"""
Voice WebSocket API
Bidirectional voice communication with LangGraph agent
"""
import asyncio
import json
import base64
import logging
import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage

from app.services.elevenlabs_service import elevenlabs_service
from app.services.voice_session_manager import register_session, unregister_session
from app.agent.graph import agent_graph

router = APIRouter()
logger = logging.getLogger(__name__)


class VoiceSession:
    """
    Manages a single voice conversation session
    """
    def __init__(self, websocket: WebSocket, thread_id: str, voice_id: str = None):
        self.websocket = websocket
        self.thread_id = thread_id
        self.voice_id = voice_id  # Voice ID from frontend (e.g. "nova", "shimmer")
        self.stt = None
        self.current_tts = None  # Track active TTS connection for immediate interruption
        self.tts_task = None  # Track ongoing TTS task for interruption
        self.is_speaking = False
        self.current_transcript = ""
        self.stt_sender_task = None  # Task for sending audio to STT
        self.stt_receiver_task = None  # Task for receiving transcripts from STT
        self.stt_audio_queue = asyncio.Queue()  # Queue for audio chunks to send
        self.stt_connected = False  # Track if STT connection is active

    async def start(self):
        """Initialize voice session (STT connects lazily on first audio)"""
        try:
            logger.info(f"🔌 Starting voice session: {self.thread_id} (voice_id={self.voice_id})")
            # STT forwarder is started lazily in handle_audio_input
            # TTS is created on-demand in speak_response
            logger.info(f"✅ Voice session started: {self.thread_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to start voice session: {e}", exc_info=True)
            return False

    async def handle_audio_input(self, audio_base64: str):
        """Handle incoming audio from user"""
        try:
            # INTERRUPT: If agent is speaking, stop immediately
            if self.is_speaking and self.tts_task and not self.tts_task.done():
                logger.info("🛑 User interrupted - cancelling TTS")

                # Close TTS connection IMMEDIATELY to stop audio stream
                if self.current_tts:
                    try:
                        await self.current_tts.close()
                        logger.info("✅ TTS connection closed immediately")
                    except Exception as close_err:
                        logger.warning(f"Error closing TTS: {close_err}")
                    self.current_tts = None

                # Cancel the task
                self.tts_task.cancel()
                try:
                    await self.tts_task
                except asyncio.CancelledError:
                    pass

                self.is_speaking = False

                # Notify frontend speech was interrupted
                await self.send_message({
                    "type": "agent_speaking",
                    "is_speaking": False
                })

            # Lazily start STT forwarder on first audio chunk
            if not self.stt_sender_task or self.stt_sender_task.done():
                logger.info("🔌 First audio chunk received — starting STT forwarder")
                self.stt_sender_task = asyncio.create_task(self._stt_forwarder())
                # Wait briefly for STT to connect before queuing
                for _ in range(30):  # up to 3 seconds
                    if self.stt_connected:
                        break
                    await asyncio.sleep(0.1)

            # Always queue audio — the forwarder will pick it up
            await self.stt_audio_queue.put(("audio", audio_base64))
            logger.info(f"📥 Queued audio chunk: {len(audio_base64)} base64 chars (stt_connected={self.stt_connected})")

        except Exception as e:
            logger.error(f"❌ Error processing audio input: {e}", exc_info=True)
            await self.send_error(f"Failed to process audio: {str(e)}")

    async def commit_audio(self):
        """Finalize current audio segment and get transcription"""
        try:
            logger.info("🛑 Committing audio...")
            
            if self.stt_connected:
                await self.stt_audio_queue.put(("commit", None))
                logger.info("✅ Commit queued for STT")
            else:
                logger.warning("⚠️ STT not connected, cannot commit audio")

        except Exception as e:
            logger.error(f"❌ Error committing audio: {e}", exc_info=True)

    async def _stt_forwarder(self):
        """
        One STT connection per session - handles both sending audio and receiving transcripts.
        Automatically reconnects if the STT WebSocket closes unexpectedly.
        """
        max_retries = 5
        retry_delay = 2.0

        for attempt in range(1, max_retries + 1):
            stt_ws = None
            sender_task = None
            receiver_task = None

            try:
                logger.info(f"🔌 [Session {self.thread_id}] Opening STT WebSocket (attempt {attempt}/{max_retries})...")

                # Create STT instance and connect
                self.stt = elevenlabs_service.create_stt()
                success = await self.stt.connect(sample_rate=16000, codec="pcm")

                if not success:
                    logger.error(f"❌ [Session {self.thread_id}] Failed to connect to STT")
                    if attempt < max_retries:
                        await asyncio.sleep(retry_delay)
                    continue

                stt_ws = self.stt.websocket
                self.stt_connected = True
                logger.info(f"✅ [Session {self.thread_id}] STT WebSocket connected")

                # Drain any audio chunks that arrived while reconnecting
                # (they're stale — the STT session doesn't know about them)
                drained = 0
                while not self.stt_audio_queue.empty():
                    try:
                        self.stt_audio_queue.get_nowait()
                        drained += 1
                    except asyncio.QueueEmpty:
                        break
                if drained:
                    logger.info(f"🗑️ Drained {drained} stale audio chunks from queue")

                # Start sender and receiver tasks
                sender_task = asyncio.create_task(self._forward_audio_to_stt(stt_ws))
                receiver_task = asyncio.create_task(self._read_transcripts_from_stt(stt_ws))

                # Wait for EITHER task to complete (normal close or error)
                done, pending = await asyncio.wait(
                    {sender_task, receiver_task},
                    return_when=asyncio.FIRST_COMPLETED
                )

                # Mark STT as disconnected immediately so audio stops being queued
                self.stt_connected = False

                # Cancel pending tasks
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass

                # Log what happened
                for task in done:
                    if task.exception():
                        logger.error(f"❌ Task {task.get_name()} failed: {task.exception()}")
                    else:
                        logger.info(f"✅ Task {task.get_name()} completed normally")

                # Close the stale WebSocket
                if stt_ws:
                    try:
                        await stt_ws.close()
                    except:
                        pass

                # Retry unless the session itself is being torn down
                if attempt < max_retries:
                    logger.info(f"🔄 [Session {self.thread_id}] STT closed, reconnecting in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)

            except asyncio.CancelledError:
                # Session is being closed — don't retry
                self.stt_connected = False
                if stt_ws:
                    try:
                        await stt_ws.close()
                    except:
                        pass
                logger.info(f"🛑 [Session {self.thread_id}] STT forwarder cancelled")
                raise
            except Exception as e:
                self.stt_connected = False
                logger.error(f"❌ STT forwarder error: {e}", exc_info=True)
                if stt_ws:
                    try:
                        await stt_ws.close()
                    except:
                        pass
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay)

        self.stt_connected = False
        logger.info(f"🛑 [Session {self.thread_id}] STT forwarder stopped after {max_retries} attempts")
    
    async def _forward_audio_to_stt(self, stt_ws):
        """Forward audio chunks from queue to STT WebSocket"""
        try:
            logger.info("📤 Audio forwarder started")
            
            while self.stt_connected:
                try:
                    # Get audio chunk or commit signal from queue (with timeout)
                    item_type, audio_base64 = await asyncio.wait_for(
                        self.stt_audio_queue.get(),
                        timeout=1.0
                    )
                    
                    if item_type == "audio":
                        # Send audio chunk as JSON (ElevenLabs expects input_audio_chunk format)
                        try:
                            audio_message = {
                                "message_type": "input_audio_chunk",
                                "audio_base_64": audio_base64,
                                "sample_rate": 16000
                            }
                            await stt_ws.send(json.dumps(audio_message))
                            logger.info(f"📤 Sent audio chunk to ElevenLabs STT ({len(audio_base64)} base64 chars)")
                        except websockets.exceptions.ConnectionClosedOK as e:
                            logger.info(f"✅ STT session ended normally: {e.code}")
                            # Don't reconnect on normal closure
                            break
                        except websockets.exceptions.ConnectionClosed as e:
                            # Abnormal closure - log but don't reconnect automatically
                            logger.warning(f"⚠️ STT connection closed abnormally: {e.code} - {e.reason}")
                            if e.code >= 1011:  # Only reconnect on server errors
                                logger.info("🔄 Will attempt reconnection on next audio chunk")
                            break
                        except Exception as e:
                            logger.error(f"❌ Error sending audio: {e}", exc_info=True)
                            break
                            
                    elif item_type == "commit":
                        # Send commit as an input_audio_chunk with commit=true
                        try:
                            commit_message = {
                                "message_type": "input_audio_chunk",
                                "audio_base_64": "",
                                "commit": True,
                                "sample_rate": 16000
                            }
                            await stt_ws.send(json.dumps(commit_message))
                            logger.info("📤 Sent commit message to STT")
                        except websockets.exceptions.ConnectionClosedOK as e:
                            logger.info(f"✅ STT session ended normally: {e.code}")
                            break
                        except Exception as e:
                            logger.error(f"❌ Error sending commit: {e}", exc_info=True)
                            break
                            
                except asyncio.TimeoutError:
                    # Timeout is fine, just continue
                    continue
                    
        except asyncio.CancelledError:
            logger.info("🛑 Audio forwarder cancelled")
            raise
        except Exception as e:
            logger.error(f"❌ Audio forwarder error: {e}", exc_info=True)
    
    async def _read_transcripts_from_stt(self, stt_ws):
        """Read transcripts from STT WebSocket"""
        try:
            logger.info("👂 Transcript receiver started")
            
            async for message in stt_ws:
                # Handle binary messages (shouldn't happen for STT)
                if isinstance(message, bytes):
                    logger.debug(f"📨 Received binary message: {len(message)} bytes")
                    continue
                
                # Parse JSON message
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    logger.warning(f"⚠️ Failed to parse STT message: {message[:100]}")
                    continue
                
                logger.info(f"📨 STT received: {data}")
                msg_type = data.get("message_type")
                
                if msg_type == "session_started":
                    session_id = data.get('session_id', 'unknown')
                    logger.info(f"✅ STT session started: {session_id}")
                    if self.stt:
                        self.stt.session_ready = True
                    continue
                    
                elif msg_type == "partial_transcript":
                    text = data.get("text", "")
                    logger.info(f"🗣️ Partial transcript: {text}")
                    await self.send_message({
                        "type": "partial_transcript",
                        "text": text
                    })
                    
                elif msg_type == "committed_transcript":
                    text = data.get("text", "")
                    logger.info(f"✅ Final transcript: {text}")
                    await self.send_message({
                        "type": "final_transcript",
                        "text": text
                    })
                    
                    # Process with agent
                    if text.strip():
                        await self.process_with_agent(text)
                        
                elif msg_type in ("input_error", "error"):
                    error_msg = data.get("error", data.get("message", "STT error"))
                    logger.error(f"❌ STT error: {error_msg}")
                    await self.send_error(error_msg)
                    
                elif msg_type == "session_terminated":
                    logger.info("🛑 STT session terminated")
                    break
                    
        except websockets.exceptions.ConnectionClosedOK as e:
            logger.info(f"✅ STT receiver: connection closed normally (code={e.code}, reason={e.reason!r})")
        except websockets.exceptions.ConnectionClosed as e:
            logger.warning(f"⚠️ STT receiver: connection closed (code={e.code}, reason={e.reason!r})")
        except asyncio.CancelledError:
            logger.info("🛑 Transcript receiver cancelled")
            raise
        except Exception as e:
            logger.error(f"❌ Transcript receiver error: {e}", exc_info=True)
        else:
            logger.info("👂 STT receiver: async for loop ended (WebSocket closed cleanly)")

    async def process_with_agent(self, user_text: str):
        """Send text to LangGraph agent and get response"""
        try:
            logger.info(f"🤖 Processing with agent: {user_text}")

            # Check if agent_graph is available
            try:
                from app.agent.graph import agent_graph
            except ImportError:
                logger.error("❌ Agent graph not available - langgraph not installed")
                agent_response_text = "I'm sorry, the AI agent is not available. Please install langgraph to enable voice responses."
                await self.send_message({
                    "type": "agent_text",
                    "text": agent_response_text
                })
                if agent_response_text:
                    self.tts_task = asyncio.create_task(self.speak_response(agent_response_text))
                    try:
                        await self.tts_task
                    except asyncio.CancelledError:
                        logger.info("TTS task was cancelled")
                return

            # Notify frontend agent is thinking
            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": True
            })

            # Create human message
            config = {"configurable": {"thread_id": self.thread_id}}
            messages = [HumanMessage(content=user_text)]

            # Stream agent response
            agent_response_text = ""
            logger.info(f"📤 Sending to agent_graph.astream...")
            async for event in agent_graph.astream(
                {"messages": messages},
                config=config,
                stream_mode="values"
            ):
                logger.debug(f"📥 Agent event received: {type(event)}")
                if "messages" in event and event["messages"]:
                    last_msg = event["messages"][-1]
                    logger.debug(f"📥 Last message type: {type(last_msg)}, has content: {hasattr(last_msg, 'content')}")

                    # Get agent's text response (not tool calls)
                    if hasattr(last_msg, "content") and last_msg.content:
                        if not hasattr(last_msg, "tool_calls") or not last_msg.tool_calls:
                            agent_response_text = last_msg.content
                            logger.info(f"✅ Agent response received: {agent_response_text[:100]}...")

            logger.info(f"📝 Final agent response text length: {len(agent_response_text)}")

            # Send text response to frontend
            await self.send_message({
                "type": "agent_text",
                "text": agent_response_text
            })

            # Convert to speech (track task for interruption)
            if agent_response_text:
                logger.info(f"🔊 Starting TTS for response: {agent_response_text[:50]}...")
                self.tts_task = asyncio.create_task(self.speak_response(agent_response_text))
                try:
                    await self.tts_task
                except asyncio.CancelledError:
                    logger.info("TTS task was cancelled")
                    pass
            else:
                logger.warning("⚠️ Agent response is empty, skipping TTS")

            # Done thinking
            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": False
            })

        except Exception as e:
            logger.error(f"Error processing with agent: {e}", exc_info=True)
            await self.send_error(f"Agent error: {str(e)}")
            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": False
            })

    async def process_system_alert(self, alert_text: str, alert_context: dict):
        """Process a system alert through the agent and speak the response"""
        try:
            logger.info(f"🚨 Processing system alert via agent: {alert_text}")

            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": True
            })

            config = {"configurable": {"thread_id": self.thread_id}}
            messages = []

            # Build comprehensive SYSTEM ALERT context
            risk_score = alert_context.get('risk_score', 0)
            hype_score = alert_context.get('hype_score', 0)
            btc_price = alert_context.get('btc_price', 0)
            price_change = alert_context.get('price_change_24h', 0)

            # Determine if this is BEAR or MOON case
            is_bear = risk_score >= 80 or price_change <= -5.0
            is_moon = hype_score >= 90 or price_change >= 5.0

            context_lines = [
                f"URGENT SYSTEM ALERT:",
                f"Type: {alert_context.get('alert_type', 'ALERT')}",
                f"Risk Score: {risk_score}/100",
                f"Hype Score: {hype_score}/100",
                f"BTC Price: ${btc_price:,.2f}",
                f"24h Change: {price_change:+.2f}%",
                "",
            ]

            if is_bear:
                context_lines.append("🐻 BEAR CASE DETECTED - Price crash/high risk!")
                context_lines.append("According to your EMERGENCY PROTOCOLS, you must:")
                context_lines.append("1. SCREAM about the crash using the alert data")
                context_lines.append("2. Call list_holdings() to check BTC positions")
                context_lines.append("3. Call execute_trade() to SELL 50-80% of BTC")
                context_lines.append("4. Call lock_user_account() to prevent panic buying")
                context_lines.append("5. Explain what you did")
            elif is_moon:
                context_lines.append("🚀 MOON CASE DETECTED - Price pump/high hype!")
                context_lines.append("According to your EMERGENCY PROTOCOLS, you must:")
                context_lines.append("1. SCREAM with EXCITEMENT using the alert data")
                context_lines.append("2. Call list_holdings() to check cash balance")
                context_lines.append("3. Call execute_trade() to BUY with 10-20% of cash")
                context_lines.append("4. DO NOT lock account")
                context_lines.append("5. Explain what you did")
            else:
                context_lines.append("Market alert - assess and respond appropriately")

            context_str = "\n".join(context_lines)

            system_prompt = f"{alert_text}\n\n{context_str}\n\nTake action NOW according to your emergency protocols!"
            messages.append(SystemMessage(content=system_prompt))

            # Instead of asking for acknowledgment, trigger ACTION
            if is_bear:
                messages.append(HumanMessage(content="The market is crashing! Take protective action immediately!"))
            elif is_moon:
                messages.append(HumanMessage(content="Bitcoin is mooning! Catch this momentum NOW!"))
            else:
                messages.append(HumanMessage(content="What's happening with the market?"))

            agent_response_text = ""
            async for event in agent_graph.astream(
                {"messages": messages},
                config=config,
                stream_mode="values"
            ):
                if "messages" in event and event["messages"]:
                    last_msg = event["messages"][-1]
                    if hasattr(last_msg, "content") and last_msg.content:
                        if not hasattr(last_msg, "tool_calls") or not last_msg.tool_calls:
                            agent_response_text = last_msg.content

            if agent_response_text:
                await self.send_message({
                    "type": "agent_text",
                    "text": agent_response_text
                })
                self.tts_task = asyncio.create_task(self.speak_response(agent_response_text))
                try:
                    await self.tts_task
                except asyncio.CancelledError:
                    logger.info("TTS task was cancelled")

            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": False
            })

        except Exception as e:
            logger.error(f"Error processing system alert: {e}")
            await self.send_error(f"Agent error: {str(e)}")
            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": False
            })

    async def speak_response(self, text: str):
        """Convert agent response to speech and stream to frontend"""
        tts = None
        try:
            logger.info(f"🔊 Speaking response: {text[:50]}...")

            # Mark as speaking
            self.is_speaking = True

            # Notify frontend agent is speaking
            await self.send_message({
                "type": "agent_speaking",
                "is_speaking": True
            })

            # Create fresh TTS connection for this response (avoids timeout)
            # Note: self.voice_id from frontend uses OpenAI names ("nova", "shimmer")
            # which aren't valid ElevenLabs IDs. Use the default from .env instead.
            from app.services.elevenlabs_service import elevenlabs_service
            tts = elevenlabs_service.create_tts()
            logger.info("🔌 Connecting to TTS...")
            await tts.connect(
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_192",
                stability=0.7,  # Higher stability for cleaner audio
                similarity_boost=0.8,
                style=0.0,  # Fast/natural style
                speaking_rate=1.3  # 30% faster than default
            )
            logger.info("✅ TTS connected")

            # Track this TTS connection for immediate interruption
            self.current_tts = tts

            # Send text to TTS
            logger.info(f"📤 Sending text to TTS: {text[:100]}...")
            await tts.send_text(text, flush=False)
            await tts.finalize()
            logger.info("✅ Text sent and finalized")

            # Stream audio chunks to frontend
            chunk_count = 0
            logger.info("🎵 Starting to receive audio chunks...")
            async for audio_chunk in tts.receive_audio():
                # Check if we were interrupted
                if not self.is_speaking:
                    logger.info("🛑 TTS interrupted, stopping stream")
                    break

                chunk_count += 1
                logger.debug(f"📥 Received audio chunk #{chunk_count}: {len(audio_chunk)} bytes")

                # Encode audio as base64
                audio_base64 = base64.b64encode(audio_chunk).decode("utf-8")

                await self.send_message({
                    "type": "agent_audio",
                    "audio": audio_base64
                })
                logger.debug(f"📤 Sent audio chunk #{chunk_count} to frontend")

            logger.info(f"✅ Finished receiving {chunk_count} audio chunks")

            # Done speaking
            self.is_speaking = False
            await self.send_message({
                "type": "agent_speaking",
                "is_speaking": False
            })

            logger.info("✅ Finished speaking response")

        except asyncio.CancelledError:
            # Task was cancelled (interrupted)
            logger.info("🛑 TTS task cancelled (interrupted)")
            self.is_speaking = False
            await self.send_message({
                "type": "agent_speaking",
                "is_speaking": False
            })
            raise  # Re-raise to signal cancellation
        except Exception as e:
            logger.error(f"Error in speak_response: {e}")
            self.is_speaking = False
            await self.send_error(f"TTS error: {str(e)}")
            await self.send_message({
                "type": "agent_speaking",
                "is_speaking": False
            })
        finally:
            # Close the TTS connection
            if tts:
                await tts.close()
            self.current_tts = None
            self.is_speaking = False

    async def send_message(self, message: Dict[str, Any]):
        """Send message to frontend"""
        try:
            await self.websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending message to frontend: {e}")

    async def send_error(self, error_message: str):
        """Send error to frontend"""
        await self.send_message({
            "type": "error",
            "message": error_message
        })

    async def close(self):
        """Clean up resources"""
        logger.info(f"🧹 Cleaning up voice session: {self.thread_id}")
        
        # Mark STT as disconnected (will stop forwarder)
        self.stt_connected = False
        
        # Cancel STT forwarder task (which manages sender and receiver)
        if self.stt_sender_task and not self.stt_sender_task.done():
            logger.info(f"🛑 Cancelling STT forwarder task...")
            self.stt_sender_task.cancel()
            try:
                await self.stt_sender_task
            except asyncio.CancelledError:
                pass
        
        # Close STT connection
        if self.stt:
            try:
                logger.info(f"🔌 Closing STT connection...")
                await self.stt.close()
            except Exception as e:
                logger.warning(f"⚠️ Error closing STT: {e}")
        
        # Close active TTS connection if any
        if self.current_tts:
            try:
                logger.info(f"🔌 Closing active TTS connection...")
                await self.current_tts.close()
            except Exception as e:
                logger.warning(f"⚠️ Error closing TTS: {e}")
            self.current_tts = None

        logger.info(f"✅ Voice session closed: {self.thread_id}")


@router.websocket("/ws/voice/agent")
async def voice_agent_websocket(websocket: WebSocket):
    """
    Voice WebSocket endpoint for bidirectional voice communication

    Protocol:
    Client → Server:
        - {"type": "start", "thread_id": "session-123"}
        - {"type": "audio_chunk", "audio": "base64_encoded_audio"}
        - {"type": "audio_end"}
        - {"type": "stop"}

    Server → Client:
        - {"type": "ready"}
        - {"type": "partial_transcript", "text": "..."}
        - {"type": "final_transcript", "text": "..."}
        - {"type": "agent_thinking", "is_thinking": true}
        - {"type": "agent_text", "text": "..."}
        - {"type": "agent_speaking", "is_speaking": true}
        - {"type": "agent_audio", "audio": "base64_encoded_audio"}
        - {"type": "error", "message": "..."}
    """
    logger.info("🎙️ Voice WebSocket connection incoming...")
    await websocket.accept()
    logger.info("✅ Voice WebSocket connection accepted")

    session = None
    stt_task = None

    try:
        # Wait for start message
        data = await websocket.receive_json()

        if data.get("type") != "start":
            await websocket.send_json({
                "type": "error",
                "message": "First message must be 'start' with thread_id"
            })
            await websocket.close()
            return

        thread_id = data.get("thread_id", "default-voice-session")
        voice_id = data.get("voice")  # e.g. "nova", "shimmer", "alloy"

        # Create voice session
        session = VoiceSession(websocket, thread_id, voice_id=voice_id)
        success = await session.start()

        if not success:
            await websocket.send_json({
                "type": "error",
                "message": "Failed to initialize voice session"
            })
            await websocket.close()
            return

        # STT forwarder is started in session.start(), no need to start it here

        # Send ready signal
        await websocket.send_json({"type": "ready"})

        # Greet the user with voice
        greeting = "What can I help you with today?"
        await session.send_message({"type": "agent_text", "text": greeting})
        asyncio.create_task(session.speak_response(greeting))

        # Register session for system alerts (single-user MVP)
        register_session(session)

        # Main message loop
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "audio_chunk":
                # User is speaking - send audio to STT
                audio_base64 = data.get("audio")
                if audio_base64:
                    logger.info(f"📥 Received audio chunk from frontend: {len(audio_base64)} base64 chars")
                    await session.handle_audio_input(audio_base64)
                else:
                    logger.warning("⚠️ Received audio_chunk message but 'audio' field is missing or empty")

            elif msg_type == "audio_end":
                # User stopped speaking - commit audio for final transcription
                logger.info("🛑 Audio end received, committing...")
                await session.commit_audio()

            elif msg_type == "stop":
                # Client wants to disconnect
                logger.info("Client requested disconnect")
                break

            else:
                logger.warning(f"Unknown message type: {msg_type}")

    except WebSocketDisconnect:
        logger.info("Client disconnected")

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass

    finally:
        # Cleanup
        unregister_session(session)
        if stt_task:
            stt_task.cancel()
            try:
                await stt_task
            except asyncio.CancelledError:
                pass

        if session:
            await session.close()

        try:
            await websocket.close()
        except:
            pass

        logger.info("Voice WebSocket connection closed")

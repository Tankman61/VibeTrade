"""
ElevenLabs Voice Service
Uses WebSocket API for STT and TTS (SDK v1.12.0 compatible)
"""
import asyncio
import json
import base64
import logging
import os
from typing import Optional, AsyncGenerator
import websockets

logger = logging.getLogger(__name__)


class ElevenLabsSTT:
    """
    Speech-to-Text using ElevenLabs realtime WebSocket API
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.ws_url = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"
        self.websocket = None
        self.session_ready = False  # Track if session_started has been received

    async def connect(self, sample_rate: int = 16000, codec: str = "pcm"):
        """Connect to ElevenLabs STT WebSocket"""
        try:
            # Build URL with query parameters
            url = f"{self.ws_url}?model_id=scribe_v2_realtime&language=en"

            # Connect with API key in header
            self.websocket = await websockets.connect(
                url,
                additional_headers={"xi-api-key": self.api_key}
            )

            # Reset session ready flag
            # Don't read session_started here - let the listener task handle it
            # Reading here would consume the message and cause conflicts with the listener
            self.session_ready = False
            
            logger.info(f"✅ Connected to ElevenLabs STT WebSocket (sample_rate={sample_rate})")
            logger.info("⏳ Waiting for session_started message from listener task...")
            
            return True

        except Exception as e:
            logger.error(f"❌ Failed to connect to ElevenLabs STT: {e}", exc_info=True)
            return False

    async def send_audio(self, audio_base64: str, sample_rate: int = 16000, commit: bool = False):
        """Send audio chunk to STT"""
        if not self.websocket:
            raise RuntimeError("STT WebSocket not connected")

        try:
            # If commit is True and audio_base64 is empty, send commit message only
            if commit and not audio_base64:
                commit_message = {
                    "message_type": "input_audio_chunk",
                "audio_base_64": "",
                "commit": True,
                "sample_rate": 16000
                }
                await self.websocket.send(json.dumps(commit_message))
                logger.debug("📤 Sent commit message to STT")
                return
            
            # Send audio as JSON input_audio_chunk message
            if audio_base64:
                audio_message = {
                    "message_type": "input_audio_chunk",
                    "audio_base_64": audio_base64,
                    "sample_rate": sample_rate
                }
                await self.websocket.send(json.dumps(audio_message))
                logger.info(f"📤 Sent audio chunk to STT: {len(audio_base64)} base64 chars")
            
            # If commit is True after sending audio, send commit message
            if commit and audio_base64:
                commit_message = {
                    "message_type": "input_audio_chunk",
                "audio_base_64": "",
                "commit": True,
                "sample_rate": 16000
                }
                await self.websocket.send(json.dumps(commit_message))
                logger.debug("📤 Sent commit message to STT after audio")

        except websockets.exceptions.ConnectionClosed as e:
            logger.error(f"❌ STT connection closed during send: {e.code} - {e.reason}")
            self.websocket = None
            self.session_ready = False
            raise
        except Exception as e:
            logger.error(f"❌ Error sending audio to STT: {e}", exc_info=True)
            raise

    async def receive_transcripts(self) -> AsyncGenerator[dict, None]:
        """Receive transcription results"""
        if not self.websocket:
            raise RuntimeError("STT WebSocket not connected")

        try:
            async for message in self.websocket:
                # Handle both text (JSON) and binary messages
                if isinstance(message, bytes):
                    # Binary messages from ElevenLabs are not expected in STT
                    # If we receive binary, log it but continue
                    logger.debug(f"📨 STT received binary message: {len(message)} bytes")
                    continue
                
                # Parse JSON message
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    logger.warning(f"⚠️ Failed to parse STT message as JSON: {message[:100]}")
                    continue
                
                logger.info(f"📨 STT received: {data}")

                # Handle different transcript types (ElevenLabs uses "message_type" field)
                msg_type = data.get("message_type")

                if msg_type == "partial_transcript":
                    text = data.get("text", "")
                    logger.info(f"🗣️ Partial transcript: {text}")
                    yield {"type": "partial", "text": text}

                elif msg_type == "committed_transcript":
                    text = data.get("text", "")
                    logger.info(f"✅ Final transcript: {text}")
                    yield {"type": "final", "text": text}

                elif msg_type == "input_error" or msg_type == "error":
                    error_msg = data.get("error", data.get("message", "Unknown error"))
                    logger.error(f"❌ STT Error: {error_msg}")
                    yield {"type": "error", "message": error_msg}
                
                elif msg_type == "session_started" or msg_type == "session_begins":
                    session_id = data.get('session_id', 'unknown')
                    logger.info(f"✅ STT session started: {session_id}")
                    # Mark session as ready (in case we didn't catch it during connect)
                    self.session_ready = True
                    # Don't yield this as a transcript, just log it
                    continue
                
                elif msg_type == "session_terminated":
                    logger.info("🛑 STT session terminated")
                    break
                
                # Handle transcript messages that might have different structure
                elif "text" in data and data.get("text"):
                    text = data.get("text", "")
                    # Check if it's a final or partial transcript
                    if data.get("is_final", False) or "committed" in str(msg_type).lower():
                        logger.info(f"✅ Final transcript (alt format): {text}")
                        yield {"type": "final", "text": text}
                    else:
                        logger.info(f"🗣️ Partial transcript (alt format): {text}")
                        yield {"type": "partial", "text": text}

        except websockets.exceptions.ConnectionClosed:
            logger.info("STT WebSocket closed")
        except Exception as e:
            logger.error(f"STT receive error: {e}", exc_info=True)

    async def close(self):
        """Close STT WebSocket"""
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            logger.info("STT WebSocket closed")


class ElevenLabsTTS:
    """
    Text-to-Speech using ElevenLabs WebSocket API
    """
    def __init__(self, api_key: str, voice_id: str):
        self.api_key = api_key
        self.voice_id = voice_id
        self.websocket = None

    async def connect(
        self,
        model_id: str = "eleven_turbo_v2",
        output_format: str = "mp3_44100_128",
        stability: float = 0.7,
        similarity_boost: float = 0.8,
        style: float = 0.0,  # 0.0 = fast/natural, 1.0 = slow/exaggerated
        speaking_rate: float = 1.3  # 0.25 to 4.0, default 1.0
    ):
        """Connect to ElevenLabs TTS WebSocket"""
        try:
            # Build WebSocket URL with query params
            url = f"wss://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}/stream-input?model_id={model_id}&output_format={output_format}"

            logger.info(f"🔌 Connecting to ElevenLabs TTS: {url}")

            # Connect to WebSocket with API key in headers
            self.websocket = await websockets.connect(
                url,
                additional_headers={"xi-api-key": self.api_key}
            )

            logger.info("✅ WebSocket connected, sending initialization...")

            # Send initialization message (API key is in headers, not message body)
            init_message = {
                "text": " ",  # Required space character
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": similarity_boost,
                    "style": style,
                    "use_speaker_boost": True
                },
                "generation_config": {
                    "chunk_length_schedule": [120, 160, 250, 290]  # Smaller chunks for lower latency
                },
                "pronunciation_dictionary_locators": [],
                "model_config": {
                    "speaking_rate": speaking_rate
                }
            }
            await self.websocket.send(json.dumps(init_message))
            logger.info(f"✅ Connected to ElevenLabs TTS (voice={self.voice_id}, model={model_id}, format={output_format}, rate={speaking_rate})")
            
            # Wait for confirmation message
            try:
                response = await asyncio.wait_for(self.websocket.recv(), timeout=5.0)
                response_data = json.loads(response)
                logger.info(f"📨 TTS initialization response: {response_data}")
            except asyncio.TimeoutError:
                logger.warning("⚠️ No initialization response from TTS (continuing anyway)")
            except Exception as e:
                logger.warning(f"⚠️ Error reading TTS initialization response: {e}")

            return True

        except Exception as e:
            logger.error(f"❌ Failed to connect to ElevenLabs TTS: {e}")
            return False

    async def send_text(self, text: str, flush: bool = False):
        """Send text chunk to TTS"""
        if not self.websocket:
            raise RuntimeError("TTS WebSocket not connected")

        message = {
            "text": text,
            "try_trigger_generation": True,
            "flush": flush
        }

        await self.websocket.send(json.dumps(message))
        logger.debug(f"Sent text to TTS: {text[:50]}...")

    async def finalize(self):
        """Send final message to flush remaining audio"""
        if not self.websocket:
            return

        # Send empty text to signal end
        message = {"text": ""}
        await self.websocket.send(json.dumps(message))
        logger.debug("Finalized TTS stream")

    async def receive_audio(self) -> AsyncGenerator[bytes, None]:
        """Receive audio chunks"""
        if not self.websocket:
            raise RuntimeError("TTS WebSocket not connected")

        try:
            async for message in self.websocket:
                # Handle both JSON and binary messages
                if isinstance(message, bytes):
                    # Binary audio data (direct PCM or encoded)
                    logger.debug(f"📥 Received binary audio: {len(message)} bytes")
                    yield message
                    continue

                # Parse JSON message
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    logger.warning(f"⚠️ Failed to parse TTS message as JSON: {message[:100]}")
                    continue

                logger.debug(f"📨 TTS received: {data}")

                # Check for audio chunks (base64 encoded)
                if "audio" in data:
                    # Decode base64 audio
                    try:
                        audio_bytes = base64.b64decode(data["audio"])
                        logger.debug(f"📥 Decoded audio chunk: {len(audio_bytes)} bytes")
                        yield audio_bytes
                    except Exception as e:
                        logger.error(f"❌ Failed to decode audio: {e}")

                # Check for final message
                if data.get("isFinal") or data.get("message_type") == "stream_complete":
                    logger.info("✅ TTS stream complete")
                    break

                # Check for errors
                if data.get("message_type") == "error":
                    error_msg = data.get("error", "Unknown TTS error")
                    logger.error(f"❌ TTS error: {error_msg}")
                    break

        except websockets.exceptions.ConnectionClosed:
            logger.info("🛑 TTS WebSocket closed")
        except Exception as e:
            logger.error(f"❌ TTS receive error: {e}", exc_info=True)

    async def close(self):
        """Close TTS WebSocket"""
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            logger.info("TTS WebSocket closed")


class ElevenLabsVoiceService:
    """
    Complete voice service managing both STT and TTS
    """
    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            logger.warning("⚠️ ELEVENLABS_API_KEY not set - voice features disabled")

        # Get voice ID from environment
        self.voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

    def create_stt(self) -> ElevenLabsSTT:
        """Create STT instance"""
        if not self.api_key:
            raise RuntimeError("ElevenLabs API key not configured")
        return ElevenLabsSTT(self.api_key)

    def create_tts(self, voice_id: Optional[str] = None) -> ElevenLabsTTS:
        """Create TTS instance"""
        if not self.api_key:
            raise RuntimeError("ElevenLabs API key not configured")
        return ElevenLabsTTS(self.api_key, voice_id or self.voice_id)


# Global service instance
elevenlabs_service = ElevenLabsVoiceService()
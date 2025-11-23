"use client";

import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";

interface UseVoiceAgentOptions {
  onTranscript?: (text: string) => void;
  onAgentResponse?: (text: string) => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

interface UseVoiceAgentReturn {
  isConnected: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  transcript: string;
  agentResponse: string;
  error: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

// Singleton state to prevent multiple connections
let globalWs: WebSocket | null = null;
let globalIsConnected = false;
let connectionCount = 0;
let globalConnecting = false;
let globalPrewarmed = false;

// Global message history
let globalTranscript = "";
let globalAgentResponse = "";

// Global recording state (for auto-stop on final transcript)
let globalProcessorRef: ScriptProcessorNode | null = null;
let globalStreamRef: MediaStream | null = null;
let globalIsRecording = false;

// Subscriber callbacks for broadcasting state changes
type StateUpdateCallback = {
  onTranscriptUpdate: (text: string) => void;
  onAgentResponseUpdate: (text: string) => void;
  onConnectedUpdate: (connected: boolean) => void;
  onSpeakingUpdate: (speaking: boolean) => void;
  onThinkingUpdate: (thinking: boolean) => void;
  onRecordingUpdate: (recording: boolean) => void;
};
const subscribers: StateUpdateCallback[] = [];

export function useVoiceAgent(options: UseVoiceAgentOptions = {}): UseVoiceAgentReturn {
  const [isConnected, setIsConnected] = useState(globalIsConnected);
  const [isRecording, setIsRecording] = useState(globalIsRecording);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState<string>(globalTranscript);
  const [agentResponse, setAgentResponse] = useState<string>(globalAgentResponse);
  const [error, setError] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const optionsRef = useRef(options);
  const resolveVoiceWsUrl = () => {
    const explicit = process.env.NEXT_PUBLIC_VOICE_WS_URL;
    if (explicit) return explicit.endsWith("/ws/voice/agent") ? explicit : `${explicit}/ws/voice/agent`;

    const legacy = process.env.NEXT_PUBLIC_WS_URL;
    if (legacy) return legacy.endsWith("/ws/voice/agent") ? legacy : `${legacy}/ws/voice/agent`;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      try {
        const url = new URL(apiUrl);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.pathname = "/ws/voice/agent";
        return url.toString();
      } catch {
        // ignore invalid
      }
    }

    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/ws/voice/agent`;
    }
    return null;
  };

  // Keep options ref up to date
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Subscribe to global state updates
  useEffect(() => {
    const callback: StateUpdateCallback = {
      onTranscriptUpdate: (text) => {
        setTranscript(text);
        optionsRef.current.onTranscript?.(text);
      },
      onAgentResponseUpdate: (text) => {
        setAgentResponse(text);
        optionsRef.current.onAgentResponse?.(text);
      },
      onConnectedUpdate: setIsConnected,
      onSpeakingUpdate: setIsSpeaking,
      onThinkingUpdate: setIsThinking,
      onRecordingUpdate: setIsRecording,
    };

    subscribers.push(callback);

    return () => {
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  }, []);

  // Optional auto-connect on mount
  useEffect(() => {
    if (options.autoConnect) {
      connect();
      return () => {
        disconnect();
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prewarm mic/audio context on first user gesture to avoid initial getUserMedia lag
  useEffect(() => {
    const prewarmMic = async () => {
      if (globalPrewarmed) return;
      try {
        // If permission is explicitly denied, skip
        if (navigator.permissions) {
          try {
            const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
            if (status.state === "denied") return;
          } catch {
            // ignore permission query failures
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          }
        });

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        }
        await audioContextRef.current.resume();

        // Stop immediately; this was just to warm up permissions/devices
        stream.getTracks().forEach(track => track.stop());
        globalPrewarmed = true;
        console.log("✅ Mic prewarmed");
      } catch (err) {
        console.warn("Mic prewarm skipped:", err);
      }
    };

    const handler = () => {
      prewarmMic();
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };

    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  // Get or create persistent thread_id (per tab to avoid stale tool-call history)
  const getThreadId = () => {
    if (typeof window === 'undefined') return `voice-session-${Date.now()}`;
    try {
      const storage = window.sessionStorage;
      let threadId = storage.getItem('voice_thread_id');
      if (!threadId) {
        threadId = `voice-session-${Date.now()}`;
        storage.setItem('voice_thread_id', threadId);
      }
      return threadId;
    } catch {
      return `voice-session-${Date.now()}`;
    }
  };
  const refreshThreadId = () => {
    const newId = `voice-session-${Date.now()}`;
    try {
      const storage = window.sessionStorage;
      storage.setItem('voice_thread_id', newId);
    } catch {
      // ignore
    }
    threadIdRef.current = newId;
    return newId;
  };
  const threadIdRef = useRef<string>(getThreadId());

  const stopCapturingAudio = (sendAudioEnd: boolean) => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (globalProcessorRef) {
      try {
        globalProcessorRef.disconnect();
      } catch {
        // ignore
      }
      globalProcessorRef = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (globalStreamRef) {
      globalStreamRef.getTracks().forEach(track => track.stop());
      globalStreamRef = null;
    }

    globalIsRecording = false;
    subscribers.forEach(sub => sub.onRecordingUpdate(false));
    setIsRecording(false);

    if (sendAudioEnd && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "audio_end" }));
    }
  };

  const ensureVoiceServiceReachable = async (wsUrl: string): Promise<boolean> => {
    // Lightweight check; never block connection attempt
    try {
      const parsed = new URL(wsUrl);
      const protocol = parsed.protocol === "wss:" ? "https:" : "http:";
      const healthUrl = `${protocol}//${parsed.host}/health`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 500);
      const res = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  };

  // Connect to voice WebSocket
  const connect = async () => {
    connectionCount++;

    // Use existing global connection
    if (globalWs?.readyState === WebSocket.OPEN || globalWs?.readyState === WebSocket.CONNECTING) {
      console.log(`⚠️ Reusing existing WebSocket connection (${connectionCount} consumers)`);
      wsRef.current = globalWs;
      setIsConnected(true);
      return;
    }
    if (globalConnecting) {
      console.log("⚠️ WebSocket is already connecting, skipping duplicate connect");
      return;
    }

    const wsUrl = resolveVoiceWsUrl();
    if (!wsUrl) {
      const errorMsg = "Voice WebSocket URL not configured";
      setError(errorMsg);
      options.onError?.(errorMsg);
      return;
    }

    // Lightweight reachability check in background; don't block connection
    ensureVoiceServiceReachable(wsUrl).then((reachable) => {
      if (!reachable) {
        const warnMsg = `Voice service health check failed at ${wsUrl} (continuing connect).`;
        console.warn(warnMsg);
      }
    }).catch(() => {
      // ignore health check failures
    });

    globalConnecting = true;
    try {
      const threadId = refreshThreadId();
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("✅ Connected to voice WebSocket");
        globalIsConnected = true;
        setIsConnected(true);

        // Send start message with persistent thread_id
        ws.send(JSON.stringify({
          type: "start",
          thread_id: threadId
        }));
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error (${wsUrl}):`, error);
        const errorMsg = `Voice service unreachable (${wsUrl}).`;
        setError(errorMsg);
        options.onError?.(errorMsg);
        toast.error(errorMsg);
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        globalIsConnected = false;
        globalWs = null;
        setIsConnected(false);
        wsRef.current = null;
      };

      globalWs = ws;
      wsRef.current = ws;
    } catch (err) {
      console.error("Failed to connect:", err);
      const errorMsg = "Failed to connect to voice service";
      setError(errorMsg);
      options.onError?.(errorMsg);
    } finally {
      globalConnecting = false;
    }
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = async (data: any) => {
    console.log("📨 Received:", data);

    switch (data.type) {
      case "ready":
        globalIsConnected = true;
        // Reset any stale playback/queues on fresh ready
        audioQueueRef.current = [];
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        isPlayingRef.current = false;
        // Broadcast to all subscribers
        subscribers.forEach(sub => sub.onConnectedUpdate(true));
        setError("");
        break;

      case "partial_transcript":
        globalTranscript = data.text;
        // Broadcast to all subscribers (they handle calling options callbacks)
        subscribers.forEach(sub => sub.onTranscriptUpdate(data.text));
        break;

      case "final_transcript":
        globalTranscript = data.text;
        // Broadcast to all subscribers (they handle calling options callbacks)
        subscribers.forEach(sub => sub.onTranscriptUpdate(data.text));

        // AUTO-STOP RECORDING: Stop sending audio chunks so agent can speak without interruption
        stopCapturingAudio(true);
        break;

      case "agent_thinking":
        // Broadcast to all subscribers
        subscribers.forEach(sub => sub.onThinkingUpdate(data.is_thinking));
        break;

      case "agent_text":
        globalAgentResponse = data.text;
        // Broadcast to all subscribers (they handle calling options callbacks)
        subscribers.forEach(sub => sub.onAgentResponseUpdate(data.text));
        break;

      case "agent_speaking":
        // Broadcast to all subscribers
        subscribers.forEach(sub => sub.onSpeakingUpdate(data.is_speaking));
        // Clear audio queue when agent starts speaking fresh
        if (data.is_speaking) {
          audioQueueRef.current = [];
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
          }
          isPlayingRef.current = false;
        }
        break;

      case "agent_audio":
        // Decode and play audio
        await playAudio(data.audio);
        break;

      case "error":
        setError(data.message);
        options.onError?.(data.message);
        break;
    }
  };

  // Convert Float32Array to 16-bit PCM
  const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  };

  // Start recording with Web Audio API (raw PCM)
  const startRecording = async () => {
    try {
      if (globalIsRecording) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      streamRef.current = stream;
      globalStreamRef = stream;

      // Create audio context for processing
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      }
      // Ensure the context is running before wiring nodes (avoids initial silence)
      await audioContextRef.current.resume();

      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Use ScriptProcessorNode to capture raw audio samples
      const bufferSize = 1024; // smaller buffer for lower latency on first words
      const processor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);

          // Convert Float32 to 16-bit PCM
          const pcmData = floatTo16BitPCM(inputData);

          // Convert to base64
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(pcmData))
          );

          // Send to backend only while actively recording
          if (globalIsRecording) {
            wsRef.current.send(JSON.stringify({
              type: "audio_chunk",
              audio: base64
            }));
          }
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processorRef.current = processor;
      globalProcessorRef = processor;
      globalIsRecording = true;
      setIsRecording(true);
      setTranscript("");

      console.log("🎤 Started recording with PCM audio capture");

    } catch (err) {
      console.error("Failed to start recording:", err);
      const errorMsg = "Microphone access denied";
      setError(errorMsg);
      options.onError?.(errorMsg);
    }
  };

  // Stop recording
  const stopRecording = () => {
    stopCapturingAudio(true);
    console.log("🛑 Stopped recording");
  };

  // Play audio from base64 using HTMLAudioElement (more reliable for MP3)
  const playAudio = async (base64Audio: string) => {
    try {
      // Add to queue
      audioQueueRef.current.push(base64Audio);

      // Start playing if not already playing
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    } catch (err) {
      console.error("Error queueing audio:", err);
    }
  };

  const playNextAudio = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const base64Audio = audioQueueRef.current.shift()!;

    try {
      // Create blob URL from base64
      const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      // Create and play audio element
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        playNextAudio();
      };

      audio.onerror = (event) => {
        console.warn("Audio element error, skipping chunk");
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        playNextAudio();
      };

      audio.play().catch(err => {
        console.warn("Audio play failed, skipping chunk:", err.message);
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        playNextAudio();
      });
    } catch (err) {
      console.warn("Audio decode error, skipping chunk:", err);
      playNextAudio();
    }
  };

  // Disconnect
  const disconnect = () => {
    connectionCount = Math.max(0, connectionCount - 1);

    if (isRecording || globalIsRecording) {
      stopCapturingAudio(true);
    }

    setIsConnected(false);
    wsRef.current = null;

    // Only close the global connection if no more consumers
    if (connectionCount === 0 && globalWs) {
      console.log("🔌 Closing global WebSocket (no more consumers)");
      if (globalWs.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({ type: "stop" }));
      }
      globalWs.close();
      globalWs = null;
      globalIsConnected = false;
    } else if (connectionCount > 0) {
      console.log(`⚠️ Keeping WebSocket open (${connectionCount} consumers remaining)`);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    isRecording,
    isSpeaking,
    isThinking,
    transcript,
    agentResponse,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  };
}

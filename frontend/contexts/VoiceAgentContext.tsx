"use client";

import { createContext, useContext, ReactNode } from "react";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";

interface VoiceAgentContextType {
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
  messages: Array<{ role: "agent" | "user", text: string, time: string }>;
}

const VoiceAgentContext = createContext<VoiceAgentContextType | null>(null);

export function VoiceAgentProvider({ children }: { children: ReactNode }) {
  const voiceAgent = useVoiceAgent({
    onTranscript: (text) => {
      // Handled by individual components via the hook's internal state
    },
    onAgentResponse: (text) => {
      // Handled by individual components via the hook's internal state
    },
    onError: (error) => {
      console.error("Voice agent error:", error);
    }
  });

  return (
    <VoiceAgentContext.Provider value={{ ...voiceAgent, messages: [] }}>
      {children}
    </VoiceAgentContext.Provider>
  );
}

export function useVoiceAgentContext() {
  const context = useContext(VoiceAgentContext);
  if (!context) {
    throw new Error("useVoiceAgentContext must be used within VoiceAgentProvider");
  }
  return context;
}

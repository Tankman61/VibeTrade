"use client";

import { Flex, Text, Button } from "@radix-ui/themes";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "agent" | "user";
  text: string;
  time: string;
}

interface AgentChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
}

export default function AgentChatModal({
  isOpen,
  onClose,
  messages
}: AgentChatModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            onClick={onClose}
          >
            <div
              className="relative w-full max-w-2xl h-[600px] overflow-hidden rounded-lg shadow-2xl border"
              style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gradient Overlay */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.03), transparent, rgba(139, 92, 246, 0.03))' }}></div>

              <div className="relative h-full flex flex-col">
                {/* Header */}
                <div className="p-4 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                  <Flex justify="between" align="center">
                    <div>
                      <Text size="4" weight="bold" style={{ color: 'var(--slate-12)' }}>Chat Transcript</Text>
                    </div>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                      style={{ color: 'var(--slate-11)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--slate-4)';
                        e.currentTarget.style.color = 'var(--slate-12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--slate-11)';
                      }}
                      onClick={onClose}
                    >
                      <Text size="4">✕</Text>
                    </button>
                  </Flex>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] ${msg.role === 'agent' ? 'order-2' : ''}`}>
                        <Flex gap="2" className={msg.role === 'user' ? 'flex-row-reverse' : ''}>
                          {msg.role === 'agent' && (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--red-9), var(--red-10))' }}>
                              🎯
                            </div>
                          )}
                          <div className="flex flex-col gap-1">
                            <div
                              className="px-4 py-2 rounded-lg"
                              style={{
                                background: msg.role === 'agent' ? 'var(--slate-3)' : 'var(--red-9)',
                                color: msg.role === 'agent' ? 'var(--slate-12)' : 'white'
                              }}
                            >
                              <Text size="2">{msg.text}</Text>
                            </div>
                            <Text size="1" className={msg.role === 'user' ? 'text-right' : ''} style={{ color: 'var(--slate-11)' }}>
                              {msg.time}
                            </Text>
                          </div>
                        </Flex>
                      </div>
                    </div>
                  ))}
                </div>


              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useState } from "react";
import { useAlpacaWebSocket } from "@/hooks/useAlpacaWebSocket";
import type { AlpacaMessage } from "@/lib/websocket";

export default function TestWebSocket() {
  const [messages, setMessages] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [symbols, setSymbols] = useState<string[]>([]);

  const handleMessage = (message: AlpacaMessage) => {
    const timestamp = new Date().toLocaleTimeString();
    
    if (message.type === "connected") {
      setIsConnected(true);
      setMessages(prev => [...prev, `[${timestamp}] ✅ ${message.message}`]);
    } else if (message.type === "subscribed") {
      setMessages(prev => [...prev, `[${timestamp}] 📊 Subscribed to: ${message.symbols.join(', ')}`]);
    } else if (message.type === "bar") {
      setMessages(prev => [...prev, `[${timestamp}] 📈 BAR: ${message.data.symbol} @ $${message.data.close.toFixed(2)}`]);
    } else if (message.type === "trade") {
      setMessages(prev => [...prev, `[${timestamp}] 💱 TRADE: ${message.data.symbol} @ $${message.data.price.toFixed(2)}`]);
    } else if (message.type === "error") {
      setMessages(prev => [...prev, `[${timestamp}] ❌ ERROR: ${message.message}`]);
    }
  };

  const cryptoWS = useAlpacaWebSocket({
    symbols: symbols,
    dataType: "crypto",
    onMessage: handleMessage,
    autoConnect: false,
  });

  const stocksWS = useAlpacaWebSocket({
    symbols: symbols,
    dataType: "stocks",
    onMessage: handleMessage,
    autoConnect: false,
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Alpaca WebSocket Test Page</h1>
      
      {/* Connection Controls */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
        <div className="flex gap-4 mb-4">
          <div className={`px-4 py-2 rounded ${isConnected ? 'bg-green-600' : 'bg-gray-600'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={() => {
              setSymbols(['BTC', 'ETH', 'SOL']);
              cryptoWS.subscribe(['BTC', 'ETH', 'SOL']);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Connect & Subscribe Crypto
          </button>
          
          <button
            onClick={() => {
              setSymbols(['AAPL', 'GOOGL', 'TSLA']);
              stocksWS.subscribe(['AAPL', 'GOOGL', 'TSLA']);
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
          >
            Connect & Subscribe Stocks
          </button>
          
          <button
            onClick={() => {
              cryptoWS.disconnect();
              stocksWS.disconnect();
              setIsConnected(false);
              setMessages([]);
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            Disconnect All
          </button>
          
          <button
            onClick={() => setMessages([])}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
          >
            Clear Log
          </button>
        </div>
      </div>

      {/* Message Log */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Message Log</h2>
        <div className="bg-black rounded p-4 h-96 overflow-y-auto font-mono text-sm">
          {messages.length === 0 ? (
            <div className="text-gray-500">No messages yet. Click a connect button above...</div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className="mb-1">{msg}</div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Instructions</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Make sure the backend is running: <code className="bg-gray-700 px-2 py-1 rounded">cd backend-new && python3 run.py</code></li>
          <li>Click "Connect & Subscribe Crypto" or "Connect & Subscribe Stocks"</li>
          <li>Watch live data stream in the message log above</li>
          <li>Check the browser console for additional debug info</li>
        </ol>
      </div>
    </div>
  );
}

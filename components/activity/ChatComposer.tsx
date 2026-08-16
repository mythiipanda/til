'use client';

import { useState, useRef, useEffect } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { ArrowUp } from 'lucide-react';

export function ChatComposer() {
  const [input, setInput] = useState('');
  const currentTopic = useMindMapStore(s => s.currentTopic);
  const chatMessages = useMindMapStore(s => s.chatMessages);
  const isChatStreaming = useMindMapStore(s => s.isChatStreaming);
  const sendChat = useMindMapStore(s => s.sendChat);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Don't show if there's no topic context
  if (!currentTopic) return null;

  const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    sendChat(q);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[520px] max-w-[90vw] z-20 flex flex-col gap-2">

      {/* Streaming response */}
      {lastAssistant && lastAssistant.content && (
        <div className="bg-[#111827]/95 backdrop-blur-xl border border-[#1e293b] rounded-2xl p-4 shadow-xl slide-up max-h-[200px] overflow-y-auto">
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#06b6d4] font-medium mb-2">
            TDILEARNED
          </div>
          <p className="text-[13px] text-[#e2e8f0] leading-relaxed">
            {lastAssistant.content}
            {isChatStreaming && (
              <span
                className="inline-block w-[2px] h-[14px] bg-[#06b6d4] ml-0.5 align-middle"
                style={{ animation: 'cursor-blink 1s step-end infinite' }}
              />
            )}
          </p>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="bg-[#111827] border border-[#1e293b] rounded-2xl shadow-2xl flex items-center p-1 hover:border-[#334155] transition-colors focus-within:border-[#334155]"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Ask about ${currentTopic}...`}
          className="flex-1 bg-transparent outline-none text-[13px] text-[#e2e8f0] placeholder-[#475569] px-4 py-3"
        />
        <button
          type="submit"
          disabled={!input.trim() || isChatStreaming}
          className="mr-1 p-2 bg-[#0a0e17] hover:bg-[#1e293b] text-[#e2e8f0] disabled:text-[#334155] rounded-xl transition-colors disabled:hover:bg-[#0a0e17]"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

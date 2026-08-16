'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { CornerDownLeft } from 'lucide-react';

export function ChatComposer() {
  const [input, setInput] = useState('');
  const currentTopic = useMindMapStore(s => s.currentTopic);
  const chatMessages = useMindMapStore(s => s.chatMessages);
  const isChatStreaming = useMindMapStore(s => s.isChatStreaming);
  const sendChat = useMindMapStore(s => s.sendChat);

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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[640px] max-w-[92vw] z-20 flex flex-col gap-2 select-none animate-drop">

      {/* Streaming Assistant Response Preview */}
      {lastAssistant && lastAssistant.content && (
        <div className="bg-black text-white border-2 border-black p-4 shadow-none max-h-[220px] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-1 mb-2 font-mono text-[9px] uppercase tracking-widest text-neutral-400">
            <span>SYNTHESIZED INQUIRY RESPONSE</span>
            <span>{isChatStreaming ? 'STREAMING...' : 'CITATIONS GROUNDED'}</span>
          </div>
          <p className="font-body text-sm text-neutral-100 leading-relaxed">
            {lastAssistant.content}
            {isChatStreaming && (
              <span className="inline-block w-1.5 h-3.5 bg-white ml-1 align-middle animate-pulse-block" />
            )}
          </p>
        </div>
      )}

      {/* Question Form Bar */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border-2 border-black flex items-center shadow-none focus-within:border-4"
      >
        <div className="px-3 font-mono text-[10px] uppercase tracking-wider text-neutral-500 border-r border-black hidden sm:block shrink-0">
          Q&A CONTEXT
        </div>

        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Inquire further regarding "${currentTopic}"...`}
          className="flex-1 bg-transparent outline-none font-body text-sm text-black placeholder:text-neutral-400 placeholder:italic px-4 py-3"
        />

        <button
          type="submit"
          disabled={!input.trim() || isChatStreaming}
          className="px-4 py-3 bg-black text-white font-mono text-xs uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-30 transition-colors flex items-center gap-1 shrink-0"
        >
          <span>Ask</span>
          <CornerDownLeft className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
}

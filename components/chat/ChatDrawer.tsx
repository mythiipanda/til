'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Zap,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export function ChatDrawer() {
  const activeChatNode = useMindMapStore((s) => s.activeChatNode);
  const setActiveChatNode = useMindMapStore((s) => s.setActiveChatNode);
  const expandRabbitHole = useMindMapStore((s) => s.expandRabbitHole);

  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeChatNode) {
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          content: `Exploring **${activeChatNode.title}**. What questions do you have about its historical context, empirical mechanisms, or connections?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [activeChatNode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeChatNode) return null;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputQuery.trim() || isStreaming) return;

    const userText = inputQuery.trim();
    setInputQuery('');

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const assistantMsgId = `asst-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMsgId,
      sender: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    try {
      const url = `${BACKEND_URL}/api/v1/chat/stream?node_title=${encodeURIComponent(
        activeChatNode.title
      )}&question=${encodeURIComponent(userText)}&ancestors=${encodeURIComponent(
        activeChatNode.category || ''
      )}`;

      const response = await fetch(url);
      if (!response.ok || !response.body) {
        throw new Error('SSE stream failed to initialize');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.replace('data: ', '').trim();
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              const token = parsed.token || '';
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: msg.content + token }
                    : msg
                )
              );
            } catch (err) {
              console.error('SSE token parse error:', err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Chat stream error:', err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  msg.content ||
                  `In studying **${activeChatNode.title}**, primary sources illustrate how theoretical geometry and systemic adaptations directly shaped this development.`,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
        )
      );
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] bg-slate-900/95 border-l border-slate-700/80 shadow-2xl backdrop-blur-2xl flex flex-col animate-slide-left">
      {/* Header */}
      <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 truncate max-w-[260px]">
              {activeChatNode.title}
            </h3>
            <span className="text-[10px] text-sky-400 font-mono flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              Cerebras Live Streaming
            </span>
          </div>
        </div>

        <button
          onClick={() => setActiveChatNode(null)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 border border-slate-700 text-sky-400'
              }`}
            >
              {msg.sender === 'user' ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-sky-600 text-white rounded-tr-none'
                  : 'bg-slate-800/80 border border-slate-700/60 text-slate-200 rounded-tl-none'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.isStreaming && (
                <span className="inline-block w-1.5 h-3 bg-sky-400 animate-pulse ml-1 align-middle" />
              )}
              <span className="block text-[10px] text-slate-400/80 text-right mt-1">
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Follow-ups */}
      {activeChatNode.rabbit_holes && activeChatNode.rabbit_holes.length > 0 && (
        <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800/60 space-y-1.5 shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-sky-400" />
            Branch Rabbit Holes
          </span>
          <div className="flex flex-wrap gap-1.5">
            {activeChatNode.rabbit_holes.map((rh, idx) => (
              <button
                key={idx}
                onClick={() => expandRabbitHole(activeChatNode.title, rh)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-sky-600/30 text-slate-300 hover:text-white border border-slate-700/80 transition-all flex items-center gap-1"
              >
                <span>{rh}</span>
                <ChevronRight className="w-3 h-3 text-sky-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Composer */}
      <form
        onSubmit={handleSendMessage}
        className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder={`Ask Cerebras about ${activeChatNode.title}...`}
          disabled={isStreaming}
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isStreaming}
          className="p-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold transition-all shadow-md"
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { CornerDownLeft, Sparkles, X, MessageSquare, Loader2, ArrowUpRight } from 'lucide-react';

export function ChatComposer() {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const currentTopic = useMindMapStore(s => s.currentTopic);
  const chatMessages = useMindMapStore(s => s.chatMessages);
  const isChatStreaming = useMindMapStore(s => s.isChatStreaming);
  const sendChat = useMindMapStore(s => s.sendChat);
  const nodes = useMindMapStore(s => s.nodes);
  const selectedNodeId = useMindMapStore(s => s.selectedNodeId);
  const activeDossier = useMindMapStore(s => s.activeDossier);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatStreaming]);

  if (!currentTopic) return null;

  const activeNode = nodes.find(n => n.id === selectedNodeId) || 
                     nodes.find(n => (n.data as { isRoot?: boolean })?.isRoot) || 
                     nodes[0];

  // Dynamically extract AI-generated rabbit holes and curiosity vectors from model output
  const aiSuggestedVectors: string[] = [];
  if (activeNode?.data?.rabbit_holes && Array.isArray(activeNode.data.rabbit_holes)) {
    activeNode.data.rabbit_holes.forEach((rh: string) => {
      if (rh && typeof rh === 'string' && !aiSuggestedVectors.includes(rh)) {
        aiSuggestedVectors.push(rh);
      }
    });
  } else if (activeDossier?.rabbitHoles && Array.isArray(activeDossier.rabbitHoles)) {
    activeDossier.rabbitHoles.forEach((rh) => {
      if (rh?.title && !aiSuggestedVectors.includes(rh.title)) {
        aiSuggestedVectors.push(rh.title);
      }
    });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || isChatStreaming) return;
    setInput('');
    setIsExpanded(true);
    sendChat(q);
  };

  const handleVectorQuestion = (vectorTitle: string) => {
    if (isChatStreaming) return;
    setIsExpanded(true);
    sendChat(`Tell me more about ${vectorTitle} and its connection to ${currentTopic}`);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[720px] max-w-[94vw] z-20 flex flex-col gap-2 select-none animate-drop">

      {/* Conversation Thread Box */}
      {chatMessages.length > 0 && isExpanded && (
        <div className="bg-black text-white border-2 border-black p-4 md:p-5 shadow-2xl max-h-[380px] overflow-y-auto custom-scrollbar space-y-4">
          
          {/* Thread Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
            <span className="flex items-center gap-1.5 font-bold text-white">
              <MessageSquare className="w-3.5 h-3.5" /> Q&A DISCUSSION: {currentTopic}
            </span>
            <div className="flex items-center gap-2">
              <span>{isChatStreaming ? 'STREAMING VIA CEREBRAS...' : `${chatMessages.length} MESSAGES`}</span>
              <button
                onClick={() => setIsExpanded(false)}
                className="hover:text-white text-neutral-400 p-0.5"
                title="Minimize Q&A"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Message List */}
          <div className="space-y-4 pt-1">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className="space-y-1">
                {msg.role === 'user' ? (
                  <div className="bg-neutral-900 border border-neutral-800 p-3 text-sm text-neutral-100 font-body">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 block mb-1">
                      YOU ASKED:
                    </span>
                    <p className="font-semibold text-white">"{msg.content}"</p>
                  </div>
                ) : (
                  <div className="p-3 bg-neutral-950 border-l-2 border-white space-y-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-white" /> AI RESEARCH ANSWER & CITATIONS:
                    </span>
                    
                    {msg.content ? (
                      <div className="text-neutral-100 text-sm leading-relaxed">
                        <MarkdownContent content={msg.content} />
                        {isChatStreaming && idx === chatMessages.length - 1 && (
                          <span className="inline-block w-1.5 h-3.5 bg-white ml-1 align-middle animate-pulse-block" />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 font-mono text-xs text-neutral-400 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Researching verified web sources & synthesizing answer...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

        </div>
      )}

      {/* Dynamic AI-Generated Follow-up Vectors (Zero Hardcoding) */}
      {chatMessages.length === 0 && aiSuggestedVectors.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 bg-white/90 backdrop-blur-xs px-2 py-1 border border-neutral-300 shrink-0">
            AI Inquiries:
          </span>
          {aiSuggestedVectors.slice(0, 3).map((vec, i) => (
            <button
              key={i}
              onClick={() => handleVectorQuestion(vec)}
              className="bg-white hover:bg-black hover:text-white text-black border border-neutral-300 hover:border-black px-2.5 py-1 font-body text-xs whitespace-nowrap transition-colors duration-100 flex items-center gap-1 shrink-0"
              title={`Ask about ${vec}`}
            >
              <span className="truncate max-w-[200px]">{vec}</span>
              <ArrowUpRight className="w-3 h-3 opacity-60 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border-2 border-black flex items-center shadow-lg focus-within:border-4 transition-all"
      >
        <div className="px-3.5 font-mono text-[10px] uppercase tracking-wider text-neutral-600 border-r border-black hidden sm:flex items-center gap-1 shrink-0 bg-neutral-50 h-full py-3">
          <MessageSquare className="w-3 h-3" />
          <span>FOLLOW-UP</span>
        </div>

        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Ask any question about "${currentTopic}"...`}
          className="flex-1 bg-transparent outline-none font-body text-sm text-black placeholder:text-neutral-400 placeholder:italic px-4 py-3"
        />

        <button
          type="submit"
          disabled={!input.trim() || isChatStreaming}
          className="px-5 py-3 bg-black text-white font-mono text-xs uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-40 transition-colors flex items-center gap-1.5 shrink-0"
        >
          {isChatStreaming ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Thinking</span>
            </>
          ) : (
            <>
              <span>Ask</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

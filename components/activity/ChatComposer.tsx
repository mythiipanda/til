'use client';

import { useState, useRef, useEffect } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { CornerDownLeft, X, MessageSquare, Loader2, ArrowUpRight, BookmarkPlus, Check } from 'lucide-react';

export function ChatComposer() {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [pinnedMsgIndices, setPinnedMsgIndices] = useState<number[]>([]);
  
  const currentTopic = useMindMapStore(s => s.currentTopic);
  const chatMessages = useMindMapStore(s => s.chatMessages);
  const isChatStreaming = useMindMapStore(s => s.isChatStreaming);
  const sendChat = useMindMapStore(s => s.sendChat);
  const pinChatToCanvas = useMindMapStore(s => s.pinChatToCanvas);
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

  const rawLlmQuestions: string[] = [];
  const nodeQuestions = (activeNode?.data?.suggested_questions as string[]) || [];
  const dossierQuestions = activeDossier?.suggestedQuestions || [];
  
  [...nodeQuestions, ...dossierQuestions].forEach((q) => {
    if (q && typeof q === 'string' && !rawLlmQuestions.includes(q.trim())) {
      rawLlmQuestions.push(q.trim());
    }
  });

  const suggestedQuestions: Array<{ label: string; query: string }> = rawLlmQuestions.slice(0, 3).map((q) => ({
    label: q,
    query: q,
  }));

  if (suggestedQuestions.length === 0) {
    if (activeDossier?.rabbitHoles && activeDossier.rabbitHoles.length > 0) {
      activeDossier.rabbitHoles.slice(0, 3).forEach((rh) => {
        if (rh.teaser) {
          suggestedQuestions.push({ label: rh.teaser, query: `${rh.teaser} (Context: ${currentTopic})` });
        }
      });
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || isChatStreaming) return;
    setInput('');
    setIsExpanded(true);
    sendChat(q);
  };

  const handleSelectSuggestedQuestion = (query: string) => {
    if (isChatStreaming) return;
    setIsExpanded(true);
    sendChat(query);
  };

  const handlePin = (idx: number, question: string, answer: string) => {
    if (pinnedMsgIndices.includes(idx)) return;
    pinChatToCanvas(question, answer);
    setPinnedMsgIndices(prev => [...prev, idx]);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[760px] max-w-[94vw] z-20 flex flex-col gap-2.5 select-none animate-fade">

      {/* Conversation Thread Box */}
      {chatMessages.length > 0 && isExpanded && (
        <div className="bg-white text-black border-2 border-black p-5 shadow-none max-h-[380px] overflow-y-auto custom-scrollbar space-y-4">
          
          {/* Thread Header */}
          <div className="flex items-center justify-between border-b-2 border-black pb-2 font-mono text-xs uppercase tracking-widest text-black">
            <span className="flex items-center gap-2 font-bold">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Q&amp;A INQUIRY: {currentTopic}</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-neutral-500">
                {isChatStreaming ? 'STREAMING VIA CEREBRAS...' : `${chatMessages.length} MESSAGES`}
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="hover:bg-black hover:text-white border border-black p-0.5 transition-colors"
                title="Minimize Q&A"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Message List */}
          <div className="space-y-4 pt-1">
            {chatMessages.map((msg, idx) => {
              const prevUserMsg = idx > 0 && chatMessages[idx - 1]?.role === 'user' ? chatMessages[idx - 1].content : currentTopic;
              const isPinned = pinnedMsgIndices.includes(idx);

              return (
                <div key={idx} className="space-y-1">
                  {msg.role === 'user' ? (
                    <div className="bg-neutral-100 border-2 border-black p-3.5 text-sm text-black font-body">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 block mb-1 font-bold">
                        USER INQUIRY:
                      </span>
                      <p className="font-serif font-bold text-base text-black">&ldquo;{msg.content}&rdquo;</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-white border-l-4 border-black border-y border-r border-neutral-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-black font-bold">
                          AI AGENT SYNTHESIS:
                        </span>

                        {msg.content && !isChatStreaming && (
                          <button
                            onClick={() => handlePin(idx, prevUserMsg, msg.content)}
                            disabled={isPinned}
                            className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 border-2 border-black ${
                              isPinned
                                ? 'bg-neutral-200 text-neutral-600 border-neutral-400'
                                : 'bg-black text-white hover:bg-white hover:text-black'
                            }`}
                            title="Pin this answer as a card on the mindmap canvas"
                          >
                            {isPinned ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Pinned</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="w-3 h-3" />
                                <span>Pin to Canvas</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      
                      {msg.content ? (
                        <div className="text-neutral-900 font-body text-sm leading-relaxed">
                          <MarkdownContent content={msg.content} />
                          {isChatStreaming && idx === chatMessages.length - 1 && (
                            <span className="inline-block w-2 h-4 bg-black ml-1 align-middle animate-pulse-block" />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 py-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                          <span>Consulting verified web citations &amp; formulating answer...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

        </div>
      )}

      {/* Suggested Inquiries */}
      {chatMessages.length === 0 && suggestedQuestions.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white bg-black px-2.5 py-1.5 font-bold shrink-0">
            PROMPT:
          </span>
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSelectSuggestedQuestion(q.query)}
              className="bg-white hover:bg-black hover:text-white text-black border-2 border-black px-3 py-1.5 font-body text-xs whitespace-nowrap transition-colors duration-100 flex items-center gap-1.5 shrink-0"
              title={q.query}
            >
              <span>{q.label}</span>
              <ArrowUpRight className="w-3 h-3 opacity-60 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border-2 border-black flex items-center shadow-none"
      >
        <div className="px-4 font-mono text-[11px] uppercase font-bold tracking-widest text-black border-r-2 border-black hidden sm:flex items-center gap-1.5 shrink-0 bg-neutral-50 h-full py-3.5">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>INQUIRY</span>
        </div>

        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Inquire further about "${currentTopic}"...`}
          className="flex-1 bg-transparent outline-none font-body text-sm text-black placeholder:text-neutral-400 placeholder:italic px-4 py-3.5"
        />

        <button
          type="submit"
          disabled={!input.trim() || isChatStreaming}
          className="px-6 py-3.5 bg-black hover:bg-white text-white hover:text-black border-l-2 border-black font-mono text-xs uppercase font-bold tracking-widest disabled:opacity-40 transition-colors duration-100 flex items-center gap-1.5 shrink-0"
        >
          {isChatStreaming ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>THINKING</span>
            </>
          ) : (
            <>
              <span>DISPATCH</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

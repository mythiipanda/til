'use client';

import { useState, useRef, useEffect } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { 
  CornerDownLeft, 
  X, 
  MessageSquare, 
  Loader2, 
  ArrowUpRight, 
  BookmarkPlus, 
  Check, 
  Search, 
  Globe, 
  Sparkles, 
  Minus, 
  Maximize2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy
} from 'lucide-react';

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function ChatComposer() {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [pinnedMsgIndices, setPinnedMsgIndices] = useState<number[]>([]);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [expandedTraceIdxs, setExpandedTraceIdxs] = useState<number[]>([]);
  
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

  const lastAssistantMsg = chatMessages.slice().reverse().find(m => m.role === 'assistant');
  if (lastAssistantMsg?.suggestedFollowUps && lastAssistantMsg.suggestedFollowUps.length > 0) {
    lastAssistantMsg.suggestedFollowUps.forEach((q) => {
      if (q && !rawLlmQuestions.includes(q.trim())) {
        rawLlmQuestions.unshift(q.trim());
      }
    });
  }

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
    setIsMinimized(false);
    sendChat(q);
  };

  const handleSelectSuggestedQuestion = (query: string) => {
    if (isChatStreaming) return;
    setIsExpanded(true);
    setIsMinimized(false);
    sendChat(query);
  };

  const handlePin = (idx: number, question: string, answer: string, citations?: Array<{ title?: string; url: string }>) => {
    if (pinnedMsgIndices.includes(idx)) return;
    pinChatToCanvas(question, answer, citations);
    setPinnedMsgIndices(prev => [...prev, idx]);
  };

  const handleCopy = (idx: number, text: string) => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedMsgIdx(idx);
      setTimeout(() => setCopiedMsgIdx(null), 2000);
    }
  };

  const toggleTrace = (idx: number) => {
    setExpandedTraceIdxs(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 bg-black text-white border-2 border-black px-4 py-2.5 font-mono text-xs uppercase font-bold tracking-wider flex items-center gap-3 shadow-none animate-fade select-none">
        <div className="flex items-center gap-2">
          {isChatStreaming ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5" />
          )}
          <span>
            {isChatStreaming 
              ? 'SYNTHESIZING ANSWER...' 
              : `Q&A THREAD (${chatMessages.length} MESSAGES)`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-neutral-700 pl-2">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 hover:bg-white hover:text-black transition-colors"
            title="Restore Q&A"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[820px] max-w-[95vw] z-20 flex flex-col gap-2 select-none animate-fade">

      {/* Conversation Thread Window */}
      {chatMessages.length > 0 && isExpanded && (
        <div className="bg-white text-black border-2 border-black shadow-none max-h-[460px] flex flex-col overflow-hidden animate-drop">
          
          {/* Thread Titlebar (Manus / Perplexity Style) */}
          <div className="p-3 bg-black text-white flex items-center justify-between border-b-2 border-black shrink-0 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="bg-white text-black px-2 py-0.5 font-bold text-[10px]">
                REASONING
              </span>
              <span className="font-bold tracking-wider truncate max-w-[400px]">
                Q&amp;A: {currentTopic}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isChatStreaming && (
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-300 font-bold">
                  <span className="w-2 h-2 bg-white animate-pulse" />
                  <span>RESEARCHING LIVE</span>
                </div>
              )}
              <div className="flex items-center gap-1 border-l border-neutral-700 pl-2">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1 hover:bg-white hover:text-black transition-colors"
                  title="Minimize Q&A"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 hover:bg-white hover:text-black transition-colors"
                  title="Close Q&A"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">
            {chatMessages.map((msg, idx) => {
              const prevUserMsg = idx > 0 && chatMessages[idx - 1]?.role === 'user' ? chatMessages[idx - 1].content : currentTopic;
              const isPinned = pinnedMsgIndices.includes(idx);
              const isCopied = copiedMsgIdx === idx;
              const isTraceOpen = expandedTraceIdxs.includes(idx);
              const isStreamingThis = isChatStreaming && idx === chatMessages.length - 1;

              return (
                <div key={idx} className="space-y-2.5">
                  {msg.role === 'user' ? (
                    <div className="bg-neutral-100 border-2 border-black p-4 text-black">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 block mb-1 font-bold">
                        USER INQUIRY:
                      </span>
                      <p className="font-serif font-bold text-base text-black">&ldquo;{msg.content}&rdquo;</p>
                    </div>
                  ) : (
                    <div className="p-5 bg-white border-2 border-black space-y-4">
                      
                      {/* Real-time Agent Reasoning / Tool Steps (Manus & Perplexity style) */}
                      {(isStreamingThis || (msg.toolCalls && msg.toolCalls.length > 0) || (msg.thoughts && msg.thoughts.length > 0)) && (
                        <div className="border border-black bg-neutral-50 p-3 space-y-2">
                          
                          {/* Live Status Header */}
                          <div className="flex items-center justify-between font-mono text-[10px] uppercase font-bold text-neutral-700 border-b border-neutral-200 pb-1.5">
                            <div className="flex items-center gap-2">
                              {isStreamingThis ? (
                                <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-black" />
                              )}
                              <span>
                                {isStreamingThis ? 'AGENT SEARCH & REASONING' : 'VERIFIED REASONING TRACE'}
                              </span>
                            </div>

                            {(msg.thoughts && msg.thoughts.length > 0) && (
                              <button
                                onClick={() => toggleTrace(idx)}
                                className="flex items-center gap-1 text-[9px] text-neutral-600 hover:text-black"
                              >
                                <span>{isTraceOpen ? 'HIDE TRACE' : 'VIEW DETAILS'}</span>
                                {isTraceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>

                          {/* Live Tool Badges */}
                          {msg.toolCalls && msg.toolCalls.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {msg.toolCalls.map((tc, tIdx) => (
                                <div
                                  key={tc.id || tIdx}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 font-mono text-[9px] uppercase font-bold border ${
                                    tc.status === 'running'
                                      ? 'border-black bg-black text-white'
                                      : 'border-neutral-300 bg-white text-black'
                                  }`}
                                >
                                  <Search className="w-3 h-3" />
                                  <span className="truncate max-w-[200px]">{tc.query || tc.tool}</span>
                                  <span>{tc.status === 'running' ? '●' : '✓'}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Collapsible Thoughts */}
                          {isTraceOpen && msg.thoughts && msg.thoughts.length > 0 && (
                            <div className="pt-2 space-y-1.5 border-t border-neutral-200 font-mono text-[10px] text-neutral-700">
                              {msg.thoughts.map((th, thIdx) => (
                                <div key={thIdx} className="flex items-start gap-1.5">
                                  <span className="text-neutral-400">↳</span>
                                  <span>{th}</span>
                                </div>
                              ))}
                            </div>
                          )}

                        </div>
                      )}

                      {/* Assistant Text Answer */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-black font-bold bg-neutral-100 border border-black px-2 py-0.5">
                            SYNTHESIS
                          </span>

                          {msg.content && !isChatStreaming && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCopy(idx, msg.content)}
                                className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider border border-black hover:bg-black hover:text-white transition-colors flex items-center gap-1"
                                title="Copy answer"
                              >
                                {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                <span>{isCopied ? 'Copied' : 'Copy'}</span>
                              </button>

                              <button
                                onClick={() => handlePin(idx, prevUserMsg, msg.content, msg.sources?.map(s => ({ title: s.title, url: s.url })))}
                                disabled={isPinned}
                                className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 border-2 border-black font-bold ${
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
                            </div>
                          )}
                        </div>

                        {msg.content ? (
                          <div className="text-neutral-900 font-body text-sm md:text-base leading-relaxed">
                            <MarkdownContent content={msg.content} />
                            {isStreamingThis && (
                              <span className="inline-block w-2 h-4 bg-black ml-1 align-middle animate-pulse-block" />
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 font-mono text-xs text-neutral-600 py-3">
                            <Loader2 className="w-4 h-4 animate-spin text-black" />
                            <span>Synthesizing grounded answer from citations...</span>
                          </div>
                        )}
                      </div>

                      {/* Discovered Citations Pills */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-3 border-t border-neutral-200 space-y-2">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 font-bold block">
                            GROUNDED SOURCES ({msg.sources.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, sIdx) => (
                              <a
                                key={src.id || sIdx}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-white hover:bg-black text-black hover:text-white border border-neutral-300 hover:border-black font-mono text-[9px] flex items-center gap-1.5 transition-colors"
                              >
                                <Globe className="w-2.5 h-2.5" />
                                <span className="truncate max-w-[140px]">{getDomain(src.url)}</span>
                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dynamic Follow-Up Inquiry Chips */}
                      {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && !isChatStreaming && (
                        <div className="pt-3 border-t-2 border-black space-y-2 bg-neutral-50 p-3">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-black" />
                            <span>SUGGESTED FOLLOW-UPS:</span>
                          </span>
                          <div className="flex flex-col sm:flex-row flex-wrap gap-1.5">
                            {msg.suggestedFollowUps.map((fu, fuIdx) => (
                              <button
                                key={fuIdx}
                                onClick={() => handleSelectSuggestedQuestion(fu)}
                                className="p-2 bg-white hover:bg-black text-black hover:text-white border border-black font-body text-xs text-left transition-colors duration-100 flex items-center justify-between gap-2"
                              >
                                <span className="font-serif font-bold text-xs">{fu}</span>
                                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                              </button>
                            ))}
                          </div>
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

      {/* Suggested Inquiries Pill Row */}
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
          placeholder={`Ask anything about "${currentTopic}"...`}
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

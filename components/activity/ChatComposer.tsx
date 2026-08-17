'use client';

import { useState, useRef, useEffect } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { ThinkingReasoning } from '@/components/agent/ThinkingReasoning';
import { WebSearch } from '@/components/agent/WebSearch';
import { InlineCitations } from '@/components/agent/InlineCitations';
import { StreamingText } from '@/components/agent/StreamingText';
import {
  ArrowUp,
  X,
  Loader2,
  BookmarkPlus,
  Check,
  Sparkles,
  Minus,
  Maximize2,
  Copy,
} from 'lucide-react';

const NOW = () => Date.now();

function elapsedSeconds(t0: number, t1: number): string {
  return `${Math.max(1, Math.round((t1 - t0) / 1000))}s`;
}

export function ChatComposer() {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [pinnedMsgIndices, setPinnedMsgIndices] = useState<number[]>([]);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);

  const currentTopic = useMindMapStore(s => s.currentTopic);
  const chatMessages = useMindMapStore(s => s.chatMessages);
  const isChatStreaming = useMindMapStore(s => s.isChatStreaming);
  const sendChat = useMindMapStore(s => s.sendChat);
  const pinChatToCanvas = useMindMapStore(s => s.pinChatToCanvas);
  const nodes = useMindMapStore(s => s.nodes);
  const selectedNodeId = useMindMapStore(s => s.selectedNodeId);
  const activeDossier = useMindMapStore(s => s.activeDossier);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(NOW);

  useEffect(() => {
    if (chatMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatStreaming]);

  // Tick once per second while streaming so "Thought for Ns" stays fresh.
  useEffect(() => {
    if (!isChatStreaming) return;
    const id = setInterval(() => setNow(NOW()), 1000);
    return () => clearInterval(id);
  }, [isChatStreaming]);

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

  // Minimized dock state in bottom-right corner
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-20 bg-black text-white border-2 border-black px-4 py-2.5 font-mono text-xs font-bold tracking-wider flex items-center gap-3 shadow-none animate-fade select-none">
        <div className="flex items-center gap-2">
          {isChatStreaming ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <span className="w-2 h-2 bg-white" />
          )}
          <span>
            {isChatStreaming ? 'Thinking…' : `Q&A (${chatMessages.length})`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-neutral-700 pl-2">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 hover:bg-white hover:text-black transition-colors"
            title="Restore Q&A"
            aria-label="Restore Q&A"
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
        <div className="bg-white border-2 border-black shadow-none max-h-[460px] flex flex-col overflow-hidden animate-drop">

          {/* Thread Titlebar */}
          <div className="px-3 py-2 bg-black text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 bg-white shrink-0" />
<span className="font-mono text-[11px] font-bold tracking-wider truncate max-w-[400px]">
              Q&amp;A: {currentTopic}
            </span>
          </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Minimize Q&A"
                aria-label="Minimize Q&A"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Close Q&A"
                aria-label="Close Q&A"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 custom-scrollbar">
            {chatMessages.map((msg, idx) => {
              const prevUserMsg = idx > 0 && chatMessages[idx - 1]?.role === 'user' ? chatMessages[idx - 1].content : currentTopic;
              const isPinned = pinnedMsgIndices.includes(idx);
              const isCopied = copiedMsgIdx === idx;
              const isStreamingThis = isChatStreaming && idx === chatMessages.length - 1;
              const startedAt = msg.timestamp;

              return (
                <div key={idx} className="space-y-2.5">
                  {msg.role === 'user' ? (
                    <div className="flex gap-2.5">
                      <span className="font-mono text-[9px] font-bold text-neutral-400 uppercase tracking-wider shrink-0 pt-1 w-8">
                        You
                      </span>
                      <p className="font-serif font-semibold text-[15px] text-black leading-snug pt-0.5">
                        {msg.content}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2.5">
                        <span className="font-mono text-[9px] font-bold text-neutral-400 uppercase tracking-wider shrink-0 pt-1 w-8">
                          Agent
                        </span>
                        <div className="space-y-2 flex-1 min-w-0">
                          {/* Live reasoning / verified trace */}
                          {((isStreamingThis && (msg.thoughts?.length ?? 0) > 0) || (msg.thoughts && msg.thoughts.length > 0)) && (
                            <ThinkingReasoning
                              lines={msg.thoughts || []}
                              active={isStreamingThis}
                              doneLabel={<span className="tabular-nums">Thought for {elapsedSeconds(startedAt, isStreamingThis ? now : msg.timestamp || startedAt)}</span>}
                            />
                          )}

                          {/* Web search sources */}
                          {msg.toolCalls && msg.toolCalls.length > 0 && (
                            <WebSearch
                              query={msg.toolCalls[0].query || prevUserMsg}
                              sources={msg.sources || []}
                              active={isStreamingThis}
                            />
                          )}

                          {/* Answer prose */}
                          {msg.content ? (
                            <div className="font-body text-sm text-neutral-900 leading-relaxed">
                              <StreamingText streaming={isStreamingThis}>
                                <MarkdownContent content={msg.content} />
                              </StreamingText>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 py-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                              <span className="font-bold tracking-wider animate-pulse text-black">Thinking…</span>
                            </div>
                          )}

                          {/* Inline citations footer */}
                          {msg.sources && msg.sources.length > 0 && !isStreamingThis && (
                            <InlineCitations sources={msg.sources} />
                          )}

                          {/* Message actions */}
                          {msg.content && !isStreamingThis && (
                            <div className="flex items-center gap-1.5 pt-1">
                              <button
                                onClick={() => handleCopy(idx, msg.content)}
                                className="p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
                                title="Copy answer"
                                aria-label={isCopied ? 'Answer copied' : 'Copy answer'}
                              >
                                {isCopied ? (
                                  <Check key="copied" className="w-3.5 h-3.5 icon-swap-enter" />
                                ) : (
                                  <Copy key="copy" className="w-3.5 h-3.5 icon-swap-enter" />
                                )}
                              </button>
                              <button
                                onClick={() => handlePin(idx, prevUserMsg, msg.content, msg.sources?.map(s => ({ title: s.title, url: s.url })))}
                                disabled={isPinned}
                                className={`p-1.5 transition-colors flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
                                  isPinned
                                    ? 'text-neutral-400 cursor-default'
                                    : 'text-neutral-500 hover:text-black hover:bg-neutral-100'
                                }`}
                                title="Pin this answer as a card on the mindmap canvas"
                              >
                                {isPinned ? <Check key="pinned" className="w-3.5 h-3.5 icon-swap-enter" /> : <BookmarkPlus key="pin" className="w-3.5 h-3.5 icon-swap-enter" />}
                                {isPinned ? <span>Pinned</span> : <span>Pin</span>}
                              </button>
                            </div>
                          )}

                          {/* Follow-up chips */}
                          {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && !isStreamingThis && (
                            <div className="pt-1.5 space-y-1.5">
                              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 font-bold flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Follow up
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.suggestedFollowUps.slice(0, 3).map((fu, fuIdx) => (
                                  <button
                                    key={fuIdx}
                                    onClick={() => handleSelectSuggestedQuestion(fu)}
                                    className="px-2.5 py-1.5 bg-white hover:bg-black hover:text-white text-black border-2 border-black font-body text-xs transition-colors duration-100 text-left"
                                  >
                                    {fu}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

        </div>
      )}

      {/* Suggested Inquiries Row */}
      {chatMessages.length === 0 && suggestedQuestions.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 shrink-0">
            Ask:
          </span>
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSelectSuggestedQuestion(q.query)}
              className="bg-white hover:bg-black hover:text-white text-black border-2 border-black px-3 py-1.5 font-body text-xs whitespace-nowrap transition-colors duration-100 shrink-0"
              title={q.query}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border-2 border-black flex items-center"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Ask anything about "${currentTopic}"…`}
          className="flex-1 bg-transparent outline-none font-body text-sm text-black placeholder:text-neutral-400 px-4 py-3"
        />

        <button
          type="submit"
          disabled={!input.trim() || isChatStreaming}
          className="m-1.5 w-9 h-9 flex items-center justify-center bg-black hover:bg-white text-white hover:text-black border border-black disabled:opacity-30 disabled:hover:bg-black disabled:hover:text-white transition-colors duration-100 shrink-0"
          aria-label="Ask"
        >
          {isChatStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { ChevronDown, ChevronUp, BookOpen, Sparkles } from 'lucide-react';

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function ActivityPanel() {
  const isResearching = useMindMapStore(s => s.isResearching);
  const planSteps = useMindMapStore(s => s.planSteps);
  const thoughts = useMindMapStore(s => s.thoughts);
  const toolCalls = useMindMapStore(s => s.toolCalls);
  const sources = useMindMapStore(s => s.sources);
  const openDossier = useMindMapStore(s => s.openDossier);
  const nodes = useMindMapStore(s => s.nodes);
  const lastResearchedNodeId = useMindMapStore(s => s.lastResearchedNodeId);
  const selectedNodeId = useMindMapStore(s => s.selectedNodeId);
  const activeDossier = useMindMapStore(s => s.activeDossier);

  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);

  const isVisible = isResearching || thoughts.length > 0 || sources.length > 0;
  if (!isVisible) return null;

  const targetNodeId = lastResearchedNodeId || activeDossier?.nodeId || selectedNodeId || nodes[0]?.id;

  return (
    <div className="fixed right-6 top-20 bottom-6 w-[360px] max-w-[90vw] bg-black text-white border-2 border-black z-20 flex flex-col shadow-none select-none animate-fade">

      {/* Header */}
      <div className="p-3 border-b border-neutral-800 flex items-center justify-between bg-black shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 ${isResearching ? 'bg-white animate-pulse' : 'bg-white'}`} />
          <span className="font-mono text-[10px] uppercase tracking-widest font-bold">
            AI RESEARCH ASSISTANT
          </span>
        </div>
        <span className="font-mono text-[9px] text-neutral-400 uppercase">
          {isResearching ? 'RESEARCHING...' : 'RESEARCH READY'}
        </span>
      </div>

      {/* Completion CTA Card */}
      {!isResearching && thoughts.length > 0 && (
        <div className="p-3 bg-neutral-900 border-b-2 border-black flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between font-mono text-[9px] text-neutral-400 uppercase">
            <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-white" /> STORY READY</span>
            <span>CITATIONS ATTACHED</span>
          </div>
          <button
            onClick={() => {
              if (targetNodeId) openDossier(targetNodeId);
            }}
            className="w-full py-2 bg-white text-black hover:bg-neutral-200 font-mono text-xs uppercase font-bold tracking-wider transition-colors flex items-center justify-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read Full Story & Summary</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">

        {/* Plan Steps */}
        {planSteps.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-1">
              [ RESEARCH STEPS ]
            </div>
            <div className="space-y-1.5 pl-1">
              {planSteps.map((step, idx) => (
                <div key={step.id || idx} className="flex items-start gap-2 text-xs font-mono">
                  <span className="text-neutral-500 font-bold shrink-0">
                    {step.status === 'done' ? '[✓]' : step.status === 'running' ? '[▶]' : '[ ]'}
                  </span>
                  <span className={step.status === 'pending' ? 'text-neutral-500' : 'text-neutral-100'}>
                    {step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Thinking Trace */}
        {thoughts.length > 0 && (
          <div className="border border-neutral-800 bg-neutral-950">
            <button
              onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
              className="w-full flex items-center justify-between p-2.5 bg-neutral-900 border-b border-neutral-800 font-mono text-[10px] uppercase tracking-wider text-neutral-300 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <span>[ AI REASONING & NOTES ]</span>
                <span className="text-neutral-500">({thoughts.length})</span>
              </div>
              {isThinkingExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {isThinkingExpanded && (
              <div className="p-3 space-y-2.5 max-h-[220px] overflow-y-auto font-mono text-[11px] text-neutral-300 leading-relaxed">
                {thoughts.map((t, idx) => (
                  <div key={idx} className="border-l border-neutral-700 pl-2">
                    <span className="text-[9px] text-neutral-500 block">NOTE #{idx + 1}</span>
                    <MarkdownContent content={t.text} className="text-xs" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tools Used */}
        {toolCalls.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-1">
              [ TOOLS & DATA SOURCES ]
            </div>
            <div className="flex flex-wrap gap-1.5">
              {toolCalls.map((tc, idx) => (
                <div
                  key={tc.id || idx}
                  className="flex items-center gap-1.5 px-2 py-1 bg-neutral-900 border border-neutral-700 font-mono text-[10px]"
                >
                  <span className="text-neutral-400">tool:</span>
                  <span className="text-white font-bold">{tc.name}</span>
                  <span className={tc.status === 'running' ? 'text-white animate-pulse' : 'text-neutral-500'}>
                    {tc.status === 'running' ? '●' : '✓'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verified Discovered Sources */}
        {sources.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-1">
              [ VERIFIED SOURCES ({sources.length}) ]
            </div>
            <div className="space-y-2">
              {sources.map((src, idx) => (
                <a
                  key={src.id || idx}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2.5 bg-neutral-950 border border-neutral-800 hover:border-white transition-colors duration-100 group"
                >
                  <div className="font-mono text-[9px] text-neutral-400 group-hover:text-white uppercase mb-0.5 truncate">
                    {getDomain(src.url)}
                  </div>
                  <div className="font-serif text-[12px] font-bold text-neutral-100 line-clamp-1 mb-1">
                    {src.title}
                  </div>
                  <div className="font-body text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                    <MarkdownContent content={src.snippet} />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

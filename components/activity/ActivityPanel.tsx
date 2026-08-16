'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { ChevronDown, ChevronUp } from 'lucide-react';

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

  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);

  const isVisible = isResearching || thoughts.length > 0 || sources.length > 0;
  if (!isVisible) return null;

  return (
    <div className="fixed right-6 top-20 bottom-6 w-[360px] max-w-[90vw] bg-black text-white border-2 border-black z-20 flex flex-col shadow-none select-none animate-fade">

      {/* Masthead Header */}
      <div className="p-3 border-b border-neutral-800 flex items-center justify-between bg-black">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-white inline-block animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest font-bold">
            AGENTIC RESEARCH SWARM
          </span>
        </div>
        <span className="font-mono text-[9px] text-neutral-400 uppercase">
          {isResearching ? 'EXECUTING...' : 'COMPLETED'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">

        {/* Plan DAG Steps */}
        {planSteps.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-1">
              [ EXECUTION PLAN ]
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
                <span>[ THINKING LOG ]</span>
                <span className="text-neutral-500">({thoughts.length})</span>
              </div>
              {isThinkingExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {isThinkingExpanded && (
              <div className="p-3 space-y-2.5 max-h-[180px] overflow-y-auto font-mono text-[11px] text-neutral-300 leading-relaxed">
                {thoughts.map((t, idx) => (
                  <div key={idx} className="border-l border-neutral-700 pl-2">
                    <span className="text-[9px] text-neutral-500 block">TRACE #{idx + 1}</span>
                    {t.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tool Invocations */}
        {toolCalls.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-1">
              [ TOOL INVOCATIONS ]
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
              [ GROUNDED SOURCES ({sources.length}) ]
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
                    {src.snippet}
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

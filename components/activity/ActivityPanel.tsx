'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { ChevronDown, ChevronUp, Sparkles, Search, BookOpen, FileText, Globe } from 'lucide-react';

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function getToolIcon(name: string) {
  if (name.includes('search')) return <Search className="w-3 h-3" />;
  if (name.includes('wiki')) return <BookOpen className="w-3 h-3" />;
  if (name.includes('extract') || name.includes('content')) return <FileText className="w-3 h-3" />;
  return <Globe className="w-3 h-3" />;
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
    <div className="fixed right-4 top-4 bottom-4 w-[340px] bg-[#111827]/95 backdrop-blur-xl border border-[#1e293b] rounded-2xl overflow-y-auto z-20 shadow-xl slide-in-right">
      <div className="p-4 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] font-medium">
            Research Activity
          </span>
          <div className="flex items-center gap-2">
            {isResearching ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <span className="shimmer-text text-xs font-medium">Researching</span>
              </>
            ) : thoughts.length > 0 ? (
              <>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                <span className="text-xs text-emerald-500 font-medium">Complete</span>
              </>
            ) : null}
          </div>
        </div>

        {/* Plan Steps */}
        {planSteps.length > 0 && (
          <div className="space-y-0">
            {planSteps.map((step, idx) => (
              <div key={step.id || idx} className="relative flex gap-3 pb-3">
                {idx < planSteps.length - 1 && (
                  <div className="absolute left-[5px] top-4 bottom-0 w-px bg-[#1e293b]" />
                )}
                <div className="relative mt-0.5 shrink-0">
                  {step.status === 'done' && (
                    <div className="h-[11px] w-[11px] rounded-full bg-emerald-500" />
                  )}
                  {step.status === 'running' && (
                    <div className="h-[11px] w-[11px] rounded-full bg-amber-500" style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
                  )}
                  {step.status === 'pending' && (
                    <div className="h-[11px] w-[11px] rounded-full bg-[#334155]" />
                  )}
                </div>
                <span className={`text-xs leading-tight ${step.status === 'pending' ? 'text-[#475569]' : 'text-[#e2e8f0]'}`}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Thinking */}
        {thoughts.length > 0 && (
          <div className="border border-[#1e293b] rounded-xl overflow-hidden">
            <button
              onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
              className="w-full flex items-center justify-between p-3 bg-[#0a0e17]/50 hover:bg-[#1a2332]/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className={`w-3.5 h-3.5 ${isResearching ? 'text-amber-500' : 'text-[#06b6d4]'}`} />
                {isResearching ? (
                  <span className="shimmer-text text-xs font-medium">Thinking</span>
                ) : (
                  <span className="text-xs font-medium text-[#e2e8f0]">Thinking</span>
                )}
                <span className="text-[10px] text-[#475569] font-mono">{thoughts.length}</span>
              </div>
              {isThinkingExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#475569]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#475569]" />
              )}
            </button>
            {isThinkingExpanded && (
              <div className="p-3 space-y-2 max-h-[180px] overflow-y-auto">
                {thoughts.map((t, idx) => (
                  <div
                    key={idx}
                    className="text-[11px] text-[#94a3b8] leading-relaxed fade-up"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    {t.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tool Calls */}
        {toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {toolCalls.map((tc, idx) => (
              <div
                key={tc.id || idx}
                className="flex items-center gap-1.5 px-2 py-1 bg-[#0a0e17] border border-[#1e293b] rounded-lg slide-up"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <span className="text-[#64748b]">{getToolIcon(tc.name)}</span>
                <span className="text-[10px] font-mono text-[#94a3b8]">{tc.name}</span>
                <div
                  className={`h-1.5 w-1.5 rounded-full ml-0.5 ${
                    tc.status === 'running' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={tc.status === 'running' ? { animation: 'pulse-dot 1.2s ease-in-out infinite' } : undefined}
                />
              </div>
            ))}
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] font-medium">
              Sources ({sources.length})
            </span>
            {sources.map((src, idx) => (
              <a
                key={src.id || idx}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg p-2.5 bg-[#0a0e17] border border-[#1e293b] hover:border-[#334155] transition-colors slide-up group"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="text-[10px] font-mono text-[#06b6d4] mb-0.5 truncate group-hover:text-[#22d3ee] transition-colors">
                  {getDomain(src.url)}
                </div>
                <div className="text-[11px] text-[#e2e8f0] font-medium truncate mb-0.5">
                  {src.title}
                </div>
                <div className="text-[10px] text-[#475569] line-clamp-2 leading-relaxed">
                  {src.snippet}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

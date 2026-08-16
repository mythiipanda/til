'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  CircleDashed, 
  ExternalLink,
  Search,
  Globe,
  Compass
} from 'lucide-react';

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

  const runningStepIdx = planSteps.findIndex(s => s.status === 'running');
  const completedStepsCount = planSteps.filter(s => s.status === 'done').length;
  const currentStepNumber = runningStepIdx !== -1 ? runningStepIdx + 1 : completedStepsCount;

  return (
    <div className="fixed right-6 top-20 bottom-6 w-[380px] max-w-[92vw] bg-black text-white border-2 border-black z-20 flex flex-col shadow-none select-none animate-fade">

      {/* Header */}
      <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-black shrink-0">
        <div className="flex items-center gap-2.5">
          {isResearching ? (
            <Loader2 className="w-4 h-4 text-white animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          )}
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest font-bold text-white">
              AI RESEARCH AGENT
            </div>
            <div className="font-mono text-[9px] text-neutral-400">
              {isResearching 
                ? (planSteps.length > 0 ? `PHASE ${currentStepNumber} OF ${planSteps.length}` : 'INITIALIZING RESEARCH...')
                : 'SYNTHESIS COMPLETE'}
            </div>
          </div>
        </div>
        <span className="font-mono text-[9px] px-2 py-0.5 border border-neutral-700 text-neutral-300 uppercase">
          {isResearching ? 'LIVE SWARM' : 'VERIFIED'}
        </span>
      </div>

      {/* Completion CTA Card */}
      {!isResearching && thoughts.length > 0 && (
        <div className="p-3.5 bg-neutral-900 border-b-2 border-black flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between font-mono text-[9px] text-neutral-300 uppercase">
            <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-white" /> STORY READY</span>
            <span>{sources.length} VERIFIED SOURCES</span>
          </div>
          <button
            onClick={() => {
              if (targetNodeId) openDossier(targetNodeId);
            }}
            className="w-full py-2.5 bg-white text-black hover:bg-neutral-200 font-mono text-xs uppercase font-bold tracking-wider transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>Read Full Story & Monograph</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">

        {/* Plan Steps */}
        {planSteps.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-1.5">
              <span>[ RESEARCH PHASES ]</span>
              <span>{completedStepsCount}/{planSteps.length} COMPLETE</span>
            </div>
            <div className="space-y-2 pl-0.5">
              {planSteps.map((step, idx) => {
                const isDone = step.status === 'done';
                const isRunning = step.status === 'running';

                return (
                  <div 
                    key={step.id || idx} 
                    className={`flex items-start gap-2.5 text-xs font-mono transition-colors duration-150 p-1.5 border ${
                      isRunning 
                        ? 'border-white bg-neutral-900 text-white' 
                        : isDone 
                        ? 'border-neutral-900 bg-black text-neutral-300' 
                        : 'border-transparent text-neutral-600'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      ) : isRunning ? (
                        <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                      ) : (
                        <CircleDashed className="w-3.5 h-3.5 text-neutral-600" />
                      )}
                    </div>
                    <div className="flex-1 leading-snug">
                      <div className={isDone ? 'text-neutral-200' : isRunning ? 'text-white font-bold' : 'text-neutral-500'}>
                        {step.title}
                      </div>
                      {isRunning && (
                        <div className="font-mono text-[9px] text-neutral-400 mt-0.5">
                          Active agent: {step.agent || 'Deep Retrieval Agent'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
                <Compass className="w-3.5 h-3.5 text-neutral-400" />
                <span>[ AI REASONING & DISCOVERY NOTES ]</span>
                <span className="text-neutral-500">({thoughts.length})</span>
              </div>
              {isThinkingExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {isThinkingExpanded && (
              <div className="p-3 space-y-2.5 max-h-[220px] overflow-y-auto font-mono text-[11px] text-neutral-300 leading-relaxed custom-scrollbar">
                {thoughts.map((t, idx) => (
                  <div key={idx} className="border-l-2 border-neutral-700 pl-2.5">
                    <span className="text-[9px] text-neutral-500 block uppercase mb-0.5">
                      {t.agent || `INSIGHT #${idx + 1}`}
                    </span>
                    <MarkdownContent content={t.text} className="text-xs text-neutral-200" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tools Used */}
        {toolCalls.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-1.5 flex items-center justify-between">
              <span>[ AGENT ACTIONS & TOOLS ]</span>
              <span>{toolCalls.length} EXECUTED</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {toolCalls.map((tc, idx) => (
                <div
                  key={tc.id || idx}
                  className={`flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] border ${
                    tc.status === 'running' 
                      ? 'border-white bg-neutral-900 text-white' 
                      : 'border-neutral-800 bg-neutral-950 text-neutral-400'
                  }`}
                >
                  <Search className="w-3 h-3 text-neutral-400" />
                  <span className="font-bold text-neutral-200">{tc.name}</span>
                  <span className={tc.status === 'running' ? 'text-white animate-pulse' : 'text-neutral-400'}>
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
            <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-1.5 flex items-center justify-between">
              <span>[ DISCOVERED CITATIONS ]</span>
              <span>{sources.length} SOURCES</span>
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
                  <div className="flex items-center justify-between font-mono text-[9px] text-neutral-400 group-hover:text-white uppercase mb-1">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {getDomain(src.url)}
                    </span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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

'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  CheckCircle2, 
  Loader2, 
  CircleDashed, 
  ExternalLink,
  Search,
  Globe,
  Compass,
  Minus,
  Maximize2,
  X
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
  const isDossierOpen = useMindMapStore(s => s.isDossierOpen);
  const nodes = useMindMapStore(s => s.nodes);
  const lastResearchedNodeId = useMindMapStore(s => s.lastResearchedNodeId);
  const selectedNodeId = useMindMapStore(s => s.selectedNodeId);
  const activeDossier = useMindMapStore(s => s.activeDossier);

  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);

  // If dossier is open on the right side, or dismissed, hide panel to prevent overlap
  const isVisible = (isResearching || thoughts.length > 0 || sources.length > 0) && !isDossierOpen && !isDismissed;
  if (!isVisible) return null;

  const targetNodeId = lastResearchedNodeId || activeDossier?.nodeId || selectedNodeId || nodes[0]?.id;

  const runningStepIdx = planSteps.findIndex(s => s.status === 'running');
  const completedStepsCount = planSteps.filter(s => s.status === 'done').length;
  const currentStepNumber = runningStepIdx !== -1 ? runningStepIdx + 1 : completedStepsCount;

  // Minimized floating dock state
  if (isMinimized) {
    return (
      <div className="fixed right-6 bottom-6 z-20 bg-black text-white border-2 border-black p-2.5 font-mono text-xs uppercase font-bold tracking-wider flex items-center gap-3 shadow-none animate-fade">
        <div className="flex items-center gap-2">
          {isResearching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          <span>
            {isResearching 
              ? `AGENT SWARM: ${completedStepsCount}/${planSteps.length || 4}`
              : `RESEARCH COMPLETE (${sources.length} SOURCES)`}
          </span>
        </div>
        <div className="flex items-center gap-1 border-l border-neutral-700 pl-2">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 hover:bg-white hover:text-black transition-colors"
            title="Expand Activity Log"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-white hover:text-black transition-colors"
            title="Dismiss Activity Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-6 top-20 bottom-6 w-[400px] max-w-[92vw] bg-white text-black border-2 border-black z-20 flex flex-col shadow-none select-none animate-fade">

      {/* Window Titlebar */}
      <div className="p-3.5 border-b-2 border-black flex items-center justify-between bg-black text-white shrink-0">
        <div className="flex items-center gap-2.5">
          {isResearching ? (
            <Loader2 className="w-4 h-4 text-white animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          )}
          <div>
            <div className="font-mono text-xs uppercase tracking-widest font-bold">
              AGENT LOG
            </div>
            <div className="font-mono text-[9px] text-neutral-400">
              {isResearching 
                ? (planSteps.length > 0 ? `PHASE ${currentStepNumber} OF ${planSteps.length}` : 'DISPATCHING AGENTS...')
                : 'SYNTHESIS COMPLETE'}
            </div>
          </div>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 border border-white hover:bg-white hover:text-black transition-colors"
            title="Minimize Window"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 border border-white hover:bg-white hover:text-black transition-colors"
            title="Close Window"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Completion Monograph CTA */}
      {!isResearching && thoughts.length > 0 && (
        <div className="p-4 bg-neutral-100 border-b-2 border-black flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between font-mono text-[10px] text-neutral-700 uppercase font-bold">
            <span>STORY READY</span>
            <span>{sources.length} SOURCES</span>
          </div>
          <button
            onClick={() => {
              if (targetNodeId) openDossier(targetNodeId);
            }}
            className="w-full py-3 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase font-bold tracking-wider transition-colors duration-100 flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>Open Research Monograph</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">

        {/* Plan Steps */}
        {planSteps.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest font-bold text-black border-b-2 border-black pb-1.5">
              <span>[ RESEARCH PHASES ]</span>
              <span>{completedStepsCount}/{planSteps.length} COMPLETE</span>
            </div>
            <div className="space-y-2">
              {planSteps.map((step, idx) => {
                const isDone = step.status === 'done';
                const isRunning = step.status === 'running';

                return (
                  <div 
                    key={step.id || idx} 
                    className={`flex items-start gap-3 text-xs font-mono p-2 border-2 transition-colors duration-100 ${
                      isRunning 
                        ? 'border-black bg-black text-white font-bold' 
                        : isDone 
                        ? 'border-neutral-300 bg-neutral-50 text-neutral-800' 
                        : 'border-neutral-200 text-neutral-400'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                      ) : isRunning ? (
                        <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                      ) : (
                        <CircleDashed className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                    </div>
                    <div className="flex-1 leading-snug">
                      <div>{step.title}</div>
                      {isRunning && (
                        <div className="font-mono text-[9px] text-neutral-300 mt-1 uppercase">
                          Active: {step.agent || 'Deep Retrieval Agent'}
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
          <div className="border-2 border-black bg-white">
            <button
              onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
              className="w-full flex items-center justify-between p-3 bg-neutral-100 border-b-2 border-black font-mono text-[10px] uppercase font-bold tracking-wider text-black hover:bg-neutral-200"
            >
              <div className="flex items-center gap-2">
                <Compass className="w-3.5 h-3.5 text-black" />
                <span>[ AI REASONING &amp; FIELD NOTES ]</span>
                <span className="text-neutral-500">({thoughts.length})</span>
              </div>
              {isThinkingExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {isThinkingExpanded && (
              <div className="p-4 space-y-3 max-h-[220px] overflow-y-auto font-body text-xs text-neutral-800 leading-relaxed custom-scrollbar">
                {thoughts.map((t, idx) => (
                  <div key={idx} className="border-l-2 border-black pl-3 space-y-0.5">
                    <span className="font-mono text-[9px] text-neutral-500 block uppercase font-bold">
                      {t.agent || `INSIGHT #${idx + 1}`}
                    </span>
                    <MarkdownContent content={t.text} className="text-xs text-black" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tools Used */}
        {toolCalls.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-xs uppercase tracking-widest font-bold text-black border-b-2 border-black pb-1.5 flex items-center justify-between">
              <span>[ AGENT ACTIONS &amp; TOOLS ]</span>
              <span>{toolCalls.length} EXECUTED</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {toolCalls.map((tc, idx) => (
                <div
                  key={tc.id || idx}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase font-bold border-2 ${
                    tc.status === 'running' 
                      ? 'border-black bg-black text-white' 
                      : 'border-neutral-300 bg-white text-black'
                  }`}
                >
                  <Search className="w-3 h-3" />
                  <span>{tc.name}</span>
                  <span>{tc.status === 'running' ? '●' : '✓'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Discovered Citations */}
        {sources.length > 0 && (
          <div className="space-y-3">
            <div className="font-mono text-xs uppercase tracking-widest font-bold text-black border-b-2 border-black pb-1.5 flex items-center justify-between">
              <span>[ DISCOVERED CITATIONS ]</span>
              <span>{sources.length} SOURCES</span>
            </div>
            <div className="space-y-2.5">
              {sources.map((src, idx) => (
                <a
                  key={src.id || idx}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-white hover:bg-black text-black hover:text-white border-2 border-black transition-colors duration-100 group"
                >
                  <div className="flex items-center justify-between font-mono text-[9px] text-neutral-500 group-hover:text-neutral-400 uppercase mb-1">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {getDomain(src.url)}
                    </span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="font-serif text-sm font-bold text-black group-hover:text-white line-clamp-1 mb-1">
                    {src.title}
                  </div>
                  <div className="font-body text-xs text-neutral-700 group-hover:text-neutral-300 line-clamp-2 leading-relaxed">
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

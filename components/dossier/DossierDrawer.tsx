'use client';

import { useState, useMemo, useRef } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { AudioTourPlayer } from './AudioTourPlayer';
import { MapViewer } from './MapViewer';
import { ThinkingReasoning } from '@/components/agent/ThinkingReasoning';
import { WebSearch } from '@/components/agent/WebSearch';
import { TodoList } from '@/components/agent/TodoList';
import { InlineCitations } from '@/components/agent/InlineCitations';
import { 
  X, 
  ExternalLink, 
  Compass, 
  Layers, 
  ArrowRight,
  Minus,
  Maximize2,
  Minimize2,
  Loader2,
  CheckCircle2,
  Clock,
  BookOpen
} from 'lucide-react';

export function DossierDrawer() {
  const isDossierOpen = useMindMapStore(s => s.isDossierOpen);
  const activeDossier = useMindMapStore(s => s.activeDossier);
  const isDossierLoading = useMindMapStore(s => s.isDossierLoading);
  const closeDossier = useMindMapStore(s => s.closeDossier);
  const startResearch = useMindMapStore(s => s.startResearch);
  const isResearching = useMindMapStore(s => s.isResearching);
  const currentTopic = useMindMapStore(s => s.currentTopic);
  const planSteps = useMindMapStore(s => s.planSteps);
  const thoughts = useMindMapStore(s => s.thoughts);
  const toolCalls = useMindMapStore(s => s.toolCalls);
  const sources = useMindMapStore(s => s.sources);
  const workstationTab = useMindMapStore(s => s.workstationTab);
  const setWorkstationTab = useMindMapStore(s => s.setWorkstationTab);
  const selectedModelId = useMindMapStore(s => s.selectedModelId);
  const availableModels = useMindMapStore(s => s.availableModels);
  const activeModel = availableModels.find(m => m.id === selectedModelId);
  const activeModelLabel = activeModel ? `${activeModel.name} · ${activeModel.provider_label}` : selectedModelId;

  const [isMinimized, setIsMinimized] = useState(false);
  const [isMagazineMode, setIsMagazineMode] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const completedStepsCount = planSteps.filter(s => s.status === 'done').length;

  const wordCount = useMemo(() => {
    if (!activeDossier) return 0;
    const fullText = [
      activeDossier.coreThesis || '',
      activeDossier.abstract || '',
      activeDossier.wowFact || '',
      ...(activeDossier.mechanisms?.map(m => `${m.title} ${m.explanation}`) || []),
      ...(activeDossier.timeline?.map(t => `${t.headline} ${t.description}`) || []),
    ].join(' ');
    return fullText.trim().split(/\s+/).filter(Boolean).length;
  }, [activeDossier]);

  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 220));

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const progress = el.scrollHeight - el.clientHeight > 0 
      ? (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100 
      : 0;
    setScrollProgress(progress);
  };

  if (!isDossierOpen) return null;

  // Minimized dock state in bottom-right corner
  if (isMinimized) {
    return (
      <div className="fixed right-4 sm:right-6 bottom-16 sm:bottom-6 z-30 bg-black text-white border-2 border-black p-3 font-mono text-xs uppercase font-bold tracking-wider flex items-center gap-3 shadow-none animate-fade">
        <div className="flex items-center gap-2">
          {isResearching ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <span className="w-2 h-2 bg-white" />
          )}
          <span className="truncate max-w-[180px] sm:max-w-[220px]">
            {isResearching 
              ? `AGENT: ${currentTopic || 'RESEARCHING...'}` 
              : `STORY: ${activeDossier?.title || currentTopic || 'MONOGRAPH'}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-neutral-700 pl-2">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 hover:bg-white hover:text-black transition-colors"
            title="Expand Workstation"
            aria-label="Expand workstation"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={closeDossier}
            className="p-1 hover:bg-white hover:text-black transition-colors"
            title="Close Workstation"
            aria-label="Close workstation"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const containerClasses = isMagazineMode
    ? 'fixed inset-0 z-50 bg-white flex flex-col shadow-none select-none animate-fade overflow-hidden'
    : 'fixed inset-x-0 bottom-0 top-12 md:top-0 md:inset-y-0 md:left-auto md:right-0 w-full md:w-[620px] md:max-w-[96vw] bg-white border-t-4 md:border-t-0 md:border-l-4 border-black z-40 md:z-30 flex flex-col shadow-none select-none animate-fade overflow-hidden';

  return (
    <div className={containerClasses}>
      
      {/* Top Scroll Progress Bar */}
      <div 
        className="h-[3px] bg-black transition-all duration-75 shrink-0" 
        style={{ width: `${scrollProgress}%` }} 
      />

      {/* Unified Window Titlebar & Tab Bar */}
      <div className="border-b-2 border-black bg-black text-white shrink-0">
        
        {/* Top Action & Window Controls */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10px] text-neutral-300 uppercase tracking-wider font-bold truncate max-w-[260px] sm:max-w-[340px]">
              {activeDossier?.title || currentTopic || 'Story'}
            </span>
            {wordCount > 0 && (
              <span className="hidden sm:inline-flex font-mono text-[9px] text-neutral-400 bg-neutral-900 border border-neutral-700 px-1.5 py-0.5">
                {readingTimeMinutes} MIN READ
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              onClick={() => setIsMagazineMode(!isMagazineMode)}
              className="p-1.5 border border-neutral-700 hover:border-white hover:bg-white hover:text-black transition-colors hidden sm:inline-flex"
              title={isMagazineMode ? "Side Drawer View" : "Fullscreen Magazine View"}
              aria-label="Toggle reader mode"
            >
              {isMagazineMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 border border-neutral-700 hover:border-white hover:bg-white hover:text-black transition-colors"
              title="Minimize"
              aria-label="Minimize dossier window"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={closeDossier}
              className="p-1.5 border border-neutral-700 hover:border-white hover:bg-white hover:text-black transition-colors"
              title="Close"
              aria-label="Close dossier window"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-4 pt-1 bg-neutral-950">
          <button
            onClick={() => setWorkstationTab('monograph')}
            className={`px-4 py-2 font-mono text-[11px] uppercase tracking-wider font-bold transition-colors border-t-2 border-r-2 ${
              workstationTab === 'monograph'
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Story</span>
              {isDossierLoading && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
            </div>
          </button>

          <button
            onClick={() => setWorkstationTab('agent')}
            className={`px-4 py-2 font-mono text-[11px] uppercase tracking-wider font-bold transition-colors border-t-2 border-r-2 ${
              workstationTab === 'agent'
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              {isResearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Sources &amp; Steps</span>
              {sources.length > 0 && (
                <span className="font-mono text-[9px] bg-neutral-800 text-neutral-300 px-1.5 py-0.5">
                  {sources.length}
                </span>
              )}
            </div>
          </button>
        </div>

      </div>

      {/* Tab 1: Monograph Document View */}
      {workstationTab === 'monograph' && (
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-8 space-y-7 custom-scrollbar"
        >
          <div className={isMagazineMode ? "max-w-3xl mx-auto space-y-8 py-4 md:py-8" : "space-y-7"}>
          {activeDossier ? (
            <>
              {/* Title Block */}
              <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  <span>{activeDossier.category || 'Topic'}</span>
                </div>
                <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-black leading-tight">
                  {activeDossier.title}
                </h2>
                {activeDossier.tagline && (
                  <p className="font-serif italic text-base text-neutral-700 pt-0.5">
                    "{activeDossier.tagline}"
                  </p>
                )}
              </div>

              {/* Audio Tour Player */}
              {activeDossier.audioTourScript && (
                <AudioTourPlayer
                  script={activeDossier.audioTourScript}
                  topicTitle={activeDossier.title}
                />
              )}

              {/* Did You Know Fact */}
              {activeDossier.wowFact && (
                <div className="p-3.5 border-l-4 border-black bg-neutral-50 space-y-1">
                  <div className="font-body text-xs md:text-sm text-black leading-relaxed italic">
                    <MarkdownContent content={activeDossier.wowFact} sources={activeDossier.sources} />
                  </div>
                </div>
              )}

              {/* Core Thesis / Overview */}
              {activeDossier.coreThesis && (
                <div className="space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1">
                    Overview
                  </div>
                  <div className="font-body text-sm md:text-base text-neutral-800 leading-relaxed space-y-2">
                    <MarkdownContent content={activeDossier.coreThesis} sources={activeDossier.sources} />
                  </div>
                </div>
              )}

              {/* Summary & Context */}
              {activeDossier.abstract && (
                <div className="space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1">
                    Context
                  </div>
                  <div className="font-body text-sm text-neutral-700 leading-relaxed">
                    <MarkdownContent content={activeDossier.abstract} sources={activeDossier.sources} />
                  </div>
                </div>
              )}

              {/* Key Concepts */}
              {activeDossier.mechanisms && activeDossier.mechanisms.length > 0 && (
                <div className="space-y-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1 flex items-center justify-between">
                    <span>Key Concepts</span>
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-3">
                    {activeDossier.mechanisms.map((mech, idx) => (
                      <div key={idx} className="p-4 border border-black space-y-2 bg-white">
                        <h4 className="font-serif text-base font-bold text-black">
                          {mech.title}
                        </h4>
                        <div className="font-body text-xs text-neutral-700 leading-relaxed">
                          <MarkdownContent content={mech.explanation} sources={activeDossier.sources} />
                        </div>
                        {mech.bulletPoints && mech.bulletPoints.length > 0 && (
                          <ul className="list-disc list-inside pt-2 space-y-1 font-body text-xs text-neutral-600 border-t border-neutral-200">
                            {mech.bulletPoints.map((bp, bIdx) => (
                              <li key={bIdx}>{bp}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chronological Timeline */}
              {activeDossier.timeline && activeDossier.timeline.length > 0 && (
                <div className="space-y-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1 flex items-center justify-between">
                    <span>Timeline</span>
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="border-l-2 border-black pl-4 ml-1 space-y-3">
                    {activeDossier.timeline.map((evt, idx) => (
                      <div key={idx} className="relative space-y-1">
                        <div className="font-mono text-[10px] font-bold text-black uppercase">
                          [{evt.date}] — {evt.headline}
                        </div>
                        <div className="font-body text-xs text-neutral-700 leading-relaxed">
                          <MarkdownContent content={evt.description} sources={activeDossier.sources} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Geographic & Historical Epicenter Map */}
              {activeDossier.geography && (
                <MapViewer geography={activeDossier.geography} />
              )}

              {/* Related Topics */}
              {activeDossier.rabbitHoles && activeDossier.rabbitHoles.length > 0 && (
                <div className="space-y-3 pt-1">
                  <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1 flex items-center justify-between">
                    <span>Related Topics</span>
                    <Compass className="w-3.5 h-3.5" />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {activeDossier.rabbitHoles.map((rh, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          startResearch(
                            rh.title,
                            rh.affinityCategory || activeDossier.category,
                            activeDossier.nodeId,
                            activeDossier.abstract || activeDossier.coreThesis,
                            rh.teaser || `Exploring related topic: ${rh.title}`
                          );
                        }}
                        className="p-3 border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors duration-100 text-left group flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between font-mono text-[9px] text-neutral-500 group-hover:text-neutral-300">
                          <span className="uppercase">{rh.affinityCategory || 'Topic'}</span>
                          <span>Explore →</span>
                        </div>
                        <div className="font-serif text-sm font-bold pt-0.5">
                          {rh.title}
                        </div>
                        <p className="font-body text-xs text-neutral-600 group-hover:text-neutral-300 pt-0.5 line-clamp-2">
                          {rh.teaser}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Citations */}
              {activeDossier.sources && activeDossier.sources.length > 0 && (
                <div className="space-y-2.5 pt-4 border-t-2 border-black">
                  <div className="font-mono text-[10px] uppercase tracking-widest font-bold">
                    Sources ({activeDossier.sources.length})
                  </div>
                  <div className="space-y-1 font-mono text-[10px]">
                    {activeDossier.sources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 border border-neutral-200 hover:border-black flex items-center justify-between text-neutral-700 hover:text-black transition-colors"
                      >
                        <span className="truncate pr-2">[{idx + 1}] {src.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Deep-Dive Action */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    startResearch(
                      activeDossier.title,
                      activeDossier.category,
                      activeDossier.nodeId,
                      activeDossier.abstract || activeDossier.coreThesis,
                      activeDossier.tagline || activeDossier.wowFact || `Deep dive into ${activeDossier.title}`
                    );
                  }}
                  className="w-full py-3 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase tracking-wider font-bold transition-colors duration-100 flex items-center justify-center gap-1.5"
                >
                  <span>Explore deeper branches →</span>
                </button>
              </div>
            </>
          ) : (
            isDossierLoading ? (
              <div className="space-y-5 animate-pulse-block" aria-busy="true">
                <div className="space-y-3">
                  <div className="w-40 h-5 bg-neutral-200 border border-black" />
                  <div className="w-3/4 h-9 bg-neutral-200 border border-black" />
                  <div className="w-1/2 h-4 bg-neutral-200 border border-black" />
                </div>
                <div className="w-full h-24 bg-neutral-100 border-2 border-black" />
                <div className="w-full h-3.5 bg-neutral-200 border border-black" />
                <div className="w-11/12 h-3.5 bg-neutral-200 border border-black" />
                <div className="w-4/5 h-3.5 bg-neutral-200 border border-black" />
                <div className="w-full h-2.5 bg-neutral-200 border border-black" />
                <div className="w-3/4 h-2.5 bg-neutral-200 border border-black" />
                <div className="w-2/3 h-2.5 bg-neutral-200 border border-black" />
              </div>
            ) : (
              <div className="text-center py-20 font-mono text-xs text-neutral-500 space-y-3">
                <p>[ SELECT ANY NODE ON THE CANVAS TO READ MONOGRAPH ]</p>
                {isResearching && (
                  <button
                    onClick={() => setWorkstationTab('agent')}
                    className="px-4 py-2 bg-black text-white font-mono text-xs uppercase font-bold hover:bg-neutral-800"
                  >
                    View Live Agent Stream →
                  </button>
                )}
              </div>
            )
          )}
          </div>
        </div>
      )}

      {/* Tab 2: Agent Activity Stream View */}
      {workstationTab === 'agent' && (
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4 custom-scrollbar">

          {/* Active Dispatch Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {isResearching ? (
                <span className="w-2 h-2 bg-black animate-pulse shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-black shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 font-bold">
                  {isResearching ? 'Researching' : 'Synthesis complete'}
                </div>
                <div className="font-serif text-sm font-bold text-black truncate flex items-center gap-2">
                  <span>{currentTopic || 'Research Topic'}</span>
                  {activeModelLabel && (
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-600 border border-neutral-300 px-1.5 py-0.5 bg-neutral-100">
                      {activeModelLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {!isResearching && activeDossier && (
              <button
                onClick={() => setWorkstationTab('monograph')}
                className="px-3 py-1.5 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-[10px] uppercase font-bold tracking-wider transition-colors duration-100 flex items-center gap-1.5 shrink-0"
              >
                <BookOpen className="w-3 h-3" />
                <span>Read Story</span>
              </button>
            )}
          </div>

          {/* Plan Phases (Cursor-style todo) */}
          {planSteps.length > 0 && <TodoList steps={planSteps} />}

          {/* Thinking Trace */}
          {thoughts.length > 0 && (
            <ThinkingReasoning
              lines={thoughts.map(t => t.text)}
              active={isResearching}
              doneLabel={`Thought for ${completedStepsCount > 0 ? `${completedStepsCount} phases` : `${thoughts.length} steps`}`}
            />
          )}

          {/* Web Search Queries & Discovered Sources */}
          {toolCalls.length > 0 ? (
            toolCalls
              .filter((tc, idx, arr) => tc.query && arr.findIndex(t => t.query === tc.query) === idx)
              .map((tc, idx) => (
                <WebSearch
                  key={tc.id || idx}
                  query={tc.query || currentTopic || 'topic'}
                  sources={sources}
                  active={tc.status === 'running' && isResearching}
                />
              ))
          ) : (
            sources.length > 0 && (
              <WebSearch
                query={currentTopic || 'topic'}
                sources={sources}
                active={isResearching}
              />
            )
          )}

          {/* Discovered Citations */}
          {sources.length > 0 && !isResearching && (
            <div className="space-y-2 pt-1">
              <InlineCitations sources={sources} />
            </div>
          )}

          {/* Model Attribution Footer */}
          {activeModelLabel && (
            <div className="pt-2.5 border-t-2 border-black flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-neutral-600 select-none">
              <span className="font-bold text-black">DISCOVERY SWARM</span>
              <span className="font-medium text-neutral-500">{activeModelLabel}</span>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

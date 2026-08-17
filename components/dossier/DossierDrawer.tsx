'use client';

import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { AudioTourPlayer } from './AudioTourPlayer';
import { MapViewer } from './MapViewer';
import { X, ExternalLink, Sparkles, Compass, Layers, Clock, ArrowRight } from 'lucide-react';

export function DossierDrawer() {
  const isDossierOpen = useMindMapStore(s => s.isDossierOpen);
  const activeDossier = useMindMapStore(s => s.activeDossier);
  const isDossierLoading = useMindMapStore(s => s.isDossierLoading);
  const closeDossier = useMindMapStore(s => s.closeDossier);
  const startResearch = useMindMapStore(s => s.startResearch);

  if (!isDossierOpen || !activeDossier) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] max-w-[96vw] bg-white border-l-4 border-black z-30 flex flex-col shadow-none select-none animate-fade overflow-hidden">
      
      {/* Editorial Header */}
      <div className="p-4 border-b-2 border-black flex items-center justify-between bg-black text-white shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest font-bold bg-white text-black px-2 py-0.5">
            {activeDossier.category}
          </span>
          <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
            {activeDossier.era || 'OVERVIEW'}
          </span>
          {isDossierLoading && (
            <span className="font-mono text-[9px] text-neutral-400 animate-pulse">
              [FETCHING FULL STORY...]
            </span>
          )}
        </div>
        <button
          onClick={closeDossier}
          className="p-1 text-neutral-400 hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Monograph Document Body */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">

        {/* Title Block */}
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 flex items-center justify-between">
            <span>TODAY I LEARNED STORY</span>
            {activeDossier.curiosityScore && (
              <span className="bg-neutral-100 border border-black px-1.5 py-0.5 text-black font-bold">
                CURIOSITY RATING {activeDossier.curiosityScore}/10
              </span>
            )}
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-black leading-tight">
            {activeDossier.title}
          </h2>
          {activeDossier.tagline && (
            <p className="font-serif italic text-base text-neutral-700 pt-1">
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


        {/* Action Banner for Vector Inquiries */}
        <div className="p-4 border-2 border-black bg-neutral-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-neutral-600 block">
              EXPAND THIS TOPIC
            </span>
            <span className="font-serif text-xs text-neutral-800">
              Grow new connected branches and explore deeper questions about this concept.
            </span>
          </div>
          <button
            onClick={() => {
              closeDossier();
              startResearch(
                activeDossier.title,
                activeDossier.category,
                activeDossier.nodeId,
                activeDossier.abstract || activeDossier.coreThesis,
                activeDossier.tagline || activeDossier.wowFact || `Deep dive into ${activeDossier.title}`
              );
            }}
            className="px-4 py-2 bg-black text-white font-mono text-xs uppercase tracking-wider font-bold hover:bg-neutral-800 transition-colors shrink-0 flex items-center gap-1"
          >
            <span>Deep-Dive Topic</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Did You Know Fact Banner */}
        {activeDossier.wowFact && (
          <div className="p-4 border-2 border-black bg-white space-y-1">
            <span className="font-mono text-[9px] uppercase tracking-widest font-bold flex items-center gap-1.5 text-neutral-500">
              <Sparkles className="w-3 h-3 text-neutral-600" /> DID YOU KNOW?
            </span>
            <div className="font-body text-sm text-black leading-relaxed italic">
              <MarkdownContent content={activeDossier.wowFact} />
            </div>
          </div>
        )}

        {/* Core Thesis */}
        {activeDossier.coreThesis && (
          <div className="space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1">
              1. THE BIG PICTURE & MAIN TAKEAWAY
            </div>
            <div className="font-body text-sm md:text-base text-neutral-800 leading-relaxed space-y-2">
              <MarkdownContent content={activeDossier.coreThesis} />
            </div>
          </div>
        )}

        {/* Overview & Abstract */}
        {activeDossier.abstract && (
          <div className="space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1">
              2. SUMMARY & KEY CONTEXT
            </div>
            <div className="font-body text-sm text-neutral-700 leading-relaxed">
              <MarkdownContent content={activeDossier.abstract} />
            </div>
          </div>
        )}

        {/* Mechanisms & Principles */}
        {activeDossier.mechanisms && activeDossier.mechanisms.length > 0 && (
          <div className="space-y-4">
            <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1 flex items-center justify-between">
              <span>3. HOW IT WORKS & KEY CONCEPTS ({activeDossier.mechanisms.length})</span>
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="space-y-3">
              {activeDossier.mechanisms.map((mech, idx) => (
                <div key={idx} className="p-4 border border-black space-y-2 bg-white">
                  <div className="font-mono text-[9px] uppercase text-neutral-500">
                    CONCEPT 0{idx + 1}
                  </div>
                  <h4 className="font-serif text-base font-bold text-black">
                    {mech.title}
                  </h4>
                  <div className="font-body text-xs text-neutral-700 leading-relaxed">
                    <MarkdownContent content={mech.explanation} />
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
          <div className="space-y-4">
            <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1 flex items-center justify-between">
              <span>4. KEY TIMELINE</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="border-l-2 border-black pl-4 ml-1 space-y-4">
              {activeDossier.timeline.map((evt, idx) => (
                <div key={idx} className="relative space-y-1">
                  <div className="font-mono text-[10px] font-bold text-black uppercase">
                    [{evt.date}] — {evt.headline}
                  </div>
                  <div className="font-body text-xs text-neutral-700 leading-relaxed">
                    <MarkdownContent content={evt.description} />
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

        {/* Downstream Rabbit Holes */}
        {activeDossier.rabbitHoles && activeDossier.rabbitHoles.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1 flex items-center justify-between">
              <span>5. RELATED RABBIT HOLES TO EXPLORE</span>
              <Compass className="w-3.5 h-3.5" />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {activeDossier.rabbitHoles.map((rh, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    closeDossier();
                    startResearch(
                      rh.title,
                      rh.affinityCategory || activeDossier.category,
                      activeDossier.nodeId,
                      activeDossier.abstract || activeDossier.coreThesis,
                      rh.teaser || `Exploring rabbit hole: ${rh.title}`
                    );
                  }}
                  className="p-3 border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors duration-100 text-left group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between font-mono text-[9px] text-neutral-500 group-hover:text-neutral-300">
                    <span className="uppercase">{rh.affinityCategory || 'RELATED TOPIC'}</span>
                    <span>EXPAND TOPIC →</span>
                  </div>
                  <div className="font-serif text-sm font-bold pt-1">
                    {rh.title}
                  </div>
                  <p className="font-body text-xs text-neutral-600 group-hover:text-neutral-300 pt-1 line-clamp-2">
                    {rh.teaser}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grounded Source Citations */}
        {activeDossier.sources && activeDossier.sources.length > 0 && (
          <div className="space-y-3 pt-4 border-t-2 border-black">
            <div className="font-mono text-[10px] uppercase tracking-widest font-bold">
              SOURCES & CITATIONS ({activeDossier.sources.length})
            </div>
            <div className="space-y-1.5 font-mono text-[10px]">
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

      </div>
    </div>
  );
}

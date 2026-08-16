'use client';

import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { X, ExternalLink } from 'lucide-react';

export function DossierDrawer() {
  const isDossierOpen = useMindMapStore(s => s.isDossierOpen);
  const activeDossier = useMindMapStore(s => s.activeDossier);
  const closeDossier = useMindMapStore(s => s.closeDossier);
  const startResearch = useMindMapStore(s => s.startResearch);

  if (!isDossierOpen || !activeDossier) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[580px] max-w-[95vw] bg-white border-l-4 border-black z-30 flex flex-col shadow-none select-none animate-fade overflow-hidden">
      
      {/* Editorial Header */}
      <div className="p-4 border-b-2 border-black flex items-center justify-between bg-black text-white">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest font-bold bg-white text-black px-1.5 py-0.5">
            {activeDossier.category}
          </span>
          <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
            {activeDossier.era || 'HISTORICAL ERA'}
          </span>
        </div>
        <button
          onClick={closeDossier}
          className="p-1 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Monograph Document Body */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">

        {/* Title Block */}
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            RESEARCH MONOGRAPH / DOSSIER
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

        {/* Wow Fact Banner */}
        {activeDossier.wowFact && (
          <div className="p-4 border-2 border-black bg-neutral-50 font-body text-sm text-black leading-relaxed">
            <span className="font-mono text-[9px] uppercase tracking-widest font-bold block mb-1 text-neutral-500">
              SALIENT FACT:
            </span>
            {activeDossier.wowFact}
          </div>
        )}

        {/* Core Thesis with Boxed Drop Cap */}
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1">
            I. CORE THESIS & SCIENTIFIC IMPLICATION
          </div>
          <div className="font-body text-sm md:text-base text-neutral-800 leading-relaxed space-y-2">
            <p className="first-letter:float-left first-letter:text-4xl first-letter:font-serif first-letter:font-bold first-letter:mr-3 first-letter:border-2 first-letter:border-black first-letter:p-2 first-letter:leading-none">
              {activeDossier.coreThesis}
            </p>
          </div>
        </div>

        {/* Overview & Abstract */}
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1">
            II. EXECUTIVE SYNTHESIS
          </div>
          <p className="font-body text-sm text-neutral-700 leading-relaxed">
            {activeDossier.abstract}
          </p>
        </div>

        {/* Mechanisms & Principles */}
        {activeDossier.mechanisms && activeDossier.mechanisms.length > 0 && (
          <div className="space-y-4">
            <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1">
              III. OPERATING MECHANISMS ({activeDossier.mechanisms.length})
            </div>
            <div className="space-y-3">
              {activeDossier.mechanisms.map((mech, idx) => (
                <div key={idx} className="p-4 border border-black space-y-1.5 bg-white">
                  <div className="font-mono text-[9px] uppercase text-neutral-500">
                    MECHANISM 0{idx + 1}
                  </div>
                  <h4 className="font-serif text-base font-bold text-black">
                    {mech.title}
                  </h4>
                  <p className="font-body text-xs text-neutral-700 leading-relaxed">
                    {mech.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chronological Timeline */}
        {activeDossier.timeline && activeDossier.timeline.length > 0 && (
          <div className="space-y-4">
            <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1">
              IV. CHRONOLOGY OF OCCURRENCES
            </div>
            <div className="border-l-2 border-black pl-4 ml-1 space-y-4">
              {activeDossier.timeline.map((evt, idx) => (
                <div key={idx} className="relative space-y-1">
                  <div className="font-mono text-[10px] font-bold text-black uppercase">
                    [{evt.date}] — {evt.headline}
                  </div>
                  <p className="font-body text-xs text-neutral-700 leading-relaxed">
                    {evt.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Downstream Rabbit Holes */}
        {activeDossier.rabbitHoles && activeDossier.rabbitHoles.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="font-mono text-[10px] uppercase tracking-widest font-bold border-b border-black pb-1">
              V. DOWNSTREAM INQUIRY VECTORS
            </div>
            <div className="grid grid-cols-1 gap-2">
              {activeDossier.rabbitHoles.map((rh, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    closeDossier();
                    startResearch(rh.title, rh.affinityCategory || activeDossier.category, activeDossier.nodeId);
                  }}
                  className="p-3 border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors duration-100 text-left group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between font-mono text-[9px] text-neutral-500 group-hover:text-neutral-300">
                    <span className="uppercase">{rh.affinityCategory || 'EXPLORATION'}</span>
                    <span>EXPAND CANVASES →</span>
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
              BIBLIOGRAPHY & GROUNDED SOURCES ({activeDossier.sources.length})
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

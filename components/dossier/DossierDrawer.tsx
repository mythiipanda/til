'use client';

import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { X, Sparkles, Clock, Compass, Layers, ExternalLink } from 'lucide-react';

export function DossierDrawer() {
  const isDossierOpen = useMindMapStore(s => s.isDossierOpen);
  const activeDossier = useMindMapStore(s => s.activeDossier);
  const closeDossier = useMindMapStore(s => s.closeDossier);
  const startResearch = useMindMapStore(s => s.startResearch);

  if (!isDossierOpen || !activeDossier) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] max-w-[95vw] bg-[#111827]/98 backdrop-blur-2xl border-l border-[#1e293b] z-30 flex flex-col shadow-2xl slide-in-right overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#0a0e17]/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#06b6d4]/10 text-[#06b6d4] font-semibold">
            {activeDossier.category}
          </span>
          <span className="text-xs text-[#94a3b8] truncate font-light">
            {activeDossier.era}
          </span>
        </div>
        <button
          onClick={closeDossier}
          className="p-1.5 text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1a2332] rounded-xl transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Hero Title & Tagline */}
        <div>
          <h2 className="text-xl font-bold text-[#e2e8f0] leading-tight">
            {activeDossier.title}
          </h2>
          <p className="text-xs text-[#06b6d4] mt-1 italic font-light">
            {activeDossier.tagline}
          </p>
        </div>

        {/* Wow Fact */}
        {activeDossier.wowFact && (
          <div className="p-3.5 rounded-xl bg-[#0a0e17] border border-[#06b6d4]/20 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#06b6d4] shrink-0 mt-0.5" />
            <p className="text-xs text-[#e2e8f0] leading-relaxed italic">
              {activeDossier.wowFact}
            </p>
          </div>
        )}

        {/* Core Thesis */}
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#64748b]">
            Core Thesis
          </h4>
          <p className="text-xs text-[#cbd5e1] leading-relaxed font-light bg-[#0a0e17] p-3 rounded-xl border border-[#1e293b]">
            {activeDossier.coreThesis}
          </p>
        </div>

        {/* Abstract */}
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#64748b]">
            Overview
          </h4>
          <p className="text-xs text-[#94a3b8] leading-relaxed">
            {activeDossier.abstract}
          </p>
        </div>

        {/* Mechanisms */}
        {activeDossier.mechanisms && activeDossier.mechanisms.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Core Mechanisms
            </h4>
            <div className="space-y-2.5">
              {activeDossier.mechanisms.map((mech, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#0a0e17] border border-[#1e293b] space-y-1.5">
                  <h5 className="text-xs font-semibold text-[#e2e8f0]">{mech.title}</h5>
                  <p className="text-[11px] text-[#94a3b8] leading-relaxed">{mech.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        {activeDossier.timeline && activeDossier.timeline.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Key Chronology
            </h4>
            <div className="space-y-2 border-l border-[#1e293b] pl-3 ml-1.5">
              {activeDossier.timeline.map((evt, idx) => (
                <div key={idx} className="relative space-y-0.5">
                  <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-[#06b6d4]" />
                  <span className="text-[10px] font-mono text-[#06b6d4]">{evt.date}</span>
                  <div className="text-xs font-medium text-[#e2e8f0]">{evt.headline}</div>
                  <p className="text-[11px] text-[#94a3b8] leading-relaxed">{evt.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rabbit Holes */}
        {activeDossier.rabbitHoles && activeDossier.rabbitHoles.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" /> Explore Rabbit Holes
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {activeDossier.rabbitHoles.map((rh, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    closeDossier();
                    startResearch(rh.title, rh.affinityCategory || activeDossier.category, activeDossier.nodeId);
                  }}
                  className="p-3 rounded-xl bg-[#0a0e17] border border-[#1e293b] hover:border-[#06b6d4]/40 text-left transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#e2e8f0] group-hover:text-[#06b6d4] transition-colors">
                      {rh.title}
                    </span>
                    <span className="text-[9px] font-mono text-[#475569]">{rh.affinityCategory}</span>
                  </div>
                  <p className="text-[10px] text-[#64748b] mt-1 line-clamp-2 leading-relaxed">
                    {rh.teaser}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sources List */}
        {activeDossier.sources && activeDossier.sources.length > 0 && (
          <div className="space-y-2 pt-2">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#64748b]">
              Grounded Sources ({activeDossier.sources.length})
            </h4>
            <div className="space-y-1.5">
              {activeDossier.sources.map((src, idx) => (
                <a
                  key={idx}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-[#0a0e17] border border-[#1e293b] hover:border-[#334155] text-xs text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
                >
                  <span className="truncate pr-2">{src.title}</span>
                  <ExternalLink className="w-3 h-3 text-[#475569] shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

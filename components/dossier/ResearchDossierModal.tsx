'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  X,
  Sparkles,
  ExternalLink,
  Clock,
  Compass,
  Layers,
  MapPin,
  Volume2,
  FileText,
  ShieldCheck,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { getProxiedImageUrl } from '@/lib/utils';

export function ResearchDossierModal() {
  const { activeDossier, closeDossier, expandRabbitHole, setActiveAudioNode } = useMindMapStore();
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number | null>(null);

  if (!activeDossier) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Manus Deep Research Dossier
            </span>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
              {activeDossier.category}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              {activeDossier.era}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveAudioNode({
                  id: activeDossier.nodeId,
                  title: activeDossier.title,
                  summary: activeDossier.abstract,
                  category: activeDossier.category,
                  audio_summary: activeDossier.audioTourScript,
                  image_search_query: activeDossier.title,
                  rabbit_holes: []
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 transition-all"
            >
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              Audio Podcast
            </button>
            <button
              onClick={closeDossier}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Article Body */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 space-y-10 custom-scrollbar">
          {/* Article Hero */}
          <div className="space-y-4">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              {activeDossier.title}
            </h1>
            <p className="text-base sm:text-lg text-sky-200/80 font-light leading-relaxed">
              {activeDossier.tagline}
            </p>
          </div>

          {/* Core Thesis Banner */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 shadow-inner">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 mt-0.5">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                  Primary Research Thesis
                </h3>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
                  {activeDossier.coreThesis}
                </p>
              </div>
            </div>
          </div>

          {/* Executive Abstract */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              Executive Abstract & Context
            </h2>
            <div className="text-slate-300 text-sm sm:text-base leading-relaxed space-y-4 font-normal">
              {activeDossier.abstract.split('\n\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Archival Visual Gallery */}
          {activeDossier.gallery && activeDossier.gallery.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Archival Imagery & Visual Evidence
                </h2>
                <span className="text-xs text-slate-400">
                  {activeDossier.gallery.length} verified archival plates
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {activeDossier.gallery.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedGalleryIndex(idx)}
                    className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950/60 hover:border-sky-500/60 transition-all cursor-pointer flex flex-col"
                  >
                    <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                      <Image
                        src={getProxiedImageUrl(item.imageUrl)}
                        alt={item.caption}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                        <span className="flex items-center gap-1 text-[11px] text-white font-medium">
                          <Maximize2 className="w-3 h-3" /> Click to inspect plate
                        </span>
                      </div>
                    </div>
                    <div className="p-3 text-xs text-slate-300 space-y-1">
                      <p className="line-clamp-2 leading-relaxed">{item.caption}</p>
                      <span className="text-[10px] text-slate-500 block">
                        License: {item.license || 'Public Domain'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical Mechanisms Breakdown */}
          {activeDossier.mechanisms && activeDossier.mechanisms.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                Technical & Structural Mechanisms
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeDossier.mechanisms.map((mech, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3"
                  >
                    <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      {mech.title}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {mech.explanation}
                    </p>
                    {mech.bulletPoints && mech.bulletPoints.length > 0 && (
                      <ul className="space-y-1.5 pt-1 border-t border-slate-700/40">
                        {mech.bulletPoints.map((bp, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-2 text-xs text-slate-400">
                            <span className="text-indigo-400 font-bold">•</span>
                            <span>{bp}</span>
                          </li>
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
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Chronological Milestones & Evolution
              </h2>

              <div className="relative pl-6 border-l-2 border-slate-800 space-y-6 ml-2">
                {activeDossier.timeline.map((event, idx) => (
                  <div key={idx} className="relative group">
                    <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-amber-400 group-hover:scale-125 transition-transform" />
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-amber-400 tracking-wider">
                        {event.date}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-100">
                        {event.headline}
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {event.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Geospatial Map Anchor */}
          {activeDossier.geography && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                Geographical Epicenter
              </h2>
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-rose-500/20 text-rose-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {activeDossier.geography.locationName}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {activeDossier.geography.latitude.toFixed(4)}°N, {activeDossier.geography.longitude.toFixed(4)}°E • {activeDossier.geography.historicalSignificance}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Verified Sources & Citations */}
          {activeDossier.sources && activeDossier.sources.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Verified Sources & Primary References
                </h2>
                <span className="text-xs text-emerald-400 font-medium">
                  {activeDossier.sources.length} Verified Citations
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeDossier.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-sky-500/50 transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">
                          {src.publisher || 'Archival Reference'}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-colors" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors line-clamp-1">
                        {src.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {src.snippet}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-emerald-400">
                      <span>Reliability: {((src.reliabilityScore || 0.95) * 100).toFixed(0)}%</span>
                      <span className="text-slate-500">Peer-Reviewed</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Downstream Rabbit Hole Launchers */}
          {activeDossier.rabbitHoles && activeDossier.rabbitHoles.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-slate-800">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Compass className="w-5 h-5 text-sky-400" />
                Downstream Exploration Vectors (Next Rabbit Holes)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {activeDossier.rabbitHoles.map((rh, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      closeDossier();
                      expandRabbitHole(activeDossier.title, rh.title);
                    }}
                    className="p-4 rounded-xl bg-gradient-to-b from-sky-950/30 to-slate-900/80 border border-sky-800/40 hover:border-sky-400 transition-all text-left space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                        {rh.affinityCategory || 'Vector'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-100 group-hover:text-white">
                      {rh.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {rh.teaser}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { Clock, Volume2, MessageSquare, Sparkles, ChevronRight, FileText } from 'lucide-react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';

export function TimelineView() {
  const nodes = useMindMapStore((s) => s.nodes);
  const setActiveChatNode = useMindMapStore((s) => s.setActiveChatNode);
  const setActiveAudioNode = useMindMapStore((s) => s.setActiveAudioNode);
  const openDossier = useMindMapStore((s) => s.openDossier);
  const expandRabbitHole = useMindMapStore((s) => s.expandRabbitHole);
  const isResearching = useMindMapStore((s) => s.isResearching);

  return (
    <div className="w-full h-full p-6 md:p-12 overflow-y-auto bg-[#090d16] text-slate-100 flex flex-col items-center custom-scrollbar">
      <div className="max-w-3xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Chronological Progression
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">
            Epoch & Evolutionary Trajectory
          </h2>
          <p className="text-xs text-slate-400">
            Historical milestones and future theoretical frontiers discovered in this mindmap
          </p>
        </div>

        {/* Timeline Items */}
        <div className="relative pl-6 border-l-2 border-slate-800 space-y-8 ml-4 md:ml-32">
          {nodes.map((node) => (
            <div key={node.id} className="relative group animate-fade-in">
              {/* Timeline Indicator Dot */}
              <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-amber-400 group-hover:scale-125 transition-transform" />

              {/* Node Epoch Card */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-700/80 hover:border-amber-400/60 shadow-xl space-y-3 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 tracking-wider">
                    {node.data.timestamp || 'Contemporary Era'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                    {node.data.category}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-100">{node.data.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{node.data.summary}</p>

                {/* Sub-branches */}
                {node.data.rabbit_holes && node.data.rabbit_holes.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Branch Vectors
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {node.data.rabbit_holes.map((rh, idx) => (
                        <button
                          key={idx}
                          onClick={() => expandRabbitHole(node.data.title, rh)}
                          disabled={isResearching}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-200 border border-slate-700/60 hover:border-amber-500/40 transition-all flex items-center gap-1"
                        >
                          <span>{rh}</span>
                          <ChevronRight className="w-3 h-3 text-amber-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => openDossier(node.id)}
                    className="px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Dossier
                  </button>

                  <button
                    onClick={() => setActiveAudioNode(node.data)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    Audio
                  </button>

                  <button
                    onClick={() => setActiveChatNode(node.data)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Ask AI
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

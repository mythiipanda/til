'use client';

import React from 'react';
import {
  X,
  Trophy,
  Sparkles,
  Compass,
  Layers,
  Share2,
  Download,
  Flame,
  Award,
} from 'lucide-react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';

interface CuriosityHeatmapProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CuriosityHeatmap({ isOpen, onClose }: CuriosityHeatmapProps) {
  const stats = useMindMapStore((s) => s.stats);
  const nodes = useMindMapStore((s) => s.nodes);

  if (!isOpen) return null;

  const totalCategories = Object.keys(stats.categoriesVisited).length;
  const categoriesList = Object.entries(stats.categoriesVisited) as [string, number][];

  const handleExportGraphJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(nodes.map((n) => n.data), null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'curiosity_mindmap_export.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-lg rounded-3xl bg-slate-900/95 border border-slate-700/80 shadow-2xl p-6 text-slate-100 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                Curiosity Index & Profile
              </h3>
              <span className="text-xs text-slate-400">
                Cognitive Exploration Metrics
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center space-y-1">
            <div className="flex items-center justify-center text-sky-400 mb-1">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-xl font-extrabold text-white">
              {stats.nodesExplored}
            </span>
            <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Nodes Visited
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center space-y-1">
            <div className="flex items-center justify-center text-amber-400 mb-1">
              <Flame className="w-4 h-4" />
            </div>
            <span className="text-xl font-extrabold text-white">
              {stats.rabbitHolesExpanded}
            </span>
            <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Rabbit Holes
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center space-y-1">
            <div className="flex items-center justify-center text-emerald-400 mb-1">
              <Compass className="w-4 h-4" />
            </div>
            <span className="text-xl font-extrabold text-white">
              {stats.deepestDepth}
            </span>
            <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Deepest Tier
            </p>
          </div>
        </div>

        {/* Categories Breakdown */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Category Affinity Distribution
            </span>
            <span className="text-slate-500 font-mono text-[11px]">
              {totalCategories} Domains
            </span>
          </div>

          <div className="space-y-2">
            {categoriesList.map(([cat, count]: [string, number], idx: number) => {
              const totalNodes = stats.nodesExplored || 1;
              const percentage = Math.round((count / totalNodes) * 100);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{cat}</span>
                    <span className="font-mono text-sky-400">{percentage}% ({count})</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={handleExportGraphJSON}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-700"
          >
            <Download className="w-4 h-4" />
            Export Graph (.json)
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { CATEGORIES } from '@/types';

export default function LandingState() {
  const [customTopic, setCustomTopic] = useState('');
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [isStartingResearch, setIsStartingResearch] = useState(false);

  const loadRandomHubByCategory = useMindMapStore(s => s.loadRandomHubByCategory);
  const startResearch = useMindMapStore(s => s.startResearch);
  const precomputedHubs = useMindMapStore(s => s.precomputedHubs);

  const handleCategoryClick = async (cat: string) => {
    setLoadingCategory(cat);
    try {
      await loadRandomHubByCategory(cat);
    } finally {
      setLoadingCategory(null);
    }
  };

  const handleCustomResearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic.trim()) return;
    setIsStartingResearch(true);
    startResearch(customTopic.trim(), 'General');
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 select-none overflow-y-auto p-6 texture-paper">
      <div className="w-full max-w-4xl bg-white border-2 border-black p-8 md:p-14 space-y-10 shadow-none animate-drop">

        {/* Masthead Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b-2 border-black pb-4 gap-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-widest bg-black text-white px-2 py-0.5 font-bold">
              TDILEARNED
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
              VOL. XXIV — EDITION 2026
            </span>
          </div>
          <div className="font-mono text-[11px] tracking-wider text-neutral-600">
            {precomputedHubs.length > 0 ? `${precomputedHubs.length} PRE-RESEARCHED HUBS LOADED` : 'SYNCHRONIZED LOCAL ARCHIVES'}
          </div>
        </div>

        {/* Hero Title & Subtext */}
        <div className="space-y-4">
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-normal tracking-tight text-black leading-none">
            Discovery through <span className="italic font-normal">essence.</span>
          </h1>
          <p className="font-body text-base md:text-lg text-neutral-700 max-w-2xl leading-relaxed pt-2">
            An infinite-canvas knowledge engine. Select a realm of inquiry below to instantly explore verified pre-researched monographs, or commission the agent swarm for real-time synthesis.
          </p>
        </div>

        {/* Category Fast Launch Grid */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between border-b border-black pb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold">
              [ 01 ] SELECT INQUIRY REALM (INSTANT 876-HUB EXPLORATION)
            </span>
            <span className="font-mono text-[10px] text-neutral-400">
              ZERO-LATENCY OFFLINE CATALOG
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
            {CATEGORIES.map((cat, idx) => {
              const isLoading = loadingCategory === cat;
              return (
                <button
                  key={cat}
                  disabled={isLoading || isStartingResearch}
                  onClick={() => handleCategoryClick(cat)}
                  className="group relative p-3 border border-black bg-white hover:bg-black hover:text-white transition-colors duration-100 text-left flex flex-col justify-between h-24 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
                >
                  <div className="flex items-center justify-between w-full font-mono text-[10px] text-neutral-500 group-hover:text-neutral-300">
                    <span>0{idx + 1}</span>
                    <span>→</span>
                  </div>
                  <div>
                    <span className="font-serif text-sm md:text-base font-bold uppercase tracking-tight block">
                      {cat}
                    </span>
                    <span className="font-mono text-[9px] text-neutral-500 group-hover:text-neutral-300 uppercase tracking-tighter">
                      {isLoading ? 'LOADING...' : 'INSTANT HUB'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Scratch Inquiry Form */}
        <div className="space-y-3 pt-4 border-t-2 border-black">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold">
              [ 02 ] OR COMMISSION NEW RESEARCH FROM SCRATCH
            </span>
            <span className="font-mono text-[10px] text-neutral-400">
              CEREBRAS + MISTRAL SWARM
            </span>
          </div>

          <form onSubmit={handleCustomResearchSubmit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              placeholder="e.g. The Antikythera Mechanism, Fermi Paradox, Medieval Manuscripts..."
              className="flex-1 border-2 border-black p-3 font-body text-sm text-black placeholder:text-neutral-400 placeholder:italic outline-none focus:bg-neutral-50"
            />
            <button
              type="submit"
              disabled={!customTopic.trim() || isStartingResearch}
              className="px-6 py-3 bg-black text-white font-mono text-xs uppercase tracking-widest font-bold hover:bg-white hover:text-black hover:border-2 hover:border-black transition-colors duration-100 disabled:opacity-40"
            >
              {isStartingResearch ? 'LAUNCHING...' : 'RUN SWARM →'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

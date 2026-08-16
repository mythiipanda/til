'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { CATEGORIES } from '@/types';
import { Sparkles, ArrowRight, Search } from 'lucide-react';

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
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 select-none overflow-y-auto p-4 md:p-8 texture-paper">
      <div className="w-full max-w-4xl bg-white border-2 border-black p-6 md:p-12 space-y-8 shadow-none animate-drop">

        {/* Masthead Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-black pb-3 gap-2">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs uppercase tracking-widest bg-black text-white px-2 py-0.5 font-bold">
              TDILEARNED
            </span>
            <span className="font-serif italic text-sm text-neutral-600">
              Today I Learned
            </span>
          </div>
          <div className="font-mono text-[11px] text-neutral-500">
            {precomputedHubs.length > 0 ? `${precomputedHubs.length} curated topics ready to explore` : 'Hundreds of topics ready to read'}
          </div>
        </div>

        {/* Hero Title & Subtext */}
        <div className="space-y-3">
          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-normal tracking-tight text-black leading-tight">
            What did you <span className="italic font-normal">learn today?</span>
          </h1>
          <p className="font-body text-sm sm:text-base text-neutral-700 max-w-2xl leading-relaxed">
            Explore the fascinating stories and surprising connections you never knew you were curious about. Pick a category to jump in right away, or search any topic you want to explore.
          </p>
        </div>

        {/* Category Fast Launch Grid */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between border-b border-black pb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> [ 1 ] PICK A CATEGORY TO EXPLORE INSTANTLY
            </span>
            <span className="font-mono text-[10px] text-neutral-500 hidden sm:inline">
              Instant topic selection
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
            {CATEGORIES.map((cat, idx) => {
              const isLoading = loadingCategory === cat;
              return (
                <button
                  key={cat}
                  disabled={isLoading || isStartingResearch}
                  onClick={() => handleCategoryClick(cat)}
                  className="group p-3 border border-black bg-white hover:bg-black hover:text-white transition-colors duration-100 text-left flex flex-col justify-between h-24 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
                >
                  <div className="flex items-center justify-between w-full font-mono text-[10px] text-neutral-400 group-hover:text-neutral-300">
                    <span>0{idx + 1}</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="font-serif text-sm sm:text-base font-bold uppercase tracking-tight block">
                      {cat}
                    </span>
                    <span className="font-mono text-[9px] text-neutral-500 group-hover:text-neutral-300">
                      {isLoading ? 'Opening topic...' : 'Explore topic →'}
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
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
              <Search className="w-3 h-3" /> [ 2 ] OR SEARCH ANY TOPIC YOU'RE CURIOUS ABOUT
            </span>
            <span className="font-mono text-[10px] text-neutral-500 hidden sm:inline">
              Researched live with verified sources
            </span>
          </div>

          <form onSubmit={handleCustomResearchSubmit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              placeholder="e.g. The Dancing Plague of 1518, How GPS works, Antikythera Mechanism..."
              className="flex-1 border-2 border-black p-3 font-body text-sm text-black placeholder:text-neutral-400 placeholder:italic outline-none focus:bg-neutral-50"
            />
            <button
              type="submit"
              disabled={!customTopic.trim() || isStartingResearch}
              className="px-6 py-3 bg-black text-white font-mono text-xs uppercase tracking-wider font-bold hover:bg-neutral-800 transition-colors duration-100 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <span>{isStartingResearch ? 'Researching...' : 'Research Topic'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { CATEGORIES } from '@/types';
import { ArrowRight, Search, ChevronDown, ChevronUp, Shuffle, Sparkles } from 'lucide-react';

const FLAGSHIP_CATEGORIES = ['Science', 'History', 'Mathematics', 'Technology', 'Philosophy'] as const;

const TRENDING_SPARKS = [
  'Voynich Manuscript',
  'Fermi Paradox',
  'Antikythera Mechanism',
  'Bronze Age Collapse',
  'Quantum Entanglement',
  'Library of Alexandria',
] as const;

export default function LandingState() {
  const [customTopic, setCustomTopic] = useState('');
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [isStartingResearch, setIsStartingResearch] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

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

  const handleSurpriseMe = async () => {
    const randomCat = FLAGSHIP_CATEGORIES[Math.floor(Math.random() * FLAGSHIP_CATEGORIES.length)];
    await handleCategoryClick(randomCat);
  };

  const handleCustomResearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic.trim()) return;
    setIsStartingResearch(true);
    startResearch(customTopic.trim(), 'General');
  };

  const handleSparkClick = (spark: string) => {
    setIsStartingResearch(true);
    startResearch(spark, 'General');
  };

  const remainingCategories = CATEGORIES.filter(c => !FLAGSHIP_CATEGORIES.includes(c as any));

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 select-none overflow-y-auto p-4 sm:p-6 md:p-12">
      <div className="w-full max-w-4xl bg-white border-2 md:border-4 border-black p-6 sm:p-8 md:p-12 space-y-8 sm:space-y-10 shadow-none animate-fade my-auto">

        {/* Masthead Rule & Label */}
        <div className="flex items-center justify-between border-b-2 md:border-b-4 border-black pb-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-black" />
            <span className="font-mono text-[10px] sm:text-xs uppercase font-bold tracking-widest text-black">
              TDILEARNED ARCHIVE
            </span>
          </div>
          <div className="font-mono text-[9px] sm:text-[11px] uppercase tracking-wider text-neutral-500">
            {precomputedHubs.length > 0 ? `${precomputedHubs.length} CURATED TOPICS ONLINE` : 'AGENTIC KNOWLEDGE ENGINE'}
          </div>
        </div>

        {/* Oversized Hero Headline */}
        <div className="space-y-3 sm:space-y-4">
          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-normal tracking-tight text-black leading-[0.98]">
            What did you <br className="hidden sm:inline" />
            <span className="italic font-normal">learn today?</span>
          </h1>
          <p className="font-body text-sm sm:text-base md:text-lg text-neutral-800 max-w-2xl leading-relaxed">
            Dynamic agentic research translated into infinite spatial mindmaps. Select a core pillar or start any curiosity inquiry.
          </p>
        </div>

        {/* Category Fast Launch Grid */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-300 pb-2 font-mono text-[10px] sm:text-xs uppercase font-bold tracking-widest text-black">
            <span>Explore by Pillar</span>
            <button
              onClick={handleSurpriseMe}
              disabled={loadingCategory !== null || isStartingResearch}
              className="flex items-center gap-1.5 hover:underline underline-offset-4 text-neutral-700 hover:text-black transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Surprise Me</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
            {FLAGSHIP_CATEGORIES.map((cat, idx) => {
              const isLoading = loadingCategory === cat;
              return (
                <button
                  key={cat}
                  disabled={isLoading || isStartingResearch}
                  onClick={() => handleCategoryClick(cat)}
                  className="group p-3 sm:p-4 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors duration-100 text-left flex flex-col justify-between h-24 sm:h-28 disabled:opacity-40"
                >
                  <div className="flex items-center justify-between w-full font-mono text-[10px] text-neutral-500 group-hover:text-neutral-400">
                    <span>0{idx + 1}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <div>
                    <span className="font-serif text-base sm:text-lg font-bold tracking-tight block">
                      {cat}
                    </span>
                    <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-neutral-500 group-hover:text-neutral-300">
                      {isLoading ? 'Loading...' : 'Explore →'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Expandable Secondary Categories */}
          <div>
            <button
              onClick={() => setShowAllCategories(!showAllCategories)}
              className="font-mono text-[10px] sm:text-xs uppercase font-bold tracking-wider text-neutral-600 hover:text-black flex items-center gap-1.5 transition-colors pt-1"
            >
              <span>{showAllCategories ? '[-] Less categories' : `[+] ${remainingCategories.length} More categories`}</span>
              {showAllCategories ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showAllCategories && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 animate-fade">
                {remainingCategories.map((cat) => {
                  const isLoading = loadingCategory === cat;
                  return (
                    <button
                      key={cat}
                      disabled={isLoading || isStartingResearch}
                      onClick={() => handleCategoryClick(cat)}
                      className="p-2.5 border border-black bg-white hover:bg-black hover:text-white font-mono text-[11px] uppercase font-bold tracking-wider text-left flex items-center justify-between transition-colors duration-100"
                    >
                      <span className="truncate">{cat}</span>
                      <ArrowRight className="w-3 h-3 opacity-60" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Live Search Inquiry Form */}
        <div className="space-y-3 pt-2 border-t-2 border-black">
          <div className="flex items-center justify-between font-mono text-[10px] sm:text-xs uppercase font-bold tracking-widest text-black">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>Search or Propose Inquiry</span>
            </div>
            <span className="text-[10px] text-neutral-500 hidden sm:inline">
              Instant AI Research
            </span>
          </div>

          <form onSubmit={handleCustomResearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              placeholder="e.g. Voynich Manuscript, Antikythera Mechanism, Fermi Paradox..."
              className="flex-1 border-2 border-black p-3.5 font-body text-sm sm:text-base text-black placeholder:text-neutral-400 placeholder:italic outline-none focus:bg-neutral-50"
            />
            <button
              type="submit"
              disabled={!customTopic.trim() || isStartingResearch}
              className="px-6 py-3.5 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase tracking-widest font-bold transition-colors duration-100 disabled:opacity-40 flex items-center justify-center gap-2 shrink-0 min-h-[44px]"
            >
              <span>{isStartingResearch ? 'Researching...' : 'Explore →'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Trending Spark Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500 pr-1">
              <Sparkles className="w-3 h-3" />
              <span>Try:</span>
            </div>
            {TRENDING_SPARKS.map((spark) => (
              <button
                key={spark}
                onClick={() => handleSparkClick(spark)}
                disabled={isStartingResearch}
                className="font-mono text-[10px] border border-neutral-300 hover:border-black bg-neutral-50 hover:bg-black hover:text-white px-2.5 py-1 transition-colors duration-100 rounded-none"
              >
                {spark}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

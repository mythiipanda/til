'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { Search, X } from 'lucide-react';
import { CATEGORIES } from '@/types';

interface HubBrowserProps {
  onClose: () => void;
}

export function HubBrowser({ onClose }: HubBrowserProps) {
  const hubs = useMindMapStore(s => s.precomputedHubs);
  const loadPrecomputedHub = useMindMapStore(s => s.loadPrecomputedHub);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredHubs = hubs.filter(hub => {
    const matchesSearch = hub.topic.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          hub.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory ? hub.category === activeCategory : true;
    return matchesSearch && matchesCategory;
  });

  const handleLoadHub = async (id: string) => {
    await loadPrecomputedHub(id);
    onClose();
  };

  return (
    <div className="fixed left-6 top-20 bottom-6 w-[360px] max-w-[90vw] bg-white border-2 border-black z-30 flex flex-col shadow-none select-none animate-fade">
      
      {/* Header */}
      <div className="p-4 border-b-2 border-black flex items-center justify-between bg-black text-white">
        <div>
          <h2 className="font-serif text-base font-bold uppercase tracking-wider">ARCHIVAL CATALOG</h2>
          <p className="font-mono text-[9px] text-neutral-400 mt-0.5">{filteredHubs.length} PRECOMPUTED MONOGRAPHS</p>
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 space-y-3 border-b border-black bg-neutral-50">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter archives by keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-black pl-9 pr-3 py-2 font-body text-xs text-black placeholder:text-neutral-400 placeholder:italic outline-none focus:border-2 focus:border-black"
          />
        </div>
        
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-2 py-1 font-mono text-[9px] uppercase tracking-wider font-bold transition-colors ${
              activeCategory === null 
                ? 'bg-black text-white' 
                : 'bg-white border border-neutral-300 text-neutral-600 hover:border-black'
            }`}
          >
            ALL
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2 py-1 font-mono text-[9px] uppercase tracking-wider font-bold transition-colors ${
                activeCategory === cat 
                  ? 'bg-black text-white' 
                  : 'bg-white border border-neutral-300 text-neutral-600 hover:border-black'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Hub Cards Listing */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {filteredHubs.length === 0 ? (
          <div className="text-center py-12 font-mono text-xs text-neutral-500">
            [ NO ARCHIVES MATCH CRITERIA ]
          </div>
        ) : (
          filteredHubs.map(hub => (
            <button
              key={hub.id}
              onClick={() => handleLoadHub(hub.id)}
              className="w-full text-left p-3 border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors duration-100 group flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between w-full font-mono text-[9px] text-neutral-500 group-hover:text-neutral-300">
                <span className="uppercase font-bold">{hub.category}</span>
                <span>OPEN ARCHIVE →</span>
              </div>
              <h3 className="font-serif text-sm font-bold leading-snug line-clamp-2">
                {hub.topic}
              </h3>
              <p className="font-body text-[11px] text-neutral-600 group-hover:text-neutral-300 line-clamp-2 leading-relaxed">
                {hub.summary}
              </p>
            </button>
          ))
        )}
      </div>

    </div>
  );
}

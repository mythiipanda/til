'use client';

import { useState, useEffect } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { Search, X, Zap } from 'lucide-react';
import { CATEGORIES } from '@/types';
import { api } from '@/lib/api';

interface HubBrowserProps {
  onClose: () => void;
}

interface DisplayTopic {
  id?: string;
  topic: string;
  category: string;
  summary: string;
  precomputed: boolean;
}

export function HubBrowser({ onClose }: HubBrowserProps) {
  const hubs = useMindMapStore(s => s.precomputedHubs);
  const loadPrecomputedHub = useMindMapStore(s => s.loadPrecomputedHub);
  const startResearch = useMindMapStore(s => s.startResearch);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [catalogList, setCatalogList] = useState<DisplayTopic[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const res = await api.catalog(2000);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.topics) {
            setCatalogList(
              data.topics.map((t: any) => ({
                id: t.id,
                topic: t.title || t.topic,
                category: t.category || 'General',
                summary: t.summary || '',
                precomputed: !!t.precomputed,
              }))
            );
          }
        }
      } catch (e) {
        console.warn('Catalog load fallback:', e);
      }
    }
    loadCatalog();
    return () => { isMounted = false; };
  }, []);

  // Merge Supabase hubs + catalog
  const mergedTopics: DisplayTopic[] = [];
  const seen = new Set<string>();

  // 1. Add all Supabase precomputed hubs
  hubs.forEach(h => {
    seen.add(h.topic.toLowerCase().trim());
    mergedTopics.push({
      id: h.id,
      topic: h.topic,
      category: h.category || 'General',
      summary: h.summary || '',
      precomputed: true,
    });
  });

  // 2. Add extra catalog topics
  catalogList.forEach(c => {
    const key = c.topic.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      mergedTopics.push(c);
    }
  });

  const filteredTopics = mergedTopics.filter(item => {
    const matchesSearch = item.topic.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory ? item.category.toLowerCase() === activeCategory.toLowerCase() : true;
    return matchesSearch && matchesCategory;
  });

  const handleSelectTopic = async (item: DisplayTopic) => {
    if (item.precomputed && item.id) {
      await loadPrecomputedHub(item.id);
    } else {
      startResearch(item.topic, item.category);
    }
    onClose();
  };

  return (
    <div className="fixed left-4 md:left-6 top-20 bottom-6 w-[420px] max-w-[92vw] bg-white border-2 border-black z-30 flex flex-col shadow-none select-none animate-fade">
      
      {/* Header */}
      <div className="p-4 border-b-2 border-black flex items-center justify-between bg-black text-white">
        <div>
          <h2 className="font-serif text-base font-bold uppercase tracking-wider">Topics</h2>
          <p className="font-mono text-[9px] text-neutral-400 mt-0.5">
            {filteredTopics.length} topics available
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-white transition-colors"
          title="Close"
          aria-label="Close topic browser"
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
            placeholder="Search topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-black pl-9 pr-3 py-2 font-body text-xs text-black placeholder:text-neutral-400 placeholder:italic outline-none focus:border-2 focus:border-black"
          />
        </div>
        
        <div className="flex flex-wrap gap-1 max-h-[84px] overflow-y-auto no-scrollbar">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-2 py-1 font-mono text-[9px] uppercase tracking-wider font-bold transition-colors ${
              activeCategory === null 
                ? 'bg-black text-white' 
                : 'bg-white border border-neutral-300 text-neutral-600 hover:border-black'
            }`}
          >
            All ({mergedTopics.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = mergedTopics.filter(i => i.category.toLowerCase() === cat.toLowerCase()).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2 py-1 font-mono text-[9px] uppercase tracking-wider font-bold transition-colors ${
                  activeCategory?.toLowerCase() === cat.toLowerCase()
                    ? 'bg-black text-white' 
                    : 'bg-white border border-neutral-300 text-neutral-600 hover:border-black'
                }`}
              >
                {cat} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Topics Scroll Listing */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {filteredTopics.length === 0 ? (
          <div className="text-center py-16 font-mono text-xs text-neutral-500">
            No topics match search
          </div>
        ) : (
          filteredTopics.map((item, idx) => (
            <button
              key={`${item.topic}-${idx}`}
              onClick={() => handleSelectTopic(item)}
              className="w-full text-left p-3 border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors duration-100 group flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between w-full font-mono text-[9px]">
                <span className="uppercase font-bold text-neutral-500 group-hover:text-neutral-300">
                  {item.category}
                </span>

                {item.precomputed ? (
                  <span className="bg-black group-hover:bg-white text-white group-hover:text-black px-1.5 py-0.5 font-bold flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" />
                    <span>Ready</span>
                  </span>
                ) : (
                  <span className="text-neutral-500 group-hover:text-neutral-300">
                    Explore →
                  </span>
                )}
              </div>

              <h3 className="font-serif text-sm font-bold leading-snug line-clamp-2">
                {item.topic}
              </h3>

              {item.summary && (
                <p className="font-body text-[11px] text-neutral-600 group-hover:text-neutral-300 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>
              )}
            </button>
          ))
        )}
      </div>

    </div>
  );
}

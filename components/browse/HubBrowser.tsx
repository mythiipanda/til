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
    <div className="fixed inset-x-0 bottom-0 top-12 md:top-20 md:bottom-6 md:left-6 w-full md:w-[420px] md:max-w-[92vw] bg-white border-t-4 md:border-2 border-black z-40 md:z-30 flex flex-col shadow-none select-none animate-fade">
      
      {/* Titlebar */}
      <div className="p-3 bg-black text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-white shrink-0" />
          <span className="font-mono text-xs uppercase font-bold tracking-widest">
            Topics ({filteredTopics.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-neutral-800 transition-colors"
          title="Close Catalog"
          aria-label="Close catalog"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-3 border-b-2 border-black bg-neutral-50 space-y-2 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter by keyword or summary..."
            className="w-full pl-9 pr-3 py-2 border-2 border-black text-xs font-mono bg-white outline-none focus:bg-white placeholder:text-neutral-400"
          />
        </div>

        {/* Category Pills (Single-Row Horizontal Scroll) */}
        <div className="flex gap-1.5 overflow-x-auto py-1 custom-scrollbar shrink-0">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-2.5 py-1 font-mono text-[10px] uppercase font-bold whitespace-nowrap border transition-colors shrink-0 ${
              activeCategory === null
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-neutral-300 hover:border-black'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`px-2.5 py-1 font-mono text-[10px] uppercase font-bold whitespace-nowrap border transition-colors shrink-0 ${
                activeCategory === cat
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-neutral-300 hover:border-black'
              }`}
            >
              {cat}
            </button>
          ))}
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

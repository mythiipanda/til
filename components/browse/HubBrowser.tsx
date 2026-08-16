'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { Search, X, BookOpen } from 'lucide-react';
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
    <div className="fixed left-4 top-4 bottom-4 w-[300px] bg-[#111827]/95 backdrop-blur-xl border border-[#1e293b] rounded-2xl z-20 flex flex-col shadow-xl slide-in-right">
      
      {/* Header */}
      <div className="p-4 border-b border-[#1e293b] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-[#e2e8f0]">Browse Topics</h2>
          <p className="text-[10px] text-[#475569] mt-0.5">{filteredHubs.length} available</p>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 text-[#475569] hover:text-[#e2e8f0] hover:bg-[#1a2332] rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Filters */}
      <div className="p-3 space-y-3 border-b border-[#1e293b]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-xl pl-9 pr-3 py-2 text-xs text-[#e2e8f0] placeholder-[#475569] outline-none focus:border-[#06b6d4] transition-colors"
          />
        </div>
        
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
              activeCategory === null 
                ? 'bg-[#e2e8f0] text-[#0f172a]' 
                : 'bg-[#1a2332] text-[#94a3b8] hover:text-[#e2e8f0]'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                activeCategory === cat 
                  ? 'bg-[#06b6d4] text-[#0a0e17]' 
                  : 'bg-[#1a2332] text-[#94a3b8] hover:text-[#e2e8f0]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredHubs.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#475569]">
            No topics found matching your criteria.
          </div>
        ) : (
          <div className="space-y-1">
            {filteredHubs.map(hub => (
              <button
                key={hub.id}
                onClick={() => handleLoadHub(hub.id)}
                className="w-full text-left p-3 hover:bg-[#1a2332] rounded-xl transition-colors group"
              >
                <div className="flex gap-3">
                  {hub.imageUrl ? (
                    <img 
                      src={hub.imageUrl} 
                      alt={hub.topic} 
                      className="w-12 h-12 rounded-lg object-cover bg-[#0a0e17] flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#0a0e17] border border-[#1e293b] flex items-center justify-center flex-shrink-0 text-[#475569]">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-[#e2e8f0] truncate group-hover:text-[#06b6d4] transition-colors">{hub.topic}</h3>
                    </div>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-medium text-[#06b6d4] bg-[#06b6d4]/10 mb-1">
                      {hub.category}
                    </span>
                    <p className="text-xs text-[#94a3b8] line-clamp-2 leading-relaxed">
                      {hub.summary}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

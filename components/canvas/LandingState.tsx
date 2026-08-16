'use client';

import { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';

const categories = [
  { name: 'Science', color: '#10b981' },
  { name: 'History', color: '#f59e0b' },
  { name: 'Technology', color: '#06b6d4' },
  { name: 'Mathematics', color: '#8b5cf6' },
  { name: 'Philosophy', color: '#ec4899' },
];

export default function LandingState() {
  const [loading, setLoading] = useState(false);
  const pickRandomTopic = useMindMapStore(s => s.pickRandomTopic);

  const handlePick = async (cat: string) => {
    setLoading(true);
    try {
      await pickRandomTopic(cat);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 fade-up pointer-events-auto">
      <div className="text-center space-y-8 max-w-lg px-4">
        <div>
          <h1 className="text-3xl tracking-tight">
            <span className="font-light text-[#64748b]">TDI</span>
            <span className="font-semibold text-[#e2e8f0]">LEARNED</span>
          </h1>
          <p className="text-[#64748b] text-sm mt-3 font-light">
            What are you curious about today?
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2.5">
          {categories.map(cat => (
            <button
              key={cat.name}
              disabled={loading}
              onClick={() => handlePick(cat.name)}
              className="px-5 py-2.5 rounded-full text-[13px] font-medium text-white/90 transition-all hover:scale-[1.04] active:scale-[0.97] disabled:opacity-40 disabled:hover:scale-100"
              style={{
                backgroundColor: cat.color + 'cc',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-[#64748b] text-xs fade-in">
            <span className="shimmer-text">Finding something fascinating</span>
            <span className="font-mono tabular-nums">...</span>
          </div>
        )}
      </div>
    </div>
  );
}

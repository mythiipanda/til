'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';

const CATEGORY_COLORS: Record<string, string> = {
  Science: '#10b981',
  History: '#f59e0b',
  Technology: '#06b6d4',
  Mathematics: '#8b5cf6',
  Philosophy: '#ec4899',
};

interface ResearchNodeData extends Record<string, unknown> {
  id?: string;
  title: string;
  summary: string;
  imageUrl?: string | null;
  category?: string | null;
  curiosity_score?: number | null;
  wow_fact?: string | null;
  rabbit_holes?: string[];
  isRoot?: boolean;
}

function ResearchNodeComponent({ data }: { data: ResearchNodeData }) {
  const startResearch = useMindMapStore(s => s.startResearch);
  const openDossier = useMindMapStore(s => s.openDossier);
  const color = CATEGORY_COLORS[data.category || ''] || '#475569';

  return (
    <div
      className={`rounded-xl bg-[#111827] border w-[280px] shadow-sm hover:shadow-lg transition-all duration-200 group ${
        data.isRoot
          ? 'border-[#06b6d4]/25'
          : 'border-[#1e293b] hover:border-[#334155]'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-2 !h-2" />

      {/* Drag handle area — image or gradient */}
      <div className="dragHandle cursor-grab active:cursor-grabbing">
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt=""
            className="w-full h-[110px] object-cover rounded-t-xl pointer-events-none"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-[110px] rounded-t-xl pointer-events-none"
            style={{ background: `linear-gradient(135deg, ${color}15, ${color}08)` }}
          />
        )}
      </div>

      {/* Content */}
      <div className="p-3.5 space-y-2">
        {data.category && (
          <span
            className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              color: color,
              backgroundColor: color + '18',
            }}
          >
            {data.category}
          </span>
        )}

        <button
          className="nodrag nopan text-left w-full"
          onClick={() => data.id && openDossier(data.id)}
        >
          <h3 className="text-[13px] font-semibold text-[#e2e8f0] leading-snug line-clamp-2 hover:text-[#f8fafc] transition-colors">
            {data.title}
          </h3>
        </button>

        <p className="text-[11px] text-[#94a3b8] leading-relaxed line-clamp-2">
          {data.summary}
        </p>

        {data.wow_fact && (
          <div className="flex items-start gap-1.5 pt-0.5">
            <Sparkles className="w-3 h-3 text-[#06b6d4] mt-0.5 shrink-0" />
            <p className="text-[10px] text-[#06b6d4]/80 italic leading-relaxed line-clamp-2">
              {data.wow_fact}
            </p>
          </div>
        )}

        {data.rabbit_holes && data.rabbit_holes.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1.5">
            {data.rabbit_holes.slice(0, 3).map((rh, i) => (
              <button
                key={i}
                className="nodrag nopan text-[10px] bg-[#0a0e17] hover:bg-[#1e293b] text-[#94a3b8] hover:text-[#e2e8f0] px-2 py-1 rounded-md transition-colors font-medium"
                onClick={() => startResearch(rh, data.category || undefined, data.id)}
              >
                {rh}
              </button>
            ))}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-2 !h-2" />
    </div>
  );
}

export default memo(ResearchNodeComponent);

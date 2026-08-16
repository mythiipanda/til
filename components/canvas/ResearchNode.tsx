'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';

interface ResearchNodeData extends Record<string, unknown> {
  id?: string;
  nodeId?: string;
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
  const targetNodeId = String(data.id || data.nodeId || '');

  return (
    <div
      className={`group w-[300px] bg-white text-black transition-colors duration-100 select-none ${
        data.isRoot
          ? 'border-2 border-black'
          : 'border border-black hover:border-black'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-1 !h-1" />

      {/* Top Drag Handle Header */}
      <div className="dragHandle cursor-grab active:cursor-grabbing border-b border-black p-2 flex items-center justify-between bg-black text-white">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-widest font-bold">
            {data.category || 'TOPIC'}
          </span>
          {data.isRoot && (
            <span className="font-mono text-[9px] bg-white text-black px-1.5 py-0.2 uppercase font-bold tracking-tighter">
              HUB ROOT
            </span>
          )}
        </div>
        <span className="font-mono text-[9px] text-neutral-400">
          {data.curiosity_score ? `SCORE ${data.curiosity_score}/10` : 'DISCOVERY'}
        </span>
      </div>

      {/* Image container if available */}
      {data.imageUrl && (
        <div className="dragHandle cursor-grab active:cursor-grabbing relative h-[120px] w-full border-b border-black overflow-hidden bg-neutral-100">
          <img
            src={data.imageUrl}
            alt=""
            className="w-full h-full object-cover grayscale contrast-125 transition-all duration-300 group-hover:scale-105 group-hover:grayscale-0 pointer-events-none"
            loading="lazy"
          />
        </div>
      )}

      {/* Card Body */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <button
          className="nodrag nopan text-left w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
          onClick={() => targetNodeId && openDossier(targetNodeId)}
        >
          <h3 className="font-serif text-[15px] font-bold leading-snug line-clamp-2 hover:underline decoration-1 underline-offset-2">
            {data.title}
          </h3>
        </button>

        {/* Summary */}
        <p className="font-body text-[12px] text-neutral-700 leading-relaxed line-clamp-3">
          {data.summary}
        </p>

        {/* Wow Fact Callout */}
        {data.wow_fact && (
          <div className="p-2 border-l-2 border-black bg-neutral-50 text-[11px] font-body italic text-neutral-800 leading-snug">
            "{data.wow_fact}"
          </div>
        )}

        {/* Rabbit Hole Exploration Vectors */}
        {data.rabbit_holes && data.rabbit_holes.length > 0 && (
          <div className="pt-2 border-t border-neutral-200 space-y-1.5">
            <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">
              Vectors of Inquiry:
            </div>
            <div className="space-y-1">
              {data.rabbit_holes.slice(0, 3).map((rh, i) => (
                <button
                  key={i}
                  className="nodrag nopan w-full text-left font-mono text-[10px] py-1 px-1.5 border border-neutral-200 hover:border-black hover:bg-black hover:text-white transition-colors duration-100 flex items-center justify-between group/btn"
                  onClick={() => startResearch(rh, data.category || undefined, targetNodeId)}
                >
                  <span className="truncate pr-1">{rh}</span>
                  <span className="opacity-60 group-hover/btn:opacity-100">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Card Footer actions */}
        <div className="pt-1 flex items-center justify-between font-mono text-[9px] text-neutral-500">
          <button
            onClick={() => targetNodeId && openDossier(targetNodeId)}
            className="nodrag nopan hover:text-black uppercase tracking-wider underline underline-offset-2"
          >
            Read Dossier →
          </button>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-1 !h-1" />
    </div>
  );
}

export default memo(ResearchNodeComponent);

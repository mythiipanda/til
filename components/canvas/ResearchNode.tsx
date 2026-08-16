'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { Sparkles, ArrowUpRight, BookOpen, Layers } from 'lucide-react';

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
  const selectedNodeId = useMindMapStore(s => s.selectedNodeId);

  const targetNodeId = String(data.id || data.nodeId || '');
  const isSelected = selectedNodeId === targetNodeId;

  return (
    <div
      className={`group w-[320px] bg-white text-black transition-all duration-100 select-none ${
        data.isRoot
          ? 'border-4 border-black'
          : isSelected
          ? 'border-2 border-black ring-4 ring-black/10'
          : 'border-2 border-black hover:border-black'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-1 !h-1" />

      {/* Top Header Tag */}
      <div className="dragHandle cursor-grab active:cursor-grabbing border-b-2 border-black p-2.5 flex items-center justify-between bg-black text-white">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-widest font-bold">
            {data.category || 'INQUIRY'}
          </span>
          {data.isRoot ? (
            <span className="font-mono text-[9px] bg-white text-black px-1.5 py-0.2 uppercase font-bold tracking-tight">
              ROOT MONOGRAPH
            </span>
          ) : (
            <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-tight">
              SUB-VECTOR
            </span>
          )}
        </div>
        <span className="font-mono text-[9px] text-neutral-400">
          {data.curiosity_score ? `SCORE ${data.curiosity_score}/10` : 'GROUNDED'}
        </span>
      </div>

      {/* Optional Grayscale-to-Color Image */}
      {data.imageUrl && (
        <div className="dragHandle cursor-grab active:cursor-grabbing relative h-[130px] w-full border-b-2 border-black overflow-hidden bg-neutral-100">
          <img
            src={data.imageUrl}
            alt=""
            className="w-full h-full object-cover grayscale contrast-125 transition-all duration-300 group-hover:scale-105 group-hover:grayscale-0 pointer-events-none"
            loading="lazy"
          />
        </div>
      )}

      {/* Card Content */}
      <div className="p-4 space-y-3">
        {/* Title Action */}
        <button
          className="nodrag nopan text-left w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-black group/title"
          onClick={() => targetNodeId && openDossier(targetNodeId)}
        >
          <h3 className="font-serif text-[16px] font-bold leading-snug line-clamp-2 group-hover/title:underline decoration-2 underline-offset-2">
            {data.title}
          </h3>
        </button>

        {/* Markdown Summary */}
        <div className="font-body text-[12px] text-neutral-800 leading-relaxed line-clamp-3">
          <MarkdownContent content={data.summary} />
        </div>

        {/* Wow Fact Callout */}
        {data.wow_fact && (
          <div className="p-2.5 border-l-2 border-black bg-neutral-50 text-[11px] font-body italic text-neutral-900 leading-snug flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2">"{data.wow_fact}"</span>
          </div>
        )}

        {/* Downstream Vectors */}
        {data.rabbit_holes && data.rabbit_holes.length > 0 && (
          <div className="pt-2 border-t border-neutral-200 space-y-1.5">
            <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 flex items-center justify-between">
              <span>Connected Vectors:</span>
              <Layers className="w-3 h-3" />
            </div>
            <div className="space-y-1">
              {data.rabbit_holes.slice(0, 3).map((rh, i) => (
                <button
                  key={i}
                  className="nodrag nopan w-full text-left font-mono text-[10px] py-1.5 px-2 border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors duration-100 flex items-center justify-between group/btn"
                  onClick={() => startResearch(rh, data.category || undefined, targetNodeId)}
                >
                  <span className="truncate pr-1">{rh}</span>
                  <ArrowUpRight className="w-3 h-3 opacity-60 group-hover/btn:opacity-100 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="pt-2 border-t border-neutral-200 flex items-center justify-between font-mono text-[10px]">
          <button
            onClick={() => targetNodeId && openDossier(targetNodeId)}
            className="nodrag nopan flex items-center gap-1 font-bold text-black uppercase tracking-wider hover:underline underline-offset-2"
          >
            <BookOpen className="w-3 h-3" />
            <span>{data.isRoot ? 'Read Full Dossier' : 'Inspect Vector'}</span>
          </button>

          {!data.isRoot && (
            <button
              onClick={() => startResearch(data.title, data.category || undefined, targetNodeId)}
              className="nodrag nopan text-neutral-500 hover:text-black uppercase tracking-tight font-medium"
            >
              Expand +
            </button>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-1 !h-1" />
    </div>
  );
}

export default memo(ResearchNodeComponent);

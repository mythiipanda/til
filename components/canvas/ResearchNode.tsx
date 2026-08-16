'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { Sparkles, ArrowUpRight, BookOpen, Plus } from 'lucide-react';

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
  const selectNode = useMindMapStore(s => s.selectNode);
  const selectedNodeId = useMindMapStore(s => s.selectedNodeId);

  const targetNodeId = String(data.id || data.nodeId || '');
  const isSelected = selectedNodeId === targetNodeId;

  const handleCardClick = () => {
    if (targetNodeId) {
      selectNode(targetNodeId);
      openDossier(targetNodeId);
    }
  };

  const handleExpandRabbitHole = (rh: string) => {
    startResearch(
      rh,
      data.category || undefined,
      targetNodeId,
      data.summary,
      `Exploring rabbit hole "${rh}" originating from "${data.title}"`
    );
  };

  const handleDeepDiveSubtopic = () => {
    startResearch(
      data.title,
      data.category || undefined,
      targetNodeId,
      data.summary,
      data.wow_fact || `Deep dive into ${data.title}`
    );
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group bg-white text-black transition-all duration-100 select-none shadow-md cursor-pointer ${
        data.isRoot
          ? 'w-[420px] border-4 border-black'
          : isSelected
          ? 'w-[380px] border-2 border-black ring-4 ring-black/25'
          : 'w-[380px] border-2 border-black hover:border-black hover:shadow-xl'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-1 !h-1" />

      {/* Top Header Tag */}
      <div className="dragHandle cursor-grab active:cursor-grabbing border-b-2 border-black p-3 flex items-center justify-between bg-black text-white">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest font-bold">
            {data.category || 'TOPIC'}
          </span>
          {data.isRoot ? (
            <span className="font-mono text-[10px] bg-white text-black px-2 py-0.5 uppercase font-bold tracking-tight">
              MAIN TOPIC
            </span>
          ) : (
            <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-tight">
              SUBTOPIC
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] text-neutral-300">
          {data.curiosity_score ? `RATING ${data.curiosity_score}/10` : 'VERIFIED'}
        </span>
      </div>

      {/* Large Grayscale-to-Color Image */}
      {data.imageUrl && (
        <div className="dragHandle cursor-grab active:cursor-grabbing relative h-[160px] w-full border-b-2 border-black overflow-hidden bg-neutral-100">
          <img
            src={data.imageUrl}
            alt=""
            className="w-full h-full object-cover grayscale contrast-125 transition-all duration-300 group-hover:scale-105 group-hover:grayscale-0 pointer-events-none"
            loading="lazy"
          />
        </div>
      )}

      {/* Card Content */}
      <div className="p-5 space-y-3.5" onClick={e => e.stopPropagation()}>
        {/* Title Action */}
        <button
          className="nodrag nopan text-left w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-black group/title"
          onClick={handleCardClick}
        >
          <h3 className={`font-serif font-bold leading-snug line-clamp-2 group-hover/title:underline decoration-2 underline-offset-2 ${
            data.isRoot ? 'text-xl md:text-2xl text-black' : 'text-lg text-black'
          }`}>
            {data.title}
          </h3>
        </button>

        {/* Markdown Summary */}
        <div className="font-body text-[13px] text-neutral-800 leading-relaxed line-clamp-3">
          <MarkdownContent content={data.summary} />
        </div>

        {/* Did You Know Fact Callout */}
        {data.wow_fact && (
          <div className="p-3 border-l-2 border-black bg-neutral-50 text-[12px] font-body italic text-neutral-900 leading-snug flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-neutral-700" />
            <span className="line-clamp-2">"{data.wow_fact}"</span>
          </div>
        )}

        {/* Downstream Rabbit Holes */}
        {data.rabbit_holes && data.rabbit_holes.length > 0 && (
          <div className="pt-2 border-t border-neutral-200 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              Related rabbit holes:
            </div>
            <div className="space-y-1.5">
              {data.rabbit_holes.slice(0, 3).map((rh, i) => (
                <button
                  key={i}
                  className="nodrag nopan w-full text-left font-mono text-[11px] py-1.5 px-2.5 border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors duration-100 flex items-center justify-between group/btn"
                  onClick={() => handleExpandRabbitHole(rh)}
                >
                  <span className="truncate pr-1">{rh}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover/btn:opacity-100 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="pt-2 border-t border-neutral-200 flex items-center justify-between font-mono text-[11px]">
          <button
            onClick={handleCardClick}
            className="nodrag nopan flex items-center gap-1.5 font-bold text-black uppercase tracking-wider hover:underline underline-offset-2"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{data.isRoot ? 'Read Full Story' : 'Read Overview'}</span>
          </button>

          {!data.isRoot && (
            <button
              onClick={handleDeepDiveSubtopic}
              className="nodrag nopan text-neutral-700 hover:text-black uppercase tracking-tight font-semibold flex items-center gap-1 border border-neutral-300 hover:border-black px-2 py-1 bg-white hover:bg-neutral-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Explore deeper</span>
            </button>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-1 !h-1" />
    </div>
  );
}

export default memo(ResearchNodeComponent);

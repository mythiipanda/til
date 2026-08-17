'use client';

import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { ArrowUpRight, BookOpen, Plus } from 'lucide-react';

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
  const closeDossier = useMindMapStore(s => s.closeDossier);
  const [imgLoaded, setImgLoaded] = useState(false);

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
      className={`group bg-white text-black transition-none select-none shadow-none cursor-pointer ${
        data.isRoot
          ? 'w-[420px] border-4 border-black'
          : isSelected
          ? 'w-[380px] border-4 border-black'
          : 'w-[380px] border-2 border-black hover:border-4'
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
            <span className="font-mono text-[10px] bg-white text-black px-1.5 py-0.2 uppercase font-bold tracking-tight">
              ORIGIN
            </span>
          ) : null}
        </div>
        {data.curiosity_score ? (
          <span className="font-mono text-[10px] text-neutral-300">
            {data.curiosity_score}/10
          </span>
        ) : null}
      </div>

      {/* Grayscale-to-Color Image */}
      {data.imageUrl && (
        <div className="dragHandle cursor-grab active:cursor-grabbing relative h-[160px] w-full border-b-2 border-black overflow-hidden bg-neutral-100">
          {!imgLoaded && (
            <div className="absolute inset-0 animate-pulse-block bg-neutral-200" />
          )}
          <img
            src={data.imageUrl}
            alt=""
            className="w-full h-full object-cover grayscale contrast-125 transition-[filter] duration-300 group-hover:grayscale-0 pointer-events-none image-outline"
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
          />
        </div>
      )}

      {/* Card Content */}
      <div className="p-5 space-y-4" onClick={e => e.stopPropagation()}>
        {/* Title Action */}
        <button
          className="nodrag nopan text-left w-full focus-visible:outline-none group/title"
          onClick={handleCardClick}
        >
          <h3 className={`font-serif font-bold leading-tight line-clamp-2 group-hover/title:underline decoration-2 underline-offset-4 ${
            data.isRoot ? 'text-2xl text-black' : 'text-xl text-black'
          }`}>
            {data.title}
          </h3>
        </button>

        {/* Markdown Summary */}
        <div className="font-body text-sm text-neutral-800 leading-relaxed line-clamp-3">
          <MarkdownContent content={data.summary} />
        </div>

        {/* Key Fact Blockquote */}
        {data.wow_fact && (
          <div className="p-3 border-l-4 border-black bg-neutral-50 text-xs font-body italic text-neutral-900 leading-relaxed">
            &ldquo;{data.wow_fact}&rdquo;
          </div>
        )}

        {/* Related Topics / Next Inquiries */}
        {data.rabbit_holes && data.rabbit_holes.length > 0 && (
          <div className="pt-2 border-t-2 border-black space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest font-bold text-neutral-600">
              Related topics:
            </div>
            <div className="space-y-1.5">
              {data.rabbit_holes.slice(0, 3).map((rh, i) => (
                <button
                  key={i}
                  className="nodrag nopan w-full text-left font-mono text-xs py-2 px-3 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors duration-100 flex items-center justify-between group/btn"
                  onClick={() => handleExpandRabbitHole(rh)}
                >
                  <span className="truncate pr-2">{rh}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover/btn:opacity-100 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="pt-3 border-t-2 border-black flex items-center justify-between font-mono text-xs">
          <button
            onClick={handleCardClick}
            className="nodrag nopan flex items-center gap-1.5 font-bold text-black uppercase tracking-wider hover:underline underline-offset-4"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read story</span>
          </button>

          {!data.isRoot && (
            <button
              onClick={handleDeepDiveSubtopic}
              className="nodrag nopan text-black hover:text-white uppercase tracking-wider font-bold flex items-center gap-1 border-2 border-black px-2.5 py-1 bg-white hover:bg-black transition-colors duration-100"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Explore</span>
            </button>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-1 !h-1" />
    </div>
  );
}

export default memo(ResearchNodeComponent);

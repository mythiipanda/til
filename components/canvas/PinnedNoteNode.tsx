'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { BookmarkCheck, X, ExternalLink, MessageSquare } from 'lucide-react';
import type { PinnedNoteData } from '@/types';

function PinnedNoteNodeComponent({ data }: { data: PinnedNoteData }) {
  const deleteNode = useMindMapStore(s => s.deleteNode);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.id) {
      deleteNode(data.id);
    }
  };

  return (
    <div className="bg-white text-black border-2 border-black w-[360px] shadow-none select-none group transition-none animate-fade">
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-1 !h-1" />

      {/* Note Header / Drag Handle */}
      <div className="dragHandle cursor-grab active:cursor-grabbing border-b-2 border-black p-3 bg-black text-white flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest font-bold">
          <BookmarkCheck className="w-3.5 h-3.5" />
          <span className="truncate max-w-[200px]">
            PINNED: {data.sourceNodeTitle || 'INSIGHT'}
          </span>
        </div>
        <button
          onClick={handleDelete}
          className="nodrag nopan p-0.5 border border-white hover:bg-white hover:text-black transition-colors duration-100"
          title="Remove Note"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Note Content */}
      <div className="p-5 space-y-4">
        {/* User Question */}
        <div className="space-y-1.5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3" />
            <span>INQUIRY</span>
          </div>
          <div className="font-serif font-bold text-base text-black leading-snug">
            &ldquo;{data.question}&rdquo;
          </div>
        </div>

        {/* Answer */}
        <div className="border-t-2 border-black pt-3 font-body text-xs text-neutral-800 leading-relaxed max-h-[220px] overflow-y-auto custom-scrollbar">
          <MarkdownContent content={data.answer} />
        </div>

        {/* Citations */}
        {data.citations && data.citations.length > 0 && (
          <div className="border-t border-neutral-200 pt-3 space-y-1.5">
            <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">
              VERIFIED CITATIONS:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.citations.map((c, i) => (
                <a
                  key={i}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nodrag nopan inline-flex items-center gap-1 font-mono text-[10px] text-black bg-white hover:bg-black hover:text-white border border-black px-2 py-1 transition-colors duration-100"
                >
                  <span className="truncate max-w-[140px]">{c.title || `Source ${i + 1}`}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-1 !h-1" />
    </div>
  );
}

export default memo(PinnedNoteNodeComponent);

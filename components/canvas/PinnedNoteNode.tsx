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
    <div className="bg-white text-black border-2 border-black w-[340px] shadow-lg select-none group transition-all animate-drop">
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-1 !h-1" />

      {/* Note Header / Drag Handle */}
      <div className="dragHandle cursor-grab active:cursor-grabbing border-b-2 border-black p-2.5 bg-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider font-bold text-neutral-700">
          <BookmarkCheck className="w-3.5 h-3.5 text-black" />
          <span className="truncate max-w-[190px]">
            PINNED INSIGHT: {data.sourceNodeTitle || 'TOPIC'}
          </span>
        </div>
        <button
          onClick={handleDelete}
          className="nodrag nopan p-1 text-neutral-400 hover:text-black hover:bg-neutral-200 transition-colors"
          title="Remove Note"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Note Content */}
      <div className="p-4 space-y-3">
        {/* User Question */}
        <div className="space-y-1">
          <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> INQUIRY:
          </div>
          <div className="font-serif font-bold text-sm text-black leading-snug">
            "{data.question}"
          </div>
        </div>

        {/* Answer */}
        <div className="border-t border-neutral-200 pt-2.5 font-body text-xs text-neutral-800 leading-relaxed max-h-[220px] overflow-y-auto custom-scrollbar">
          <MarkdownContent content={data.answer} />
        </div>

        {/* Citations */}
        {data.citations && data.citations.length > 0 && (
          <div className="border-t border-neutral-200 pt-2 space-y-1">
            <div className="font-mono text-[8px] uppercase tracking-widest text-neutral-400">
              Verified Sources:
            </div>
            <div className="flex flex-wrap gap-1">
              {data.citations.map((c, i) => (
                <a
                  key={i}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nodrag nopan inline-flex items-center gap-1 font-mono text-[9px] text-neutral-600 hover:text-black hover:underline bg-neutral-50 border border-neutral-200 px-1.5 py-0.5"
                >
                  <span className="truncate max-w-[120px]">{c.title || `Source ${i + 1}`}</span>
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

'use client';

import { ExternalLink } from 'lucide-react';

interface InlineCitationsProps {
  sources: Array<{ id?: string; title?: string; url: string }>;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Numbered citation markers rendered as clean editorial cards linking directly to their origin.
 */
export function InlineCitations({ sources }: InlineCitationsProps) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="border-t-2 border-black pt-2.5 mt-2 space-y-1.5 select-none">
      <div className="font-mono text-[9px] uppercase tracking-widest font-bold text-neutral-500 pb-1">
        Sources ({sources.length})
      </div>
      <div className="space-y-1">
        {sources.map((src, i) => (
          <a
            key={src.id || i}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-body text-xs text-neutral-800 hover:text-black hover:underline underline-offset-2 leading-snug group py-0.5"
          >
            <span className="font-mono text-[9px] font-bold text-black bg-neutral-100 border border-black/20 px-1 py-0.5 shrink-0">
              [{i + 1}]
            </span>
            <span className="truncate min-w-0 flex-1">{src.title || src.url}</span>
            <span className="font-mono text-[9px] text-neutral-400 group-hover:text-black shrink-0 ml-auto border border-neutral-200 px-1 py-0.5 flex items-center gap-1">
              <span>{getDomain(src.url)}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

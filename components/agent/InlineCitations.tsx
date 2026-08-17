'use client';

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
 * Numbered citation markers rendered as superscript chips in the prose, plus
 * a compact source footer linking each number to its origin.
 */
export function InlineCitations({ sources }: InlineCitationsProps) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="border-t-2 border-black pt-2 mt-1 space-y-1">
      {sources.map((src, i) => (
        <a
          key={src.id || i}
          href={src.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-baseline gap-2 font-body text-[11px] text-neutral-700 hover:text-black hover:underline underline-offset-2 leading-snug group"
        >
          <span className="font-mono text-[9px] font-bold text-black group-hover:text-black shrink-0">
            [{i + 1}]
          </span>
          <span className="truncate min-w-0">{src.title || src.url}</span>
          <span className="font-mono text-[9px] text-neutral-500 shrink-0 ml-auto">
            {getDomain(src.url)}
          </span>
        </a>
      ))}
    </div>
  );
}

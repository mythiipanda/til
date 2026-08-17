'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface ThinkingReasoningProps {
  lines: string[];
  active: boolean;
  /** Label for the folded state, e.g. "Thought for 4s" */
  doneLabel?: ReactNode;
}

/**
 * Collapsible thinking block. While `active`, it shimmers "Thinking…" and the
 * reasoning is always open, revealing each new line as it streams in. Once
 * done it folds into a "Thought for Ns" summary that the user can toggle.
 */
export function ThinkingReasoning({ lines, active, doneLabel }: ThinkingReasoningProps) {
  const [open, setOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  // While active, keep the reasoning expanded so streamed lines are visible.
  const expanded = active ? true : open;

  const toggle = useCallback(() => {
    if (active) return;
    setOpen((o) => !o);
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  }, [active]);

  return (
    <div className="border-2 border-black bg-white">
      <button
        type="button"
        className={`w-full flex items-center justify-between px-3 py-2 text-left ${
          active ? 'cursor-default' : 'cursor-pointer hover:bg-neutral-100'
        }`}
        onClick={toggle}
        aria-expanded={expanded}
      >
        {active ? (
          <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-black animate-pulse">
            Thinking…
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-black">
            {doneLabel || 'Thought'}
          </span>
        )}
        {!active && (
          <ChevronDown
            className={`w-3.5 h-3.5 text-black transition-transform duration-150 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {expanded && (
        <div className="border-t-2 border-black">
          <div
            ref={viewportRef}
            className="max-h-[180px] overflow-y-auto px-3 py-2 space-y-1.5 custom-scrollbar"
          >
            {lines.length === 0 ? (
              <p className="font-mono text-[10px] text-neutral-500">
                Reasoning in progress…
              </p>
            ) : (
              lines.map((line, i) => (
                <p
                  key={i}
                  className="line-reveal font-body text-xs text-neutral-800 leading-relaxed flex items-start gap-1.5"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span className="text-black shrink-0 mt-0.5 font-mono">↳</span>
                  <span>{line}</span>
                </p>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

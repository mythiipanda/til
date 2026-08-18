'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface ThinkingReasoningProps {
  lines: string[];
  active: boolean;
  /** Label for the folded state, e.g. "Thought for 2s" */
  doneLabel?: ReactNode;
}

/**
 * High-craft Thinking & Reasoning component (aicss.dev standard).
 * While active, it shimmers "Thinking…" and keeps the reasoning open,
 * revealing each new line as it streams in. Once done, it folds cleanly into
 * an expandable "Thought for Ns" summary.
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
    <div className="border-2 border-black bg-white select-none transition-all">
      <button
        type="button"
        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
          active ? 'cursor-default bg-neutral-50' : 'cursor-pointer hover:bg-neutral-100'
        }`}
        onClick={toggle}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          {active ? (
            <>
              <span className="w-2 h-2 bg-black animate-ping shrink-0" />
              <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-black animate-pulse truncate">
                Thinking…
              </span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 bg-black shrink-0" />
              <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-black truncate">
                {doneLabel || 'Thought'}
              </span>
            </>
          )}
        </div>

        {!active && (
          <ChevronDown
            className={`w-3.5 h-3.5 text-black transition-transform duration-200 shrink-0 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {expanded && (
        <div className="border-t-2 border-black bg-white">
          <div
            ref={viewportRef}
            className="max-h-[220px] overflow-y-auto px-3.5 py-2.5 space-y-2 custom-scrollbar"
          >
            {lines.length === 0 ? (
              <p className="font-mono text-[10px] text-neutral-500 italic">
                Reasoning trace in progress…
              </p>
            ) : (
              lines.map((line, i) => (
                <div
                  key={i}
                  className="line-reveal font-body text-xs text-neutral-800 leading-relaxed flex items-start gap-2"
                  style={{ animationDelay: `${i * 25}ms` }}
                >
                  <span className="text-neutral-400 shrink-0 font-mono text-[11px] select-none pt-0.5">
                    ↳
                  </span>
                  <span className="flex-1 break-words">{line}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

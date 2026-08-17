'use client';

import { useState } from 'react';
import type { PlanStep } from '@/types';

interface TodoListProps {
  steps: PlanStep[];
}

const Check = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const Arrow = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m12.75 15 3-3m0 0-3-3m3 3h-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const Dashed = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="9" strokeDasharray="1.8 3.6" />
  </svg>
);

/**
 * Cursor-style to-do list the research agent maintains: collapsible header
 * with a done/progress count and per-step pending / in-progress / done states.
 */
export function TodoList({ steps }: TodoListProps) {
  const [collapsed, setCollapsed] = useState(false);
  const done = steps.filter((s) => s.status === 'done').length;
  const activeIdx = steps.findIndex((s) => s.status === 'running');
  const allDone = steps.length > 0 && done === steps.length;

  return (
    <div className="border-2 border-black bg-white">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-neutral-100"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-black">
            {allDone ? 'Complete' : 'Research Phases'}
          </span>
          <span className="font-mono text-[9px] text-neutral-500">
            {done}/{steps.length}
          </span>
        </div>
        <svg className={`w-3.5 h-3.5 text-black transition-transform duration-150 ${collapsed ? '' : 'rotate-180'}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {!collapsed && (
        <ul className="border-t-2 border-black px-3 py-1.5 space-y-1">
          {steps.map((step, i) => {
            const isDone = step.status === 'done';
            const isActive = step.status === 'running';
            return (
              <li
                key={step.id || i}
                className={`line-reveal flex items-center gap-2.5 py-1 ${
                  isActive ? 'text-black' : isDone ? 'text-neutral-600' : 'text-neutral-400'
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="shrink-0">
                  {isDone ? (
                    <span className="text-black"><Check /></span>
                  ) : isActive ? (
                    <span className="text-black"><Arrow /></span>
                  ) : (
                    <span><Dashed /></span>
                  )}
                </span>
                <span className={`font-body text-xs leading-snug ${isActive ? 'font-bold' : ''}`}>
                  {step.title}
                </span>
                {isActive && (
                  <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-wider ml-auto shrink-0 animate-pulse">
                    {step.agent || 'working'}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

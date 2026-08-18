'use client';

import { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { PlanStep } from '@/types';

interface TodoListProps {
  steps: PlanStep[];
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-black shrink-0"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Task / Phase execution tracker (aicss.dev & cursor standard).
 * Collapsible header with dynamic progress counter and per-step status indicator.
 */
export function TodoList({ steps }: TodoListProps) {
  const [collapsed, setCollapsed] = useState(false);
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const allDone = steps.length > 0 && doneCount === steps.length;

  return (
    <div className="border-2 border-black bg-white select-none transition-all">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-neutral-100 transition-colors"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-black shrink-0" />
          <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-black">
            {allDone ? 'Steps Complete' : 'Research Steps'}
          </span>
          <span className="font-mono text-[9px] text-neutral-500 font-semibold">
            {doneCount}/{steps.length}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-black transition-transform duration-200 ${
            !collapsed ? 'rotate-180' : ''
          }`}
        />
      </button>

      {!collapsed && (
        <ul className="border-t-2 border-black px-3.5 py-2 space-y-1.5 bg-white">
          {steps.map((step, i) => {
            const isDone = step.status === 'done';
            const isActive = step.status === 'running';

            return (
              <li
                key={step.id || i}
                className={`line-reveal flex items-center gap-2.5 py-1 ${
                  isActive ? 'text-black font-semibold' : isDone ? 'text-neutral-700' : 'text-neutral-400'
                }`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span className="shrink-0">
                  {isDone ? (
                    <CheckIcon />
                  ) : isActive ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full border border-neutral-300 inline-block" />
                  )}
                </span>
                <span className="font-body text-xs leading-snug flex-1 truncate">
                  {step.title}
                </span>
                {isActive && step.agent && (
                  <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-wider ml-auto shrink-0 animate-pulse border border-neutral-200 px-1 py-0.2">
                    {step.agent}
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

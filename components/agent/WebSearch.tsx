'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';

interface WebSearchProps {
  query: string;
  sources: Array<{ id?: string; title?: string; url: string }>;
  active: boolean;
}

const M = {
  L: 'M6.057 11.565 C2.081 11.565 0.371 8.159 0.371 5.964 C0.371 3.642 2.152 0.329 6.05 0.329',
  ML: 'M6.012 11.55 C4.575 10.496 3.333 8.116 3.321 5.964 C3.307 3.399 4.974 0.977 6.012 0.329',
  MR: 'M6.012 11.55 C7.211 10.781 8.715 8.287 8.715 5.964 C8.715 3.399 7.24 1.233 6.012 0.329',
  R: 'M6.012 11.55 C9.677 11.55 11.65 8.487 11.65 5.964 C11.65 3.499 9.748 0.329 6.012 0.329',
};

function Globe() {
  const values = [M.L, M.ML, M.MR, M.R, M.L].join(';');
  return (
    <svg
      viewBox="0 0 12 12"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      strokeLinecap="round"
      style={{ overflow: 'visible' }}
      className="globe-spin shrink-0"
    >
      <circle cx="6" cy="6" r="5.7" opacity="0.9" />
      <line x1="0.3" y1="6" x2="11.7" y2="6" opacity="0.9" />
      {['0s', '-1.2s', '-2.4s', '-3.6s', '-4.8s', '-6s'].map((begin) => (
        <path
          key={begin}
          d={M.L}
          opacity="0"
        >
          <animate
            attributeName="d"
            dur="7.2s"
            begin={begin}
            repeatCount="indefinite"
            calcMode="spline"
            keyTimes="0;0.25;0.5;0.75;1"
            keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
            values={values}
          />
          <animate
            attributeName="opacity"
            dur="7.2s"
            begin={begin}
            repeatCount="indefinite"
            calcMode="linear"
            keyTimes="0;0.05;0.7;0.75;1"
            values="0;0.9;0.9;0;0"
          />
        </path>
      ))}
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-black"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Live Web Search component (aicss.dev standard).
 * Shows a spinning globe while searching with resolving source citations.
 */
export function WebSearch({ query, sources, active }: WebSearchProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border-2 border-black bg-white select-none transition-all">
      <button
        type="button"
        onClick={() => !active && setCollapsed(c => !c)}
        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
          active ? 'cursor-default bg-neutral-50' : 'cursor-pointer hover:bg-neutral-100'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {active ? <Globe /> : <CheckIcon />}
          <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-black truncate">
            {active ? `Searching “${query}”` : `Searched “${query}”`}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {sources.length > 0 && !active && (
            <span className="font-mono text-[9px] text-neutral-500 font-semibold uppercase tracking-wider">
              {sources.length} {sources.length === 1 ? 'source' : 'sources'}
            </span>
          )}
          {!active && sources.length > 0 && (
            <ChevronDown
              className={`w-3.5 h-3.5 text-black transition-transform duration-200 ${
                !collapsed ? 'rotate-180' : ''
              }`}
            />
          )}
        </div>
      </button>

      {sources.length > 0 && !collapsed && (
        <ul className="border-t-2 border-black px-3.5 py-2 space-y-1.5 bg-white">
          {sources.map((src, i) => (
            <li
              key={src.id || i}
              className="line-reveal flex items-center gap-2 py-0.5 group"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="text-black shrink-0">
                {active ? <Globe /> : <CheckIcon />}
              </span>
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-xs text-neutral-800 hover:text-black hover:underline underline-offset-2 truncate min-w-0 flex-1 flex items-center gap-1.5"
                title={src.title || src.url}
              >
                <span className="truncate">{src.title || src.url}</span>
                <ExternalLink className="w-3 h-3 text-neutral-400 group-hover:text-black opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </a>
              <span className="font-mono text-[9px] text-neutral-400 group-hover:text-neutral-600 shrink-0 truncate max-w-[130px] border border-neutral-200 px-1.5 py-0.5">
                {getDomain(src.url)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

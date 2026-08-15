'use client';

import React, { useEffect, useState } from 'react';

interface LoadingPixelStateProps {
  label?: string;
  sublabel?: string;
}

export function LoadingPixelState({
  label = 'Expanding rabbit holes...',
  sublabel = 'Synthesizing knowledge connections',
}: LoadingPixelStateProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-surface-100/80 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl text-slate-100 max-w-sm mx-auto">
      {/* Pixel Grid Loader */}
      <div className="grid grid-cols-4 gap-1.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 mb-3 shadow-inner">
        {Array.from({ length: 16 }).map((_, i) => {
          const delay = (i % 4) * 150 + Math.floor(i / 4) * 150;
          return (
            <div
              key={i}
              className="w-3.5 h-3.5 rounded-[3px] bg-sky-500/20 animate-pulse border border-sky-400/30"
              style={{
                animationDelay: `${delay}ms`,
                animationDuration: '1.2s',
              }}
            />
          );
        })}
      </div>

      <div className="text-center">
        <h4 className="text-sm font-semibold text-sky-400 tracking-wide">{label}</h4>
        <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
          <span>{(elapsedMs / 1000).toFixed(2)}s elapsed</span>
        </div>
      </div>
    </div>
  );
}

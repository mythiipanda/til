'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white texture-grid">
      <div className="w-full max-w-4xl bg-white border-2 md:border-4 border-black p-6 sm:p-8 md:p-12 space-y-8 sm:space-y-10 shadow-none">
        {/* Masthead Rule & Label */}
        <div className="flex items-center justify-between border-b-2 md:border-b-4 border-black pb-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-black" />
            <span className="font-mono text-[10px] sm:text-xs uppercase font-bold tracking-widest text-black">
              TDILEARNED
            </span>
          </div>
          <div className="font-mono text-[9px] sm:text-[11px] uppercase tracking-wider text-neutral-500">
            SOMETHING BROKE
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-3 sm:space-y-4">
          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-normal tracking-tight text-black leading-[0.98]">
            The map hit <br className="hidden sm:inline" />
            <span className="italic font-normal">a snag.</span>
          </h1>
          <p className="font-body text-sm sm:text-base md:text-lg text-neutral-800 max-w-2xl leading-relaxed">
            Nothing you wrote was lost. Try loading this page again.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t-2 border-black">
          <button
            type="button"
            onClick={() => reset()}
            className="px-6 py-3.5 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase tracking-widest font-bold transition-colors duration-100 min-h-[44px]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3.5 bg-white hover:bg-black text-black hover:text-white border-2 border-black font-mono text-xs uppercase tracking-widest font-bold transition-colors duration-100 min-h-[44px]"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

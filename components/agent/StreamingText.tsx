'use client';

import type { ReactNode } from 'react';

interface StreamingTextProps {
  children: ReactNode;
  streaming?: boolean;
}

/**
 * Prose wrapper that appends a blinking caret while the model is still
 * streaming tokens. The actual text is passed in by the parent so this stays
 * a thin presentational layer.
 */
export function StreamingText({ children, streaming }: StreamingTextProps) {
  return (
    <span>
      {children}
      {streaming && (
        <span
          className="caret-blink inline-block w-[2px] h-[1em] bg-current ml-0.5 align-middle"
          aria-hidden
        />
      )}
    </span>
  );
}

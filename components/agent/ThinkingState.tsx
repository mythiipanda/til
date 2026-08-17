'use client';

export function ThinkingState({ label = 'Thinking' }: { label?: string }) {
  return (
    <span className="font-mono text-xs font-bold tracking-wider text-black animate-pulse">
      {label}
    </span>
  );
}

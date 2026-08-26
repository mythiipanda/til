'use client';

import { supabase } from '@/lib/supabase/client';

/**
 * Launch metrics: tiny, anonymous, INSERT-only event stream.
 * Backed by public.launch_events (anon INSERT policy, no public SELECT).
 * Writes are batched and throttled client-side; failures are swallowed —
 * metrics must never break the product.
 */

export type LaunchEventName =
  | 'map_visit'
  | 'expand_click'
  | 'topic_search'
  | 'share_copy'
  | 'research_fallback'
  | 'fresh_map';

interface QueueItem {
  event: LaunchEventName;
  topic?: string | null;
  ref?: string | null;
  metadata?: Record<string, unknown>;
}

const FLUSH_DELAY_MS = 15000;
const MAX_QUEUE = 20;

let queue: QueueItem[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pagehideHooked = false;

function flush(): void {
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_QUEUE);
  Promise.resolve(
    supabase
      .from('launch_events')
      .insert(batch)
  )
    .then(({ error }) => {
      if (error && process.env.NODE_ENV === 'development') {
        console.warn('[launch-events] insert failed:', error.message);
      }
    })
    .catch(() => {});
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

function hookPagehide(): void {
  if (pagehideHooked || typeof window === 'undefined') return;
  pagehideHooked = true;
  window.addEventListener('pagehide', () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flush();
    }
  });
}

export function trackLaunchEvent(
  event: LaunchEventName,
  opts: {
    topic?: string | null;
    ref?: string | null;
    /** Emit at most once per tab session for this key (e.g. `visit:<slug>`). */
    onceKey?: string;
    metadata?: Record<string, unknown>;
  } = {}
): void {
  if (typeof window === 'undefined') return;
  try {
    if (opts.onceKey) {
      const key = `tdilearned-le:${opts.onceKey}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    }
  } catch {
    // Private-mode sessionStorage can throw; still record the event.
  }

  queue.push({
    event,
    topic: opts.topic ?? null,
    ref: opts.ref ?? null,
    metadata: opts.metadata ?? {},
  });
  if (queue.length >= MAX_QUEUE) {
    if (flushTimer) clearTimeout(flushTimer);
    flush();
  } else {
    scheduleFlush();
  }
  hookPagehide();
}

import type { PrecomputedHubSummary } from '@/types';

/**
 * Curated launch topics tuned to r/InternetIsBeautiful tastes (Aug 2026).
 * Powers three things:
 *  - the hub seeder input (backend/app/scripts/continuous_precompute.py --topics-file
 *    is generated from this list)
 *  - last-resort saturation routing when the live catalog is unreachable
 *    (route by category via loadRandomHubByCategory)
 *  - "Fresh map" badge eligibility (a root topic matching one of these is
 *    considered known even if the catalog request failed)
 */
export interface FallbackHubTopic {
  topic: string;
  category: string;
}

export const FALLBACK_HUB_TOPICS: FallbackHubTopic[] = [
  { topic: 'The Great Emu War', category: 'History' },
  { topic: 'Radium Girls', category: 'History' },
  { topic: 'Boston Molasses Flood', category: 'History' },
  { topic: 'Dancing Plague of 1518', category: 'History' },
  { topic: 'Gutenberg printing press', category: 'Technology' },
  { topic: 'Antikythera mechanism', category: 'Technology' },
  { topic: 'Trolley problem', category: 'Philosophy' },
  { topic: 'Fermi paradox', category: 'Science' },
  { topic: 'Tardigrades', category: 'Nature' },
  { topic: 'Mantis shrimp', category: 'Nature' },
  { topic: 'Immortal jellyfish', category: 'Nature' },
  { topic: 'Voynich manuscript', category: 'Language' },
  { topic: 'Byzantine Empire', category: 'History' },
  { topic: 'Black hole information paradox', category: 'Science' },
  { topic: 'Banach-Tarski paradox', category: 'Mathematics' },
  { topic: 'Bystander effect', category: 'Society' },
  { topic: 'Ship of Theseus', category: 'Philosophy' },
  { topic: 'Svalbard Global Seed Vault', category: 'Geography' },
  { topic: 'Dyatlov Pass incident', category: 'History' },
  { topic: 'Carrington Event', category: 'Science' },
  { topic: 'Streisand effect', category: 'Culture' },
  { topic: 'Blue eyes and genetic mutation', category: 'Health' },
  { topic: 'Libet experiment free will', category: 'Philosophy' },
  { topic: 'Why cathedrals took centuries to build', category: 'Engineering' },
];

/**
 * Convert fallback entries to hub-summary shape so the matcher can treat both
 * identically. `id` is intentionally absent — these cannot be opened directly;
 * they route by category instead.
 */
export function fallbackTopicsAsSummaries(): Array<PrecomputedHubSummary & { id: string }> {
  return FALLBACK_HUB_TOPICS.map((t, i) => ({
    id: `fallback-${i}`,
    topic: t.topic,
    category: t.category,
    summary: '',
    imageUrl: null,
  }));
}

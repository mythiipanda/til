const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'with',
  'at', 'by', 'from', 'how', 'what', 'why', 'is', 'are', 'was', 'were',
  'be', 'do', 'does', 'did', 'vs', 'versus', 'it', 'its', 'as', 'this',
  'that', 'these', 'those', 'your', 'my', 'their',
]);

/** Lowercase, strip punctuation, drop stopwords. */
export function normalizeTopicTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** Fraction of meaningful query tokens present in the candidate topic (0..1). */
export function tokenOverlapScore(queryTokens: string[], candidateText: string): number {
  if (queryTokens.length === 0) return 0;
  const candidateTokens = new Set(normalizeTopicTokens(candidateText));
  let hits = 0;
  for (const t of queryTokens) {
    if (candidateTokens.has(t)) hits++;
  }
  return hits / queryTokens.length;
}

export interface MatchableTopic {
  topic: string;
}

/**
 * Find the best finished-map candidates for a typed topic.
 * Requires at least one non-stopword token match; returns up to `limit`
 * candidates ordered by overlap score, ties shuffled so repeat fallbacks vary.
 */
export function rankTopicMatches<T extends MatchableTopic>(
  query: string,
  candidates: T[],
  limit = 3
): T[] {
  const queryTokens = normalizeTopicTokens(query);
  if (queryTokens.length === 0) return [];

  const scored = candidates
    .map((c) => ({ c, score: tokenOverlapScore(queryTokens, c.topic) }))
    .filter((s) => s.score > 0);

  // Group by score descending; shuffle inside equal-score groups.
  scored.sort((a, b) => b.score - a.score);

  const result: T[] = [];
  let i = 0;
  while (i < scored.length && result.length < limit) {
    let j = i;
    while (j < scored.length && scored[j].score === scored[i].score) j++;
    const group = scored.slice(i, j);
    for (let k = group.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [group[k], group[r]] = [group[r], group[k]];
    }
    for (const g of group) {
      if (result.length < limit) result.push(g.c);
    }
    i = j;
  }
  return result;
}

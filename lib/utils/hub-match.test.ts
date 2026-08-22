import { describe, expect, it } from 'vitest';
import {
  normalizeTopicTokens,
  rankTopicMatches,
  tokenOverlapScore,
} from './hub-match';

describe('normalizeTopicTokens', () => {
  it('lowercases, strips punctuation, and drops stopwords', () => {
    expect(normalizeTopicTokens('The Great Emu War!')).toEqual(['great', 'emu', 'war']);
    expect(normalizeTopicTokens('Why is the sky blue?')).toEqual(['sky', 'blue']);
  });

  it('returns an empty array for pure-stopword input', () => {
    expect(normalizeTopicTokens('The of and')).toEqual([]);
  });
});

describe('tokenOverlapScore', () => {
  it('scores full overlap as 1', () => {
    const q = normalizeTopicTokens('medieval bread');
    expect(tokenOverlapScore(q, 'Medieval Bread & Guilds')).toBe(1);
  });

  it('scores partial overlap fractionally', () => {
    const q = normalizeTopicTokens('medieval bread recipes');
    expect(tokenOverlapScore(q, 'medieval bread')).toBeCloseTo(2 / 3);
  });

  it('scores zero when nothing matches', () => {
    const q = normalizeTopicTokens('quantum tunneling');
    expect(tokenOverlapScore(q, 'Great Emu War')).toBe(0);
  });
});

describe('rankTopicMatches', () => {
  const candidates = [
    { topic: 'Medieval bread and guilds', id: 'a' },
    { topic: 'Bread in ancient Egypt', id: 'b' },
    { topic: 'Great Emu War', id: 'c' },
    { topic: 'Radium Girls', id: 'd' },
  ];

  it('returns only candidates sharing at least one meaningful token', () => {
    const ranked = rankTopicMatches('medieval bread history', candidates, 3);
    expect(ranked.map((r) => r.id)).toContain('a');
    expect(ranked.map((r) => r.id)).not.toContain('c');
    expect(ranked.map((r) => r.id)).not.toContain('d');
  });

  it('puts the strongest match first regardless of shuffle', () => {
    const ranked = rankTopicMatches('medieval bread', candidates, 3);
    expect(ranked[0].id).toBe('a');
  });

  it('respects the limit', () => {
    expect(rankTopicMatches('bread', candidates, 1).length).toBeLessThanOrEqual(1);
  });

  it('returns empty for stopword-only queries', () => {
    expect(rankTopicMatches('the of and', candidates, 3)).toEqual([]);
  });
});

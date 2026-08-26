import { describe, expect, it } from 'vitest';
import { exportDossierMarkdown } from './export';
import type { ResearchDossier } from '@/types';

function makeDossier(overrides: Partial<ResearchDossier> = {}): ResearchDossier {
  return {
    nodeId: 'n1',
    title: 'The Great Emu War',
    tagline: 'When birds beat artillery',
    category: 'History',
    era: '1932',
    abstract: 'A military operation against emus that failed spectacularly.',
    coreThesis: 'Bureaucratic overconfidence meets an uncooperative adversary.',
    sources: [
      { id: 's1', title: 'Emu War Archive', url: 'https://example.com/a', snippet: 'q', publisher: 'History Weekly' },
      { id: 's2', title: 'Birds vs Guns', url: 'https://example.com/b', snippet: 'q', publisher: null },
    ],
    gallery: [],
    timeline: [
      { date: 'Nov 1932', headline: 'First deployment', description: 'Soldiers march west.' },
      { date: 'Dec 1932', headline: 'Withdrawal', description: 'The emus prevail.' },
    ],
    mechanisms: [
      { title: 'Guerrilla flocking', explanation: 'Small groups scatter under fire.', bulletPoints: [] },
    ],
    geography: null,
    rabbitHoles: [],
    audioTourScript: '',
    wowFact: 'The machine gunners withdrew after the birds kept winning.',
    ...overrides,
  };
}

describe('exportDossierMarkdown', () => {
  it('emits headings in document order', () => {
    const md = exportDossierMarkdown(makeDossier());
    const positions = [
      md.indexOf('# The Great Emu War'),
      md.indexOf('>'),
      md.indexOf('## Core thesis'),
      md.indexOf('## Timeline'),
      md.indexOf('## How it works'),
      md.indexOf('## Sources'),
    ];
    expect(positions.every(p => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('renders the wow fact as a blockquote', () => {
    const md = exportDossierMarkdown(makeDossier());
    expect(md).toContain('\n> The machine gunners withdrew');
  });

  it('numbers every source with title, publisher, and url', () => {
    const md = exportDossierMarkdown(makeDossier());
    expect(md).toContain('[1] Emu War Archive - History Weekly - https://example.com/a');
    expect(md).toContain('[2] Birds vs Guns - https://example.com/b');
  });

  it('contains zero em dash characters even when inputs use them', () => {
    const dossier = makeDossier({
      abstract: 'A strange campaign \u2014 and a stranger aftermath.',
      timeline: [{ date: '1932', headline: 'Retreat \u2014 again', description: 'Guns \u2014 useless.' }],
    });
    const md = exportDossierMarkdown(dossier);
    expect(md).not.toContain('\u2014');
    expect(md).toContain('Retreat - again');
  });

  it('ends with the TDILEARNED footer', () => {
    const md = exportDossierMarkdown(makeDossier());
    expect(md.trimEnd().endsWith('Researched with TDILEARNED')).toBe(true);
  });

  it('omits empty sections without leaving stray headings', () => {
    const md = exportDossierMarkdown(makeDossier({ timeline: [], mechanisms: [], sources: [], wowFact: null }));
    expect(md).not.toContain('## Timeline');
    expect(md).not.toContain('## How it works');
    expect(md).not.toContain('## Sources');
    expect(md).not.toContain('\n>');
    expect(md).toContain('# The Great Emu War');
  });
});

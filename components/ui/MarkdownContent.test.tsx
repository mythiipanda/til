import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownContent } from '@/components/ui/MarkdownContent';

const sources = [
  { id: 'a', title: 'Source A', url: 'https://a.example' },
  { id: 'b', title: 'Source B', url: 'https://b.example' },
  { id: 'c', title: 'Source C', url: 'https://c.example' },
];

describe('MarkdownContent citation mapping', () => {
  it('links [1] to sources[0]', () => {
    render(<MarkdownContent content="The mechanism worked [1]." sources={sources} />);
    const link = screen.getByRole('link', { name: '[1]' });
    expect(link).toHaveAttribute('href', 'https://a.example');
  });

  it('links multi-citation [2, 3] to the matching sources in order', () => {
    render(<MarkdownContent content="Both facts check out [2, 3]." sources={sources} />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      'https://b.example',
      'https://c.example',
    ]);
  });

  it('never renders out-of-range citations as links (count-align contract)', () => {
    // Regression: [9] must not link anywhere — an out-of-range index means the
    // backend evidence list and the frontend source list have desynced.
    render(<MarkdownContent content="A claim [9] and another [1]." sources={sources} />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(1); // only [1] links
    expect(links[0]).toHaveAttribute('href', 'https://a.example');
    // The out-of-range [9] still renders as inert text
    expect(screen.getByText('[9]')).toBeTruthy();
  });

  it('renders plain text unchanged when no sources exist', () => {
    render(<MarkdownContent content="No citations here." />);
    expect(screen.getByText('No citations here.')).toBeTruthy();
  });

  it('handles [Canon] by pointing at sources[0]', () => {
    render(<MarkdownContent content="See [Canon] for detail." sources={sources} />);
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === 'https://a.example')).toBe(true);
  });
});
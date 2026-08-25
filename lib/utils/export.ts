import type { ResearchDossier } from '@/types';

/* ── Slug helpers ────────────────────────────────────────── */

/**
 * Kebab-case slug from an arbitrary topic string.
 * Strips non-ascii characters so filenames stay portable.
 */
export function slugifyTopic(topic: string): string {
  return topic
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Build a safe PNG filename like `great-emu-war-map.png`. */
export function mapExportFilename(topic: string | null): string {
  const base = slugifyTopic(topic || '') || 'mindmap';
  return `${base}-map.png`;
}

/* ── Markdown export ─────────────────────────────────────── */

/** Em dashes are banned in output copy; normalize any coming from research data. */
function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\u2014/g, '-').trim();
}

/**
 * Render a research dossier as plain Markdown suitable for pasting into
 * notes tools or GitHub issues.
 */
export function exportDossierMarkdown(dossier: ResearchDossier): string {
  const lines: string[] = [];

  lines.push(`# ${clean(dossier.title)}`);

  if (dossier.wowFact) {
    lines.push('', `> ${clean(dossier.wowFact)}`);
  }

  const abstract = clean(dossier.abstract);
  if (abstract) {
    lines.push('', abstract);
  }

  const coreThesis = clean(dossier.coreThesis);
  if (coreThesis) {
    lines.push('', '## Core thesis', coreThesis);
  }

  if (dossier.timeline?.length) {
    lines.push('', '## Timeline');
    for (const event of dossier.timeline) {
      lines.push(`- **[${clean(event.date)}] ${clean(event.headline)}** - ${clean(event.description)}`);
    }
  }

  if (dossier.mechanisms?.length) {
    lines.push('', '## How it works');
    for (const mechanism of dossier.mechanisms) {
      lines.push(`- **${clean(mechanism.title)}** - ${clean(mechanism.explanation)}`);
    }
  }

  if (dossier.sources?.length) {
    lines.push('', '## Sources');
    dossier.sources.forEach((source, index) => {
      const publisher = clean(source.publisher);
      const parts = [`[${index + 1}] ${clean(source.title)}`];
      if (publisher) parts.push(publisher);
      parts.push(source.url);
      lines.push(parts.join(' - '));
    });
  }

  lines.push('', 'Researched with TDILEARNED');

  return `${lines.join('\n')}\n`;
}

/* ── Clipboard ───────────────────────────────────────────── */

/**
 * Copy text to the clipboard, falling back to a hidden-textarea
 * execCommand('copy') when the async Clipboard API is unavailable
 * (insecure context, permission denial).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

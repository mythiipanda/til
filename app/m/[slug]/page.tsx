import type { Metadata } from 'next';
import { getSharedMindMap } from './data';
import SharedMindMapClient from './SharedMindMapClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://til-seven.vercel.app';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const mindmap = await getSharedMindMap(slug);
  if (!mindmap) {
    return {
      title: 'Shared Mindmap Not Found — TDILEARNED',
      robots: { index: false, follow: false },
    };
  }

  const url = `${SITE_URL}/m/${mindmap.slug}`;
  const description = `Explore "${mindmap.title}" — ${mindmap.summary}`;

  return {
    title: `${mindmap.title} — TDILEARNED`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${mindmap.title} — TDILEARNED`,
      description,
      url,
      siteName: 'TDILEARNED',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${mindmap.title} — TDILEARNED`,
      description,
    },
  };
}

export default async function SharedMindMapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mindmap = await getSharedMindMap(slug);

  const jsonLd = mindmap
    ? {
        '@context': 'https://schema.org',
        '@type': 'LearningResource',
        name: mindmap.title,
        description: mindmap.summary,
        url: `${SITE_URL}/m/${mindmap.slug}`,
        provider: { '@type': 'Organization', name: 'TDILEARNED' },
        learningResourceType: 'Interactive Spatial Knowledge Map',
      }
    : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <SharedMindMapClient />
    </>
  );
}
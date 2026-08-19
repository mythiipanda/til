import type { Metadata } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import SharedMindMapClient from './SharedMindMapClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://til-seven.vercel.app';

async function getSharedMindMap(slug: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('mindmaps')
    .select('id, title, share_slug, nodes, updated_at')
    .eq('share_slug', slug)
    .single();

  if (error || !data) return null;

  const rootNode = Array.isArray(data.nodes) ? (data.nodes as any[]).find((n) => !n?.parentId) : null;
  const summary =
    (rootNode?.data?.summary as string) ||
    (rootNode?.data?.label as string) ||
    `${data.title} — an interactive spatial knowledge map`;

  return {
    id: data.id,
    title: data.title,
    slug: data.share_slug,
    summary,
    nodeCount: Array.isArray(data.nodes) ? data.nodes.length : 0,
    category: (rootNode?.data?.category as string) || 'General',
  };
}

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
      card: 'summary',
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
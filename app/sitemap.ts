import type { MetadataRoute } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://til-seven.vercel.app';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('mindmaps')
      .select('share_slug, updated_at')
      .eq('is_public', true)
      .not('share_slug', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (error) return staticRoutes;

    return [
      ...staticRoutes,
      ...(data ?? [])
        .filter((row) => row.share_slug)
        .map((row) => ({
          url: `${SITE_URL}/m/${row.share_slug}`,
          lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        })),
    ];
  } catch {
    return staticRoutes;
  }
}

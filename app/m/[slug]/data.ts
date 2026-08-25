import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getSharedMindMap(slug: string) {
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

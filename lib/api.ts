const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const api = {
  /** List all pre-researched hub summaries. */
  precomputedList: () =>
    fetch(`${API}/api/v1/graph/precomputed`),

  /** Fetch a full pre-researched hub (root + children). */
  precomputedHub: (hubId: string) =>
    fetch(`${API}/api/v1/graph/precomputed/${encodeURIComponent(hubId)}`),

  /** Fetch the research dossier for a given node. */
  dossier: (nodeId: string) =>
    fetch(`${API}/api/v1/research/dossier/${encodeURIComponent(nodeId)}`),

  /** Build SSE URL for live deep research with full context inheritance. */
  researchStreamUrl: (
    topic: string,
    category?: string,
    parentId?: string,
    contextChain?: string[],
    parentSummary?: string,
    teaserContext?: string,
  ) => {
    const params = new URLSearchParams({ topic });
    if (category) params.set('category', category);
    if (parentId) params.set('parent_id', parentId);
    if (contextChain && contextChain.length > 0) params.set('context_chain', contextChain.join(','));
    if (parentSummary) params.set('parent_summary', parentSummary);
    if (teaserContext) params.set('teaser_context', teaserContext);
    return `${API}/api/v1/research/stream?${params}`;
  },

  /** Build SSE URL for follow-up chat with multi-turn history. */
  chatStreamUrl: (
    nodeTitle: string,
    question: string,
    ancestors: string[] = [],
    history: ChatHistoryMessage[] = [],
    activeSummary?: string,
  ) => {
    const params = new URLSearchParams({
      node_title: nodeTitle,
      question,
      ancestors: ancestors.join(','),
    });
    if (history.length > 0) {
      params.set('history', JSON.stringify(history));
    }
    if (activeSummary) {
      params.set('active_summary', activeSummary);
    }
    return `${API}/api/v1/chat/stream?${params}`;
  },
};
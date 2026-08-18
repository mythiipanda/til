const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_TIMEOUT_MS = 15000;

async function withTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const MAX_HISTORY_TURNS = 6;

function trimHistory(history: ChatHistoryMessage[]): ChatHistoryMessage[] {
  return history.slice(-MAX_HISTORY_TURNS);
}

export const api = {
  /** List all pre-researched hub summaries. */
  precomputedList: () =>
    withTimeout(`${API}/api/v1/graph/precomputed`),

  /** Fetch a full pre-researched hub (root + children). */
  precomputedHub: (hubId: string) =>
    withTimeout(`${API}/api/v1/graph/precomputed/${encodeURIComponent(hubId)}`),

  /** Fetch the research dossier for a given node. */
  dossier: (nodeId: string) =>
    withTimeout(`${API}/api/v1/research/dossier/${encodeURIComponent(nodeId)}`),

  /** Build SSE URL for live deep research with full context inheritance. */
  researchStreamUrl: (
    topic: string,
    category?: string,
    parentId?: string,
    contextChain?: string[],
    parentSummary?: string,
    teaserContext?: string,
    model?: string,
  ) => {
    const params = new URLSearchParams({ topic });
    if (category) params.set('category', category);
    if (parentId) params.set('parent_id', parentId);
    if (contextChain && contextChain.length > 0) params.set('context_chain', contextChain.join(','));
    if (parentSummary) params.set('parent_summary', parentSummary);
    if (teaserContext) params.set('teaser_context', teaserContext);
    if (model) params.set('model', model);
    return `${API}/api/v1/research/stream?${params}`;
  },

  /** Build SSE URL for follow-up chat with multi-turn history and monograph grounding. */
  chatStreamUrl: (
    nodeTitle: string,
    question: string,
    ancestors: string[] = [],
    history: ChatHistoryMessage[] = [],
    activeSummary?: string,
    nodeId?: string,
    model?: string,
  ) => {
    const params = new URLSearchParams({
      node_title: nodeTitle,
      question,
      ancestors: ancestors.join(','),
    });
    if (nodeId) {
      params.set('node_id', nodeId);
    }
    const trimmed = trimHistory(history);
    if (trimmed.length > 0) {
      params.set('history', JSON.stringify(trimmed));
    }
    if (activeSummary) {
      params.set('active_summary', activeSummary);
    }
    if (model) {
      params.set('model', model);
    }
    return `${API}/api/v1/chat/stream?${params}`;
  },

  /** List free models catalog across Cerebras, Mistral, and OpenRouter */
  modelsCatalog: () =>
    withTimeout(`${API}/api/v1/models`),

  /** Pick a curiosity-ranked random topic */
  randomTopic: (category: string) =>
    withTimeout(`${API}/api/v1/graph/random-topic?category=${encodeURIComponent(category)}`),

  /** Fetch the large catalog of topics */
  catalog: (limit: number = 2000) =>
    withTimeout(`${API}/api/v1/graph/catalog?limit=${limit}`),
};
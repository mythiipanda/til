/* ── Backend schema mirrors ─────────────────────────────── */

export interface Coordinates {
  lat: number;
  lng: number;
  tileX?: number | null;
  tileY?: number | null;
  location_name?: string | null;
}

export interface NodeSchema extends Record<string, unknown> {
  id: string;
  title: string;
  summary: string;
  category?: string | null;
  coordinates?: Coordinates | null;
  image_search_query: string;
  imageUrl?: string | null;
  rabbit_holes: string[];
  timestamp?: string | null;
  confidence?: number | null;
  audio_summary?: string | null;
  sources_count?: number | null;
  curiosity_score?: number | null;
  wow_fact?: string | null;
  related_to_today?: string | null;
  suggested_questions?: string[];
}

export interface SourceCitation {
  id: string;
  title: string;
  url: string;
  snippet: string;
  publisher?: string | null;
  publishedDate?: string | null;
  reliabilityScore?: number | null;
}

export interface GalleryItem {
  imageUrl: string;
  caption: string;
  license?: string | null;
  originUrl?: string | null;
}

export interface TimelineEvent {
  date: string;
  headline: string;
  description: string;
}

export interface MechanismCard {
  title: string;
  explanation: string;
  bulletPoints: string[];
}

export interface Geography {
  locationName: string;
  latitude: number;
  longitude: number;
  historicalSignificance: string;
}

export interface RabbitHoleTeaser {
  title: string;
  teaser: string;
  affinityCategory: string;
}

export interface ResearchDossier {
  nodeId: string;
  title: string;
  tagline: string;
  category: string;
  era: string;
  abstract: string;
  coreThesis: string;
  sources: SourceCitation[];
  gallery: GalleryItem[];
  timeline: TimelineEvent[];
  mechanisms: MechanismCard[];
  geography?: Geography | null;
  rabbitHoles: RabbitHoleTeaser[];
  suggestedQuestions?: string[];
  audioTourScript: string;
  wowFact?: string | null;
  curiosityScore?: number | null;
}

export interface PrecomputedHubSummary {
  id: string;
  topic: string;
  category: string;
  imageUrl?: string | null;
  summary: string;
}

export interface PrecomputedHub {
  id: string;
  topic: string;
  category: string;
  root: NodeSchema;
  children: NodeSchema[];
}

export interface PlanStep {
  id: string;
  title: string;
  agent: string;
  status: 'pending' | 'running' | 'done';
}

/* ── Frontend-only UI types ─────────────────────────────── */

export interface ThoughtStep {
  type?: 'plan' | 'thought';
  text: string;
  agent?: string;
  timestamp?: number;
}

export interface ToolCallEvent {
  id: string;
  name?: string;
  tool?: string;
  query?: string;
  args?: string;
  status: 'running' | 'done' | 'success';
  result?: string;
  timestamp?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  thoughts?: string[];
  toolCalls?: Array<{ id: string; tool: string; query?: string; status: 'running' | 'success' }>;
  sources?: Array<{ id: string; title: string; url: string; snippet?: string }>;
  suggestedFollowUps?: string[];
  model?: string;
  modelLabel?: string;
}

export interface ModelOption {
  id: string; // e.g. "cerebras:gemma-4-31b" or "openrouter:meta-llama/llama-3.3-70b-instruct:free"
  name: string; // "Gemma 4 31B"
  provider: 'cerebras' | 'mistral' | 'openrouter' | string;
  provider_label: string; // "Cerebras", "Mistral AI", "OpenRouter"
  model_id: string;
  tier: string;
  is_free: boolean;
  is_available: boolean;
}

export interface ModelCatalog {
  default_model: string;
  models: ModelOption[];
}

export interface PinnedNoteData extends Record<string, unknown> {
  id: string;
  sourceNodeId: string;
  sourceNodeTitle: string;
  question: string;
  answer: string;
  citations: Array<{ title?: string; url: string }>;
  timestamp: number;
}

export const CATEGORIES = [
  'Science',
  'History',
  'Mathematics',
  'Technology',
  'Philosophy',
  'Culture',
  'Geography',
  'Health',
  'Nature',
  'People',
  'Religion',
  'Society',
  'Language',
  'Law',
  'Politics',
  'Education',
  'Engineering',
  'Energy',
  'Food and drink',
  'Economy',
  'Time',
] as const;


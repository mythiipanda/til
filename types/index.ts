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
  name: string;
  args?: string;
  status: 'running' | 'done';
  result?: string;
  timestamp: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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

export interface Coordinates {
  lat: number;
  lng: number;
  tileX?: number;
  tileY?: number;
  location_name?: string;
}

export interface NodeSchema {
  id: string;
  title: string;
  summary: string;
  category?: string;
  coordinates?: Coordinates | null;
  image_search_query: string;
  imageUrl?: string | null;
  rabbit_holes: string[];
  timestamp?: string;
  confidence?: number;
  audio_summary?: string;
  sources_count?: number;
  curiosity_score?: number;
  wow_fact?: string;
  related_to_today?: string;
}

export interface NodeData extends Record<string, unknown> {
  id: string;
  title: string;
  summary: string;
  category: string;
  coordinates?: Coordinates | null;
  image_search_query: string;
  imageUrl?: string | null;
  rabbit_holes: string[];
  timestamp?: string;
  confidence?: number;
  audio_summary?: string;
  sources_count?: number;
  curiosity_score?: number;
  wow_fact?: string;
  related_to_today?: string;
  isExpanding?: boolean;
  expandedVectors?: string[];
  onExpandRabbitHole?: (parentTopic: string, vector: string) => void;
  onOpenDossier?: (nodeId: string) => void;
  onOpenChat?: (node: NodeData) => void;
  onPlayAudio?: (node: NodeData) => void;
}

export interface SourceCitation {
  id: string;
  title: string;
  url: string;
  snippet: string;
  publisher?: string;
  publishedDate?: string;
  reliabilityScore?: number;
}

export interface GalleryItem {
  imageUrl: string;
  caption: string;
  license?: string;
  originUrl?: string;
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

export interface GeographyData {
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
  geography?: GeographyData;
  rabbitHoles: RabbitHoleTeaser[];
  audioTourScript: string;
  wowFact?: string;
  curiosityScore?: number;
}

export interface PlanStep {
  id: string;
  title: string;
  agent: string;
  status: 'pending' | 'running' | 'done';
}

export interface ToolCallEvent {
  call_id: string;
  tool: string;
  query: string;
  status: 'running' | 'success' | 'failed';
  preview?: string;
  count?: number;
}

export interface ThinkingStep {
  id: string;
  agent: string;
  label: string;
  detail: string;
  durationMs?: number;
  status: 'pending' | 'running' | 'complete';
}

export interface CuriosityStats {
  nodesExplored: number;
  rabbitHolesExpanded: number;
  categoriesVisited: Record<string, number>;
  deepestDepth: number;
}

export type CanvasViewMode = 'canvas' | 'map' | 'timeline';

'use client';

import { create } from 'zustand';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { api, ChatHistoryMessage } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type {
  ThoughtStep,
  ToolCallEvent,
  SourceCitation,
  PlanStep,
  ResearchDossier,
  ChatMessage,
  PrecomputedHubSummary,
  NodeSchema,
  PrecomputedHub
} from '@/types';

interface MindMapState {
  // Canvas
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  lastResearchedNodeId: string | null;
  contextChain: string[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  
  // Research flow
  isResearching: boolean;
  currentTopic: string | null;
  hasNewDossier: boolean;
  
  // SSE activity stream
  thoughts: ThoughtStep[];
  toolCalls: ToolCallEvent[];
  sources: SourceCitation[];
  planSteps: PlanStep[];
  
  // Dossier Cache Map & Active Dossier
  dossiersByNodeId: Record<string, ResearchDossier>;
  activeDossier: ResearchDossier | null;
  isDossierOpen: boolean;
  isDossierLoading: boolean;
  workstationTab: 'monograph' | 'agent';
  
  // Chat
  chatMessages: ChatMessage[];
  isChatStreaming: boolean;
  chatNodeTitle: string | null;

  // Sidebar / browse
  precomputedHubs: PrecomputedHubSummary[];

  // Persistence & Sharing
  activeMindMapId: string | null;
  shareSlug: string | null;
  savedMindMaps: Array<{
    id: string;
    title: string;
    root_topic: string;
    category?: string;
    updated_at: string;
    share_slug?: string;
  }>;
  recentSessions: Array<{
    id: string;
    topic: string;
    category?: string;
    nodeCount: number;
    timestamp: number;
  }>;
  
  // Actions
  fetchPrecomputedHubs: () => Promise<PrecomputedHubSummary[]>;
  loadRandomHubByCategory: (category: string) => Promise<void>;
  startResearch: (
    topic: string,
    category?: string,
    parentId?: string,
    parentSummary?: string,
    teaserContext?: string
  ) => void;
  loadPrecomputedHub: (hubId: string) => Promise<void>;
  selectNode: (nodeId: string) => void;
  openDossier: (nodeId: string) => Promise<void>;
  closeDossier: () => void;
  setWorkstationTab: (tab: 'monograph' | 'agent') => void;
  dismissNewDossierAlert: () => void;
  sendChat: (question: string) => void;
  pinChatToCanvas: (question: string, answer: string, citations?: Array<{ title?: string; url: string }>) => void;
  deleteNode: (nodeId: string) => void;
  saveMindMap: () => Promise<{ id?: string; shareSlug?: string; error?: string }>;
  loadMindMapById: (id: string) => Promise<boolean>;
  loadMindMapBySlug: (slug: string) => Promise<boolean>;
  generateShareLink: () => Promise<string | null>;
  restoreSessionFromLocalStorage: () => boolean;
  restoreSessionFromURL: () => boolean;
  resetCanvas: () => void;
  flushCanvasAutosave: () => void;
}

let researchES: EventSource | null = null;
let chatES: EventSource | null = null;

// Watchdog: if a stream goes silent for this long, the connection is stale —
// close it so an orphaned EventSource can't pin the tab or leak connections.
const SSE_IDLE_TIMEOUT_MS = 60000;
let researchIdleTimer: ReturnType<typeof setTimeout> | null = null;
let chatIdleTimer: ReturnType<typeof setTimeout> | null = null;

function armIdleTimer(es: EventSource, timerRef: { current: ReturnType<typeof setTimeout> | null }, onStale: () => void) {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => {
    es.close();
    if (timerRef.current) timerRef.current = null;
    onStale();
  }, SSE_IDLE_TIMEOUT_MS);
}

function kickIdleTimer(es: EventSource, timerRef: { current: ReturnType<typeof setTimeout> | null }, onStale: () => void) {
  if (timerRef.current) clearTimeout(timerRef.current);
  armIdleTimer(es, timerRef, onStale);
}

// Debounced canvas autosave: coalesce rapid drag/edge edits into one write.
const AUTOSAVE_DEBOUNCE_MS = 800;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    persistActiveSession(useMindMapStore.getState());
  }, AUTOSAVE_DEBOUNCE_MS);
}

function flushAutosave() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  const state = useMindMapStore.getState();
  if (state.nodes && state.nodes.length > 0) {
    persistActiveSession(state);
  }
}

function persistActiveSession(state: {
  nodes: Node[];
  edges: Edge[];
  currentTopic: string | null;
  dossiersByNodeId: Record<string, ResearchDossier>;
  contextChain: string[];
  activeMindMapId: string | null;
  shareSlug: string | null;
}) {
  if (typeof window === 'undefined' || !state.nodes || state.nodes.length === 0) return;
  try {
    const payload = {
      id: state.activeMindMapId || `local-${Date.now()}`,
      topic: state.currentTopic || 'Knowledge Exploration',
      nodes: state.nodes,
      edges: state.edges,
      dossiersByNodeId: state.dossiersByNodeId,
      contextChain: state.contextChain,
      shareSlug: state.shareSlug,
      timestamp: Date.now(),
    };
    localStorage.setItem('tdilearned_active_session', JSON.stringify(payload));

    // Per-topic snapshot so browser back/forward and reload can restore each
    // hub that was visited in history, without re-running research.
    const topicKey = state.currentTopic || 'Knowledge Exploration';
    const topicSessions = JSON.parse(localStorage.getItem('tdilearned_topic_sessions') || '{}');
    topicSessions[topicKey] = payload;
    try {
      localStorage.setItem('tdilearned_topic_sessions', JSON.stringify(topicSessions));
    } catch {
      // Quota exceeded: keep the active session only.
    }
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

export const useMindMapStore = create<MindMapState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  lastResearchedNodeId: null,
  contextChain: [],
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
    scheduleAutosave();
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
    scheduleAutosave();
  },
  
  currentTopic: '',
  isResearching: false,
  hasNewDossier: false,
  
  thoughts: [],
  toolCalls: [],
  sources: [],
  planSteps: [],
  
  dossiersByNodeId: {},
  activeDossier: null,
  isDossierOpen: false,
  isDossierLoading: false,
  workstationTab: 'monograph',
  
  chatMessages: [],
  isChatStreaming: false,
  chatNodeTitle: null,
  
  precomputedHubs: [],

  activeMindMapId: null,
  shareSlug: null,
  savedMindMaps: [],
  recentSessions: [],

  fetchPrecomputedHubs: async () => {
    try {
      const res = await api.precomputedList();
      const data = (await res.json()) as PrecomputedHubSummary[];
      set({ precomputedHubs: data });
      return data;
    } catch (e) {
      console.error('Failed to fetch precomputed hubs:', e);
      return [];
    }
  },

  loadRandomHubByCategory: async (category: string) => {
    let hubs = get().precomputedHubs;
    if (!hubs || hubs.length === 0) {
      hubs = await get().fetchPrecomputedHubs();
    }

    const targetCategory = category.toLowerCase().trim();
    const matching = hubs.filter(
      h => h.category && h.category.toLowerCase().trim() === targetCategory
    );

    const pool = matching.length > 0 ? matching : hubs;
    if (pool.length > 0) {
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      await get().loadPrecomputedHub(chosen.id);
    } else {
      get().startResearch(category, category);
    }
  },

  startResearch: (
    topic: string,
    category?: string,
    parentId?: string,
    parentSummary?: string,
    teaserContext?: string
  ) => {
    if (researchES) {
      researchES.close();
    }

    // Build unbroken context trail
    let currentChain = get().contextChain;
    if (parentId) {
      const parentNode = get().nodes.find(n => n.id === parentId);
      const parentTitle = (parentNode?.data?.title as string) || '';
      if (parentTitle && !currentChain.includes(parentTitle)) {
        currentChain = [...currentChain, parentTitle];
      }
      if (!parentSummary && parentNode?.data?.summary) {
        parentSummary = parentNode.data.summary as string;
      }
    } else {
      currentChain = category ? [category, topic] : [topic];
    }
    
    // Set research in progress and switch workstation to live agent tab
    set({
      isResearching: true,
      isDossierOpen: true,
      workstationTab: 'agent',
      currentTopic: topic,
      chatNodeTitle: topic,
      hasNewDossier: false,
      contextChain: currentChain,
      thoughts: [],
      toolCalls: [],
      sources: [],
      planSteps: [],
    });

    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/?topic=${encodeURIComponent(topic)}`);
    }

    const url = api.researchStreamUrl(
      topic,
      category,
      parentId,
      currentChain,
      parentSummary,
      teaserContext
    );
    const es = new EventSource(url);
    researchES = es;

    const timerRef = { current: researchIdleTimer };
    const staleHandler = () => {
      if (researchES === es) researchES = null;
      if (researchIdleTimer) researchIdleTimer = null;
      set({ isResearching: false });
    };
    armIdleTimer(es, timerRef, staleHandler);

    let childIndex = 0;

    es.onmessage = (e) => {
      kickIdleTimer(es, timerRef, staleHandler);
      try {
        const parsed = JSON.parse(e.data);
        const event = parsed.event;
        const data = parsed.data;

        if (event === 'plan') {
          if (data && data.steps) {
            set({ planSteps: data.steps });
          }
        } else if (event === 'thought') {
          set((state) => ({
            thoughts: [...state.thoughts, data]
          }));
        } else if (event === 'tool_call') {
          set((state) => ({
            toolCalls: [
              ...state.toolCalls,
              {
                id: data.call_id || Math.random().toString(),
                name: data.tool,
                status: 'running',
                timestamp: Date.now(),
              }
            ]
          }));
        } else if (event === 'tool_result') {
          set((state) => ({
            toolCalls: state.toolCalls.map((tc) =>
              tc.name === data.tool || tc.id === data.call_id
                ? { ...tc, status: 'done' }
                : tc
            )
          }));
        } else if (event === 'source') {
          set((state) => {
            if (state.sources.some(s => s.url === data.url)) return state;
            return {
              sources: [
                ...state.sources,
                {
                  id: data.id || Math.random().toString(),
                  title: data.title,
                  url: data.url,
                  snippet: data.snippet,
                }
              ]
            };
          });
        } else if (event === 'node_stream') {
          set((state) => {
            const rawNode = (data.node || data) as NodeSchema;
            const rawId = rawNode.id ? String(rawNode.id) : null;
            const nodeId = rawId && !state.nodes.some(n => n.id === rawId)
              ? rawId
              : `res-node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            
            let x = 0;
            let y = 0;

            if (parentId) {
              const parentNode = state.nodes.find(n => n.id === parentId);
              if (parentNode) {
                const angle = childIndex * 2.39996;
                x = parentNode.position.x + 560 * Math.cos(angle);
                y = parentNode.position.y + 560 * Math.sin(angle);
                childIndex++;
              }
            } else if (state.nodes.length > 0) {
              const rootNode = state.nodes[0];
              const angle = childIndex * 2.39996;
              x = rootNode.position.x + 560 * Math.cos(angle);
              y = rootNode.position.y + 560 * Math.sin(angle);
              childIndex++;
            }

            const isThisRoot = !parentId && state.nodes.length === 0;

            const newNode: Node = {
              id: nodeId,
              type: 'research',
              position: { x, y },
              data: {
                ...rawNode,
                id: nodeId,
                nodeId: nodeId,
                isRoot: isThisRoot,
              }
            };

            const newEdges = [...state.edges];
            if (parentId) {
              const edgeId = `e-${parentId}-${nodeId}`;
              if (!newEdges.some(e => e.id === edgeId)) {
                newEdges.push({
                  id: edgeId,
                  source: parentId,
                  target: nodeId,
                  type: 'smoothstep',
                  animated: false
                });
              }
            }

            return {
              nodes: [...state.nodes, newNode],
              edges: newEdges,
              selectedNodeId: nodeId,
              lastResearchedNodeId: nodeId,
            };
          });
        } else if (event === 'dossier') {
          const rawDossier = (data.dossier || data) as ResearchDossier;
          const targetId = rawDossier.nodeId || get().lastResearchedNodeId || '';
          set((state) => ({
            activeDossier: rawDossier,
            hasNewDossier: true,
            lastResearchedNodeId: targetId || state.lastResearchedNodeId,
            dossiersByNodeId: {
              ...state.dossiersByNodeId,
              ...(targetId ? { [targetId]: rawDossier } : {}),
            }
          }));
        } else if (event === 'done') {
          if (timerRef.current) clearTimeout(timerRef.current);
          set((state) => ({
            isResearching: false,
            hasNewDossier: true,
            planSteps: state.planSteps.map((s) => ({ ...s, status: 'done' as const })),
          }));
          persistActiveSession(get());
          es.close();
        } else if (event === 'error') {
          if (timerRef.current) clearTimeout(timerRef.current);
          set({ isResearching: false });
          es.close();
        }
      } catch (err) {
        console.error('Error parsing SSE event', err);
      }
    };

    es.onerror = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      set({ isResearching: false });
      es.close();
    };
  },
  
  loadPrecomputedHub: async (hubId: string) => {
    try {
      get().resetCanvas();
      const res = await api.precomputedHub(hubId);
      if (!res.ok) {
        console.error(`Failed to fetch hub ${hubId}: HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as (PrecomputedHub & { dossier?: any });
      if (!data || !data.root) {
        console.error('Invalid hub data returned from backend:', data);
        return;
      }
      
      const rootNodeSchema = data.root;
      const childrenSchema = data.children || [];
      const rootId = String(rootNodeSchema.id || `hub-root-${data.id}`);
      
      const rootNode: Node = {
        id: rootId,
        type: 'research',
        position: { x: 0, y: 0 },
        data: {
          ...rootNodeSchema,
          id: rootId,
          nodeId: rootId,
          isRoot: true,
        }
      };
      
      const nodes: Node[] = [rootNode];
      const edges: Edge[] = [];
      
      childrenSchema.forEach((child, index) => {
        const childId = String(child.id || `hub-child-${data.id}-${index}`);
        const angle = index * ((Math.PI * 2) / Math.max(1, childrenSchema.length));
        const x = 560 * Math.cos(angle);
        const y = 560 * Math.sin(angle);
        
        nodes.push({
          id: childId,
          type: 'research',
          position: { x, y },
          data: {
            ...child,
            id: childId,
            nodeId: childId,
            isRoot: false,
          }
        });
        
        edges.push({
          id: `e-${rootId}-${childId}`,
          source: rootId,
          target: childId,
          type: 'smoothstep',
          animated: false
        });
      });
      
      set({
        nodes,
        edges,
        currentTopic: rootNodeSchema.title,
        chatNodeTitle: rootNodeSchema.title,
        selectedNodeId: rootId,
        lastResearchedNodeId: rootId,
        contextChain: [rootNodeSchema.category || 'General', rootNodeSchema.title],
        isResearching: false,
        hasNewDossier: false,
        activeDossier: data.dossier && data.dossier.abstract ? data.dossier : get().activeDossier,
      });

      persistActiveSession(get());

      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', `/?topic=${encodeURIComponent(rootNodeSchema.title)}`);
      }

      // Pre-populate active dossier for root node
      get().openDossier(rootId);
    } catch (e) {
      console.error('Failed to load precomputed hub:', e);
    }
  },

  selectNode: (nodeId: string) => {
    const node = get().nodes.find(n => n.id === nodeId);
    if (!node || !node.data) return;

    const nodeTitle = (node.data.title as string) || '';
    const category = (node.data.category as string) || 'General';

    let trail = [category];
    const rootNode = get().nodes.find(n => (n.data as { isRoot?: boolean })?.isRoot);
    if (rootNode && rootNode.data?.title && rootNode.id !== nodeId) {
      trail.push(rootNode.data.title as string);
    }
    if (nodeTitle && !trail.includes(nodeTitle)) {
      trail.push(nodeTitle);
    }

    set({
      selectedNodeId: nodeId,
      currentTopic: nodeTitle,
      chatNodeTitle: nodeTitle,
      contextChain: trail,
    });
  },
  
  openDossier: async (nodeId: string) => {
    get().selectNode(nodeId);
    set({ isDossierOpen: true, workstationTab: 'monograph' });
    
    // 1. Check if we already have the full monograph cached
    if (get().dossiersByNodeId[nodeId]) {
      set({ 
        activeDossier: get().dossiersByNodeId[nodeId],
        isDossierLoading: false,
      });
      return;
    }

    // 2. Check if the currently active dossier matches this node
    if (get().activeDossier && get().activeDossier?.nodeId === nodeId && get().activeDossier?.coreThesis) {
      set({ isDossierLoading: false });
      return;
    }
    
    // 3. Fallback preview from node.data
    const node = get().nodes.find(n => n.id === nodeId);
    if (node && node.data) {
      const nData = node.data;
      const initialDossier: ResearchDossier = {
        nodeId: nodeId,
        title: (nData.title as string) || 'Knowledge Vector',
        tagline: (nData.wow_fact as string) || (nData.category as string) || 'Knowledge Exploration Vector',
        category: (nData.category as string) || 'General',
        era: (nData.era as string) || (nData.timestamp as string) || 'Overview',
        abstract: (nData.summary as string) || 'Exploration overview synthesized by the knowledge engine.',
        coreThesis: (nData.summary as string) || '',
        sources: [],
        gallery: nData.imageUrl ? [{ imageUrl: nData.imageUrl as string, caption: (nData.title as string) || '' }] : [],
        timeline: [],
        mechanisms: [],
        rabbitHoles: ((nData.rabbit_holes as string[]) || []).map(rh => ({
          title: rh,
          teaser: `Inquire further into this connected knowledge topic under ${nData.category || 'General'}.`,
          affinityCategory: (nData.category as string) || 'General',
        })),
        audioTourScript: '',
        wowFact: (nData.wow_fact as string) || null,
        curiosityScore: (nData.curiosity_score as number) || null,
      };
      set({ activeDossier: initialDossier, isDossierLoading: true });
    }

    // 4. Try fetching backend full monograph dossier
    try {
      const res = await api.dossier(nodeId);
      if (res.ok) {
        const data = await res.json();
        const fullDossier = data as ResearchDossier;
        set((state) => ({
          activeDossier: fullDossier,
          isDossierLoading: false,
          dossiersByNodeId: {
            ...state.dossiersByNodeId,
            [nodeId]: fullDossier,
          }
        }));
      } else {
        set({ isDossierLoading: false });
      }
    } catch (e) {
      set({ isDossierLoading: false });
    }
  },
  
  closeDossier: () => {
    set({ isDossierOpen: false });
  },

  setWorkstationTab: (tab: 'monograph' | 'agent') => {
    set({ workstationTab: tab });
  },

  dismissNewDossierAlert: () => {
    set({ hasNewDossier: false });
  },
  
  sendChat: (question: string) => {
    if (chatES) {
      chatES.close();
    }
    
    const activeNode = get().nodes.find(n => n.id === get().selectedNodeId) ||
                       get().nodes.find(n => (n.data as { isRoot?: boolean })?.isRoot) ||
                       get().nodes[0];

    const nodeTitle = (activeNode?.data?.title as string) || get().chatNodeTitle || get().currentTopic || 'General';
    const ancestors = get().contextChain;
    const activeSummary = (activeNode?.data?.summary as string) || '';
    
    const history: ChatHistoryMessage[] = get().chatMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    set((state) => ({
      isChatStreaming: true,
      chatMessages: [
        ...state.chatMessages,
        { role: 'user', content: question, timestamp: Date.now() },
        { role: 'assistant', content: '', timestamp: Date.now() + 1 }
      ]
    }));
    
    const url = api.chatStreamUrl(nodeTitle, question, ancestors, history, activeSummary);
    const es = new EventSource(url);
    chatES = es;

    const timerRef = { current: chatIdleTimer };
    const staleHandler = () => {
      if (chatES === es) chatES = null;
      if (chatIdleTimer) chatIdleTimer = null;
      set({ isChatStreaming: false });
    };
    armIdleTimer(es, timerRef, staleHandler);
    
    es.onmessage = (e) => {
      kickIdleTimer(es, timerRef, staleHandler);
      try {
        const parsed = JSON.parse(e.data);
        const event = parsed.event;
        const data = parsed.data;
        
        if (event === 'thought') {
          set((state) => {
            const msgs = [...state.chatMessages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant') {
              const currentThoughts = last.thoughts || [];
              last.thoughts = [...currentThoughts, data.text || data.agent || 'Thinking...'];
            }
            return { chatMessages: msgs };
          });
        } else if (event === 'tool_call') {
          set((state) => {
            const msgs = [...state.chatMessages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant') {
              const currentTools = last.toolCalls || [];
              last.toolCalls = [
                ...currentTools,
                { id: data.call_id || String(Date.now()), tool: data.tool || 'Search', query: data.query, status: 'running' }
              ];
            }
            return { chatMessages: msgs };
          });
        } else if (event === 'tool_result') {
          set((state) => {
            const msgs = [...state.chatMessages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant' && last.toolCalls) {
              last.toolCalls = last.toolCalls.map(tc => 
                tc.id === data.call_id || tc.tool === data.tool
                  ? { ...tc, status: 'success' as const }
                  : tc
              );
            }
            return { chatMessages: msgs };
          });
        } else if (event === 'source') {
          set((state) => {
            const msgs = [...state.chatMessages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant') {
              const currentSources = last.sources || [];
              if (!currentSources.some(s => s.url === data.url)) {
                last.sources = [...currentSources, {
                  id: data.id || String(Date.now()),
                  title: data.title || data.url,
                  url: data.url,
                  snippet: data.snippet
                }];
              }
            }
            return { chatMessages: msgs };
          });
        } else if (event === 'suggested_questions') {
          set((state) => {
            const msgs = [...state.chatMessages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant') {
              last.suggestedFollowUps = Array.isArray(data) ? data : data.questions || [];
            }
            return { chatMessages: msgs };
          });
        } else if (event === 'answer_start') {
          set((state) => {
            const msgs = [...state.chatMessages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant') {
              last.content = '';
            }
            return { chatMessages: msgs };
          });
        } else if (event === 'token') {
          set((state) => {
            const msgs = [...state.chatMessages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant') {
              last.content += data.token;
            }
            return { chatMessages: msgs };
          });
        } else if (event === 'done') {
          if (timerRef.current) clearTimeout(timerRef.current);
          set({ isChatStreaming: false });
          es.close();
        } else if (event === 'error') {
          if (timerRef.current) clearTimeout(timerRef.current);
          set({ isChatStreaming: false });
          es.close();
        }
      } catch (err) {
        console.error('Error parsing chat SSE:', err);
      }
    };
    
    es.onerror = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      set({ isChatStreaming: false });
      es.close();
    };
  },
  
  pinChatToCanvas: (question: string, answer: string, citations?: Array<{ title?: string; url: string }>) => {
    const activeNodeId = get().selectedNodeId || get().lastResearchedNodeId || get().nodes[0]?.id;
    const activeNode = get().nodes.find(n => n.id === activeNodeId);
    const activeTitle = (activeNode?.data?.title as string) || get().currentTopic || 'Research Topic';
    
    const noteId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    
    const existingNotesCount = get().nodes.filter(n => n.type === 'note').length;
    const offsetAngle = existingNotesCount * 0.785;
    const baseX = activeNode ? activeNode.position.x + 460 * Math.cos(offsetAngle) : 100;
    const baseY = activeNode ? activeNode.position.y + 460 * Math.sin(offsetAngle) : 100;

    const newNoteNode: Node = {
      id: noteId,
      type: 'note',
      position: { x: baseX, y: baseY },
      data: {
        id: noteId,
        sourceNodeId: activeNodeId || '',
        sourceNodeTitle: activeTitle,
        question,
        answer,
        citations: citations || [],
        timestamp: Date.now(),
      }
    };

    const newEdges = [...get().edges];
    if (activeNodeId) {
      newEdges.push({
        id: `e-note-${activeNodeId}-${noteId}`,
        source: activeNodeId,
        target: noteId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#000000', strokeDasharray: '4,4', strokeWidth: 1.5 },
      });
    }

    set({
      nodes: [...get().nodes, newNoteNode],
      edges: newEdges,
    });
  },

  deleteNode: (nodeId: string) => {
    set({
      nodes: get().nodes.filter(n => n.id !== nodeId),
      edges: get().edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
    });
  },

  saveMindMap: async () => {
    const { nodes, edges, currentTopic, activeMindMapId, shareSlug } = get();
    if (nodes.length === 0 || !currentTopic) {
      return { error: 'Canvas is empty. Explore a topic first.' };
    }

    const title = currentTopic;
    const rootNode = nodes.find(n => !n.parentId);
    const category = rootNode?.data?.category as string || 'General';
    const slug = shareSlug || `${currentTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      // 1. Try Supabase cloud persistence if logged in
      const { data: { user } } = await supabase.auth.getUser();
      let savedId = activeMindMapId;

      if (user) {
        if (activeMindMapId) {
          const { data, error } = await supabase
            .from('mindmaps')
            .update({
              title,
              root_topic: currentTopic,
              category,
              nodes: nodes as any,
              edges: edges as any,
              share_slug: slug,
              updated_at: new Date().toISOString()
            })
            .eq('id', activeMindMapId)
            .select()
            .single();

          if (!error && data) savedId = data.id;
        } else {
          const { data, error } = await supabase
            .from('mindmaps')
            .insert({
              user_id: user.id,
              title,
              root_topic: currentTopic,
              category,
              nodes: nodes as any,
              edges: edges as any,
              share_slug: slug,
              is_public: false,
            })
            .select()
            .single();

          if (!error && data) savedId = data.id;
        }
      }

      // 2. Always persist locally for instant guest retrieval
      const localSession = {
        id: savedId || slug,
        topic: currentTopic,
        category,
        nodeCount: nodes.length,
        nodes,
        edges,
        dossiersByNodeId: get().dossiersByNodeId,
        contextChain: get().contextChain,
        shareSlug: slug,
        timestamp: Date.now()
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('tdilearned_active_session', JSON.stringify(localSession));

        const existingRaw = localStorage.getItem('tdilearned_recent_sessions');
        const recentList = existingRaw ? JSON.parse(existingRaw) : [];
        const filtered = recentList.filter((item: any) => item.topic !== currentTopic);
        const updatedRecent = [{
          id: savedId || slug,
          topic: currentTopic,
          category,
          nodeCount: nodes.length,
          timestamp: Date.now()
        }, ...filtered].slice(0, 10);
        
        localStorage.setItem('tdilearned_recent_sessions', JSON.stringify(updatedRecent));
        set({ recentSessions: updatedRecent });
      }

      set({ activeMindMapId: savedId, shareSlug: slug });
      return { id: savedId || slug, shareSlug: slug };
    } catch (e: any) {
      console.error('Error saving mindmap:', e);
      return { error: e.message || 'Failed to save mindmap.' };
    }
  },

  loadMindMapById: async (id: string) => {
    try {
      // 1. Check Supabase
      const { data, error } = await supabase
        .from('mindmaps')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        set({
          nodes: data.nodes || [],
          edges: data.edges || [],
          currentTopic: data.root_topic || data.title,
          dossiersByNodeId: data.dossiers || {},
          contextChain: data.context_chain || [],
          activeMindMapId: data.id,
          shareSlug: data.share_slug,
          selectedNodeId: data.nodes?.[0]?.id || null,
          isResearching: false,
          isDossierOpen: false,
        });

        persistActiveSession(get());
        return true;
      }

      // 2. Check Local Storage
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('tdilearned_active_session');
        if (raw) {
          const session = JSON.parse(raw);
          if (session.id === id || session.shareSlug === id) {
            set({
              nodes: session.nodes || [],
              edges: session.edges || [],
              currentTopic: session.topic,
              dossiersByNodeId: session.dossiersByNodeId || {},
              contextChain: session.contextChain || [],
              activeMindMapId: session.id,
              shareSlug: session.shareSlug,
              selectedNodeId: session.nodes?.[0]?.id || null,
              isResearching: false,
              isDossierOpen: false,
            });
            return true;
          }
        }
      }

      return false;
    } catch (e) {
      console.error('Error loading mindmap by ID:', e);
      return false;
    }
  },

  loadMindMapBySlug: async (slug: string) => {
    try {
      const { data, error } = await supabase
        .from('mindmaps')
        .select('*')
        .eq('share_slug', slug)
        .single();

      if (error || !data) return false;

      set({
        nodes: data.nodes || [],
        edges: data.edges || [],
        currentTopic: data.title,
        dossiersByNodeId: data.dossiers || {},
        contextChain: data.context_chain || [],
        activeMindMapId: data.id,
        shareSlug: data.share_slug,
        selectedNodeId: data.nodes?.[0]?.id || null,
        isResearching: false,
        isDossierOpen: false,
      });

      persistActiveSession(get());
      return true;
    } catch (e) {
      console.error('Error loading shared mindmap:', e);
      return false;
    }
  },

  generateShareLink: async () => {
    const { currentTopic, shareSlug, nodes, edges, activeMindMapId } = get();
    if (!currentTopic) return null;

    let slug = shareSlug;
    if (!slug) {
      slug = `${currentTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const rootNode = nodes.find(n => !n.parentId);
    const category = (rootNode?.data?.category as string) || 'General';

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        title: currentTopic,
        root_topic: currentTopic,
        category,
        nodes: nodes as any,
        edges: edges as any,
        share_slug: slug,
        is_public: true,
        updated_at: new Date().toISOString(),
      };

      if (user && activeMindMapId) {
        await supabase.from('mindmaps').update(payload).eq('id', activeMindMapId);
      } else if (user) {
        const { data, error } = await supabase
          .from('mindmaps')
          .insert({ ...payload, user_id: user.id })
          .select()
          .single();
        if (!error && data) set({ activeMindMapId: data.id });
      } else {
        // Guests: upsert a public row keyed by share_slug so shared links resolve for everyone
        const { data, error } = await supabase
          .from('mindmaps')
          .upsert({ ...payload, user_id: null }, { onConflict: 'share_slug' })
          .select()
          .single();
        if (!error && data) set({ activeMindMapId: data.id });
      }
    } catch (e) {
      console.warn('Supabase share update skipped (guest mode)');
    }

    set({ shareSlug: slug });
    persistActiveSession(get());
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tdilearned.com';
    return `${origin}/m/${slug}`;
  },

  restoreSessionFromLocalStorage: () => {
    if (typeof window === 'undefined') return false;
    try {
      const rawRecent = localStorage.getItem('tdilearned_recent_sessions');
      if (rawRecent) {
        set({ recentSessions: JSON.parse(rawRecent) });
      }

      const params = new URLSearchParams(window.location.search);
      const urlTopic = params.get('topic');
      return get().restoreSessionFromURL();
    } catch (e) {
      console.error('Error restoring session from localStorage:', e);
      return false;
    }
  },

  restoreSessionFromURL: () => {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTopic = params.get('topic');
      if (!urlTopic) return false;

      const topicSessions = JSON.parse(localStorage.getItem('tdilearned_topic_sessions') || '{}');
      const session = topicSessions[urlTopic];

      if (session && session.nodes && session.nodes.length > 0) {
        const rootNodeId =
          session.nodes.find((n: Node) => (n.data as { isRoot?: boolean })?.isRoot)?.id ||
          session.nodes[0]?.id;
        const restoredDossier = session.dossiersByNodeId?.[rootNodeId] || null;

        set({
          nodes: session.nodes,
          edges: session.edges || [],
          currentTopic: session.topic,
          dossiersByNodeId: session.dossiersByNodeId || {},
          activeDossier: restoredDossier,
          contextChain: session.contextChain || [session.topic],
          activeMindMapId: session.id,
          shareSlug: session.shareSlug,
          selectedNodeId: rootNodeId || null,
          isResearching: false,
          isDossierOpen: false,
          workstationTab: 'monograph',
        });
        return true;
      }

      // No saved snapshot for this topic — treat it as a fresh research URL.
      if (get().nodes.length === 0) {
        get().startResearch(urlTopic);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error restoring session from URL:', e);
      return false;
    }
  },

  resetCanvas: () => {
    if (researchES) researchES.close();
    if (chatES) chatES.close();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tdilearned_active_session');
      window.history.pushState({}, '', '/');
    }

    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      lastResearchedNodeId: null,
      contextChain: [],
      isResearching: false,
      currentTopic: null,
      chatNodeTitle: null,
      hasNewDossier: false,
      thoughts: [],
      toolCalls: [],
      sources: [],
      planSteps: [],
      dossiersByNodeId: {},
      activeDossier: null,
      isDossierOpen: false,
      chatMessages: [],
      activeMindMapId: null,
      shareSlug: null,
    });
  },
  flushCanvasAutosave: () => {
    flushAutosave();
  }
}));



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
  
  // Chat
  chatMessages: ChatMessage[];
  isChatStreaming: boolean;
  chatNodeTitle: string | null;
  
  // Sidebar / browse
  selectedCategory: string;
  precomputedHubs: PrecomputedHubSummary[];
  
  // Actions
  fetchPrecomputedHubs: () => Promise<PrecomputedHubSummary[]>;
  loadRandomHubByCategory: (category: string) => Promise<void>;
  pickRandomTopic: (category: string) => Promise<void>;
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
  dismissNewDossierAlert: () => void;
  sendChat: (question: string) => void;
  setCategory: (cat: string) => void;
  resetCanvas: () => void;
}

let researchES: EventSource | null = null;
let chatES: EventSource | null = null;

export const useMindMapStore = create<MindMapState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  lastResearchedNodeId: null,
  contextChain: [],
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  
  isResearching: false,
  currentTopic: null,
  hasNewDossier: false,
  
  thoughts: [],
  toolCalls: [],
  sources: [],
  planSteps: [],
  
  dossiersByNodeId: {},
  activeDossier: null,
  isDossierOpen: false,
  isDossierLoading: false,
  
  chatMessages: [],
  isChatStreaming: false,
  chatNodeTitle: null,
  
  selectedCategory: 'Science',
  precomputedHubs: [],
  
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

  pickRandomTopic: async (category: string) => {
    try {
      const res = await api.randomTopic(category);
      if (!res.ok) throw new Error('Failed to pick random topic');
      const data = await res.json();
      get().startResearch(data.topic, category);
    } catch (e) {
      console.error('Failed random topic picker, falling back:', e);
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
    
    // Set research in progress
    set({
      isResearching: true,
      currentTopic: topic,
      chatNodeTitle: topic,
      hasNewDossier: false,
      contextChain: currentChain,
      thoughts: [],
      toolCalls: [],
      sources: [],
      planSteps: [],
    });

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

    let childIndex = 0;

    es.onmessage = (e) => {
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
          set((state) => ({
            isResearching: false,
            hasNewDossier: true,
            planSteps: state.planSteps.map((s) => ({ ...s, status: 'done' as const })),
          }));
          es.close();
        } else if (event === 'error') {
          set({ isResearching: false });
          es.close();
        }
      } catch (err) {
        console.error('Error parsing SSE event', err);
      }
    };

    es.onerror = () => {
      set({ isResearching: false });
      es.close();
    };
  },
  
  loadPrecomputedHub: async (hubId: string) => {
    try {
      get().resetCanvas();
      const res = await api.precomputedHub(hubId);
      const data = (await res.json()) as PrecomputedHub;
      
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
      });

      // Eagerly pre-populate active dossier for root node
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
    set({ isDossierOpen: true });
    
    // 1. Check if we already have the full monograph cached
    const cachedDossier = get().dossiersByNodeId[nodeId];
    if (cachedDossier && cachedDossier.coreThesis) {
      set({ activeDossier: cachedDossier, isDossierLoading: false });
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
    
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        const event = parsed.event;
        const data = parsed.data;
        
        if (event === 'answer_start') {
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
          set({ isChatStreaming: false });
          es.close();
        } else if (event === 'error') {
          set({ isChatStreaming: false });
          es.close();
        }
      } catch (err) {
        console.error('Error parsing chat SSE:', err);
      }
    };
    
    es.onerror = () => {
      set({ isChatStreaming: false });
      es.close();
    };
  },
  
  setCategory: (cat: string) => {
    set({ selectedCategory: cat });
  },

  setSelectedNode: (nodeId: string | null) => {
    if (nodeId) {
      get().selectNode(nodeId);
    } else {
      set({ selectedNodeId: null });
    }
  },
  
  resetCanvas: () => {
    if (researchES) researchES.close();
    if (chatES) chatES.close();
    
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
    });
  }
}));

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
import { api } from '@/lib/api';
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
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  
  // Research flow
  isResearching: boolean;
  currentTopic: string | null;
  
  // SSE activity stream
  thoughts: ThoughtStep[];
  toolCalls: ToolCallEvent[];
  sources: SourceCitation[];
  planSteps: PlanStep[];
  
  // Dossier
  activeDossier: ResearchDossier | null;
  isDossierOpen: boolean;
  
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
  startResearch: (topic: string, category?: string, parentId?: string) => void;
  loadPrecomputedHub: (hubId: string) => Promise<void>;
  openDossier: (nodeId: string) => Promise<void>;
  closeDossier: () => void;
  sendChat: (question: string) => void;
  setCategory: (cat: string) => void;
  resetCanvas: () => void;
}

let researchES: EventSource | null = null;
let chatES: EventSource | null = null;

export const useMindMapStore = create<MindMapState>((set, get) => ({
  nodes: [],
  edges: [],
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  
  isResearching: false,
  currentTopic: null,
  
  thoughts: [],
  toolCalls: [],
  sources: [],
  planSteps: [],
  
  activeDossier: null,
  isDossierOpen: false,
  
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

  /**
   * Instantly load a precomputed hub matching the category with zero latency.
   */
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
      // Fallback to live research if completely empty
      get().startResearch(category, category);
    }
  },
  
  pickRandomTopic: async (category: string) => {
    try {
      const res = await api.randomTopic(category);
      const data = await res.json();
      get().startResearch(data.node.title, category);
    } catch (e) {
      console.error('Failed to pick random topic:', e);
      get().loadRandomHubByCategory(category);
    }
  },
  
  startResearch: (topic: string, category?: string, parentId?: string) => {
    if (researchES) {
      researchES.close();
      researchES = null;
    }
    
    set({
      isResearching: true,
      currentTopic: topic,
      planSteps: [],
      thoughts: [],
      toolCalls: [],
      sources: []
    });

    if (!parentId) {
      get().resetCanvas();
      set({ isResearching: true, currentTopic: topic });
    }

    const url = api.researchStreamUrl(topic, category, parentId);
    const es = new EventSource(url);
    researchES = es;

    let childIndex = 0;

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        const event = parsed.event;
        const data = parsed.data;

        if (event === 'plan') {
          set((state) => ({ planSteps: [...state.planSteps, data as PlanStep] }));
        } else if (event === 'thought') {
          set((state) => ({
            thoughts: [
              ...state.thoughts,
              { type: 'thought', text: data.text, timestamp: Date.now() }
            ]
          }));
        } else if (event === 'tool_call') {
          set((state) => ({
            toolCalls: [
              ...state.toolCalls,
              {
                id: data.id || `tc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                name: data.tool,
                args: data.args,
                status: 'running',
                timestamp: Date.now()
              }
            ]
          }));
        } else if (event === 'tool_result') {
          set((state) => ({
            toolCalls: state.toolCalls.map(tc => 
              tc.id === data.id ? { ...tc, status: 'done', result: data.result } : tc
            )
          }));
        } else if (event === 'source') {
          set((state) => ({ sources: [...state.sources, data as SourceCitation] }));
        } else if (event === 'node_stream') {
          const nodeData = data as NodeSchema;
          const nodeId = String(nodeData.id || `node-${Date.now()}-${childIndex}`);
          
          set((state) => {
            const existingIndex = state.nodes.findIndex(n => n.id === nodeId);
            if (existingIndex >= 0) {
              const updatedNodes = [...state.nodes];
              updatedNodes[existingIndex] = {
                ...updatedNodes[existingIndex],
                data: {
                  ...updatedNodes[existingIndex].data,
                  ...nodeData,
                  id: nodeId,
                  nodeId: nodeId,
                }
              };
              return { nodes: updatedNodes };
            }

            let x = 0;
            let y = 0;

            if (parentId) {
              const parentNode = state.nodes.find(n => n.id === parentId);
              if (parentNode) {
                const angle = childIndex * 2.39996;
                x = parentNode.position.x + 380 * Math.cos(angle);
                y = parentNode.position.y + 380 * Math.sin(angle);
                childIndex++;
              }
            } else if (state.nodes.length > 0) {
              const rootNode = state.nodes[0];
              const angle = childIndex * 2.39996;
              x = rootNode.position.x + 380 * Math.cos(angle);
              y = rootNode.position.y + 380 * Math.sin(angle);
              childIndex++;
            }

            const newNode: Node = {
              id: nodeId,
              type: 'research',
              position: { x, y },
              data: {
                ...nodeData,
                id: nodeId,
                nodeId: nodeId,
                isRoot: !parentId && state.nodes.length === 0,
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
              edges: newEdges
            };
          });
        } else if (event === 'dossier') {
          set({ activeDossier: data as ResearchDossier });
        } else if (event === 'done' || event === 'error') {
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
        const x = 380 * Math.cos(angle);
        const y = 380 * Math.sin(angle);
        
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
      
      set({ nodes, edges, currentTopic: rootNodeSchema.title, isResearching: false });
    } catch (e) {
      console.error('Failed to load precomputed hub:', e);
    }
  },
  
  openDossier: async (nodeId: string) => {
    try {
      set({ isDossierOpen: true });
      const currentActive = get().activeDossier;
      if (currentActive && currentActive.nodeId === nodeId) {
        return;
      }
      const res = await api.dossier(nodeId);
      if (res.ok) {
        const data = await res.json();
        set({ activeDossier: data as ResearchDossier });
      }
    } catch (e) {
      console.error('Failed to fetch dossier:', e);
    }
  },
  
  closeDossier: () => {
    set({ isDossierOpen: false });
  },
  
  sendChat: (question: string) => {
    if (chatES) {
      chatES.close();
    }
    
    const nodeTitle = get().chatNodeTitle || get().currentTopic || 'General';
    
    set((state) => ({
      isChatStreaming: true,
      chatMessages: [
        ...state.chatMessages,
        { role: 'user', content: question, timestamp: Date.now() },
        { role: 'assistant', content: '', timestamp: Date.now() + 1 }
      ]
    }));
    
    const url = api.chatStreamUrl(nodeTitle, question, []);
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
        } else if (event === 'done' || event === 'error') {
          set({ isChatStreaming: false });
          es.close();
        }
      } catch (err) {
        console.error('Error parsing chat SSE event', err);
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
  
  resetCanvas: () => {
    if (researchES) {
      researchES.close();
      researchES = null;
    }
    if (chatES) {
      chatES.close();
      chatES = null;
    }
    set({
      nodes: [],
      edges: [],
      isResearching: false,
      currentTopic: null,
      thoughts: [],
      toolCalls: [],
      sources: [],
      planSteps: [],
      activeDossier: null,
      isDossierOpen: false,
      chatMessages: [],
      isChatStreaming: false,
      chatNodeTitle: null,
    });
  }
}));

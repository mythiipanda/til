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
  fetchPrecomputedHubs: () => Promise<void>;
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
      const data = await res.json();
      set({ precomputedHubs: data });
    } catch (e) {
      console.error('Failed to fetch precomputed hubs:', e);
    }
  },
  
  pickRandomTopic: async (category: string) => {
    try {
      const res = await api.randomTopic(category);
      const data = await res.json();
      get().startResearch(data.node.title, category);
    } catch (e) {
      console.error('Failed to pick random topic:', e);
    }
  },
  
  startResearch: (topic: string, category?: string, parentId?: string) => {
    if (researchES) {
      researchES.close();
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
      // Ensure we immediately start fresh for new research
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
                id: data.id || `tc-${Date.now()}`,
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
          set((state) => {
            const existingNode = state.nodes.find(n => n.id === nodeData.id);
            if (existingNode) {
              return {
                nodes: state.nodes.map(n =>
                  n.id === nodeData.id ? { ...n, data: { ...n.data, ...nodeData } } : n
                )
              };
            }

            let x = 0;
            let y = 0;

            if (parentId) {
              const parentNode = state.nodes.find(n => n.id === parentId);
              if (parentNode) {
                // Radial placement using golden angle approximation
                const angle = childIndex * 2.39996;
                x = parentNode.position.x + 350 * Math.cos(angle);
                y = parentNode.position.y + 350 * Math.sin(angle);
                childIndex++;
              }
            } else if (state.nodes.length > 0) {
              const rootNode = state.nodes[0];
              const angle = childIndex * 2.39996;
              x = rootNode.position.x + 350 * Math.cos(angle);
              y = rootNode.position.y + 350 * Math.sin(angle);
              childIndex++;
            }

            const newNode: Node = {
              id: nodeData.id,
              type: 'research',
              position: { x, y },
              data: nodeData
            };

            const newEdges = [...state.edges];
            if (parentId) {
              newEdges.push({
                id: `e-${parentId}-${nodeData.id}`,
                source: parentId,
                target: nodeData.id,
                type: 'smoothstep',
                animated: false
              });
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
      const childrenSchema = data.children;
      
      const rootNode: Node = {
        id: rootNodeSchema.id,
        type: 'research',
        position: { x: 0, y: 0 },
        data: rootNodeSchema
      };
      
      const nodes: Node[] = [rootNode];
      const edges: Edge[] = [];
      
      childrenSchema.forEach((child, index) => {
        const angle = index * ((Math.PI * 2) / childrenSchema.length);
        const x = 350 * Math.cos(angle);
        const y = 350 * Math.sin(angle);
        
        nodes.push({
          id: child.id,
          type: 'research',
          position: { x, y },
          data: child
        });
        
        edges.push({
          id: `e-${rootNode.id}-${child.id}`,
          source: rootNode.id,
          target: child.id,
          type: 'smoothstep',
          animated: false
        });
      });
      
      set({ nodes, edges, currentTopic: rootNodeSchema.title });
    } catch (e) {
      console.error('Failed to load precomputed hub:', e);
    }
  },
  
  openDossier: async (nodeId: string) => {
    try {
      set({ isDossierOpen: true });
      const currentActive = get().activeDossier;
      if (currentActive && currentActive.nodeId === nodeId) {
        return; // Already have this dossier active
      }
      const res = await api.dossier(nodeId);
      const data = await res.json();
      set({ activeDossier: data as ResearchDossier });
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
            if (last.role === 'assistant') {
              last.content = '';
            }
            return { chatMessages: msgs };
          });
        } else if (event === 'token') {
          set((state) => {
            const msgs = [...state.chatMessages];
            const last = msgs[msgs.length - 1];
            if (last.role === 'assistant') {
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

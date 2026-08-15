import { create } from 'zustand';
import { Node, Edge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react';
import {
  NodeData,
  NodeSchema,
  ThinkingStep,
  CanvasViewMode,
  CuriosityStats,
  ResearchDossier,
  PlanStep,
  ToolCallEvent,
  SourceCitation
} from '@/types/graph';
import { PRECOMPUTED_HUBS } from '@/lib/mockData';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

interface MindMapState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNode: NodeData | null;
  activeChatNode: NodeData | null;
  activeAudioNode: NodeData | null;
  
  // Manus Deep Research State
  isResearching: boolean;
  activeAgentPhase: string;
  activePlanSteps: PlanStep[];
  activeToolCalls: ToolCallEvent[];
  discoveredSources: SourceCitation[];
  activeDossier: ResearchDossier | null;
  dossiersMap: Record<string, ResearchDossier>;

  // Thinking & Telemetry
  thinkingSteps: ThinkingStep[];
  isThinking: boolean;
  totalLatencyMs: number;
  engineUsed: string;
  
  // Top-Down Generation Inspector State
  isInspectorOpen: boolean;
  setIsInspectorOpen: (open: boolean) => void;

  // View & Analytics
  viewMode: CanvasViewMode;
  stats: CuriosityStats;
  
  // Actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  setSelectedNode: (node: NodeData | null) => void;
  setActiveChatNode: (node: NodeData | null) => void;
  setActiveAudioNode: (node: NodeData | null) => void;
  setViewMode: (mode: CanvasViewMode) => void;
  
  // Research Actions
  initTopDownUniverse: () => void;
  startDeepResearch: (topic: string, category?: string, parentId?: string) => Promise<void>;
  openDossier: (nodeId: string) => void;
  closeDossier: () => void;
  expandRabbitHole: (parentTopic: string, vector: string, parentNodeId?: string) => Promise<void>;
  resetGraph: () => void;
  loadPresetCategory: (categoryKey: string) => void;
}

export const useMindMapStore = create<MindMapState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  activeChatNode: null,
  activeAudioNode: null,

  isResearching: false,
  activeAgentPhase: '',
  activePlanSteps: [],
  activeToolCalls: [],
  discoveredSources: [],
  activeDossier: null,
  dossiersMap: {},

  thinkingSteps: [],
  isThinking: false,
  totalLatencyMs: 0,
  engineUsed: 'cerebras-cs3-agent',
  isInspectorOpen: false,
  setIsInspectorOpen: (open) => set({ isInspectorOpen: open }),

  viewMode: 'canvas',
  stats: {
    nodesExplored: 0,
    rabbitHolesExpanded: 0,
    categoriesVisited: {},
    deepestDepth: 1,
  },

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as Node<NodeData>[],
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  setSelectedNode: (node) => set({ selectedNode: node }),
  setActiveChatNode: (node) => set({ activeChatNode: node }),
  setActiveAudioNode: (node) => set({ activeAudioNode: node }),
  setViewMode: (mode) => set({ viewMode: mode }),

  openDossier: (nodeId) => {
    const dossier = get().dossiersMap[nodeId];
    if (dossier) {
      set({ activeDossier: dossier });
    }
  },

  closeDossier: () => set({ activeDossier: null }),

  initTopDownUniverse: () => {
    const rootNodeId = 'universe-root';
    const rootNode: Node<NodeData> = {
      id: rootNodeId,
      type: 'mindmap',
      position: { x: 0, y: 0 },
      data: {
        id: rootNodeId,
        title: '🌌 The Universe of Curiosity',
        summary: 'Start from the top: click any major domain below to see how AI breaks down history, wars, ancient tech, and cosmic mysteries into interactive discovery maps.',
        category: 'Macro Cosmos',
        image_search_query: 'Cosmic universe constellation nebula galaxy',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Hubble_Ultra_Deep_Field_part_of_the_sky.jpg/800px-Hubble_Ultra_Deep_Field_part_of_the_sky.jpg',
        rabbit_holes: [
          '⚔️ Epic Wars & Famous Battles',
          '📜 Fascinating History & Scandals',
          '⚙️ Ancient Inventions & Lost Tech',
          '🚀 Space & Cosmic Wonders',
          '🌊 Deep Ocean & Earth Enigmas'
        ],
        timestamp: 'All Epochs',
        confidence: 1.0,
        audio_summary: 'Welcome to the Universe of Curiosity. Pick any realm of history or science, and watch how new concepts branch out in real time.',
        sources_count: 5,
        isExpanding: false,
        expandedVectors: [],
        onExpandRabbitHole: (p, v) => get().expandRabbitHole(p, v, rootNodeId),
        onOpenDossier: (id) => get().openDossier(id),
        onOpenChat: (node) => set({ activeChatNode: node }),
        onPlayAudio: (node) => set({ activeAudioNode: node }),
      }
    };

    const pillarConfigs = [
      {
        id: 'pillar-wars',
        title: '⚔️ Epic Wars & Famous Battles',
        summary: 'Daring military sneak attacks, master tacticians, and the strangest conflicts in human history.',
        category: 'Epic Wars & Battles',
        pos: { x: -650, y: 400 },
        img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Hannibal_traversant_les_Alpes_-_Clairin.jpg/800px-Hannibal_traversant_les_Alpes_-_Clairin.jpg',
        rabbits: ['Hannibal Crossing the Alps with War Elephants', 'The Great Emu War of 1932', 'The Trojan War: Myth vs Reality']
      },
      {
        id: 'pillar-history',
        title: '📜 Fascinating History & Mysteries',
        summary: 'Bizarre mass hysterias, lost libraries, royal secrets, and forgotten civilizations.',
        category: 'Fascinating History',
        pos: { x: -320, y: 450 },
        img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Pieter_Brueghel_the_Elder_-_The_Triumph_of_Death_-_Google_Art_Project.jpg/800px-Pieter_Brueghel_the_Elder_-_The_Triumph_of_Death_-_Google_Art_Project.jpg',
        rabbits: ['The Dancing Plague of 1518', 'The Lost Library of Alexandria', 'The Voynich Manuscript Secret Code']
      },
      {
        id: 'pillar-inventions',
        title: '⚙️ Ancient Inventions & Lost Tech',
        summary: 'Handheld bronze computers, ancient steam engines, and super-weapons of antiquity.',
        category: 'Ancient Inventions',
        pos: { x: 0, y: 480 },
        img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/NAMA_Machine_d%27Anticyth%C3%A8re_1.jpg/800px-NAMA_Machine_d%27Anticyth%C3%A8re_1.jpg',
        rabbits: ['The 2,000-Year-Old Antikythera Computer', 'Hero of Alexandria Steam Turbine', 'Archimedes Secret War Machines']
      },
      {
        id: 'pillar-space',
        title: '🚀 Space & Cosmic Wonders',
        summary: 'Falling into black holes, wormholes, alien ocean moons, and relativistic time travel.',
        category: 'Space & The Cosmos',
        pos: { x: 320, y: 450 },
        img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Black_hole_-_Messier_87_crop_max_res.jpg/800px-Black_hole_-_Messier_87_crop_max_res.jpg',
        rabbits: ['What Really Happens Inside a Black Hole', 'The Hidden Oceans of Europa', 'How Time Dilation Changes Aging']
      },
      {
        id: 'pillar-ocean',
        title: '🌊 Deep Ocean & Earth Enigmas',
        summary: 'Unexplained hydrophone sounds, monsters of the Mariana trench, and lost sunken continents.',
        category: 'Deep-Sea Enigmas',
        pos: { x: 650, y: 400 },
        img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Deep_sea_hydrothermal_vent.jpg/800px-Deep_sea_hydrothermal_vent.jpg',
        rabbits: ['The Bloop Mysterious Ocean Sound', 'Life at the Bottom of Mariana Trench', 'Sunken Megaliths of Dwarka']
      }
    ];

    const pillarNodes: Node<NodeData>[] = pillarConfigs.map((p) => ({
      id: p.id,
      type: 'mindmap',
      position: p.pos,
      data: {
        id: p.id,
        title: p.title,
        summary: p.summary,
        category: p.category,
        image_search_query: p.title,
        imageUrl: p.img,
        rabbit_holes: p.rabbits,
        timestamp: 'Top-Down Pillar',
        confidence: 0.99,
        audio_summary: p.summary,
        sources_count: 4,
        isExpanding: false,
        expandedVectors: [],
        onExpandRabbitHole: (parentTopic, vector) => get().expandRabbitHole(parentTopic, vector, p.id),
        onOpenDossier: (id) => get().openDossier(id),
        onOpenChat: (node) => set({ activeChatNode: node }),
        onPlayAudio: (node) => set({ activeAudioNode: node }),
      }
    }));

    const edges: Edge[] = pillarConfigs.map((p) => ({
      id: `edge-root-${p.id}`,
      source: rootNodeId,
      target: p.id,
      animated: true,
      style: { stroke: '#38bdf8', strokeWidth: 2.5, opacity: 0.8 },
    }));

    set({
      nodes: [rootNode, ...pillarNodes],
      edges: edges,
      stats: {
        nodesExplored: 6,
        rabbitHolesExpanded: 0,
        categoriesVisited: { 'Macro Cosmos': 1, 'Epic Wars & Battles': 1, 'Fascinating History': 1, 'Ancient Inventions': 1, 'Space & The Cosmos': 1, 'Deep-Sea Enigmas': 1 },
        deepestDepth: 1,
      }
    });
  },

  startDeepResearch: async (topic: string, category?: string, parentId?: string) => {
    set({
      isResearching: true,
      activeAgentPhase: `Discovering stories about "${topic}"...`,
      activePlanSteps: [],
      activeToolCalls: [],
      discoveredSources: [],
      thinkingSteps: [
        {
          id: 'think-init',
          agent: 'Planner Agent',
          label: 'Formulating Top-Down Discovery Tree',
          detail: `Deconstructing: "${topic}". Connecting historical records, maps, and primary mechanisms.`,
          status: 'running'
        }
      ]
    });

    const isExpansion = Boolean(parentId);

    try {
      const streamUrl = `${BACKEND_URL}/api/v1/research/stream?topic=${encodeURIComponent(topic)}${category ? `&category=${encodeURIComponent(category)}` : ''}${parentId ? `&parent_id=${encodeURIComponent(parentId)}` : ''}`;
      
      const response = await fetch(streamUrl);
      if (!response.ok || !response.body) {
        throw new Error(`Research stream failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const trimmed = block.trim();
          if (!trimmed.startsWith('data:')) continue;

          try {
            const jsonStr = trimmed.replace(/^data:\s*/, '');
            const parsed = JSON.parse(jsonStr);
            const { event, data } = parsed;

            if (event === 'plan') {
              set({ activePlanSteps: data.steps || [] });
            } else if (event === 'thought') {
              set((state) => ({
                thinkingSteps: [
                  ...state.thinkingSteps,
                  {
                    id: `think-${Date.now()}-${Math.random()}`,
                    agent: data.agent || 'Agent',
                    label: data.agent === 'Planner Agent' ? 'Execution Plan' : 'Synthesizing Knowledge',
                    detail: data.text || '',
                    status: 'running'
                  }
                ]
              }));
            } else if (event === 'tool_call') {
              set((state) => ({
                activeToolCalls: [
                  ...state.activeToolCalls,
                  {
                    call_id: data.call_id,
                    tool: data.tool,
                    query: data.query,
                    status: 'running'
                  }
                ]
              }));
            } else if (event === 'tool_result') {
              set((state) => ({
                activeToolCalls: state.activeToolCalls.map((tc) =>
                  tc.call_id === data.call_id
                    ? { ...tc, status: 'success', preview: data.preview, count: data.count }
                    : tc
                )
              }));
            } else if (event === 'source') {
              set((state) => ({
                discoveredSources: [...state.discoveredSources, data]
              }));
            } else if (event === 'dossier') {
              set((state) => ({
                activeDossier: data.dossier,
                dossiersMap: {
                  ...state.dossiersMap,
                  [data.node_id]: data.dossier
                }
              }));
            } else if (event === 'node_stream') {
              const nodeData: NodeSchema = data.node;
              const parent = data.parent_id;
              const isRoot = data.is_root;

              const existingNodes = get().nodes;
              const existingEdges = get().edges;

              let posX = 0;
              let posY = 0;

              if (parent && parent !== 'root') {
                const parentNode = existingNodes.find((n) => n.id === parent);
                if (parentNode) {
                  const siblingCount = existingEdges.filter((e) => e.source === parent).length;
                  const offsetX = (siblingCount - 1) * 380;
                  posX = parentNode.position.x + offsetX;
                  posY = parentNode.position.y + 420;
                }
              } else if (!isRoot) {
                const childIdx = existingNodes.length;
                posX = (childIdx % 3 - 1) * 380;
                posY = 420;
              }

              const newNode: Node<NodeData> = {
                id: nodeData.id,
                type: 'mindmap',
                position: { x: posX, y: posY },
                data: {
                  ...nodeData,
                  category: nodeData.category || category || 'Curiosity',
                  onExpandRabbitHole: (p, v) => get().expandRabbitHole(p, v, nodeData.id),
                  onOpenDossier: (id) => get().openDossier(id),
                  onOpenChat: (node) => set({ activeChatNode: node }),
                  onPlayAudio: (node) => set({ activeAudioNode: node }),
                }
              };

              const newNodesList = isRoot && !isExpansion
                ? [newNode]
                : [...existingNodes.filter((n) => n.id !== nodeData.id), newNode];

              let newEdgesList = isRoot && !isExpansion ? [] : [...existingEdges];
              if (parent && parent !== 'root') {
                newEdgesList.push({
                  id: `edge-${parent}-${nodeData.id}`,
                  source: parent,
                  target: nodeData.id,
                  animated: true,
                  style: { stroke: '#38bdf8', strokeWidth: 2, opacity: 0.85 },
                });
              }

              set({
                nodes: newNodesList,
                edges: newEdgesList,
                stats: {
                  ...get().stats,
                  nodesExplored: newNodesList.length,
                  deepestDepth: Math.max(get().stats.deepestDepth, isExpansion ? 2 : 1)
                }
              });
            } else if (event === 'done') {
              set({
                isResearching: false,
                totalLatencyMs: data.execution_time_ms || 0
              });
            }
          } catch (e) {
            console.error('Failed to parse SSE line:', block, e);
          }
        }
      }
    } catch (err) {
      console.warn('Backend stream error, using rich fallback:', err);
      get().loadPresetCategory(category || topic);
    } finally {
      set({ isResearching: false });
    }
  },

  expandRabbitHole: async (parentTopic: string, vector: string, parentNodeId?: string) => {
    // Find parent node id if not provided
    const targetParentId = parentNodeId || get().nodes.find(n => n.data.title.includes(parentTopic) || parentTopic.includes(n.data.title))?.id;
    await get().startDeepResearch(vector, undefined, targetParentId);
  },

  loadPresetCategory: (categoryKey: string) => {
    const key = categoryKey.toLowerCase().trim();
    let hub = PRECOMPUTED_HUBS[key];

    if (!hub) {
      const matchedKey = Object.keys(PRECOMPUTED_HUBS).find((k) => key.includes(k) || k.includes(key));
      if (matchedKey) hub = PRECOMPUTED_HUBS[matchedKey];
    }

    if (!hub) hub = PRECOMPUTED_HUBS['epic wars & battles'] || Object.values(PRECOMPUTED_HUBS)[0];

    const rootNode: Node<NodeData> = {
      id: hub.root.id,
      type: 'mindmap',
      position: { x: 0, y: 0 },
      data: {
        ...hub.root,
        category: hub.root.category || 'Discovery',
        onExpandRabbitHole: (p, v) => get().expandRabbitHole(p, v, hub.root.id),
        onOpenDossier: (id) => get().openDossier(id),
        onOpenChat: (node) => set({ activeChatNode: node }),
        onPlayAudio: (node) => set({ activeAudioNode: node }),
      },
    };

    const childNodes: Node<NodeData>[] = hub.children.map((child, index) => ({
      id: child.id,
      type: 'mindmap',
      position: { x: (index - 1) * 380, y: 400 },
      data: {
        ...child,
        category: child.category || hub.root.category || 'Discovery',
        onExpandRabbitHole: (p, v) => get().expandRabbitHole(p, v, child.id),
        onOpenDossier: (id) => get().openDossier(id),
        onOpenChat: (node) => set({ activeChatNode: node }),
        onPlayAudio: (node) => set({ activeAudioNode: node }),
      },
    }));

    const edges: Edge[] = hub.children.map((child) => ({
      id: `edge-${hub.root.id}-${child.id}`,
      source: hub.root.id,
      target: child.id,
      animated: true,
      style: { stroke: '#38bdf8', strokeWidth: 2, opacity: 0.8 },
    }));

    set({
      nodes: [rootNode, ...childNodes],
      edges: edges,
      stats: {
        nodesExplored: 1 + childNodes.length,
        rabbitHolesExpanded: childNodes.length,
        categoriesVisited: { [hub.root.category || 'General']: 1 },
        deepestDepth: 2,
      },
      isResearching: false,
    });
  },

  resetGraph: () => {
    get().initTopDownUniverse();
  }
}));

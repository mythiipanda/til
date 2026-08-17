'use client';

import { useMemo, useCallback, useEffect, useRef } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, BackgroundVariant, Node, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import ResearchNode from './ResearchNode';
import PinnedNoteNode from './PinnedNoteNode';
import LandingState from './LandingState';

export function KnowledgeCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
  const nodes = useMindMapStore(s => s.nodes);
  const edges = useMindMapStore(s => s.edges);
  const onNodesChange = useMindMapStore(s => s.onNodesChange);
  const onEdgesChange = useMindMapStore(s => s.onEdgesChange);
  const isResearching = useMindMapStore(s => s.isResearching);
  const selectNode = useMindMapStore(s => s.selectNode);
  const openDossier = useMindMapStore(s => s.openDossier);
  const { fitView } = useReactFlow();

  const prevNodeCount = useRef(nodes.length);
  const isDragging = useRef(false);

  const nodeTypes = useMemo(() => ({
    research: ResearchNode,
    note: PinnedNoteNode,
  }), []);

  // Auto-fit when a new node streams in during research so freshly spawned
  // children stay in view without manual panning. Suppressed while the user
  // is dragging to avoid fighting their pointer.
  useEffect(() => {
    if (nodes.length > prevNodeCount.current && isResearching && !isDragging.current) {
      fitView({ padding: 0.12, maxZoom: 1.05, duration: 400 });
    }
    prevNodeCount.current = nodes.length;
  }, [nodes.length, isResearching, fitView]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node && node.id) {
      selectNode(node.id);
      openDossier(node.id);
    }
  }, [selectNode, openDossier]);

  const handleNodeDragStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleNodeDragStop = useCallback(() => {
    isDragging.current = false;
    // A drag just ended — flush the debounced autosave so positions are durable
    // even if the tab closes before the debounce fires.
    useMindMapStore.getState().flushCanvasAutosave?.();
  }, []);

  // Flush the debounced autosave when the tab is hidden/closed, so the very
  // latest canvas state survives a background-tab eviction or crash.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        useMindMapStore.getState().flushCanvasAutosave?.();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onVisibilityChange);
    };
  }, []);

  const showLanding = nodes.length === 0 && !isResearching;

  return (
    <div className="absolute inset-0 bg-white select-none texture-grid">
      {showLanding && <LandingState />}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1.05, minZoom: 0.7 }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.95 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#000000', strokeWidth: 2 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          size={1.5}
          gap={32}
          color="#00000020"
        />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

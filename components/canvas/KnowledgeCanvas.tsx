'use client';

import { useMemo, useCallback, useEffect } from 'react';
import { ReactFlow, Background, Controls, BackgroundVariant, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import ResearchNode from './ResearchNode';
import PinnedNoteNode from './PinnedNoteNode';
import LandingState from './LandingState';

export function KnowledgeCanvas() {
  const nodes = useMindMapStore(s => s.nodes);
  const edges = useMindMapStore(s => s.edges);
  const onNodesChange = useMindMapStore(s => s.onNodesChange);
  const onEdgesChange = useMindMapStore(s => s.onEdgesChange);
  const isResearching = useMindMapStore(s => s.isResearching);
  const selectNode = useMindMapStore(s => s.selectNode);
  const openDossier = useMindMapStore(s => s.openDossier);

  const nodeTypes = useMemo(() => ({
    research: ResearchNode,
    note: PinnedNoteNode,
  }), []);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node && node.id) {
      selectNode(node.id);
      openDossier(node.id);
    }
  }, [selectNode, openDossier]);

  const handleNodeDragStop = useCallback(() => {
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

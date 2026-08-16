'use client';

import { useMemo } from 'react';
import { ReactFlow, Background, Controls, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import ResearchNode from './ResearchNode';
import LandingState from './LandingState';

export function KnowledgeCanvas() {
  const nodes = useMindMapStore(s => s.nodes);
  const edges = useMindMapStore(s => s.edges);
  const onNodesChange = useMindMapStore(s => s.onNodesChange);
  const onEdgesChange = useMindMapStore(s => s.onEdgesChange);
  const isResearching = useMindMapStore(s => s.isResearching);

  const nodeTypes = useMemo(() => ({
    research: ResearchNode,
  }), []);

  const showLanding = nodes.length === 0 && !isResearching;

  return (
    <div className="absolute inset-0">
      {showLanding && <LandingState />}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          size={1}
          gap={28}
          color="#1a2332"
        />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

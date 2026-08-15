'use client';

import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MindMapNode } from '@/components/mindmap/MindMapNode';

export function MindMapCanvas() {
  const nodes = useMindMapStore((s) => s.nodes);
  const edges = useMindMapStore((s) => s.edges);
  const onNodesChange = useMindMapStore((s) => s.onNodesChange);
  const onEdgesChange = useMindMapStore((s) => s.onEdgesChange);
  const setSelectedNode = useMindMapStore((s) => s.setSelectedNode);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      mindMapNode: MindMapNode,
    }),
    []
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      setSelectedNode(node.data);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  return (
    <div className="w-full h-full bg-[#080c14] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2.0}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        className="touch-none"
      >
        <Background
          color="#1e293b"
          gap={24}
          size={1.5}
          variant={BackgroundVariant.Dots}
        />
        
        <Controls
          className="!bg-slate-900/90 !border-slate-700/80 !rounded-xl !shadow-2xl overflow-hidden [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700 [&>button:hover]:!text-white"
          showInteractive={false}
        />

        <MiniMap
          nodeColor="#38bdf8"
          maskColor="rgba(8, 12, 20, 0.75)"
          className="!bg-slate-900/90 !border-slate-700/80 !rounded-xl !shadow-2xl overflow-hidden hidden md:block"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

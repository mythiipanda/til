'use client';

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, BackgroundVariant, Node, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import ResearchNode from './ResearchNode';
import { toPng } from 'html-to-image';
import { mapExportFilename } from '@/lib/utils/export';
import PinnedNoteNode from './PinnedNoteNode';
import LandingState from './LandingState';

export function KnowledgeCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function isExportableExportNode(node: HTMLElement): boolean {
  if (!(node instanceof Element)) return false;
  return ['.react-flow__pane', '.react-flow__edges', '.react-flow__nodes']
    .some(sel => node.matches(sel) || node.closest(sel) !== null);
}

function CanvasInner() {
  const nodes = useMindMapStore(s => s.nodes);
  const edges = useMindMapStore(s => s.edges);
  const onNodesChange = useMindMapStore(s => s.onNodesChange);
  const onEdgesChange = useMindMapStore(s => s.onEdgesChange);
  const isResearching = useMindMapStore(s => s.isResearching);
  const selectNode = useMindMapStore(s => s.selectNode);
  const openDossier = useMindMapStore(s => s.openDossier);
  const currentTopic = useMindMapStore(s => s.currentTopic);
  const loadRandomHubByCategory = useMindMapStore(s => s.loadRandomHubByCategory);
  const { fitView, zoomIn, zoomOut, setCenter } = useReactFlow();
  const prevNodeCount = useRef(nodes.length);
  const isDragging = useRef(false);
  const canvasShellRef = useRef<HTMLDivElement>(null);

  const nodeTypes = useMemo(() => ({
    research: ResearchNode,
    note: PinnedNoteNode,
  }), []);

  // Auto-fit when a new node streams in during research so freshly spawned
  // children stay in view without manual panning. Suppressed while the user
  // is dragging to avoid fighting their pointer.
  useEffect(() => {
    if (nodes.length > prevNodeCount.current && !isDragging.current && (isResearching || prevNodeCount.current === 0)) {
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
    useMindMapStore.getState().flushCanvasAutosave?.();
  }, []);

  const handleRecenterRoot = useCallback(() => {
    const rootNode = nodes[0];
    if (rootNode && rootNode.position) {
      setCenter(rootNode.position.x + 160, rootNode.position.y + 100, { zoom: 1.0, duration: 500 });
    } else {
      fitView({ padding: 0.15, duration: 400 });
    }
  }, [nodes, setCenter, fitView]);

  const handleSurpriseMe = useCallback(() => {
    const cats = ['Science', 'History', 'Mathematics', 'Technology', 'Philosophy'];
    const randomCat = cats[Math.floor(Math.random() * cats.length)];
    loadRandomHubByCategory(randomCat);
  }, [loadRandomHubByCategory]);

  // PNG export of the current map. Only the pane, edges and nodes render;
  // panels and other UI chrome are filtered out. Uses the existing
  // transition-colors utility only, so prefers-reduced-motion is respected.
  const [pngState, setPngState] = useState<'idle' | 'generating' | 'saved'>('idle');
  const [pngFailed, setPngFailed] = useState(false);
  const savedTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => clearTimeout(savedTimerRef.current), []);

  const handleDownloadPng = useCallback(async () => {
    if (pngState === 'generating' || !canvasShellRef.current) return;
    setPngFailed(false);
    setPngState('generating');
    try {
      const flowEl = canvasShellRef.current.querySelector<HTMLElement>('.react-flow');
      if (!flowEl) throw new Error('React Flow container not found');
      const dataUrl = await toPng(flowEl as HTMLDivElement, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: isExportableExportNode,
      });
      const link = document.createElement('a');
      link.download = mapExportFilename(currentTopic);
      link.href = dataUrl;
      link.click();
      setPngState('saved');
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setPngState('idle'), 1500);
    } catch (error) {
      console.error('PNG export failed:', error);
      setPngState('idle');
      setPngFailed(true);
    }
  }, [pngState, currentTopic]);

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
  const showResearchSkeleton = nodes.length === 0 && isResearching;

  return (
    <div ref={canvasShellRef} className="absolute inset-0 bg-white select-none texture-grid">
      {showLanding && <LandingState />}

      {showResearchSkeleton && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-3 border-2 border-black bg-white p-3.5 animate-fade">
            <span className="w-2 h-2 bg-black animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold">
              Researching...
            </span>
          </div>
        </div>
      )}

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
      </ReactFlow>

      {/* Floating Canvas Navigation HUD (Bottom-Left on Desktop) */}
      {nodes.length > 0 && (
        <div className="fixed bottom-6 left-6 z-20 hidden md:flex items-center gap-1.5 bg-white border-2 border-black p-1.5 shadow-none nodrag">
          <button
            onClick={() => zoomIn({ duration: 250 })}
            className="w-7 h-7 flex items-center justify-center font-mono text-sm font-bold border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors"
            title="Zoom In (+)"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => zoomOut({ duration: 250 })}
            className="w-7 h-7 flex items-center justify-center font-mono text-sm font-bold border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors"
            title="Zoom Out (-)"
            aria-label="Zoom out"
          >
            -
          </button>
          <button
            onClick={() => fitView({ padding: 0.15, duration: 400 })}
            className="px-2 h-7 flex items-center justify-center font-mono text-[10px] uppercase font-bold border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors"
            title="Fit Map to Screen"
            aria-label="Fit map"
          >
            Fit
          </button>
          <button
            onClick={handleRecenterRoot}
            className="px-2 h-7 flex items-center justify-center font-mono text-[10px] uppercase font-bold border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors"
            title="Center Origin"
            aria-label="Center origin"
          >
            Root
          </button>
          <button
            onClick={handleDownloadPng}
            disabled={pngState === 'generating'}
            className="px-2 h-7 flex items-center justify-center font-mono text-[10px] uppercase font-bold border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors disabled:opacity-50"
            title={pngFailed ? 'Could not render map image' : 'Download map as PNG'}
            aria-label="Download map as PNG"
          >
            {pngState === 'saved' ? 'Saved' : pngState === 'generating' ? '...' : 'PNG'}
          </button>
          <div className="w-px h-4 bg-neutral-300 mx-0.5" />
          <button
            onClick={handleSurpriseMe}
            className="px-2.5 h-7 flex items-center justify-center font-mono text-[10px] uppercase font-bold bg-black text-white hover:bg-neutral-800 transition-colors"
            title="Random topic"
            aria-label="Random topic"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

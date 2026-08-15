'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Globe,
  Clock,
  Sparkles,
  Trophy,
  RotateCcw,
  Zap,
  Bot,
  BrainCircuit,
  GitBranch,
} from 'lucide-react';

import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { MindMapCanvas } from '@/components/mindmap/MindMapCanvas';
import { MapView } from '@/components/views/MapView';
import { TimelineView } from '@/components/views/TimelineView';
import { PromptBar } from '@/components/ui/PromptBar';
import { ThinkingTrace } from '@/components/ui/ThinkingTrace';
import { LoadingPixelState } from '@/components/ui/LoadingPixelState';
import { CuriosityHeatmap } from '@/components/ui/CuriosityHeatmap';
import { AudioPlayerBar } from '@/components/ui/AudioPlayerBar';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { CommandCenterBar } from '@/components/ui/CommandCenterBar';
import { ResearchDossierModal } from '@/components/dossier/ResearchDossierModal';
import { TopicGenerationInspector } from '@/components/inspector/TopicGenerationInspector';

export default function Home() {
  const nodes = useMindMapStore((s) => s.nodes);
  const isResearching = useMindMapStore((s) => s.isResearching);
  const thinkingSteps = useMindMapStore((s) => s.thinkingSteps);
  const viewMode = useMindMapStore((s) => s.viewMode);
  const setViewMode = useMindMapStore((s) => s.setViewMode);
  const startDeepResearch = useMindMapStore((s) => s.startDeepResearch);
  const initTopDownUniverse = useMindMapStore((s) => s.initTopDownUniverse);
  const resetGraph = useMindMapStore((s) => s.resetGraph);
  const setIsInspectorOpen = useMindMapStore((s) => s.setIsInspectorOpen);

  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // Initialize Top-Down Universe on first mount if empty
  useEffect(() => {
    if (nodes.length === 0) {
      initTopDownUniverse();
    }
  }, [initTopDownUniverse, nodes.length]);

  const handleSearch = (topic: string, category?: string) => {
    startDeepResearch(topic, category);
  };

  return (
    <main className="flex flex-col h-screen w-screen bg-[#090d16] text-slate-100 overflow-hidden relative font-sans">
      {/* Top Header Navigation */}
      <header className="h-16 px-4 sm:px-6 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between z-30 shrink-0">
        {/* Brand & Active Model Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <BrainCircuit className="w-5 h-5" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-100">
                Infinite Curiosity
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-300">
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                Top-Down Swarm • Cerebras & Mistral
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:block">
              Interactive Spatial Knowledge Engine
            </span>
          </div>
        </div>

        {/* Center View Mode Switcher */}
        <div className="flex items-center p-1 bg-slate-950/90 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setViewMode('canvas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'canvas'
                ? 'bg-sky-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Spatial Canvas</span>
          </button>

          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'map'
                ? 'bg-sky-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden md:inline">World Map</span>
          </button>

          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'timeline'
                ? 'bg-sky-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Timeline</span>
          </button>
        </div>

        {/* Right Stats, Topic Inspector & Reset Actions */}
        <div className="flex items-center gap-2">
          {/* Topic Generator Inspector Button */}
          <button
            onClick={() => setIsInspectorOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-indigo-500/20 hover:from-sky-500/30 hover:to-indigo-500/30 border border-sky-500/40 text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title="Inspect How Topics Are Generated"
          >
            <GitBranch className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Topic Inspector</span>
          </button>

          <button
            onClick={() => setIsStatsOpen(true)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="View Curiosity Stats"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
          </button>

          <button
            onClick={resetGraph}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Reset to Universe Root"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Spatial Content Viewport */}
      <div className="relative flex-1 w-full h-[calc(100vh-4rem)] overflow-hidden">
        {viewMode === 'canvas' && <MindMapCanvas />}
        {viewMode === 'map' && <MapView />}
        {viewMode === 'timeline' && <TimelineView />}

        {/* Top Floating Prompt & Category Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl px-4 pointer-events-auto">
          <PromptBar onSearch={handleSearch} isGenerating={isResearching} />
        </div>

        {/* Bottom Floating Manus-Style Command Center Bar */}
        <CommandCenterBar />

        {/* Top-Right Live Thinking Trace Stream */}
        <ThinkingTrace steps={thinkingSteps} isGenerating={isResearching} />

        {/* Loading Overlay */}
        {isResearching && nodes.length === 0 && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm pointer-events-none">
            <LoadingPixelState />
          </div>
        )}
      </div>

      {/* Persistent Bottom Audio Player Bar */}
      <AudioPlayerBar />

      {/* Slide-out Groq LPU Streaming Chat Drawer */}
      <ChatDrawer />

      {/* Research Dossier Modal */}
      <ResearchDossierModal />

      {/* Topic Generation Inspector Modal */}
      <TopicGenerationInspector />

      {/* Curiosity Analytics & Achievements Modal */}
      <CuriosityHeatmap
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
      />
    </main>
  );
}

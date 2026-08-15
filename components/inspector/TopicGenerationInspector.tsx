'use client';

import React, { useState } from 'react';
import {
  BrainCircuit,
  X,
  Layers,
  Sparkles,
  GitBranch,
  Play,
  CheckCircle2,
  Clock,
  Zap,
  Globe,
  Database,
  ArrowRight,
  Search,
  BookOpen
} from 'lucide-react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';

export function TopicGenerationInspector() {
  const isInspectorOpen = useMindMapStore((s) => s.isInspectorOpen);
  const setIsInspectorOpen = useMindMapStore((s) => s.setIsInspectorOpen);
  const nodes = useMindMapStore((s) => s.nodes);
  const edges = useMindMapStore((s) => s.edges);
  const isResearching = useMindMapStore((s) => s.isResearching);
  const activePlanSteps = useMindMapStore((s) => s.activePlanSteps);
  const activeToolCalls = useMindMapStore((s) => s.activeToolCalls);
  const totalLatencyMs = useMindMapStore((s) => s.totalLatencyMs);
  const startDeepResearch = useMindMapStore((s) => s.startDeepResearch);

  const [testTopic, setTestTopic] = useState('');
  const [selectedPillar, setSelectedPillar] = useState('Epic Wars & Battles');

  if (!isInspectorOpen) return null;

  const handleRunCustomDecomposition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTopic.trim() || isResearching) return;
    startDeepResearch(testTopic.trim(), selectedPillar);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-slate-100">
                  Topic Generation Inspector & Live Graph Telemetry
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold">
                  Live Top-Down Architecture
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Visualize how macro curiosity domains decompose into sub-branches, historical events, and dossiers
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsInspectorOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Top-Down Architecture Diagram Card */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <GitBranch className="w-4 h-4" />
                Top-Down Decomposition Pipeline
              </span>
              <span className="text-xs font-mono text-slate-400">
                Level 0 (Macro Cosmos) ➔ Level 1 (Theme) ➔ Level 2 (Epic) ➔ Level 3 (Dossier)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Level 0 */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-sky-500/40 flex flex-col gap-1.5">
                <span className="text-[10px] font-mono font-bold text-sky-400">LEVEL 0: UNIVERSE ROOT</span>
                <span className="text-xs font-bold text-slate-200">The Universe of Curiosity</span>
                <p className="text-[11px] text-slate-400">Master container orchestrating all domains of knowledge.</p>
              </div>

              {/* Level 1 */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-indigo-500/40 flex flex-col gap-1.5">
                <span className="text-[10px] font-mono font-bold text-indigo-400">LEVEL 1: MACRO PILLAR</span>
                <span className="text-xs font-bold text-slate-200">e.g. Epic Wars & Battles</span>
                <p className="text-[11px] text-slate-400">Broad thematic domain for high-level exploration.</p>
              </div>

              {/* Level 2 */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-purple-500/40 flex flex-col gap-1.5">
                <span className="text-[10px] font-mono font-bold text-purple-400">LEVEL 2: EPIC HISTORICAL STORY</span>
                <span className="text-xs font-bold text-slate-200">e.g. Hannibal’s Alpine Crossing</span>
                <p className="text-[11px] text-slate-400">Specific captivating event, battle, or invention.</p>
              </div>

              {/* Level 3 */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/40 flex flex-col gap-1.5">
                <span className="text-[10px] font-mono font-bold text-emerald-400">LEVEL 3: TACTICAL DOSSIER</span>
                <span className="text-xs font-bold text-slate-200">Mechanisms & Rabbit Holes</span>
                <p className="text-[11px] text-slate-400">Surprise tactics, secret weapons, timelines, and citations.</p>
              </div>
            </div>
          </div>

          {/* Interactive Custom Generation Playground */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-sky-950/40 to-indigo-950/40 border border-sky-800/40 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-sky-300">
              <Sparkles className="w-4 h-4" />
              Live Topic Decomposition Generator
            </div>
            <p className="text-xs text-slate-300">
              Type any general subject (e.g. &quot;World War II Radar Tech&quot;, &quot;Samurai Battles&quot;, &quot;Lost Egyptian Secrets&quot;) to trigger the multi-agent swarm:
            </p>

            <form onSubmit={handleRunCustomDecomposition} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={testTopic}
                onChange={(e) => setTestTopic(e.target.value)}
                placeholder="Enter any history or war topic (e.g. 'The Battle of Marathon', 'The Siege of Troy')..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />

              <select
                value={selectedPillar}
                onChange={(e) => setSelectedPillar(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="Epic Wars & Battles">⚔️ Epic Wars & Battles</option>
                <option value="Fascinating History">📜 Fascinating History</option>
                <option value="Ancient Inventions">⚙️ Ancient Inventions</option>
                <option value="Space & The Cosmos">🚀 Space & The Cosmos</option>
                <option value="Deep-Sea Enigmas">🌊 Deep-Sea Enigmas</option>
              </select>

              <button
                type="submit"
                disabled={!testTopic.trim() || isResearching}
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-lg shadow-sky-500/20"
              >
                <Play className="w-3.5 h-3.5" />
                Generate Branch
              </button>
            </form>
          </div>

          {/* Active Graph State Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Active Nodes</span>
              <span className="text-xl font-black text-sky-400">{nodes.length}</span>
              <span className="text-[10px] text-slate-400">Interactive nodes on canvas</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Graph Edges</span>
              <span className="text-xl font-black text-indigo-400">{edges.length}</span>
              <span className="text-[10px] text-slate-400">Animated connection lines</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Inference Hardware</span>
              <span className="text-xl font-black text-amber-400">Cerebras CS-3</span>
              <span className="text-[10px] text-slate-400">~3,000 tok/s structured JSON</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Last Generation Time</span>
              <span className="text-xl font-black text-emerald-400">
                {totalLatencyMs > 0 ? `${(totalLatencyMs / 1000).toFixed(2)}s` : '< 300ms'}
              </span>
              <span className="text-[10px] text-slate-400">Full tree & dossier synthesis</span>
            </div>
          </div>

          {/* Multi-Agent Execution Steps */}
          {activePlanSteps.length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Live Multi-Agent Swarm Execution Steps
                </span>
                <span className="text-xs font-mono text-slate-400">{activePlanSteps.length} Steps Defined</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {activePlanSteps.map((step) => (
                  <div
                    key={step.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                      step.status === 'done'
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-200'
                        : step.status === 'running'
                        ? 'bg-sky-950/40 border-sky-500/50 text-sky-200 animate-pulse'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {step.status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : step.status === 'running' ? (
                        <Zap className="w-4 h-4 text-sky-400 shrink-0 animate-bounce" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span>{step.title}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                      {step.agent}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <span>Click any node directly on the spatial canvas to branch down further</span>
          <button
            onClick={() => setIsInspectorOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Return to Canvas
          </button>
        </div>

      </div>
    </div>
  );
}

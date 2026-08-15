'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Image as ImageIcon,
  MapPin,
  CheckCircle2,
  Loader2,
  ChevronUp,
  ChevronDown,
  Layers,
  ShieldCheck,
  ExternalLink,
  Bot
} from 'lucide-react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';

export function CommandCenterBar() {
  const {
    isResearching,
    activeAgentPhase,
    activePlanSteps,
    activeToolCalls,
    discoveredSources,
    thinkingSteps,
    totalLatencyMs
  } = useMindMapStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'tools' | 'sources' | 'thoughts'>('plan');

  if (!isResearching && activePlanSteps.length === 0 && discoveredSources.length === 0) {
    return null;
  }

  const completedSteps = activePlanSteps.filter(s => s.status === 'done').length;
  const totalSteps = activePlanSteps.length || 6;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl animate-slide-up">
      <div className="rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl overflow-hidden transition-all duration-300">
        {/* Main Status Bar */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-slate-800/40 transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-md">
              {isResearching ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-white" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-sky-400" />
                  Manus Multi-Agent Swarm
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  {isResearching ? 'Active Research' : 'Synthesis Complete'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium truncate max-w-md">
                {activeAgentPhase || 'All research vectors verified and synthesized.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Tool Chips Preview */}
            <div className="hidden sm:flex items-center gap-1.5">
              {activeToolCalls.slice(-3).map((tool, idx) => (
                <span 
                  key={idx}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                    tool.status === 'running' 
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {tool.tool === 'WebSearch' && <Search className="w-3 h-3" />}
                  {tool.tool === 'WikimediaArchive' && <ImageIcon className="w-3 h-3" />}
                  {tool.tool === 'OSMGeocoder' && <MapPin className="w-3 h-3" />}
                  {tool.tool}
                </span>
              ))}
            </div>

            {/* Sources Badge */}
            {discoveredSources.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {discoveredSources.length} Sources
              </span>
            )}

            <button className="p-1 rounded-lg text-slate-400 hover:text-slate-100">
              {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Progress Line */}
        {isResearching && (
          <div className="w-full bg-slate-800 h-1 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Expandable Control Panel */}
        {isExpanded && (
          <div className="p-5 border-t border-slate-800 bg-slate-950/60 space-y-4 animate-fade-in max-h-80 overflow-y-auto custom-scrollbar">
            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <button
                onClick={() => setActiveTab('plan')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'plan' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Execution Plan ({completedSteps}/{totalSteps})
              </button>
              <button
                onClick={() => setActiveTab('tools')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'tools' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tools Executed ({activeToolCalls.length})
              </button>
              <button
                onClick={() => setActiveTab('sources')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'sources' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Discovered Sources ({discoveredSources.length})
              </button>
              <button
                onClick={() => setActiveTab('thoughts')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'thoughts' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Agent Reasoning ({thinkingSteps.length})
              </button>
            </div>

            {/* Tab 1: Execution Plan */}
            {activeTab === 'plan' && (
              <div className="space-y-2">
                {activePlanSteps.map((step) => (
                  <div 
                    key={step.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                      step.status === 'done' 
                        ? 'bg-slate-900/40 border-slate-800 text-slate-300'
                        : step.status === 'running'
                        ? 'bg-sky-950/40 border-sky-500/40 text-sky-200 font-semibold'
                        : 'bg-slate-950/20 border-slate-800/40 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {step.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {step.status === 'running' && <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />}
                      {step.status === 'pending' && <span className="w-4 h-4 rounded-full border border-slate-600 inline-block" />}
                      <span>{step.title}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {step.agent}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 2: Tools Executed */}
            {activeTab === 'tools' && (
              <div className="space-y-2">
                {activeToolCalls.map((tool, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        Tool: {tool.tool}
                      </span>
                      <span className="text-[10px] text-emerald-400 uppercase font-semibold">
                        {tool.status}
                      </span>
                    </div>
                    <p className="text-slate-300 font-mono text-[11px]">Query: "{tool.query}"</p>
                    {tool.preview && <p className="text-slate-400 text-[11px] pt-1">{tool.preview}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: Discovered Sources */}
            {activeTab === 'sources' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {discoveredSources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-sky-500/40 transition-all flex flex-col justify-between group text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{src.publisher || 'Reference'}</span>
                        <ExternalLink className="w-3 h-3 group-hover:text-sky-400" />
                      </div>
                      <h5 className="font-bold text-slate-200 group-hover:text-white line-clamp-1">
                        {src.title}
                      </h5>
                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {src.snippet}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* Tab 4: Agent Reasoning */}
            {activeTab === 'thoughts' && (
              <div className="space-y-2">
                {thinkingSteps.map((step, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-indigo-400 font-semibold">
                      <span>{step.agent}</span>
                      <span className="text-[10px] text-slate-500">{step.status}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
                      {step.detail}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

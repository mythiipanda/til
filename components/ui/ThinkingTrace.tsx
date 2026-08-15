'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ThinkingStep } from '@/types/graph';

interface ThinkingTraceProps {
  steps: ThinkingStep[];
  isGenerating: boolean;
}

export function ThinkingTrace({ steps, isGenerating }: ThinkingTraceProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (steps.length === 0 && !isGenerating) {
    return null;
  }

  const latestStep = steps[steps.length - 1];
  const completedCount = steps.filter((s) => s.status === 'complete').length;

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl bg-slate-900/80 border border-slate-700/80 backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-300">
      {/* Header Summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 rounded-lg bg-sky-500/20 text-sky-400">
            <BrainCircuit className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-slate-100 flex items-center gap-1.5 truncate">
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>{latestStep?.label || 'Synthesizing knowledge graph...'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Research Synthesis Verified ({completedCount} steps)</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {latestStep?.durationMs && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full">
              <Clock className="w-2.5 h-2.5 text-amber-400" />
              {latestStep.durationMs}ms
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Reasoning List */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2.5 text-xs max-h-60 overflow-y-auto custom-scrollbar">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex items-start gap-2.5 text-slate-300 border-l-2 border-slate-700/60 pl-3 py-0.5"
            >
              <div className="mt-0.5">
                {step.status === 'complete' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                )}
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 text-[11px]">
                    {step.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {step.agent}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

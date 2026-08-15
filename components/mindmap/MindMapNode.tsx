'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import Image from 'next/image';
import { 
  Sparkles, 
  MapPin, 
  Clock, 
  MessageSquare, 
  Volume2, 
  ChevronRight, 
  Layers,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { NodeData } from '@/types/graph';
import { getProxiedImageUrl, getProxiedOsmTileUrl } from '@/lib/utils';

export const MindMapNode = memo(({ data }: NodeProps) => {
  const nodeData = data as NodeData;
  const {
    id,
    title,
    summary,
    category,
    coordinates,
    imageUrl,
    rabbit_holes = [],
    timestamp,
    sources_count = 0,
    expandedVectors = [],
    onExpandRabbitHole,
    onOpenDossier,
    onOpenChat,
    onPlayAudio
  } = nodeData;

  const proxiedMainImage = imageUrl ? getProxiedImageUrl(imageUrl) : null;
  const proxiedTileImage = coordinates?.tileX && coordinates?.tileY 
    ? getProxiedOsmTileUrl(12, coordinates.tileX, coordinates.tileY) 
    : null;

  return (
    <div className="group relative w-80 sm:w-96 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-sky-500/80 hover:shadow-sky-500/10 text-slate-100 overflow-hidden select-none">
      {/* React Flow Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-sky-400 !border-2 !border-slate-900 !rounded-full -top-1.5 transition-transform group-hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-sky-400 !border-2 !border-slate-900 !rounded-full -bottom-1.5 transition-transform group-hover:scale-125"
      />

      {/* Header Bar - Strict Drag Handle Isolation */}
      <div className="dragHandle flex items-center justify-between px-4 py-3 bg-slate-800/60 border-b border-slate-700/60 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-sky-400">
            {category || 'Discovery Hub'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {sources_count > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              {sources_count} Sources
            </span>
          )}
          {timestamp && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
              <Clock className="w-3 h-3 text-amber-400" />
              {timestamp}
            </span>
          )}
        </div>
      </div>

      {/* Visual Media Header (Proxied Wikimedia Commons Artwork) */}
      {proxiedMainImage && (
        <div className="relative h-40 w-full overflow-hidden bg-slate-950">
          <Image
            src={proxiedMainImage}
            alt={title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
        </div>
      )}

      {/* Node Content Body */}
      <div className="p-4 space-y-3">
        <h3 className="text-base font-bold text-white tracking-tight leading-snug">
          {title}
        </h3>

        <p className="text-xs text-slate-300 leading-relaxed font-light line-clamp-3">
          {summary}
        </p>

        {/* Geospatial Mini-Tile Card */}
        {coordinates && (
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
            {proxiedTileImage ? (
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
                <Image
                  src={proxiedTileImage}
                  alt={coordinates.location_name || 'Map Tile'}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                <MapPin className="w-4 h-4 text-rose-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-200">
                <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                <span className="truncate">{coordinates.location_name || 'Geocoded Coordinates'}</span>
              </div>
              <p className="text-[10px] text-slate-500">
                {coordinates.lat.toFixed(2)}°N, {coordinates.lng.toFixed(2)}°E
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Rabbit Hole Branch Vectors */}
        {rabbit_holes.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-400" />
                Downstream Rabbit Holes
              </span>
              <span>3 vectors</span>
            </div>

            <div className="space-y-1 nodrag">
              {rabbit_holes.map((vector, idx) => {
                const isExpanded = expandedVectors.includes(vector);
                return (
                  <button
                    key={idx}
                    onClick={() => onExpandRabbitHole?.(title, vector)}
                    disabled={isExpanded}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all ${
                      isExpanded
                        ? 'bg-sky-500/10 text-sky-300 border border-sky-500/30 cursor-default opacity-80'
                        : 'bg-slate-800/80 hover:bg-sky-600/20 text-slate-200 hover:text-white border border-slate-700/60 hover:border-sky-500/50 group/btn shadow-sm'
                    }`}
                  >
                    <span className="truncate pr-2 font-medium">{vector}</span>
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      isExpanded ? 'text-sky-400 rotate-90' : 'text-slate-400 group-hover/btn:translate-x-0.5 group-hover/btn:text-sky-400'
                    }`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Footer Action Controls - Strictly Isolated (.nodrag) */}
      <div className="nodrag flex items-center justify-between px-4 py-2.5 bg-slate-950/70 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onOpenDossier?.(id)}
            title="Read Complete Research Dossier"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 transition-all shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            Explore Dossier
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPlayAudio?.(nodeData)}
            title="Listen to Audio Podcast Narration"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onOpenChat?.(nodeData)}
            title="Ask Cerebras Streaming Follow-up"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

MindMapNode.displayName = 'MindMapNode';

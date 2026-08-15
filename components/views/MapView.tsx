'use client';

import React, { useState } from 'react';
import { MapPin, Globe, Volume2, MessageSquare, FileText } from 'lucide-react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { getProxyMediaUrl } from '@/lib/utils';

export function MapView() {
  const nodes = useMindMapStore((s) => s.nodes);
  const setActiveChatNode = useMindMapStore((s) => s.setActiveChatNode);
  const setActiveAudioNode = useMindMapStore((s) => s.setActiveAudioNode);
  const openDossier = useMindMapStore((s) => s.openDossier);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const geoNodes = nodes.filter((n) => n.data.coordinates && n.data.coordinates.lat !== undefined);
  const selectedNode = geoNodes.find((n) => n.id === selectedNodeId) || geoNodes[0];

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-[#090d16] text-slate-100 overflow-hidden">
      {/* Geo Nodes Sidebar */}
      <div className="w-full md:w-96 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/50 p-4 flex flex-col gap-3 overflow-y-auto max-h-72 md:max-h-full custom-scrollbar">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Geocoded Discoveries ({geoNodes.length})
          </h3>
        </div>

        {geoNodes.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No geographic locations discovered yet. Explore historical hubs to populate the map!</p>
        ) : (
          <div className="flex flex-col gap-2">
            {geoNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500/15 border-sky-400 text-sky-200 shadow-md'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold truncate">{node.data.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono shrink-0">
                      {node.data.coordinates?.location_name || `${node.data.coordinates?.lat.toFixed(1)}°, ${node.data.coordinates?.lng.toFixed(1)}°`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{node.data.summary}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Map Tile Canvas & Inspector */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-6 bg-slate-950/90">
        {selectedNode ? (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col md:flex-row">
            {/* Tile Map Image */}
            <div className="w-full md:w-1/2 h-56 md:h-auto bg-slate-900 relative overflow-hidden">
              {selectedNode.data.coordinates?.tileX !== undefined && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={getProxyMediaUrl(`https://tile.openstreetmap.org/12/${selectedNode.data.coordinates.tileX}/${selectedNode.data.coordinates.tileY}.png`)}
                  alt="OpenStreetMap Tile"
                  className="w-full h-full object-cover opacity-90"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-200 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>{selectedNode.data.coordinates?.location_name}</span>
                </div>
              </div>
            </div>

            {/* Inspector Details */}
            <div className="p-5 flex-1 flex flex-col justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  {selectedNode.data.category} • {selectedNode.data.timestamp || 'Historical'}
                </span>
                <h2 className="text-base font-bold text-slate-100 mt-0.5">{selectedNode.data.title}</h2>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{selectedNode.data.summary}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => openDossier(selectedNode.id)}
                  className="px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Dossier
                </button>

                <button
                  onClick={() => setActiveAudioNode(selectedNode.data)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                  Listen
                </button>

                <button
                  onClick={() => setActiveChatNode(selectedNode.data)}
                  className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask AI
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500">
            <Globe className="w-12 h-12 mx-auto mb-2 opacity-40 animate-pulse" />
            <p className="text-sm">Select a geocoded discovery to inspect coordinates</p>
          </div>
        )}
      </div>
    </div>
  );
}

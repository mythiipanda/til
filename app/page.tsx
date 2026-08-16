'use client';

import { useEffect, useState } from 'react';
import { KnowledgeCanvas } from '@/components/canvas/KnowledgeCanvas';
import { ActivityPanel } from '@/components/activity/ActivityPanel';
import { ChatComposer } from '@/components/activity/ChatComposer';
import { HubBrowser } from '@/components/browse/HubBrowser';
import { DossierDrawer } from '@/components/dossier/DossierDrawer';
import { useMindMapStore } from '@/lib/store/useMindMapStore';

export default function Home() {
  const fetchPrecomputedHubs = useMindMapStore(s => s.fetchPrecomputedHubs);
  const isResearching = useMindMapStore(s => s.isResearching);
  const resetCanvas = useMindMapStore(s => s.resetCanvas);
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  
  useEffect(() => { 
    fetchPrecomputedHubs(); 
  }, [fetchPrecomputedHubs]);
  
  return (
    <main className="relative h-screen w-screen overflow-hidden select-none" style={{ background: 'var(--bg-base)' }}>
      {/* Full-bleed spatial canvas */}
      <KnowledgeCanvas />
      
      {/* Floating brand + Controls Header - top left */}
      <div className="fixed top-5 left-5 z-30 flex items-center gap-3 bg-[#111827]/80 backdrop-blur-md px-4 py-2 rounded-xl border border-[#1e293b] shadow-lg">
        <button
          onClick={resetCanvas}
          className="text-left flex items-center gap-1.5 focus:outline-none"
          title="Reset to home"
        >
          <span className="font-light text-[#94a3b8] text-sm">TDI</span>
          <span className="font-bold text-[#e2e8f0] text-sm tracking-wide">LEARNED</span>
        </button>

        <div className="w-px h-4 bg-[#1e293b]" />

        <button
          onClick={() => setIsBrowseOpen(!isBrowseOpen)}
          className={`text-[11px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-lg transition-all ${
            isBrowseOpen
              ? 'bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/30'
              : 'text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1a2332]'
          }`}
        >
          {isBrowseOpen ? 'Close' : 'Browse Hubs'}
        </button>

        {isResearching && (
          <>
            <div className="w-px h-4 bg-[#1e293b]" />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-[10px] font-mono text-amber-400">Live Swarm</span>
            </div>
          </>
        )}
      </div>
      
      {/* Floating panels & Overlays */}
      {isBrowseOpen && <HubBrowser onClose={() => setIsBrowseOpen(false)} />}
      <ActivityPanel />
      <ChatComposer />
      <DossierDrawer />
    </main>
  );
}

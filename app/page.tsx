'use client';

import { useEffect, useState } from 'react';
import { KnowledgeCanvas } from '@/components/canvas/KnowledgeCanvas';
import { ActivityPanel } from '@/components/activity/ActivityPanel';
import { ChatComposer } from '@/components/activity/ChatComposer';
import { HubBrowser } from '@/components/browse/HubBrowser';
import { DossierDrawer } from '@/components/dossier/DossierDrawer';
import { UserMenu } from '@/components/auth/UserMenu';
import { MyMindMapsDrawer } from '@/components/library/MyMindMapsDrawer';
import { ShareModal } from '@/components/share/ShareModal';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { CATEGORIES } from '@/types';
import { Plus, RotateCcw, BookOpen, Sparkles, X, Share2, Bookmark } from 'lucide-react';

const FLAGSHIP_CATEGORIES = ['Science', 'History', 'Mathematics', 'Technology', 'Philosophy'] as const;

export default function Home() {
  const fetchPrecomputedHubs = useMindMapStore(s => s.fetchPrecomputedHubs);
  const loadRandomHubByCategory = useMindMapStore(s => s.loadRandomHubByCategory);
  const restoreSessionFromLocalStorage = useMindMapStore(s => s.restoreSessionFromLocalStorage);
  const isResearching = useMindMapStore(s => s.isResearching);
  const resetCanvas = useMindMapStore(s => s.resetCanvas);
  const nodes = useMindMapStore(s => s.nodes);
  const currentTopic = useMindMapStore(s => s.currentTopic);
  const hasNewDossier = useMindMapStore(s => s.hasNewDossier);
  const isDossierOpen = useMindMapStore(s => s.isDossierOpen);
  const openDossier = useMindMapStore(s => s.openDossier);
  const dismissNewDossierAlert = useMindMapStore(s => s.dismissNewDossierAlert);

  const lastResearchedNodeId = useMindMapStore(s => s.lastResearchedNodeId);
  const selectedNodeId = useMindMapStore(s => s.selectedNodeId);
  const activeDossier = useMindMapStore(s => s.activeDossier);

  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const startResearch = useMindMapStore(s => s.startResearch);

  useEffect(() => { 
    fetchPrecomputedHubs();
    restoreSessionFromLocalStorage();
  }, [fetchPrecomputedHubs, restoreSessionFromLocalStorage]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    setIsCustomModalOpen(false);
    startResearch(customInput.trim(), 'General');
    setCustomInput('');
  };

  const handleSurpriseMe = () => {
    const randomCat = FLAGSHIP_CATEGORIES[Math.floor(Math.random() * FLAGSHIP_CATEGORIES.length)];
    loadRandomHubByCategory(randomCat);
  };

  const targetNodeId = lastResearchedNodeId || activeDossier?.nodeId || selectedNodeId || nodes[0]?.id;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-white text-black font-body select-none">
      {/* Full-bleed spatial canvas */}
      <KnowledgeCanvas />
      
      {/* Top Masthead Bar */}
      <header className="fixed top-4 left-4 right-4 z-20 flex items-center justify-between bg-white border-2 border-black p-2 md:px-4 shadow-none gap-2">
        
        {/* Left: Brand & Home Reset */}
        <div className="flex items-center gap-3">
          <button
            onClick={resetCanvas}
            className="flex items-center gap-1.5 font-serif text-lg font-extrabold tracking-tight hover:opacity-75 transition-opacity"
            title="Go to Home Cover"
          >
            <span className="bg-black text-white px-2 py-0.5 font-mono text-xs font-bold">TDI</span>
            <span className="underline decoration-2 underline-offset-2">LEARNED</span>
          </button>

          <div className="hidden lg:block h-4 w-px bg-black" />

          <span className="hidden lg:block font-serif italic text-xs text-neutral-600">
            Today I Learned
          </span>
        </div>

        {/* Center: 5 Flagship Pillars + Surprise Me */}
        <div className="hidden md:flex items-center gap-1.5">
          {FLAGSHIP_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => loadRandomHubByCategory(cat)}
              className="px-2.5 py-1 font-mono text-[10px] uppercase font-bold tracking-wider border border-neutral-300 hover:border-black hover:bg-black hover:text-white transition-colors duration-100"
            >
              {cat}
            </button>
          ))}
          <button
            onClick={handleSurpriseMe}
            className="px-2.5 py-1 font-mono text-[10px] uppercase font-bold tracking-wider bg-neutral-100 border border-neutral-400 hover:bg-black hover:text-white hover:border-black transition-colors flex items-center gap-1"
            title="Surprise me with a random topic"
          >
            <Sparkles className="w-3 h-3" />
            <span>Surprise Me</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Researching Live Indicator */}
          {isResearching && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black text-white font-mono text-[10px] uppercase tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 bg-white" />
              <span>RESEARCHING...</span>
            </div>
          )}

          {/* New Topic Custom Query */}
          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="px-3 py-1 bg-white border border-black font-mono text-[10px] uppercase tracking-wider font-bold hover:bg-black hover:text-white transition-colors duration-100 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">RESEARCH ANY TOPIC</span>
          </button>

          {/* Browse Catalog Button */}
          <button
            onClick={() => setIsBrowseOpen(!isBrowseOpen)}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider font-bold transition-colors duration-100 border border-black ${
              isBrowseOpen
                ? 'bg-black text-white'
                : 'bg-black text-white hover:bg-white hover:text-black'
            }`}
          >
            {isBrowseOpen ? 'CLOSE LIBRARY' : 'BROWSE 2000+ TOPICS'}
          </button>

          {/* My Library & History Drawer */}
          <button
            onClick={() => setIsLibraryOpen(true)}
            className="p-1.5 border border-black hover:bg-black hover:text-white transition-colors"
            title="My Saved Mindmaps & History"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>

          {/* Share & Export Modal */}
          {nodes.length > 0 && currentTopic && (
            <button
              onClick={() => setIsShareOpen(true)}
              className="p-1.5 border border-black hover:bg-black hover:text-white transition-colors"
              title="Share & Export Mindmap"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Canvas Clear */}
          {nodes.length > 0 && (
            <button
              onClick={resetCanvas}
              className="p-1 border border-black hover:bg-black hover:text-white transition-colors"
              title="Reset to Cover"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Supabase User Profile / Sign in Menu */}
          <UserMenu onOpenLibrary={() => setIsLibraryOpen(true)} />
        </div>
      </header>

      {/* Floating Active Topic Ribbon */}
      {currentTopic && nodes.length > 0 && (
        <div className="fixed top-18 left-6 z-10 pointer-events-none hidden sm:block">
          <div className="bg-black text-white px-3 py-1 font-mono text-[10px] uppercase tracking-widest border border-black">
            CURRENT TOPIC: <span className="font-serif font-bold text-xs capitalize ml-1">{currentTopic}</span>
          </div>
        </div>
      )}

      {/* Research Output Ready Notification Toast */}
      {hasNewDossier && !isDossierOpen && targetNodeId && (
        <div className="fixed top-18 right-6 z-30 bg-black text-white border-2 border-black p-3.5 shadow-none flex items-center gap-3 animate-drop">
          <Sparkles className="w-4 h-4 shrink-0 text-white" />
          <div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">
              RESEARCH READY
            </div>
            <div className="font-serif text-sm font-bold truncate max-w-xs">
              {currentTopic}
            </div>
          </div>
          <button
            onClick={() => {
              openDossier(targetNodeId);
              dismissNewDossierAlert();
            }}
            className="px-3 py-1.5 bg-white text-black font-mono text-xs uppercase font-bold hover:bg-neutral-200 transition-colors flex items-center gap-1 shrink-0"
          >
            <BookOpen className="w-3 h-3" />
            <span>Read Story</span>
          </button>
          <button
            onClick={dismissNewDossierAlert}
            className="p-1 text-neutral-400 hover:text-white"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      
      {/* Custom Inquiry Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border-2 border-black p-6 md:p-8 space-y-5 shadow-none animate-fade">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase font-bold bg-black text-white px-2 py-0.5">
                  TDI
                </span>
                <h3 className="font-serif text-lg font-bold tracking-tight text-black">
                  Propose Custom Inquiry
                </h3>
              </div>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className="p-1 border border-black hover:bg-black hover:text-white transition-colors duration-100"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="font-body text-xs text-neutral-700 leading-relaxed">
              Dispatch autonomous research agents to discover verified citations, extract chronological events, and synthesize an interactive spatial mindmap.
            </p>

            <form onSubmit={handleCustomSubmit} className="space-y-4 pt-1">
              <input
                type="text"
                autoFocus
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                placeholder="e.g. Voynich Manuscript, Fermi Paradox, Bronze Age Collapse..."
                className="w-full border-2 border-black p-3.5 font-body text-sm text-black placeholder:text-neutral-400 placeholder:italic outline-none focus:bg-neutral-50"
              />

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  className="font-mono text-xs uppercase font-bold text-neutral-600 hover:text-black tracking-wider underline underline-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!customInput.trim()}
                  className="px-6 py-3 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase tracking-widest font-bold transition-colors duration-100 disabled:opacity-40"
                >
                  Dispatch Agents →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Panels & Overlays */}
      {isBrowseOpen && <HubBrowser onClose={() => setIsBrowseOpen(false)} />}
      <ActivityPanel />
      <ChatComposer />
      <DossierDrawer />
      <MyMindMapsDrawer
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onOpenShareModal={() => setIsShareOpen(true)}
      />
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </main>
  );
}

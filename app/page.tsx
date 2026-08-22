'use client';

import { useEffect, useState } from 'react';
import { KnowledgeCanvas } from '@/components/canvas/KnowledgeCanvas';
import { ChatComposer } from '@/components/activity/ChatComposer';
import { HubBrowser } from '@/components/browse/HubBrowser';
import { DossierDrawer } from '@/components/dossier/DossierDrawer';
import { UserMenu } from '@/components/auth/UserMenu';
import { MyMindMapsDrawer } from '@/components/library/MyMindMapsDrawer';
import { ShareModal } from '@/components/share/ShareModal';
import { MobileBottomBar } from '@/components/ui/MobileBottomBar';
import { ModelSelector } from '@/components/model/ModelSelector';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { CATEGORIES } from '@/types';
import { Plus, RotateCcw, BookOpen, X, Share2, Bookmark, Keyboard, Command, Search as SearchIcon, MoreVertical } from 'lucide-react';
import { MobileOverflowMenu } from '@/components/ui/MobileOverflowMenu';

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
  const closeDossier = useMindMapStore(s => s.closeDossier);
  const dismissNewDossierAlert = useMindMapStore(s => s.dismissNewDossierAlert);
  const selectNode = useMindMapStore(s => s.selectNode);

  const lastResearchedNodeId = useMindMapStore(s => s.lastResearchedNodeId);
  const selectedNodeId = useMindMapStore(s => s.selectedNodeId);
  const activeDossier = useMindMapStore(s => s.activeDossier);

  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const startResearch = useMindMapStore(s => s.startResearch);

  useEffect(() => { 
    fetchPrecomputedHubs();
    restoreSessionFromLocalStorage();
  }, [fetchPrecomputedHubs, restoreSessionFromLocalStorage]);

  // Browser back/forward: restore the hub for whichever topic URL we land on.
  useEffect(() => {
    const onPopState = () => restoreSessionFromLocalStorage();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [restoreSessionFromLocalStorage]);

  // Global Keyboard Shortcuts & LIFO Escape Stack
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCustomModalOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        setIsCustomModalOpen(true);
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        // Orderly LIFO Stack Dismissal
        if (isOverflowOpen) {
          setIsOverflowOpen(false);
        } else if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
        } else if (isCustomModalOpen) {
          setIsCustomModalOpen(false);
        } else if (isShareOpen) {
          setIsShareOpen(false);
        } else if (isLibraryOpen) {
          setIsLibraryOpen(false);
        } else if (isBrowseOpen) {
          setIsBrowseOpen(false);
        } else if (isDossierOpen) {
          closeDossier();
        } else if (selectedNodeId) {
          selectNode(null);
        }
      } else if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
        handleSurpriseMe();
      } else if (e.key.toLowerCase() === 'b' && !e.metaKey && !e.ctrlKey) {
        handleToggleBrowse();
      } else if (e.key.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey) {
        handleToggleLibrary();
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const catIdx = parseInt(e.key, 10) - 1;
        if (FLAGSHIP_CATEGORIES[catIdx]) {
          loadRandomHubByCategory(FLAGSHIP_CATEGORIES[catIdx]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isShortcutsOpen,
    isCustomModalOpen,
    isShareOpen,
    isLibraryOpen,
    isBrowseOpen,
    isDossierOpen,
    selectedNodeId,
    isOverflowOpen,
    loadRandomHubByCategory,
    closeDossier,
    selectNode,
  ]);

  const handleSurpriseMe = async () => {
    const randomCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    await loadRandomHubByCategory(randomCategory);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    startResearch(customInput.trim());
    setCustomInput('');
    setIsCustomModalOpen(false);
  };

  const handleToggleBrowse = () => {
    setIsBrowseOpen(prev => !prev);
    setIsLibraryOpen(false);
    setIsShareOpen(false);
    setIsShortcutsOpen(false);
    setIsOverflowOpen(false);
  };

  const handleToggleLibrary = () => {
    setIsLibraryOpen(prev => !prev);
    setIsBrowseOpen(false);
    setIsShareOpen(false);
    setIsShortcutsOpen(false);
    setIsOverflowOpen(false);
  };

  const handleToggleShare = () => {
    setIsShareOpen(prev => !prev);
    setIsBrowseOpen(false);
    setIsLibraryOpen(false);
    setIsShortcutsOpen(false);
    setIsOverflowOpen(false);
  };

  const targetNodeId = lastResearchedNodeId || activeDossier?.nodeId || selectedNodeId || nodes[0]?.id;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-white text-black font-body select-none">
      {/* Full-bleed spatial canvas */}
      <KnowledgeCanvas />
      
      {/* Top Masthead Bar */}
      <header className="fixed top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-20 flex items-center justify-between bg-white border-2 border-black p-1.5 sm:p-2 md:px-4 shadow-none gap-1 sm:gap-2">
        
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

        {/* Mobile-only actions: search + overflow */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="w-11 h-11 flex items-center justify-center border border-black hover:bg-black hover:text-white transition-colors"
            title="Search Topic"
            aria-label="Search topic"
          >
            <SearchIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOverflowOpen(true)}
            className={`w-11 h-11 flex items-center justify-center border border-black transition-colors ${
              isOverflowOpen ? 'bg-black text-white' : 'hover:bg-black hover:text-white'
            }`}
            title="Menu"
            aria-label="Open menu"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
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
            title="Discover a random topic"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Random</span>
          </button>
        </div>

        {/* Right: Actions & Model Selector (desktop only — mobile uses overflow menu) */}
        <div className="hidden md:flex items-center gap-2">
          {/* Model Selector Dropdown */}
          <ModelSelector className="hidden sm:inline-block" />

          {/* Researching Live Indicator */}
          {isResearching && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black text-white font-mono text-[10px] uppercase tracking-wider font-bold">
              <span className="w-1.5 h-1.5 bg-white animate-pulse" />
              <span>Searching...</span>
            </div>
          )}

          {/* New Topic Search */}
          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="px-3 py-1 bg-white border border-black font-mono text-[10px] uppercase tracking-wider font-bold hover:bg-black hover:text-white transition-colors duration-100 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Search</span>
          </button>

          {/* Browse Catalog Button */}
          <button
            onClick={handleToggleBrowse}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider font-bold transition-colors duration-100 border border-black ${
              isBrowseOpen
                ? 'bg-black text-white'
                : 'bg-black text-white hover:bg-white hover:text-black'
            }`}
          >
            {isBrowseOpen ? 'Close' : 'Topics'}
          </button>

          {/* My Library & History Drawer */}
          <button
            onClick={handleToggleLibrary}
            className={`p-1.5 border border-black transition-colors ${
              isLibraryOpen ? 'bg-black text-white' : 'hover:bg-black hover:text-white'
            }`}
            title="Saved Mindmaps"
            aria-label="Saved mindmaps"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>

          {/* Share & Export Modal */}
          {nodes.length > 0 && currentTopic && (
            <button
              onClick={handleToggleShare}
              className={`p-1.5 border border-black transition-colors ${
                isShareOpen ? 'bg-black text-white' : 'hover:bg-black hover:text-white'
              }`}
              title="Share Mindmap"
              aria-label="Share mindmap"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Keyboard Shortcuts */}
          <button
            onClick={() => setIsShortcutsOpen(prev => !prev)}
            className={`p-1.5 border border-black transition-colors ${
              isShortcutsOpen ? 'bg-black text-white' : 'hover:bg-black hover:text-white'
            }`}
            title="Shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {/* Canvas Clear */}
          {nodes.length > 0 && (
            <button
              onClick={resetCanvas}
              className="p-1.5 border border-black hover:bg-black hover:text-white transition-colors"
              title="Clear Canvas"
              aria-label="Clear canvas"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Supabase User Profile / Sign in Menu */}
          <UserMenu onOpenLibrary={handleToggleLibrary} />
        </div>
      </header>

      {/* Monograph Ready Notification Toast */}
      {hasNewDossier && !isDossierOpen && targetNodeId && (
        <div className="fixed top-18 right-6 z-30 bg-black text-white border-2 border-black p-3.5 shadow-none flex items-center gap-3 animate-drop">
          <BookOpen className="w-4 h-4 shrink-0 text-white" />
          <div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">
              Story Ready
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
            <span>Read</span>
          </button>
          <button
            onClick={dismissNewDossierAlert}
            className="p-1 text-neutral-400 hover:text-white"
            title="Dismiss"
            aria-label="Dismiss new story alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      
      {/* Custom Topic Search Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border-2 border-black p-6 md:p-8 space-y-4 shadow-none animate-fade">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-serif text-lg font-bold tracking-tight text-black">
                Search any topic
              </h3>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className="p-1 border border-black hover:bg-black hover:text-white transition-colors duration-100"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="font-body text-xs text-neutral-600 leading-relaxed">
              Type any topic. You get a researched mindmap with sources and threads to follow.
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
                  className="font-mono text-xs uppercase font-bold text-neutral-600 hover:text-black tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!customInput.trim()}
                  className="px-6 py-3 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase tracking-widest font-bold transition-colors duration-100 disabled:opacity-40"
                >
                  Research →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      {isShortcutsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border-2 border-black p-6 md:p-7 space-y-4 shadow-none animate-fade select-none">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-black" />
                <h3 className="font-serif text-base font-bold tracking-tight text-black">
                  Keyboard Shortcuts
                </h3>
              </div>
              <button
                onClick={() => setIsShortcutsOpen(false)}
                className="p-1 border border-black hover:bg-black hover:text-white transition-colors"
                aria-label="Close shortcuts modal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 font-mono text-xs text-neutral-800">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <span className="font-serif text-neutral-700">Search Any Topic</span>
                <span className="bg-neutral-100 border border-neutral-400 px-1.5 py-0.5 font-bold">⌘ / Ctrl + K</span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <span className="font-serif text-neutral-700">Quick Search</span>
                <span className="bg-neutral-100 border border-neutral-400 px-1.5 py-0.5 font-bold">/</span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <span className="font-serif text-neutral-700">Random Topic</span>
                <span className="bg-neutral-100 border border-neutral-400 px-1.5 py-0.5 font-bold">S</span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <span className="font-serif text-neutral-700">Browse 2000+ Topics</span>
                <span className="bg-neutral-100 border border-neutral-400 px-1.5 py-0.5 font-bold">B</span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <span className="font-serif text-neutral-700">My Saved Mindmaps</span>
                <span className="bg-neutral-100 border border-neutral-400 px-1.5 py-0.5 font-bold">L</span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <span className="font-serif text-neutral-700">Category Shortcuts</span>
                <span className="bg-neutral-100 border border-neutral-400 px-1.5 py-0.5 font-bold">1 - 5</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="font-serif text-neutral-700">Close Active View / Modal</span>
                <span className="bg-neutral-100 border border-neutral-400 px-1.5 py-0.5 font-bold">ESC</span>
              </div>
            </div>

            <div className="pt-2 text-center border-t border-neutral-200">
              <button
                onClick={() => setIsShortcutsOpen(false)}
                className="w-full py-2 bg-black text-white hover:bg-neutral-800 font-mono text-xs uppercase font-bold tracking-wider transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Panels & Overlays */}
      {isBrowseOpen && <HubBrowser onClose={() => setIsBrowseOpen(false)} />}
      <ChatComposer />
      <DossierDrawer />
      <MobileOverflowMenu
        isOpen={isOverflowOpen}
        onClose={() => setIsOverflowOpen(false)}
        onSearch={() => {
          setIsOverflowOpen(false);
          setIsCustomModalOpen(true);
        }}
        canShare={nodes.length > 0 && !!currentTopic}
        onShare={() => {
          setIsOverflowOpen(false);
          handleToggleShare();
        }}
        canClear={nodes.length > 0}
        onClear={() => {
          setIsOverflowOpen(false);
          resetCanvas();
        }}
        onShortcuts={() => {
          setIsOverflowOpen(false);
          setIsShortcutsOpen(true);
        }}
        onOpenLibrary={handleToggleLibrary}
      />
      <MyMindMapsDrawer
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onOpenShareModal={() => setIsShareOpen(true)}
        onBrowseTopics={() => {
          setIsLibraryOpen(false);
          handleToggleBrowse();
        }}
      />
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />

      {/* Mobile Bottom Navigation Bar (< md) */}
      <MobileBottomBar
        onToggleBrowse={handleToggleBrowse}
        isBrowseOpen={isBrowseOpen}
        onToggleLibrary={handleToggleLibrary}
        isLibraryOpen={isLibraryOpen}
        onCenterCanvas={() => {
          setIsBrowseOpen(false);
          setIsLibraryOpen(false);
          closeDossier();
        }}
      />
    </main>
  );
}

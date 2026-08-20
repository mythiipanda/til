'use client';

import { memo } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { Network, Compass, BookOpen, Bookmark } from 'lucide-react';

interface MobileBottomBarProps {
  onToggleBrowse: () => void;
  isBrowseOpen: boolean;
  onToggleLibrary: () => void;
  isLibraryOpen: boolean;
  onCenterCanvas: () => void;
}

export function MobileBottomBar({
  onToggleBrowse,
  isBrowseOpen,
  onToggleLibrary,
  isLibraryOpen,
  onCenterCanvas,
}: MobileBottomBarProps) {
  const nodes = useMindMapStore(s => s.nodes);
  const selectedNodeId = useMindMapStore(s => s.selectedNodeId);
  const isDossierOpen = useMindMapStore(s => s.isDossierOpen);
  const openDossier = useMindMapStore(s => s.openDossier);
  const closeDossier = useMindMapStore(s => s.closeDossier);
  const isResearching = useMindMapStore(s => s.isResearching);

  const rootNode = nodes.find(n => (n.data as any)?.isRoot) || nodes[0];
  const activeNodeId = selectedNodeId || rootNode?.id;

  const handleStoryClick = () => {
    if (isDossierOpen) {
      closeDossier();
    } else if (activeNodeId) {
      openDossier(activeNodeId);
    } else {
      onToggleBrowse();
    }
  };

  if (nodes.length === 0) return null;

  return (
    <nav aria-label="Primary" className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t-2 border-black h-14 pb-[env(safe-area-inset-bottom)] flex items-center justify-around select-none">
      {/* Canvas / Center */}
      <button
        onClick={onCenterCanvas}
        className="flex-1 flex flex-col items-center justify-center h-full text-black hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
        title="Center Map"
      >
        <Network className="w-4 h-4" />
        <span className="font-mono text-[9px] uppercase font-bold tracking-wider pt-0.5">
          Map
        </span>
      </button>

      {/* Topics Catalog */}
      <button
        onClick={onToggleBrowse}
        aria-current={isBrowseOpen ? 'page' : undefined}
        className={`flex-1 flex flex-col items-center justify-center h-full transition-colors ${
          isBrowseOpen ? 'bg-black text-white' : 'text-black hover:bg-neutral-100'
        }`}
        title="Explore Topics"
      >
        <Compass className="w-4 h-4" />
        <span className="font-mono text-[9px] uppercase font-bold tracking-wider pt-0.5">
          Topics
        </span>
      </button>

      {/* Story / Dossier */}
      <button
        onClick={handleStoryClick}
        aria-current={isDossierOpen ? 'page' : undefined}
        className={`flex-1 flex flex-col items-center justify-center h-full relative transition-colors ${
          isDossierOpen ? 'bg-black text-white' : 'text-black hover:bg-neutral-100'
        }`}
        title="Read Story"
      >
        <BookOpen className="w-4 h-4" />
        <span className="font-mono text-[9px] uppercase font-bold tracking-wider pt-0.5">
          Story
        </span>
        {isResearching && (
          <span className="absolute top-2 right-1/4 w-2 h-2 rounded-full bg-black animate-ping" />
        )}
      </button>

      {/* Library */}
      <button
        onClick={onToggleLibrary}
        aria-current={isLibraryOpen ? 'page' : undefined}
        className={`flex-1 flex flex-col items-center justify-center h-full transition-colors ${
          isLibraryOpen ? 'bg-black text-white' : 'text-black hover:bg-neutral-100'
        }`}
        title="Saved Mindmaps"
      >
        <Bookmark className="w-4 h-4" />
        <span className="font-mono text-[9px] uppercase font-bold tracking-wider pt-0.5">
          Library
        </span>
      </button>
    </nav>
  );
}

export default memo(MobileBottomBar);

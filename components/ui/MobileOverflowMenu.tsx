'use client';

import { memo } from 'react';
import { Search, Share2, RotateCcw, Keyboard, X, Plus } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';

interface MobileOverflowMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: () => void;
  canShare: boolean;
  onShare: () => void;
  canClear: boolean;
  onClear: () => void;
  onShortcuts: () => void;
  onOpenLibrary: () => void;
}

export function MobileOverflowMenu({
  isOpen,
  onClose,
  onSearch,
  canShare,
  onShare,
  canClear,
  onClear,
  onShortcuts,
  onOpenLibrary,
}: MobileOverflowMenuProps) {
  if (!isOpen) return null;

  const row =
    'w-full min-h-[44px] flex items-center gap-3 px-4 font-mono text-xs uppercase font-bold tracking-wider text-black hover:bg-black hover:text-white transition-colors duration-100 text-left';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-2 top-2 bottom-16 z-50 md:hidden w-[260px] bg-white border-2 border-black flex flex-col shadow-none animate-fade">
        <div className="flex items-center justify-between px-4 h-12 border-b-2 border-black bg-black text-white shrink-0">
          <span className="font-mono text-[10px] uppercase tracking-widest font-bold">
            MENU
          </span>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center hover:bg-white hover:text-black transition-colors"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          <button onClick={onSearch} className={row}>
            <Search className="w-4 h-4 shrink-0" />
            <span>Search Topic</span>
          </button>

          {canShare && (
            <button onClick={onShare} className={row}>
              <Share2 className="w-4 h-4 shrink-0" />
              <span>Share Mindmap</span>
            </button>
          )}

          {canClear && (
            <button onClick={onClear} className={row}>
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Clear Canvas</span>
            </button>
          )}

          <button onClick={onShortcuts} className={row}>
            <Keyboard className="w-4 h-4 shrink-0" />
            <span>Shortcuts</span>
          </button>

          <button onClick={onOpenLibrary} className={row}>
            <Plus className="w-4 h-4 shrink-0 rotate-45" />
            <span>Library</span>
          </button>
        </div>

        <div className="border-t-2 border-black p-2 shrink-0">
          <UserMenu onOpenLibrary={onOpenLibrary} />
        </div>
      </div>
    </>
  );
}

export default memo(MobileOverflowMenu);
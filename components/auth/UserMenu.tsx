'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { AuthModal } from './AuthModal';
import { User, LogOut, Bookmark, Cloud, ChevronDown, Sparkles } from 'lucide-react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';

interface UserMenuProps {
  onOpenLibrary?: () => void;
}

export function UserMenu({ onOpenLibrary }: UserMenuProps) {
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const { saveMindMap, currentTopic, nodes } = useMindMapStore();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsDropdownOpen(false);
  };

  const handleQuickSave = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    setSaveStatus('Saving...');
    const res = await saveMindMap();
    if (res.error) {
      setSaveStatus('Error');
    } else {
      setSaveStatus('Saved ✔');
    }

    setTimeout(() => setSaveStatus(null), 2500);
    setIsDropdownOpen(false);
  };

  return (
    <>
      <div className="relative">
        {user ? (
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-full text-xs font-medium text-neutral-800 transition-colors shadow-xs"
            >
              <div className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-mono">
                {user.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="max-w-[100px] truncate text-[11px] font-medium hidden sm:inline">
                {user.user_metadata?.full_name || user.email?.split('@')[0]}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-500" />
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3.5 py-2 border-b border-neutral-100">
                    <p className="text-[11px] font-medium text-neutral-900 truncate">
                      {user.user_metadata?.full_name || 'Researcher'}
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate">{user.email}</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        if (onOpenLibrary) onOpenLibrary();
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors text-left"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-neutral-500" />
                      My Library & History
                    </button>

                    {nodes.length > 0 && currentTopic && (
                      <button
                        onClick={handleQuickSave}
                        className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors text-left"
                      >
                        <span className="flex items-center gap-2">
                          <Cloud className="w-3.5 h-3.5 text-neutral-500" />
                          Save Mindmap
                        </span>
                        {saveStatus && (
                          <span className="text-[10px] text-neutral-500 font-mono">{saveStatus}</span>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="border-t border-neutral-100 pt-1 mt-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-500" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-black text-white rounded-full text-xs font-medium transition-all shadow-xs active:scale-[0.98]"
            >
              <User className="w-3 h-3 text-neutral-300" />
              <span>Sign in</span>
            </button>
          </div>
        )}
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => setIsAuthOpen(false)}
      />
    </>
  );
}

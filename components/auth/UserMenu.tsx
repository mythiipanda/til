'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { AuthModal } from './AuthModal';
import { User, LogOut, Bookmark, Cloud, ChevronDown } from 'lucide-react';
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
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        setIsAuthOpen(false);
      }
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

    setSaveStatus('SAVING...');
    const res = await saveMindMap();
    if (res.error) {
      setSaveStatus('ERROR');
    } else {
      setSaveStatus('SAVED ✔');
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
              className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-black text-black hover:text-white border-2 border-black font-mono text-xs uppercase font-bold tracking-wider transition-colors duration-100"
            >
              <span className="w-4 h-4 bg-black text-white flex items-center justify-center text-[9px] font-bold">
                {user.email?.[0]?.toUpperCase() || 'U'}
              </span>
              <span className="max-w-[120px] truncate hidden sm:inline">
                {user.user_metadata?.full_name || user.email?.split('@')[0]}
              </span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white border-2 border-black z-50 animate-fade">
                  <div className="p-3 border-b-2 border-black bg-neutral-50">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                      CURRENT SESSION
                    </p>
                    <p className="font-mono text-xs font-bold text-black truncate pt-0.5">
                      {user.email}
                    </p>
                  </div>

                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        if (onOpenLibrary) onOpenLibrary();
                      }}
                      className="w-full flex items-center justify-between p-2.5 font-mono text-xs uppercase tracking-wider text-black hover:bg-black hover:text-white transition-colors duration-100 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Library & History</span>
                      </span>
                      <span className="text-[10px] opacity-60">→</span>
                    </button>

                    {nodes.length > 0 && currentTopic && (
                      <button
                        onClick={handleQuickSave}
                        className="w-full flex items-center justify-between p-2.5 font-mono text-xs uppercase tracking-wider text-black hover:bg-black hover:text-white transition-colors duration-100 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <Cloud className="w-3.5 h-3.5" />
                          <span>Save to Cloud</span>
                        </span>
                        {saveStatus && (
                          <span className="font-bold text-[10px]">{saveStatus}</span>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="border-t-2 border-black p-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 p-2.5 font-mono text-xs uppercase tracking-wider text-black hover:bg-black hover:text-white transition-colors duration-100 text-left font-bold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase font-bold tracking-widest transition-colors duration-100"
          >
            <User className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </>
  );
}

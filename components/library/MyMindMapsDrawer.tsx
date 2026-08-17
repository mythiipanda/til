'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { X, Bookmark, History, Trash2, ArrowRight, Folder } from 'lucide-react';

interface MyMindMapsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShareModal?: () => void;
}

export function MyMindMapsDrawer({ isOpen, onClose }: MyMindMapsDrawerProps) {
  const [cloudMindmaps, setCloudMindmaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'cloud'>('recent');

  const { recentSessions, loadMindMapById, currentTopic, resetCanvas } = useMindMapStore();

  const fetchCloudMindmaps = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('mindmaps')
        .select('id, title, root_topic, category, node_count, updated_at, share_slug')
        .order('updated_at', { ascending: false });

      if (!error && data) {
        setCloudMindmaps(data);
        if (data.length > 0) setActiveTab('cloud');
      }
    } catch (e) {
      console.error('Error fetching cloud mindmaps:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCloudMindmaps();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoad = async (id: string) => {
    const ok = await loadMindMapById(id);
    if (ok) {
      onClose();
    }
  };

  const handleDeleteCloud = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.from('mindmaps').delete().eq('id', id);
      setCloudMindmaps(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Failed to delete mindmap:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/60 backdrop-blur-none animate-fade">
      <div className="relative w-full max-w-[480px] h-full bg-white border-l-4 border-black flex flex-col shadow-none overflow-hidden">
        
        {/* Masthead Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b-2 border-black bg-black text-white shrink-0">
          <div className="flex items-center gap-3">
            <Bookmark className="w-4 h-4 text-white" />
            <div>
              <h2 className="font-serif text-base font-bold tracking-tight uppercase">
                Library & Archive
              </h2>
              <p className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">
                Saved Sessions & Explorations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 border border-white hover:bg-white hover:text-black transition-colors duration-100"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 border-b-2 border-black bg-neutral-100 font-mono text-xs font-bold uppercase tracking-wider shrink-0">
          <button
            onClick={() => setActiveTab('recent')}
            className={`py-3 px-4 flex items-center justify-center gap-2 border-r-2 border-black transition-colors duration-100 ${
              activeTab === 'recent'
                ? 'bg-white text-black font-extrabold'
                : 'bg-neutral-100 text-neutral-600 hover:text-black'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Recent ({recentSessions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`py-3 px-4 flex items-center justify-center gap-2 transition-colors duration-100 ${
              activeTab === 'cloud'
                ? 'bg-white text-black font-extrabold'
                : 'bg-neutral-100 text-neutral-600 hover:text-black'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Cloud Archive ({cloudMindmaps.length})</span>
          </button>
        </div>

        {/* MindMap List Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'recent' && (
            <div className="space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 pb-1 border-b border-black">
                // LOCAL DISK PERSISTENCE (ACTIVE BROWSER)
              </div>

              {recentSessions.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-neutral-300 space-y-2">
                  <p className="font-serif text-sm font-bold text-black">No Recent Explorations</p>
                  <p className="font-body text-xs text-neutral-500">
                    Explore any topic from the cover or search bar to automatically build your session archive.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleLoad(session.id)}
                      className={`group p-4 border-2 border-black cursor-pointer transition-colors duration-100 ${
                        currentTopic === session.topic
                          ? 'bg-black text-white'
                          : 'bg-white text-black hover:bg-black hover:text-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 font-bold ${
                              currentTopic === session.topic
                                ? 'bg-white text-black'
                                : 'bg-neutral-100 group-hover:bg-white text-black'
                            }`}>
                              {session.category || 'GENERAL'}
                            </span>
                            <span className={`font-mono text-[10px] ${
                              currentTopic === session.topic ? 'text-neutral-300' : 'text-neutral-500 group-hover:text-neutral-300'
                            }`}>
                              {session.nodeCount} nodes
                            </span>
                          </div>
                          <h3 className="font-serif text-base font-bold truncate">
                            {session.topic}
                          </h3>
                        </div>

                        <span className="font-mono text-xs opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                          →
                        </span>
                      </div>

                      <div className={`mt-3 pt-2 border-t font-mono text-[10px] flex items-center justify-between ${
                        currentTopic === session.topic ? 'border-neutral-800 text-neutral-400' : 'border-neutral-200 group-hover:border-neutral-800 text-neutral-500 group-hover:text-neutral-400'
                      }`}>
                        <span>{new Date(session.timestamp).toLocaleDateString()}</span>
                        <span>{currentTopic === session.topic ? 'ACTIVE NOW' : 'CLICK TO RESTORE'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'cloud' && (
            <div className="space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 pb-1 border-b border-black">
                // SUPABASE CLOUD ARCHIVE (CROSS-DEVICE)
              </div>

              {loading ? (
                <div className="p-8 text-center font-mono text-xs uppercase text-neutral-500">
                  FETCHING ARCHIVES...
                </div>
              ) : cloudMindmaps.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-neutral-300 space-y-3">
                  <p className="font-serif text-sm font-bold text-black">No Cloud Mindmaps Saved</p>
                  <p className="font-body text-xs text-neutral-500">
                    Sign in and click &quot;Save to Cloud&quot; from the masthead menu to archive your canvas.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cloudMindmaps.map((map) => (
                    <div
                      key={map.id}
                      onClick={() => handleLoad(map.id)}
                      className="group p-4 bg-white hover:bg-black text-black hover:text-white border-2 border-black cursor-pointer transition-colors duration-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 font-bold bg-neutral-100 group-hover:bg-white text-black">
                              {map.category || 'GENERAL'}
                            </span>
                            <span className="font-mono text-[10px] text-neutral-500 group-hover:text-neutral-300">
                              {map.node_count || 0} nodes
                            </span>
                          </div>
                          <h3 className="font-serif text-base font-bold truncate">
                            {map.title || map.root_topic}
                          </h3>
                        </div>

                        <button
                          onClick={(e) => handleDeleteCloud(map.id, e)}
                          className="p-1 text-neutral-400 hover:text-white transition-colors"
                          title="Delete from cloud"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="mt-3 pt-2 border-t border-neutral-200 group-hover:border-neutral-800 font-mono text-[10px] text-neutral-500 group-hover:text-neutral-400 flex items-center justify-between">
                        <span>Updated {new Date(map.updated_at).toLocaleDateString()}</span>
                        <span className="font-bold flex items-center gap-1">
                          RESTORE <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-black bg-neutral-50 flex items-center justify-between shrink-0 font-mono text-xs">
          <button
            onClick={() => {
              resetCanvas();
              onClose();
            }}
            className="text-neutral-600 hover:text-black uppercase font-bold tracking-wider underline underline-offset-2"
          >
            ← New Blank Exploration
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-black text-white hover:bg-white hover:text-black border-2 border-black font-mono uppercase font-bold tracking-wider transition-colors duration-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

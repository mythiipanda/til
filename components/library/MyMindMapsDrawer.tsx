'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { X, Bookmark, History, Trash2, ArrowRight, Share2, Sparkles, Folder } from 'lucide-react';

interface MyMindMapsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShareModal?: () => void;
}

export function MyMindMapsDrawer({ isOpen, onClose, onOpenShareModal }: MyMindMapsDrawerProps) {
  const [cloudMindmaps, setCloudMindmaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'cloud' | 'recent'>('recent');

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
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-[440px] h-full bg-white border-l border-neutral-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-neutral-900" />
            <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">Research Library & History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 px-5 pt-2 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('recent')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'recent'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Recent Explorations ({recentSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'cloud'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            Saved Cloud Maps ({cloudMindmaps.length})
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {activeTab === 'recent' ? (
            recentSessions.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 space-y-2">
                <History className="w-8 h-8 mx-auto text-neutral-300 stroke-[1.5]" />
                <p className="text-xs">No recent exploration sessions found.</p>
                <p className="text-[11px] text-neutral-400">Start exploring topics from the discovery bar.</p>
              </div>
            ) : (
              recentSessions.map((session) => (
                <div
                  key={session.id || session.topic}
                  onClick={() => handleLoad(session.id || session.topic)}
                  className={`group relative p-3.5 bg-neutral-50 hover:bg-white border rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs hover:border-neutral-300 flex items-center justify-between ${
                    currentTopic === session.topic ? 'border-neutral-900 bg-neutral-50/80 ring-1 ring-neutral-900/10' : 'border-neutral-200'
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-neutral-200/80 rounded text-neutral-700 font-medium">
                        {session.category || 'Discovery'}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {session.nodeCount || 1} nodes
                      </span>
                    </div>
                    <h3 className="text-xs font-semibold text-neutral-900 truncate group-hover:text-neutral-950">
                      {session.topic}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600" />
                  </div>
                </div>
              ))
            )
          ) : (
            cloudMindmaps.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 space-y-2">
                <Folder className="w-8 h-8 mx-auto text-neutral-300 stroke-[1.5]" />
                <p className="text-xs">No saved cloud mindmaps yet.</p>
                <p className="text-[11px] text-neutral-400">Click &apos;Save Mindmap&apos; when researching to bookmark graphs permanently.</p>
              </div>
            ) : (
              cloudMindmaps.map((map) => (
                <div
                  key={map.id}
                  onClick={() => handleLoad(map.id)}
                  className={`group relative p-3.5 bg-neutral-50 hover:bg-white border rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs hover:border-neutral-300 flex items-center justify-between ${
                    currentTopic === map.root_topic ? 'border-neutral-900 bg-neutral-50/80 ring-1 ring-neutral-900/10' : 'border-neutral-200'
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-neutral-200/80 rounded text-neutral-700 font-medium">
                        {map.category || 'Topic'}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {map.node_count || 1} nodes
                      </span>
                    </div>
                    <h3 className="text-xs font-semibold text-neutral-900 truncate group-hover:text-neutral-950">
                      {map.title || map.root_topic}
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                      {new Date(map.updated_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDeleteCloud(map.id, e)}
                      title="Delete saved map"
                      className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600 ml-1" />
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
          <button
            onClick={() => {
              resetCanvas();
              onClose();
            }}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Start New Graph
          </button>

          {onOpenShareModal && (
            <button
              onClick={() => {
                onClose();
                onOpenShareModal();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-black text-white text-xs font-medium rounded-full shadow-xs transition-all"
            >
              <Share2 className="w-3 h-3" />
              <span>Share / Export</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

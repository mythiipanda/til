'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { KnowledgeCanvas } from '@/components/canvas/KnowledgeCanvas';
import { DossierDrawer } from '@/components/dossier/DossierDrawer';
import { ActivityPanel } from '@/components/activity/ActivityPanel';
import { Sparkles, ArrowLeft, Share2, Copy, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SharedMindMapPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();

  const { loadMindMapBySlug, nodes, currentTopic, isDossierOpen } = useMindMapStore();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (slug) {
      loadMindMapBySlug(slug).then((success) => {
        setLoading(false);
        if (!success) setNotFound(true);
      });
    }
  }, [slug, loadMindMapBySlug]);

  const handleCopy = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          <p className="text-xs font-mono text-neutral-400">Hydrating shared mindmap...</p>
        </div>
      </div>
    );
  }

  if (notFound || nodes.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-white p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-800 mb-4 border border-neutral-200">
          <Sparkles className="w-6 h-6 text-neutral-500" />
        </div>
        <h1 className="text-lg font-semibold text-neutral-900 mb-1">Shared Mindmap Not Found</h1>
        <p className="text-xs text-neutral-500 max-w-sm mb-6">
          This mindmap link may have expired or is set to private.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-full text-xs font-medium hover:bg-black transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Explore TDILEARNED
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white">
      {/* Top Banner Header */}
      <header className="absolute top-0 left-0 right-0 z-30 flex h-14 items-center justify-between px-6 bg-white/90 backdrop-blur-md border-b border-neutral-200/80">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-full text-xs font-medium text-neutral-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>TDILEARNED</span>
          </Link>
          <div className="h-4 w-px bg-neutral-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-900 truncate max-w-[240px] sm:max-w-[400px]">
              {currentTopic}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-500">
              Shared Mindmap ({nodes.length} nodes)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-black text-white rounded-full text-xs font-medium transition-all shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-400" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-neutral-300" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Interactive Canvas */}
      <main className="h-full w-full pt-14">
        <KnowledgeCanvas />
      </main>

      {/* Dossier Drawer */}
      <DossierDrawer />

      {/* Activity Panel */}
      <ActivityPanel />
    </div>
  );
}

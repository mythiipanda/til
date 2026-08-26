'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { trackLaunchEvent } from '@/lib/metrics/launch-events';
import { KnowledgeCanvas } from '@/components/canvas/KnowledgeCanvas';
import { DossierDrawer } from '@/components/dossier/DossierDrawer';
import { ArrowLeft, ArrowUpRight, Copy, Check, Loader2 } from 'lucide-react';

export default function SharedMindMapClient() {
  const params = useParams();
  const slug = params?.slug as string;

  const loadMindMapBySlug = useMindMapStore(s => s.loadMindMapBySlug);
  const fetchPrecomputedHubs = useMindMapStore(s => s.fetchPrecomputedHubs);
  const nodes = useMindMapStore(s => s.nodes);
  const currentTopic = useMindMapStore(s => s.currentTopic);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    // Warm the hub catalog immediately so the saturation fallback can match
    // instantly when a cold visitor types their own topic.
    void fetchPrecomputedHubs();
    loadMindMapBySlug(slug).then((success) => {
      setLoading(false);
      if (!success) {
        setNotFound(true);
      } else {
        const ref = new URLSearchParams(window.location.search).get('ref');
        trackLaunchEvent('map_visit', { topic: currentTopic || slug, ref, onceKey: `visit:${slug}` });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, loadMindMapBySlug, fetchPrecomputedHubs]);

  const handleCopy = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-black">
        <div className="flex flex-col items-center gap-3 border-2 border-black p-8">
          <Loader2 className="w-6 h-6 animate-spin text-black" />
          <p className="font-mono text-xs uppercase tracking-widest text-black font-bold">
            Loading Shared Mindmap...
          </p>
        </div>
      </div>
    );
  }

  if (notFound || nodes.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-white p-6 text-center">
        <div className="border-2 border-black p-8 max-w-md space-y-4">
          <div className="w-3 h-3 bg-black mx-auto" />
          <h1 className="font-serif text-2xl font-bold text-black">
            Shared Mindmap Not Found
          </h1>
          <p className="font-body text-xs text-neutral-600 leading-relaxed">
            This mindmap link may have expired or is set to private by its author.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white hover:bg-white hover:text-black border-2 border-black font-mono text-xs uppercase font-bold tracking-widest transition-colors duration-100"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Explore TDILEARNED</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white select-none">
      {/* Top Banner Header */}
      <header className="fixed top-4 left-4 right-4 z-30 flex items-center justify-between bg-white border-2 border-black p-2 md:px-4 shadow-none">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-2.5 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase font-bold tracking-wider transition-colors duration-100"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>TDILEARNED</span>
          </Link>
          <div className="h-4 w-px bg-black hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="font-serif text-base font-bold text-black truncate max-w-[240px] sm:max-w-[400px]">
              {currentTopic}
            </span>
            <span className="font-mono text-[10px] uppercase font-bold bg-neutral-100 border border-black px-2 py-0.5 text-black">
              {nodes.length} NODES
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-black text-black hover:text-white border-2 border-black font-mono text-xs uppercase font-bold tracking-wider transition-colors duration-100"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Make Your Own</span>
            <span className="sm:hidden">Make One</span>
          </Link>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase font-bold tracking-wider transition-colors duration-100"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Share Link</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Interactive Canvas */}
      <main className="h-full w-full">
        <KnowledgeCanvas />
      </main>

      {/* Dossier Drawer */}
      <DossierDrawer />
    </div>
  );
}
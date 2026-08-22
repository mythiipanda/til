'use client';

import React, { useEffect, useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { trackLaunchEvent } from '@/lib/metrics/launch-events';
import { X, Copy, Check, Share2, Loader2 } from 'lucide-react';

/**
 * Post-generation share moment. Auto-opens after a root research run
 * (gated once per tab session in the store) and offers the map link with
 * one-tap copy plus share intents. Honest on failure: no link is shown
 * unless the row actually persisted.
 */
export function SharePromptModal() {
  const isOpen = useMindMapStore(s => s.sharePromptOpen);
  const setSharePromptOpen = useMindMapStore(s => s.setSharePromptOpen);
  const generateShareLink = useMindMapStore(s => s.generateShareLink);
  const currentTopic = useMindMapStore(s => s.currentTopic);
  const nodeCount = useMindMapStore(s => s.nodes.length);
  const isFreshMap = useMindMapStore(s => s.isFreshMap);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setShareUrl(null);
    generateShareLink().then((url) => {
      if (cancelled) return;
      setLoading(false);
      if (url) {
        setShareUrl(url);
      } else {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, generateShareLink]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSharePromptOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, setSharePromptOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    trackLaunchEvent('share_copy', { topic: currentTopic, ref: 'prompt' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (!shareUrl || typeof navigator.share === 'undefined') return;
    try {
      await navigator.share({
        title: `${currentTopic} — TDILEARNED`,
        text: `A researched mindmap about ${currentTopic}`,
        url: shareUrl,
      });
      trackLaunchEvent('share_copy', { topic: currentTopic, ref: 'prompt-native' });
    } catch {
      // User dismissed the sheet; nothing to do.
    }
  };

  const xIntent = shareUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`A researched mindmap about ${currentTopic ?? 'anything'}`)}&url=${encodeURIComponent(shareUrl)}`
    : '#';
  const redditIntent = shareUrl
    ? `https://www.reddit.com/r/InternetIsBeautiful/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(currentTopic ?? '')}`
    : '#';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 animate-fade"
      onClick={() => setSharePromptOpen(false)}
    >
      <div
        className="relative w-full max-w-md bg-white border-2 border-black p-6 md:p-8 space-y-5 shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase font-bold bg-black text-white px-2 py-0.5">
              YOUR MAP IS LIVE
            </span>
          </div>
          <button
            onClick={() => setSharePromptOpen(false)}
            className="p-1 border border-black hover:bg-black hover:text-white transition-colors duration-100"
            aria-label="Close share dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h2 className="font-serif text-xl font-bold tracking-tight text-black leading-snug">
          Someone out there wants to see this.
        </h2>

        {isFreshMap && (
          <div className="font-mono text-[10px] uppercase font-bold tracking-widest bg-neutral-100 border-2 border-black px-3 py-1.5 inline-block">
            Fresh map — first person to map this here
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-neutral-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Publishing your link...</span>
          </div>
        )}

        {failed && (
          <p className="font-body text-sm text-neutral-700">
            The link could not be published just now. Your map stays on this device; try Share again in a moment.
          </p>
        )}

        {shareUrl && !loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full px-3 py-2.5 bg-neutral-50 border-2 border-black font-mono text-xs text-black outline-none"
                aria-label="Your public mindmap link"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2.5 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase font-bold tracking-wider transition-colors duration-100 flex items-center gap-1.5 shrink-0 min-h-[44px]"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {typeof navigator !== 'undefined' && typeof navigator.share !== 'undefined' && (
                <button
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white hover:bg-black text-black hover:text-white border-2 border-black font-mono text-[11px] uppercase font-bold tracking-wider transition-colors duration-100 min-h-[44px]"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              )}
              <a
                href={xIntent}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackLaunchEvent('share_copy', { topic: currentTopic, ref: 'prompt-x' })}
                className="flex items-center justify-center px-3 py-2.5 bg-white hover:bg-black text-black hover:text-white border-2 border-black font-mono text-[11px] uppercase font-bold tracking-wider transition-colors duration-100 min-h-[44px]"
              >
                Post on X
              </a>
              <a
                href={redditIntent}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackLaunchEvent('share_copy', { topic: currentTopic, ref: 'prompt-reddit' })}
                className="flex items-center justify-center px-3 py-2.5 bg-white hover:bg-black text-black hover:text-white border-2 border-black font-mono text-[11px] uppercase font-bold tracking-wider transition-colors duration-100 min-h-[44px]"
              >
                To Reddit
              </a>
            </div>

            <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
              Anyone with this link can open your map and its sources.
            </p>
          </div>
        )}

        <div className="border-t border-neutral-200 pt-3 flex justify-between items-center">
          <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            {nodeCount} NODES RESEARCHED
          </span>
          <button
            onClick={() => setSharePromptOpen(false)}
            className="px-5 py-2 border-2 border-black font-mono text-xs uppercase font-bold tracking-wider hover:bg-black hover:text-white transition-colors duration-100"
          >
            Keep Exploring
          </button>
        </div>
      </div>
    </div>
  );
}

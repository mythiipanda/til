'use client';

import React, { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { X, Copy, Check, Share2, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { currentTopic, nodes, generateShareLink, activeDossier } = useMindMapStore();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportingImg, setExportingImg] = useState(false);

  if (!isOpen) return null;

  const handleGenerateLink = async () => {
    try {
      setLoadingLink(true);
      const url = await generateShareLink();
      setShareUrl(url);
    } catch (e) {
      console.error('Failed to generate share link:', e);
    } finally {
      setLoadingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    if (!currentTopic || nodes.length === 0) return;

    let md = `# TDILEARNED Investigation: ${currentTopic}\n\n`;
    md += `*Generated on ${new Date().toLocaleDateString()} via TDILEARNED Agentic Discovery Engine*\n\n`;
    md += `---\n\n`;

    // Overview & Dossier
    if (activeDossier) {
      md += `## Executive Monograph\n\n`;
      md += `${activeDossier.abstract || ''}\n\n`;

      if (activeDossier.mechanisms && activeDossier.mechanisms.length > 0) {
        md += `### Core Mechanisms & Explanations\n\n`;
        activeDossier.mechanisms.forEach((m) => {
          md += `#### ${m.title}\n`;
          md += `${m.explanation}\n\n`;
        });
      }

      if (activeDossier.timeline && activeDossier.timeline.length > 0) {
        md += `### Historical Chronology\n\n`;
        activeDossier.timeline.forEach((t) => {
          md += `- **${t.date}**: ${t.headline} — *${t.description}*\n`;
        });
        md += `\n`;
      }
    }

    // Graph Nodes
    md += `## Explored Concept Map (${nodes.length} nodes)\n\n`;
    nodes.forEach((node) => {
      const data = node.data as any;
      if (node.type === 'note') {
        md += `### 📌 Pinned Insight: ${data.question}\n\n`;
        md += `${data.answer}\n\n`;
        if (data.citations && data.citations.length > 0) {
          md += `*Sources:*\n`;
          data.citations.forEach((c: any) => {
            md += `- [${c.title || c.url}](${c.url})\n`;
          });
          md += `\n`;
        }
      } else {
        md += `### ${data.title} (${data.category || 'Concept'})\n\n`;
        md += `${data.summary}\n\n`;
        if (data.wow_fact) {
          md += `> **Key Fact**: ${data.wow_fact}\n\n`;
        }
      }
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-monograph.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = async () => {
    const canvasElement = document.querySelector('.react-flow') as HTMLElement;
    if (!canvasElement) return;

    try {
      setExportingImg(true);
      const dataUrl = await toPng(canvasElement, {
        backgroundColor: '#FFFFFF',
        pixelRatio: 2,
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${(currentTopic || 'mindmap').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-canvas.png`;
      a.click();
    } catch (e) {
      console.error('Failed to export canvas PNG:', e);
    } finally {
      setExportingImg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-none p-4 animate-fade">
      <div className="relative w-full max-w-lg bg-white border-2 border-black p-6 md:p-8 space-y-6 shadow-none">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase font-bold bg-black text-white px-2 py-0.5">
              EXPORT
            </span>
            <div>
              <h2 className="font-serif text-lg font-bold tracking-tight text-black">
                Share & Export Monograph
              </h2>
              <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest truncate max-w-[280px]">
                {currentTopic || 'Spatial Exploration'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 border border-black hover:bg-black hover:text-white transition-colors duration-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Share Link Generation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[11px] uppercase font-bold tracking-wider text-black">
              1. Public Interactive Link
            </label>
            <span className="font-mono text-[10px] text-neutral-500 uppercase">Instant Web Access</span>
          </div>

          {shareUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full px-3 py-2.5 bg-neutral-50 border-2 border-black font-mono text-xs text-black outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase font-bold tracking-wider transition-colors duration-100 flex items-center gap-1.5 shrink-0"
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
              <p className="font-mono text-[10px] text-neutral-500">
                Anyone with this URL can navigate and view this mindmap and its dossiers.
              </p>
            </div>
          ) : (
            <button
              onClick={handleGenerateLink}
              disabled={loadingLink}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-black text-black hover:text-white border-2 border-black font-mono text-xs uppercase font-bold tracking-widest transition-colors duration-100 disabled:opacity-40"
            >
              {loadingLink ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Generate Shareable URL</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Thick Horizontal Rule */}
        <div className="border-t-2 border-black pt-5 space-y-3">
          <label className="block font-mono text-[11px] uppercase font-bold tracking-wider text-black">
            2. Offline Document &amp; Image Exports
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Markdown Export */}
            <button
              onClick={handleExportMarkdown}
              className="p-4 bg-white hover:bg-black text-black hover:text-white border-2 border-black transition-colors duration-100 text-left space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <FileText className="w-5 h-5" />
                <span className="font-mono text-[10px] uppercase font-bold border border-current px-1.5 py-0.5">
                  .MD
                </span>
              </div>
              <div>
                <h3 className="font-serif text-sm font-bold">Markdown Monograph</h3>
                <p className="font-body text-xs text-neutral-600 group-hover:text-neutral-300 leading-snug pt-0.5">
                  Full text, chronology, and insights formatted for Obsidian &amp; Notion.
                </p>
              </div>
            </button>

            {/* PNG Canvas Export */}
            <button
              onClick={handleExportPng}
              disabled={exportingImg}
              className="p-4 bg-white hover:bg-black text-black hover:text-white border-2 border-black transition-colors duration-100 text-left space-y-2 group disabled:opacity-40"
            >
              <div className="flex items-center justify-between">
                <ImageIcon className="w-5 h-5" />
                <span className="font-mono text-[10px] uppercase font-bold border border-current px-1.5 py-0.5">
                  .PNG
                </span>
              </div>
              <div>
                <h3 className="font-serif text-sm font-bold">Canvas Image</h3>
                <p className="font-body text-xs text-neutral-600 group-hover:text-neutral-300 leading-snug pt-0.5">
                  High-resolution raster screenshot of the current spatial graph.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 border-2 border-black font-mono text-xs uppercase font-bold tracking-wider hover:bg-black hover:text-white transition-colors duration-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

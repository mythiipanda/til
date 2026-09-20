'use client';

import React, { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { Copy, Check, Share2, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Modal } from '@/components/ui/Modal';

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

    let md = `# TDILEARNED: ${currentTopic}\n\n`;
    md += `*Exported on ${new Date().toLocaleDateString()} via TDILEARNED*\n\n`;
    md += `---\n\n`;

    // Overview & Dossier
    if (activeDossier) {
      md += `## Overview\n\n`;
      md += `${activeDossier.abstract || ''}\n\n`;

      if (activeDossier.mechanisms && activeDossier.mechanisms.length > 0) {
        md += `### Key Concepts\n\n`;
        activeDossier.mechanisms.forEach((m) => {
          md += `#### ${m.title}\n`;
          md += `${m.explanation}\n\n`;
        });
      }

      if (activeDossier.timeline && activeDossier.timeline.length > 0) {
        md += `### Timeline\n\n`;
        activeDossier.timeline.forEach((t) => {
          md += `- **${t.date}**: ${t.headline}. *${t.description}*\n`;
        });
        md += `\n`;
      }
    }

    // Graph Nodes
    md += `## Mindmap (${nodes.length} nodes)\n\n`;
    nodes.forEach((node) => {
      const data = node.data as any;
      if (node.type === 'note') {
        md += `### Pinned note: ${data.question}\n\n`;
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
    a.download = `${currentTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-notes.md`;
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
    <Modal
      open={isOpen}
      onClose={onClose}
      label="Share and export mindmap"
      badge="EXPORT"
      title="Share & Export"
      subtitle={currentTopic || 'Untitled map'}
      closeLabel="Close share dialog"
    >
      <div className="pt-6 space-y-6">
        {/* Share Link Generation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[11px] uppercase font-bold tracking-wider text-black">
              1. Public Interactive Link
            </label>
            <span className="font-mono text-[10px] text-neutral-600 uppercase">Public URL</span>
          </div>

          {shareUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  aria-label="Your public mindmap link"
                  className="w-full px-3 py-2.5 bg-neutral-50 border-2 border-black font-mono text-xs text-black outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 min-h-[44px] bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase font-bold tracking-wider transition-colors duration-100 flex items-center gap-1.5 shrink-0"
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
              <p className="font-mono text-[10px] text-neutral-600">
                Anyone with this link can open this mindmap and its stories.
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
                <h3 className="font-serif text-sm font-bold">Markdown file</h3>
                <p className="font-body text-xs text-neutral-600 group-hover:text-neutral-300 leading-snug pt-0.5">
                  Full text, timeline, and pinned notes formatted for Obsidian &amp; Notion.
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
                <h3 className="font-serif text-sm font-bold">Canvas image</h3>
                <p className="font-body text-xs text-neutral-600 group-hover:text-neutral-300 leading-snug pt-0.5">
                  Screenshot of the canvas at 2x resolution.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 min-h-[44px] border-2 border-black font-mono text-xs uppercase font-bold tracking-wider hover:bg-black hover:text-white transition-colors duration-100"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

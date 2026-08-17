'use client';

import React, { useState } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { X, Copy, Check, Share2, FileText, Image as ImageIcon, Sparkles, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { currentTopic, nodes, dossiersByNodeId, generateShareLink, activeDossier } = useMindMapStore();
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
      } else {
        md += `### 🌐 ${data.title}\n\n`;
        md += `${data.summary || ''}\n\n`;
        if (data.rabbit_holes && data.rabbit_holes.length > 0) {
          md += `**Connected Vectors:** ${data.rabbit_holes.join(', ')}\n\n`;
        }
      }
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${currentTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-monograph.md`;
    link.click();
  };

  const handleExportPNG = async () => {
    const flowEl = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!flowEl) return;

    try {
      setExportingImg(true);
      const dataUrl = await toPng(flowEl, {
        backgroundColor: '#FFFFFF',
        quality: 0.95,
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${currentTopic ? currentTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'tdilearned'}-canvas.png`;
      link.click();
    } catch (err) {
      console.error('Failed to export canvas image:', err);
    } finally {
      setExportingImg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-[460px] bg-white border border-neutral-200 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center text-white">
              <Share2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">Share & Export Mindmap</h2>
              <p className="text-[11px] text-neutral-500 truncate max-w-[280px]">
                {currentTopic || 'Active Discovery Session'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-5 space-y-5">
          {/* Public Link Share */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-900">
              Public Interactive Canvas Link
            </label>
            <p className="text-[11px] text-neutral-500">
              Anyone with this link can interactively zoom, pan, and read all researched monographs.
            </p>

            {shareUrl ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono text-neutral-800 select-all outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-medium transition-all shadow-xs shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateLink}
                disabled={loadingLink || nodes.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-medium transition-all shadow-sm disabled:opacity-50"
              >
                {loadingLink ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    Generate Public Share Link
                  </>
                )}
              </button>
            )}
          </div>

          <div className="border-t border-neutral-100 pt-4">
            <label className="block text-xs font-semibold text-neutral-900 mb-2">
              Export Formats
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleExportMarkdown}
                disabled={nodes.length === 0}
                className="flex items-center gap-2.5 p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-300 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-neutral-800 shadow-2xs group-hover:scale-105 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Markdown (.md)</p>
                  <p className="text-[10px] text-neutral-500">For Notion & Obsidian</p>
                </div>
              </button>

              <button
                onClick={handleExportPNG}
                disabled={nodes.length === 0 || exportingImg}
                className="flex items-center gap-2.5 p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-300 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-neutral-800 shadow-2xs group-hover:scale-105 transition-transform">
                  {exportingImg ? <Loader2 className="w-4 h-4 animate-spin text-neutral-800" /> : <ImageIcon className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Canvas Image</p>
                  <p className="text-[10px] text-neutral-500">High-res PNG render</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

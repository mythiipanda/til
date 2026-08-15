import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Infinite Curiosity Engine — Agentic Spatial Discovery Canvas',
  description: 'Dynamically translate human curiosity into infinite spatial mindmaps enriched with live AI reasoning, Wikimedia archives, OpenStreetMap tiles, and streaming follow-ups.',
  keywords: ['Mindmap', 'AI Knowledge Graph', 'Cerebras', 'Mistral', 'Discovery Engine', 'React Flow', 'Spatial Canvas'],
  authors: [{ name: 'Infinite Curiosity Team' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-slate-100 min-h-screen antialiased selection:bg-sky-500/30 selection:text-sky-200">
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TDILEARNED — What did you learn today?',
  description: 'An AI-powered discovery engine that researches any topic live with a swarm of agents. Watch them think, search, and build knowledge in real time.',
  keywords: ['AI research', 'knowledge discovery', 'live research', 'TDILEARNED'],
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
      <body>{children}</body>
    </html>
  );
}

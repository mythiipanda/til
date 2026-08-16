import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TDILEARNED — Discovery Through Essence',
  description: 'An architectural, infinite-canvas discovery engine researching knowledge live with a swarm of intelligence.',
  keywords: ['AI Research', 'Knowledge Graph', 'Editorial', 'Monochrome', 'TDILEARNED'],
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
    <html lang="en">
      <body className="bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TDILEARNED — Today I Learned',
  description: 'Explore the things you never knew you were curious about. Interactive visual topic maps, deep stories, and live AI research.',
  keywords: ['Today I Learned', 'TDILEARNED', 'Learning', 'Knowledge', 'Science', 'History', 'Curiosity'],
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

import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Playfair_Display, Source_Serif_4, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-playfair',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-source-serif',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TDILEARNED — Today I Learned',
  description: 'Type any topic and get a visual mindmap: sourced stories, key facts, and follow-up threads. Live web research on anything you want to learn.',
  keywords: ['Today I Learned', 'TDILEARNED', 'Learning', 'Knowledge', 'Science', 'History', 'Curiosity'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#000000',
};

const CF_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`bg-background text-foreground antialiased selection:bg-foreground selection:text-background ${playfair.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`}>
        {children}
        {CF_ANALYTICS_TOKEN ? (
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: CF_ANALYTICS_TOKEN })}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}

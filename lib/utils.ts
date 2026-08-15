import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CF_PROXY_URL = process.env.NEXT_PUBLIC_CF_PROXY_URL;

export function getProxyMediaUrl(originUrl: string): string {
  if (!originUrl) return '';
  if (!originUrl.startsWith('http')) return originUrl;
  
  if (CF_PROXY_URL) {
    return `${CF_PROXY_URL}/media?url=${encodeURIComponent(originUrl)}`;
  }
  
  // Local Next.js Edge proxy route fallback
  return `/api/media?url=${encodeURIComponent(originUrl)}`;
}

export function getProxiedImageUrl(originUrl?: string | null): string {
  if (!originUrl) return '';
  return getProxyMediaUrl(originUrl);
}

export function getProxiedOsmTileUrl(zoom: number, tileX: number, tileY: number): string {
  const originUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
  return getProxyMediaUrl(originUrl);
}

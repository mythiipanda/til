'use client';

import { MapPin, Globe, ExternalLink } from 'lucide-react';
import type { Geography } from '@/types';

interface MapViewerProps {
  geography: Geography;
}

export function MapViewer({ geography }: MapViewerProps) {
  if (!geography || !geography.latitude || !geography.longitude) return null;

  const { latitude, longitude, locationName, historicalSignificance } = geography;
  
  // Construct OSM bounding box embed URL
  const delta = 0.08;
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
  const osmDirectUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=12/${latitude}/${longitude}`;

  return (
    <div className="border-2 border-black bg-white space-y-2.5 p-4 animate-drop">
      {/* Header */}
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-neutral-500 border-b border-neutral-200 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-black">
          <MapPin className="w-3.5 h-3.5 text-black" />
          <span>GEOGRAPHIC & HISTORICAL EPICENTER</span>
        </div>
        <span className="text-neutral-400">
          {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E
        </span>
      </div>

      {/* Location Banner */}
      <div>
        <h4 className="font-serif font-bold text-base text-black flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-neutral-600 shrink-0" />
          <span>{locationName}</span>
        </h4>
        {historicalSignificance && (
          <p className="font-body text-xs text-neutral-700 pt-1 leading-relaxed">
            {historicalSignificance}
          </p>
        )}
      </div>

      {/* Map Embed Container */}
      <div className="relative w-full h-[180px] border border-black overflow-hidden bg-neutral-100">
        <iframe
          title={`Map of ${locationName}`}
          src={osmEmbedUrl}
          className="w-full h-full border-none grayscale contrast-125 hover:grayscale-0 transition-[filter] duration-300 image-outline"
          loading="lazy"
        />
      </div>

      {/* Footer attribution & link */}
      <div className="flex items-center justify-between font-mono text-[9px] text-neutral-500 pt-1">
        <span>OpenStreetMap Verified Geospatial Data</span>
        <a
          href={osmDirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-black hover:underline flex items-center gap-1"
        >
          <span>View on OpenStreetMap</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}

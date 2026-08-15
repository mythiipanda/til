'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, X, Radio } from 'lucide-react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';

export function AudioPlayerBar() {
  const activeAudioNode = useMindMapStore((s) => s.activeAudioNode);
  const setActiveAudioNode = useMindMapStore((s) => s.setActiveAudioNode);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!activeAudioNode) {
      window.speechSynthesis?.cancel();
      setIsPlaying(false);
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const textToSpeak =
        activeAudioNode.audio_summary ||
        `Exploring ${activeAudioNode.title}. ${activeAudioNode.summary}`;

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
    }
  }, [activeAudioNode]);

  if (!activeAudioNode) return null;

  const togglePlayPause = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      } else {
        const textToSpeak =
          activeAudioNode.audio_summary || activeAudioNode.summary;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      }
    }
  };

  const handleClose = () => {
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
    setActiveAudioNode(null);
  };

  return (
    <div className="fixed bottom-24 right-6 z-40 max-w-sm w-full bg-slate-900/95 border border-indigo-500/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl animate-slide-up">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Radio className={`w-4 h-4 ${isPlaying ? 'animate-pulse text-indigo-300' : ''}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                Audio Tour Guide
              </span>
              {isPlaying && (
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <h4 className="text-xs font-bold text-slate-100 truncate">
              {activeAudioNode.title}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={togglePlayPause}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

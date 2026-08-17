'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Volume2, VolumeX, Sparkles, RefreshCw } from 'lucide-react';

interface AudioTourPlayerProps {
  script: string;
  topicTitle: string;
}

export function AudioTourPlayer({ script, topicTitle }: AudioTourPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentSentence, setCurrentSentence] = useState('');
  
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sentencesRef = useRef<string[]>([]);
  const currentSentenceIdxRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    // Reset player state when topic or script changes
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentSentence('');

    if (script) {
      // Split script into clean sentences
      const rawSentences = script
        .replace(/\n+/g, ' ')
        .split(/(?<=[.?!])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
      sentencesRef.current = rawSentences;
      currentSentenceIdxRef.current = 0;
    }
  }, [script, topicTitle]);

  if (!script || !isSupported) return null;

  const playSentenceAtIndex = (idx: number) => {
    if (!synthRef.current || idx >= sentencesRef.current.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      return;
    }

    currentSentenceIdxRef.current = idx;
    const text = sentencesRef.current[idx];
    setCurrentSentence(text);
    setProgress(Math.round(((idx) / sentencesRef.current.length) * 100));

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Pick a natural sounding voice
    const voices = synthRef.current.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))) ||
                         voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (currentSentenceIdxRef.current + 1 < sentencesRef.current.length) {
        playSentenceAtIndex(currentSentenceIdxRef.current + 1);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(100);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('Speech synthesis error:', e);
      }
      setIsPlaying(false);
      setIsPaused(false);
    };

    synthRef.current.speak(utterance);
  };

  const handlePlay = () => {
    if (!synthRef.current) return;

    if (isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    synthRef.current.cancel();
    setIsPlaying(true);
    setIsPaused(false);
    playSentenceAtIndex(0);
  };

  const handlePause = () => {
    if (!synthRef.current) return;
    synthRef.current.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentSentence('');
    currentSentenceIdxRef.current = 0;
  };

  return (
    <div className="border-2 border-black bg-neutral-900 text-white p-4 space-y-3 select-none animate-drop">
      
      {/* Player Header */}
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-white">
          <Volume2 className="w-3.5 h-3.5" />
          <span>AUDIO MONOGRAPH TOUR</span>
        </div>
        <div className="flex items-center gap-2">
          {isPlaying && (
            <div className="flex items-center gap-0.5 h-3">
              <span className="w-0.5 h-2.5 bg-white animate-pulse" />
              <span className="w-0.5 h-3.5 bg-white animate-pulse delay-75" />
              <span className="w-0.5 h-1.5 bg-white animate-pulse delay-150" />
              <span className="w-0.5 h-3 bg-white animate-pulse delay-100" />
            </div>
          )}
          <span>{isPlaying ? 'NARRATING...' : isPaused ? 'PAUSED' : 'AI NARRATION READY'}</span>
        </div>
      </div>

      {/* Spoken sentence display */}
      {currentSentence ? (
        <div className="font-serif italic text-xs text-neutral-200 line-clamp-2 bg-black/40 p-2 border border-neutral-800">
          "{currentSentence}"
        </div>
      ) : (
        <div className="font-serif text-xs text-neutral-400 line-clamp-2">
          Listen to an immersive podcast-style narrative breakdown of {topicTitle}.
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-neutral-800 h-1.5 overflow-hidden">
        <div 
          className="bg-white h-full transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls & Timing */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <button
              onClick={handlePlay}
              className="px-3 py-1.5 bg-white text-black font-mono text-xs uppercase font-bold hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>{isPaused ? 'Resume' : 'Play Audio Story'}</span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="px-3 py-1.5 bg-neutral-200 text-black font-mono text-xs uppercase font-bold hover:bg-white transition-colors flex items-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5 fill-black" />
              <span>Pause</span>
            </button>
          )}

          {(isPlaying || isPaused || progress > 0) && (
            <button
              onClick={handleStop}
              className="p-1.5 border border-neutral-700 text-neutral-400 hover:text-white hover:border-white transition-colors"
              title="Stop Narration"
              aria-label="Stop narration"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="font-mono text-[9px] text-neutral-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-neutral-400" />
          <span>SYNTHESIZED PODCAST SCRIPT</span>
        </div>
      </div>

    </div>
  );
}

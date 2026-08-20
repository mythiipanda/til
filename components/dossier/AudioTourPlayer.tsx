'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Volume2, FastForward } from 'lucide-react';

interface AudioTourPlayerProps {
  script: string;
  topicTitle: string;
}

export function AudioTourPlayer({ script, topicTitle }: AudioTourPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sentencesRef = useRef<string[]>([]);
  const currentSentenceIdxRef = useRef<number>(0);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

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
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentIdx(0);

    if (script) {
      const rawSentences = script
        .replace(/\n+/g, ' ')
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      sentencesRef.current = rawSentences;
      currentSentenceIdxRef.current = 0;
    }
  }, [script, topicTitle]);

  if (!script || !isSupported) return null;

  const playSentenceAtIndex = (idx: number, rate = playbackRate) => {
    if (!synthRef.current || idx >= sentencesRef.current.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      return;
    }

    currentSentenceIdxRef.current = idx;
    setCurrentIdx(idx);
    const text = sentencesRef.current[idx];
    setProgress(Math.round((idx / sentencesRef.current.length) * 100));

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    const voices = synthRef.current.getVoices();
    const englishVoice =
      voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Neural') ||
            v.name.includes('Google') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel') ||
            v.name.includes('Alex'))
      ) || voices.find((v) => v.lang.startsWith('en'));

    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.rate = rate;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (currentSentenceIdxRef.current + 1 < sentencesRef.current.length) {
        playSentenceAtIndex(currentSentenceIdxRef.current + 1, rate);
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
    playSentenceAtIndex(currentIdx || 0);
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
    setCurrentIdx(0);
    currentSentenceIdxRef.current = 0;
  };

  const handleJumpToSentence = (idx: number) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    setIsPlaying(true);
    setIsPaused(false);
    playSentenceAtIndex(idx, playbackRate);
  };

  const toggleRate = () => {
    const nextRate = playbackRate === 1.0 ? 1.25 : playbackRate === 1.25 ? 1.5 : 1.0;
    setPlaybackRate(nextRate);
    if (isPlaying && synthRef.current) {
      synthRef.current.cancel();
      playSentenceAtIndex(currentSentenceIdxRef.current, nextRate);
    }
  };

  const activeSentenceText = sentencesRef.current[currentIdx] || '';

  return (
    <div className="border-2 border-black bg-neutral-900 text-white p-4 space-y-3 select-none animate-drop">
      {/* Player Header */}
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-white">
          <Volume2 className="w-3.5 h-3.5" />
          <span>AUDIO MONOGRAPH</span>
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
          <span>{isPlaying ? 'PLAYING' : isPaused ? 'PAUSED' : 'AUDIO READY'}</span>
        </div>
      </div>

      {/* Karaoke Active Sentence Box */}
      <div className="bg-black/50 p-3 border border-neutral-800 rounded-none space-y-2">
        {activeSentenceText ? (
          <div className="font-serif italic text-sm text-neutral-100 leading-relaxed border-l-2 border-white pl-2.5 transition-all">
            "{activeSentenceText}"
          </div>
        ) : (
          <div className="font-serif text-xs text-neutral-400">
            Audio overview of {topicTitle}.
          </div>
        )}

        {/* Toggle Transcript View */}
        <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80">
          <button
            onClick={() => setShowFullTranscript(!showFullTranscript)}
            className="font-mono text-[9px] text-neutral-400 hover:text-white uppercase tracking-wider transition-colors"
          >
            {showFullTranscript ? 'Hide Interactive Script [-]' : 'View Interactive Script [+]'}
          </button>
          <span className="font-mono text-[9px] text-neutral-500">
            Sentence {Math.min(currentIdx + 1, sentencesRef.current.length)} of {sentencesRef.current.length}
          </span>
        </div>

        {/* Full Karaoke Script Container */}
        {showFullTranscript && (
          <div
            ref={transcriptContainerRef}
            className="max-h-44 overflow-y-auto space-y-1.5 pt-2 pr-1 border-t border-neutral-800 scrollbar-thin scrollbar-thumb-neutral-700"
          >
            {sentencesRef.current.map((sentence, idx) => {
              const isActive = idx === currentIdx && (isPlaying || isPaused);
              const isPast = idx < currentIdx;
              return (
                <p
                  key={idx}
                  onClick={() => handleJumpToSentence(idx)}
                  className={`font-serif text-xs leading-relaxed cursor-pointer p-1.5 transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white font-semibold border-l-2 border-white pl-2'
                      : isPast
                      ? 'text-neutral-500 hover:text-neutral-300'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {sentence}
                </p>
              );
            })}
          </div>
        )}
      </div>

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
              className="px-3 py-2.5 bg-white text-black font-mono text-xs uppercase font-bold hover:bg-neutral-200 transition-colors flex items-center gap-1.5 min-h-[44px]"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>{isPaused ? 'Resume' : 'Play Audio'}</span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="px-3 py-2.5 bg-neutral-200 text-black font-mono text-xs uppercase font-bold hover:bg-white transition-colors flex items-center gap-1.5 min-h-[44px]"
            >
              <Pause className="w-3.5 h-3.5 fill-black" />
              <span>Pause</span>
            </button>
          )}

          {(isPlaying || isPaused || progress > 0) && (
            <button
              onClick={handleStop}
              className="p-2.5 border border-neutral-700 text-neutral-400 hover:text-white hover:border-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Stop Audio"
              aria-label="Stop audio"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Speed Toggle */}
          <button
            onClick={toggleRate}
            className="px-3 py-2 border border-neutral-700 text-neutral-300 font-mono text-[10px] font-bold hover:border-white hover:text-white transition-colors flex items-center gap-1 min-h-[44px]"
            title="Playback Speed"
          >
            <FastForward className="w-3 h-3" />
            <span>{playbackRate}x</span>
          </button>
        </div>

        <div className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">
          <span>AUDIO OVERVIEW</span>
        </div>
      </div>
    </div>
  );
}

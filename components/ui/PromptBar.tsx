'use client';

import React, { useState } from 'react';
import { Search, Sparkles, Dices, Mic, MicOff, ArrowRight } from 'lucide-react';

interface PromptBarProps {
  onSearch: (topic: string, category?: string) => void;
  isGenerating?: boolean;
}

const CURATED_CATEGORIES = [
  { label: 'Epic Wars & Battles', icon: '⚔️', topic: 'Hannibal Crossing the Alps with War Elephants', category: 'Epic Wars & Battles' },
  { label: 'Fascinating History', icon: '📜', topic: 'The Dancing Plague of 1518', category: 'Fascinating History' },
  { label: 'Ancient Inventions', icon: '⚙️', topic: 'The 2,000-Year-Old Antikythera Computer', category: 'Ancient Inventions' },
  { label: 'Space & The Cosmos', icon: '🚀', topic: 'What Happens Inside a Black Hole', category: 'Space & The Cosmos' },
  { label: 'Deep-Sea Enigmas', icon: '🌊', topic: 'The Bloop & Mysterious Ocean Sounds', category: 'Deep-Sea Enigmas' },
];

const RANDOM_TOPICS = [
  'The Emu War: When Australia Went to War Against Birds',
  'Hannibal Crossing the Alps with War Elephants',
  'The Trojan War: Myth vs Archaeological Reality',
  'The 2,000-Year-Old Antikythera Bronze Computer',
  'The Dancing Plague of 1518 in Strasbourg',
  'How the Pyramids of Giza Were Really Built',
  'What Happens at the Bottom of the Mariana Trench',
  'The Real Story of the Library of Alexandria',
];

export function PromptBar({ onSearch, isGenerating }: PromptBarProps) {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isGenerating) return;
    onSearch(query.trim());
  };

  const handleRandomWheel = () => {
    const randomTopic = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
    setQuery(randomTopic);
    onSearch(randomTopic, 'Curiosity Wheel');
  };

  const toggleVoice = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported by your browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        onSearch(transcript);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-3">
      {/* Search Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center w-full bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl transition-all focus-within:ring-2 focus-within:ring-sky-400 focus-within:border-sky-400"
      >
        <div className="pl-4 pr-2 text-slate-400">
          <Search className="w-5 h-5" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything or pick a curiosity (e.g., 'Hannibal with Elephants', 'The Emu War', 'Black Holes')..."
          disabled={isGenerating}
          className="w-full py-3.5 bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none disabled:opacity-50"
        />

        <div className="flex items-center gap-1.5 pr-2.5">
          {/* Voice Input */}
          <button
            type="button"
            onClick={toggleVoice}
            title={isListening ? 'Stop listening' : 'Voice search'}
            className={`p-2 rounded-xl text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors ${
              isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : ''
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Random Curiosity Wheel */}
          <button
            type="button"
            onClick={handleRandomWheel}
            title="Surprise Me (Random Curiosity)"
            disabled={isGenerating}
            className="p-2 rounded-xl text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 transition-all flex items-center gap-1 text-xs font-medium"
          >
            <Dices className="w-4 h-4" />
            <span className="hidden sm:inline">Surprise Me</span>
          </button>

          {/* Submit */}
          <button
            type="submit"
            disabled={!query.trim() || isGenerating}
            className="p-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-all disabled:opacity-40 disabled:hover:bg-sky-500 shadow-md flex items-center justify-center"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Curated Category Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          Popular Topics:
        </span>
        {CURATED_CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            onClick={() => {
              setQuery(cat.topic);
              onSearch(cat.topic, cat.category);
            }}
            disabled={isGenerating}
            className="text-xs px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 hover:border-sky-400/50 text-slate-300 hover:text-sky-300 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

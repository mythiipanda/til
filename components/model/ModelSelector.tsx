'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMindMapStore } from '@/lib/store/useMindMapStore';
import { ChevronDown, Check } from 'lucide-react';

export function ModelSelector({ className = '' }: { className?: string }) {
  const selectedModelId = useMindMapStore((s) => s.selectedModelId);
  const availableModels = useMindMapStore((s) => s.availableModels);
  const setSelectedModelId = useMindMapStore((s) => s.setSelectedModelId);
  const fetchAvailableModels = useMindMapStore((s) => s.fetchAvailableModels);

  const [isOpen, setIsOpen] = useState(false);
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAvailableModels();
  }, [fetchAvailableModels]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeModel = availableModels.find((m) => m.id === selectedModelId) || {
    id: selectedModelId,
    name: selectedModelId.includes(':') ? selectedModelId.split(':')[1] : selectedModelId,
    provider: selectedModelId.includes(':') ? selectedModelId.split(':')[0] : 'cerebras',
    provider_label: selectedModelId.includes('cerebras')
      ? 'Cerebras'
      : selectedModelId.includes('openrouter')
      ? 'OpenRouter'
      : 'Mistral AI',
    model_id: selectedModelId,
    is_free: true,
    is_available: true,
  };

  const filteredModels = availableModels.filter((m) => {
    if (filterProvider === 'all') return true;
    return m.provider.toLowerCase() === filterProvider.toLowerCase();
  });

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1 font-mono text-[10px] uppercase font-bold tracking-wider border-2 border-black hover:bg-black hover:text-white bg-white text-black transition-colors duration-100 select-none"
        title="Select AI model"
      >
        <span className="text-neutral-500 font-normal">MODEL:</span>
        <span className="truncate max-w-[130px] md:max-w-[160px]">
          {activeModel.name}
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-150 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-72 md:w-80 bg-white border-2 border-black shadow-none z-50 divide-y-2 divide-black animate-in fade-in-0 duration-100 select-none">
          {/* Header */}
          <div className="p-2.5 bg-black text-white flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest font-bold">
              AI MODEL
            </span>
            <span className="font-mono text-[9px] text-neutral-400">
              {filteredModels.length} AVAILABLE
            </span>
          </div>

          {/* Provider Filter Tabs */}
          <div className="p-1.5 bg-neutral-50 flex gap-1 border-b-2 border-black">
            {[
              { id: 'all', label: 'All' },
              { id: 'cerebras', label: 'Cerebras' },
              { id: 'mistral', label: 'Mistral' },
              { id: 'openrouter', label: 'OpenRouter' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterProvider(tab.id)}
                className={`flex-1 py-1 font-mono text-[9px] uppercase font-bold tracking-wider transition-colors border ${
                  filterProvider === tab.id
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-neutral-600 border-neutral-300 hover:border-black'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Model Options List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-neutral-200 custom-scrollbar">
            {filteredModels.length === 0 ? (
              <div className="p-4 text-center font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
                No models available
              </div>
            ) : (
              filteredModels.map((m) => {
                const isSelected = m.id === selectedModelId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedModelId(m.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2.5 transition-colors ${
                      isSelected
                        ? 'bg-neutral-100 border-l-4 border-l-black font-bold'
                        : 'hover:bg-neutral-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs text-neutral-950 font-medium truncate">
                        {m.name}
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-wider text-neutral-500 mt-0.5">
                        {m.provider_label}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-black shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

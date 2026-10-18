/**
 * VoxStory AI - Tag Autocomplete & Suggestion Palette (v11.0)
 * Cursor-aware popover for instant expression tag filtering and insertion.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Search, Check, Info } from 'lucide-react';
import { VERIFIED_TAGS } from '../lib/tagCatalog';
import { ExpressionTag } from '../types';

interface TagAutocompleteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTag: (tag: string) => void;
  query?: string;
  position?: { top: number; left: number };
}

export const TagAutocomplete: React.FC<TagAutocompleteProps> = ({
  isOpen,
  onClose,
  onSelectTag,
  query = '',
  position,
}) => {
  const [search, setSearch] = useState(query);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSearch(query);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredTags = VERIFIED_TAGS.filter((t) => {
    const q = search.toLowerCase().replace(/^[<[]+|[>\]]+$/g, '');
    if (!q) return true;
    return (
      t.tag.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredTags.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredTags.length) % Math.max(1, filteredTags.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTags[selectedIndex]) {
        onSelectTag(filteredTags[selectedIndex].tag);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#12141f] border border-[#23273b] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[460px] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="p-3 border-b border-[#1f2233] bg-[#161826] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type tag name (e.g. whispers, excited, pauses)..."
            className="w-full bg-transparent text-xs font-mono text-white placeholder-[#5d637c] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-[#1e2235] text-[10px] font-mono text-[#8e92a8]">
            Esc to close
          </kbd>
        </div>

        {/* Tag List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredTags.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#737891]">
              No matching expression tag. Timbre v3.0 supports 13 verified tags.
            </div>
          ) : (
            filteredTags.map((t, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    onSelectTag(t.tag);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all ${
                    isSelected
                      ? 'bg-purple-600/20 border border-purple-500/40 text-white'
                      : 'hover:bg-[#181a28] border border-transparent text-[#b0b5cc]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="px-2 py-0.5 rounded-md text-xs font-mono font-bold shrink-0"
                      style={{
                        backgroundColor: t.badgeBg,
                        color: t.color,
                        borderColor: t.badgeBorder,
                      }}
                    >
                      {t.tag}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{t.name}</span>
                        <span className="text-[10px] font-normal uppercase text-[#737891]">
                          ({t.category})
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7d8299] truncate">
                        {t.description}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300 shrink-0 ml-2">
                    {t.pacingEffect.split(',')[0]}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-3 py-2 border-t border-[#1f2233] bg-[#0f111a] flex items-center justify-between text-[10px] text-[#6d7289]">
          <span>Use ↑↓ arrows to navigate, Enter to insert</span>
          <span>13 Verified Timbre v3.0 Tags</span>
        </div>
      </div>
    </div>
  );
};

/**
 * VoxStory AI - 13 Expression Tags Drawer / Modal
 */

import React, { useState } from 'react';
import { X, Sparkles, Plus, Check, Info } from 'lucide-react';
import { VERIFIED_TAGS } from '../lib/tagCatalog';
import { ExpressionTag, TagCategory } from '../types';

interface ExpressionPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertTag: (tag: string) => void;
}

export const ExpressionPaletteModal: React.FC<ExpressionPaletteModalProps> = ({
  isOpen,
  onClose,
  onInsertTag,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredTags = selectedCategory === 'all'
    ? VERIFIED_TAGS
    : VERIFIED_TAGS.filter((t) => t.category === selectedCategory);

  const handleInsert = (tag: string) => {
    onInsertTag(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#10121a] border border-[#232738] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#1f2231] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Gnani Timbre v3.0 Audio Tags Palette
              </h3>
              <p className="text-xs text-[#8e92a8]">
                Insert any of the 13 verified expression tags at your cursor position
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e92a8] hover:text-white hover:bg-[#1b1f2e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-5 py-3 border-b border-[#1f2231] bg-[#0c0e15] flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All 13 Tags' },
            { id: 'delivery', label: 'Vocal Delivery' },
            { id: 'reaction', label: 'Reactions' },
            { id: 'pacing', label: 'Pacing & Silence' },
            { id: 'nonverbal', label: 'Non-Verbal Gestures' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-[#151722] text-[#8e92a8] hover:text-white hover:bg-[#1d2030]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Tags Grid */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredTags.map((tag) => (
            <div
              key={tag.id}
              className="p-4 rounded-xl bg-[#141622] border border-[#222638] flex flex-col justify-between hover:border-[#353b52] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-bold text-purple-300">
                    {tag.tag}
                  </span>
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#1c2030] text-[#8e92a8] font-semibold">
                    {tag.category}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-white mb-1">{tag.name}</h4>
                <p className="text-xs text-[#8e92a8] mb-3 leading-relaxed">
                  {tag.description}
                </p>

                <div className="p-2.5 rounded-lg bg-[#0b0c10] border border-[#1d202d] text-xs font-mono text-[#aeb3c8] mb-3">
                  <span className="text-purple-400 font-bold">{tag.tag}</span> {tag.sampleText}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#1d202e]">
                <span className="text-[11px] text-[#71768c] font-mono">
                  {tag.pacingEffect}
                </span>

                <button
                  onClick={() => handleInsert(tag.tag)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-transform active:scale-95"
                >
                  {copiedTag === tag.tag ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Inserted!</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Insert Tag</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-[#1f2231] bg-[#0c0e15] flex items-center justify-between text-xs text-[#8e92a8]">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-purple-400" />
            Tags continue their vocal effect until the next tag in your script.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1a1d29] hover:bg-[#25293a] text-white text-xs font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

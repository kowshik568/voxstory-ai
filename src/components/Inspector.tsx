/**
 * VoxStory AI - Right Inspector Panel (v13.0)
 * Controls voice profile, language, acoustic output quality, and directorial tags.
 * Follows zero-pill metadata discipline and domain-native audio workstation design.
 */

import React from 'react';
import {
  Mic,
  Globe2,
  Sliders,
  FileAudio,
  Sparkles,
  Info,
  ChevronDown,
  User,
  Volume2,
  Check,
} from 'lucide-react';
import { SUPPORTED_VOICES, SUPPORTED_LANGUAGES } from '../lib/voices';
import { TAG_MAP } from '../lib/tagCatalog';
import { SupportedLanguage, AudioContainer, AudioConfig, VoiceProfile } from '../types';

interface InspectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  selectedLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  audioConfig: AudioConfig;
  onAudioConfigChange: (config: AudioConfig) => void;
  detectedTags: string[];
}

export const Inspector: React.FC<InspectorProps> = ({
  selectedVoice,
  onVoiceChange,
  selectedLanguage,
  onLanguageChange,
  audioConfig,
  onAudioConfigChange,
  detectedTags,
}) => {
  const currentVoiceProfile =
    SUPPORTED_VOICES.find((v) => v.name.toLowerCase() === selectedVoice.toLowerCase()) ||
    SUPPORTED_VOICES[0];

  return (
    <div className="w-80 lg:w-96 bg-[#0E1017] flex flex-col h-full overflow-y-auto p-5 space-y-6 shrink-0 border-l border-[#1C1F2E]">
      {/* Panel Header */}
      <div className="pb-3 border-b border-[#1C1F2E]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-violet-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Voice & Direction Inspector
          </h3>
        </div>
        <p className="text-[11px] text-[#8E92A8] mt-0.5">
          Configure model performance and acoustic output
        </p>
      </div>

      {/* 1. Voice Selection */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-[#8E92A8] flex items-center justify-between">
          <span>Voice Actor ({SUPPORTED_VOICES.length} Available)</span>
          <span className="text-[10px] text-violet-400 font-mono font-normal">Timbre v3.0</span>
        </label>

        <div className="relative">
          <select
            value={currentVoiceProfile.name}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="w-full bg-[#131622] border border-[#232738] rounded-xl px-3.5 py-2.5 text-xs font-medium text-white appearance-none focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            {SUPPORTED_VOICES.map((v) => (
              <option key={v.id} value={v.name} className="bg-[#131622] text-white">
                {v.name} ({v.gender} · {v.style})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[#8E92A8] absolute right-3 top-3 pointer-events-none" />
        </div>

        {/* Selected Voice Profile Card */}
        <div className="p-3.5 rounded-xl bg-[#131622] border border-[#222638] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-xs shadow-xs">
                {currentVoiceProfile.name[0]}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">{currentVoiceProfile.name}</h4>
                <div className="flex items-center gap-1.5 text-[10px] text-[#8E92A8] mt-0.5">
                  <span>{currentVoiceProfile.gender}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-violet-300">{currentVoiceProfile.style}</span>
                </div>
              </div>
            </div>
            <span className="text-[10px] text-[#71758C] font-mono">
              {currentVoiceProfile.primaryLanguage}
            </span>
          </div>

          <p className="text-[11px] text-[#A4A9BE] leading-relaxed">
            {currentVoiceProfile.description}
          </p>

          <div className="pt-2 text-[10px] text-[#787D94] border-t border-[#1D2130]">
            <span className="font-semibold text-[#A4A9BE]">Recommended: </span>
            {currentVoiceProfile.recommendedUse}
          </div>
        </div>
      </div>

      {/* 2. Language Selection */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-[#8E92A8] flex items-center justify-between">
          <span>Language (10 Indic + English)</span>
          <Globe2 className="w-3.5 h-3.5 text-[#8E92A8]" />
        </label>

        <div className="relative">
          <select
            value={selectedLanguage}
            onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
            className="w-full bg-[#131622] border border-[#232738] rounded-xl px-3.5 py-2.5 text-xs font-medium text-white appearance-none focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-[#131622] text-white">
                {lang.name} — {lang.nativeName} ({lang.code})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[#8E92A8] absolute right-3 top-3 pointer-events-none" />
        </div>
      </div>

      {/* 3. Audio Container & Master Config */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-[#8E92A8] flex items-center justify-between">
          <span>Audio Output Format</span>
          <FileAudio className="w-3.5 h-3.5 text-[#8E92A8]" />
        </label>

        {/* Format Selector */}
        <div className="p-1 bg-[#12141F] rounded-lg border border-[#1E2130] flex items-center">
          <button
            onClick={() => onAudioConfigChange({ ...audioConfig, container: 'wav' })}
            className="flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors bg-violet-600 text-white shadow-xs"
          >
            16-bit PCM WAV (Broadcast)
          </button>
        </div>

        {/* Sample Rate selection */}
        <div>
          <label className="text-[11px] text-[#8E92A8] block mb-1">
            Sample Rate
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[16000, 24000, 48000].map((rate) => (
              <button
                key={rate}
                onClick={() =>
                  onAudioConfigChange({
                    ...audioConfig,
                    sampleRate: rate as 16000 | 24000 | 48000,
                  })
                }
                className={`py-1.5 px-2 rounded-lg border text-center text-xs font-mono transition-colors ${
                  audioConfig.sampleRate === rate
                    ? 'bg-[#1F2233] border-violet-500 text-violet-300 font-bold'
                    : 'bg-[#131622] border-[#232738] text-[#8E92A8] hover:text-white'
                }`}
              >
                {rate / 1000} kHz
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Active Expression Tags in Current Script */}
      <div className="space-y-2.5 pt-2 border-t border-[#1C1F2E]">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-[#8E92A8] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Active Script Tags ({detectedTags.length})</span>
          </label>
        </div>

        {detectedTags.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-[#131622] border border-[#222638] text-center text-[11px] text-[#71768C]">
            No tags detected in current script. Timbre v3.0 will deliver naturally according to punctuation and syntax.
          </div>
        ) : (
          <div className="space-y-2">
            {detectedTags.map((tagStr) => {
              const tag = TAG_MAP.get(tagStr);
              if (!tag) return null;
              return (
                <div
                  key={tag.id}
                  className="p-2.5 rounded-lg bg-[#12141E] border border-[#202434] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-violet-300">{tag.tag}</span>
                    <span className="text-[10px] text-[#8E92A8] font-mono">
                      {tag.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9FA3B8] leading-tight">
                    {tag.description}
                  </p>
                  <div className="text-[10px] text-violet-400 font-mono">
                    Impact: {tag.pacingEffect}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Director Tips */}
      <div className="p-3.5 rounded-xl bg-[#11131C] border border-[#1F2334] space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
          <Info className="w-3.5 h-3.5" />
          <span>Director’s Pacing Tip</span>
        </div>
        <p className="text-[11px] text-[#9AA0B6] leading-relaxed">
          Pair <code className="text-violet-300 font-mono">&lt;whispers&gt;</code> with a preceding{' '}
          <code className="text-violet-300 font-mono">&lt;pauses&gt;</code> to create cinematic suspense before an emotional revelation.
        </p>
      </div>
    </div>
  );
};

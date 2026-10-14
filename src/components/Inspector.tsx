/**
 * VoxStory AI - Right Inspector Panel
 * Controls voice profile, language, audio container, sample rate, and active tag direction
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
  const currentVoiceProfile = SUPPORTED_VOICES.find(
    (v) => v.name.toLowerCase() === selectedVoice.toLowerCase()
  ) || SUPPORTED_VOICES[0];

  return (
    <div className="w-80 lg:w-96 bg-[#0e1017] flex flex-col h-full overflow-y-auto p-5 space-y-6 shrink-0 border-l border-[#1c1f2e]">
      {/* Panel Header */}
      <div className="pb-3 border-b border-[#1c1f2e]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Voice & Direction Inspector
          </h3>
        </div>
        <p className="text-[11px] text-[#8e92a8] mt-0.5">
          Configure model performance and acoustic output
        </p>
      </div>

      {/* 1. Voice Selection */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-[#8e92a8] flex items-center justify-between">
          <span>Voice Actor ({SUPPORTED_VOICES.length} Available)</span>
          <span className="text-[10px] text-purple-400 font-mono font-normal">Timbre v3.0</span>
        </label>

        <div className="relative">
          <select
            value={currentVoiceProfile.name}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="w-full bg-[#131622] border border-[#232738] rounded-xl px-3.5 py-2.5 text-xs font-medium text-white appearance-none focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            {SUPPORTED_VOICES.map((v) => (
              <option key={v.id} value={v.name} className="bg-[#131622] text-white">
                {v.name} ({v.gender} • {v.style})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[#8e92a8] absolute right-3 top-3 pointer-events-none" />
        </div>

        {/* Selected Voice Profile Card */}
        <div className="p-3.5 rounded-xl bg-[#131622] border border-[#222638] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                {currentVoiceProfile.name[0]}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">{currentVoiceProfile.name}</h4>
                <span className="text-[10px] text-purple-300">{currentVoiceProfile.style}</span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1b1f30] text-[#8e92a8] font-medium">
              {currentVoiceProfile.gender}
            </span>
          </div>

          <p className="text-[11px] text-[#a4a9be] leading-relaxed">
            {currentVoiceProfile.description}
          </p>

          <div className="pt-1 text-[10px] text-[#787d94] border-t border-[#1d2130]">
            <span className="font-semibold text-[#a4a9be]">Recommended:</span> {currentVoiceProfile.recommendedUse}
          </div>
        </div>
      </div>

      {/* 2. Language Selection */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-[#8e92a8] flex items-center justify-between">
          <span>Language (10 Indic + English)</span>
          <Globe2 className="w-3.5 h-3.5 text-[#8e92a8]" />
        </label>

        <div className="relative">
          <select
            value={selectedLanguage}
            onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
            className="w-full bg-[#131622] border border-[#232738] rounded-xl px-3.5 py-2.5 text-xs font-medium text-white appearance-none focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-[#131622] text-white">
                {lang.name} — {lang.nativeName} ({lang.code})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[#8e92a8] absolute right-3 top-3 pointer-events-none" />
        </div>
      </div>

      {/* 3. Audio Container & Master Config */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-[#8e92a8] flex items-center justify-between">
          <span>Audio Container & Quality</span>
          <FileAudio className="w-3.5 h-3.5 text-[#8e92a8]" />
        </label>

        {/* Format radio group */}
        <div className="grid grid-cols-3 gap-2">
          {(['wav', 'mp3', 'ogg'] as AudioContainer[]).map((format) => (
            <button
              key={format}
              onClick={() => onAudioConfigChange({ ...audioConfig, container: format })}
              className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                audioConfig.container === format
                  ? 'bg-purple-600 border-purple-500 text-white font-bold shadow-sm'
                  : 'bg-[#131622] border-[#232738] text-[#8e92a8] hover:text-white hover:border-[#32364a]'
              }`}
            >
              <span className="uppercase text-xs font-mono">{format}</span>
              <span className="block text-[9px] opacity-75 font-sans mt-0.5">
                {format === 'wav' ? 'Lossless' : format === 'mp3' ? 'Web' : 'Opus'}
              </span>
            </button>
          ))}
        </div>

        {/* Sample Rate selection */}
        <div>
          <label className="text-[11px] text-[#8e92a8] block mb-1">
            Sample Rate
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[16000, 24000, 48000].map((rate) => (
              <button
                key={rate}
                onClick={() => onAudioConfigChange({ ...audioConfig, sampleRate: rate as 16000 | 24000 | 48000 })}
                className={`py-1.5 px-2 rounded-lg border text-center text-xs font-mono transition-colors ${
                  audioConfig.sampleRate === rate
                    ? 'bg-[#1f2233] border-purple-500 text-purple-300 font-bold'
                    : 'bg-[#131622] border-[#232738] text-[#8e92a8] hover:text-white'
                }`}
              >
                {rate / 1000} kHz
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Active Expression Tags in Current Script */}
      <div className="space-y-2.5 pt-2 border-t border-[#1c1f2e]">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-[#8e92a8] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Active Script Tags ({detectedTags.length})</span>
          </label>
        </div>

        {detectedTags.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-[#131622] border border-[#222638] text-center text-[11px] text-[#71768c]">
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
                  className="p-2.5 rounded-lg bg-[#12141e] border border-[#202434] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-purple-300">{tag.tag}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-[#1a1d2b] text-[#8e92a8]">
                      {tag.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9fa3b8] leading-tight">
                    {tag.description}
                  </p>
                  <div className="text-[10px] text-purple-400 font-mono">
                    Impact: {tag.pacingEffect}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Director Tips */}
      <div className="p-3.5 rounded-xl bg-[#11131c] border border-[#1f2334] space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
          <Info className="w-3.5 h-3.5" />
          <span>Director’s Pacing Tip</span>
        </div>
        <p className="text-[11px] text-[#9aa0b6] leading-relaxed">
          Pair <code className="text-purple-300 font-mono">&lt;whispers&gt;</code> with a preceding <code className="text-purple-300 font-mono">&lt;pauses&gt;</code> to create cinematic suspense before an emotional revelation.
        </p>
      </div>
    </div>
  );
};

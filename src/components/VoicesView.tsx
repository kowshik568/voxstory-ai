/**
 * VoxStory AI - Voices & Presets Directory (v4.0)
 * Interactive audition gallery of all 10 verified Gnani Timbre v3.0 voice actors.
 * Audition with inline expression tags, filter by gender/style, and assign to Studio.
 */

import React, { useState, useRef } from 'react';
import {
  Radio,
  Play,
  Pause,
  Sliders,
  Sparkles,
  Volume2,
  Check,
  User,
  Tag,
  ArrowRight,
  Globe2,
} from 'lucide-react';
import { SUPPORTED_VOICES, SUPPORTED_LANGUAGES } from '../lib/voices';
import { VoiceProfile, SupportedLanguage } from '../types';
import { generateProceduralSpeechWav } from '../lib/audioGenerator';

interface VoicesViewProps {
  activeVoice: string;
  onSelectVoice: (voiceName: string) => void;
  onOpenInStudio: (voiceName: string) => void;
}

export const VoicesView: React.FC<VoicesViewProps> = ({
  activeVoice,
  onSelectVoice,
  onOpenInStudio,
}) => {
  const [genderFilter, setGenderFilter] = useState<'all' | 'Female' | 'Male'>('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const filteredVoices = SUPPORTED_VOICES.filter((v) => {
    if (genderFilter === 'all') return true;
    return v.gender === genderFilter;
  });

  const handleAuditionVoice = (voice: VoiceProfile) => {
    if (playingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    try {
      // Generate a rich audition speech snippet demonstrating tags
      const auditionText =
        voice.gender === 'Female'
          ? `<whispers> Welcome to VoxStory AI. <laugh> I can deliver subtle whispers, <excited> vibrant excitement, or quiet suspense.`
          : `<tense> The mission has begun. <pauses> Every decision counts. <slow> Listen carefully to what comes next.`;

      const audio = generateProceduralSpeechWav(auditionText, voice.gender, 24000);

      if (audioRef.current) {
        audioRef.current.src = audio.dataUrl;
        audioRef.current.play().catch(console.error);
        setPlayingVoiceId(voice.id);
        audioRef.current.onended = () => setPlayingVoiceId(null);
      }
    } catch (e) {
      console.error('Failed to audition voice:', e);
    }
  };

  return (
    <div className="flex-1 bg-[#0B0C10] overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Hidden audio element */}
      <audio ref={audioRef} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1A1C29] pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Voices & Presets Directory</span>
            <span className="text-xs font-mono text-violet-400 font-normal px-2 py-0.5 rounded bg-violet-950/40 border border-violet-800/40">
              10 Verified Actors
            </span>
          </h1>
          <p className="text-xs text-[#8E92A8] mt-1">
            Audition Timbre v3.0 neural voice actors with full support for 13 directorial expression tags
          </p>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center p-1 bg-[#12141F] rounded-lg border border-[#1E2130]">
          <button
            onClick={() => setGenderFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              genderFilter === 'all'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-[#8E92A8] hover:text-white'
            }`}
          >
            All Voices (10)
          </button>
          <button
            onClick={() => setGenderFilter('Female')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              genderFilter === 'Female'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-[#8E92A8] hover:text-white'
            }`}
          >
            Female ({SUPPORTED_VOICES.filter((v) => v.gender === 'Female').length})
          </button>
          <button
            onClick={() => setGenderFilter('Male')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              genderFilter === 'Male'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-[#8E92A8] hover:text-white'
            }`}
          >
            Male ({SUPPORTED_VOICES.filter((v) => v.gender === 'Male').length})
          </button>
        </div>
      </div>

      {/* Voices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVoices.map((voice) => {
          const isSelected = activeVoice.toLowerCase() === voice.name.toLowerCase();
          const isPlaying = playingVoiceId === voice.id;

          return (
            <div
              key={voice.id}
              className={`rounded-xl border p-5 flex flex-col justify-between transition-all bg-[#10121B] hover:bg-[#141622] hover:border-violet-500/40 ${
                isSelected
                  ? 'border-violet-500/70 shadow-lg shadow-violet-950/20'
                  : 'border-[#1C1F2E]'
              }`}
            >
              <div>
                {/* Top Row: Avatar Initials, Name & Style */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-inner ${
                        voice.gender === 'Female'
                          ? 'bg-gradient-to-tr from-pink-600 to-rose-400 text-white'
                          : 'bg-gradient-to-tr from-violet-600 to-indigo-500 text-white'
                      }`}
                    >
                      {voice.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-white">{voice.name}</h3>
                        {isSelected && (
                          <span className="text-[10px] text-violet-400 font-mono font-medium">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-violet-400 font-medium">
                        {voice.style}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-[#71758C] px-2 py-0.5 rounded bg-[#161824] border border-[#202334]">
                    {voice.gender}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-[#8E92A8] leading-relaxed mb-3">
                  {voice.description}
                </p>

                {/* Recommended Use */}
                <div className="text-[11px] text-[#6A6E85] space-y-1 mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#8E92A8] font-medium">Best For:</span>
                    <span className="text-[#A2A6BC]">{voice.recommendedUse}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#8E92A8] font-medium">Accent:</span>
                    <span className="text-[#A2A6BC]">{voice.accent}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-[#181B27] flex items-center justify-between gap-2">
                {/* Audition Button */}
                <button
                  onClick={() => handleAuditionVoice(voice)}
                  className={`flex-1 h-8 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    isPlaying
                      ? 'bg-violet-600 text-white'
                      : 'bg-[#161826] hover:bg-[#1E2134] text-white border border-[#23273C]'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Stop Audition</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-violet-400" />
                      <span>Audition Sample</span>
                    </>
                  )}
                </button>

                {/* Select / Use in Studio Button */}
                <button
                  onClick={() => {
                    onSelectVoice(voice.name);
                    onOpenInStudio(voice.name);
                  }}
                  className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                    isSelected
                      ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/30'
                      : 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>In Studio</span>
                    </>
                  ) : (
                    <>
                      <span>Use Voice</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

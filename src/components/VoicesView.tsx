/**
 * VoxStory AI - Voice Library & Discovery (v13.0)
 * Responsive gallery of all verified Gnani Timbre v3.0 voice actors.
 * Search, language & gender filtering, favorites persistence, recently used,
 * expressive preview auditioning, and one-click 'Use Voice in Studio'.
 */

import React, { useState, useRef, useEffect } from 'react';
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
  Search,
  Star,
  Clock,
  Heart,
} from 'lucide-react';
import { SUPPORTED_VOICES, SUPPORTED_LANGUAGES } from '../lib/voices';
import { VoiceProfile, SupportedLanguage } from '../types';
import { generateProceduralSpeechWav } from '../lib/audioGenerator';

interface VoicesViewProps {
  activeVoice: string;
  onSelectVoice: (voiceName: string) => void;
  onOpenInStudio: (voiceName: string) => void;
  initialShowFavoritesOnly?: boolean;
}

export const VoicesView: React.FC<VoicesViewProps> = ({
  activeVoice,
  onSelectVoice,
  onOpenInStudio,
  initialShowFavoritesOnly = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'Female' | 'Male'>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(initialShowFavoritesOnly);
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState<string[]>([
    'shivani',
    'avinash',
    'nalini',
    'lakshmi',
    'kalpana',
  ]);
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>(['Shivani', 'Avinash', 'Nalini']);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync favorites from backend
  useEffect(() => {
    fetch('/api/favorites')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setFavoriteVoiceIds(d.data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialShowFavoritesOnly) {
      setFavoritesOnly(true);
    }
  }, [initialShowFavoritesOnly]);

  // Distinct primary voices (avoiding duplicate aliases in discovery gallery)
  const primaryVoices = SUPPORTED_VOICES.filter(
    (v) =>
      !['nalini', 'deepak', 'kaveri', 'aarav', 'ananya', 'rohan'].includes(v.id) ||
      SUPPORTED_VOICES.findIndex((x) => x.name.toLowerCase() === v.name.toLowerCase()) ===
        SUPPORTED_VOICES.indexOf(v)
  );

  const toggleFavorite = async (voice: VoiceProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    const voiceId = voice.id.toLowerCase();
    const isFav = favoriteVoiceIds.includes(voiceId);

    const updated = isFav
      ? favoriteVoiceIds.filter((id) => id !== voiceId)
      : [...favoriteVoiceIds, voiceId];

    setFavoriteVoiceIds(updated);

    try {
      await fetch(`/api/favorites/${voiceId}`, {
        method: isFav ? 'DELETE' : 'POST',
      });
    } catch {
      // rollback if failed
    }
  };

  const handleAuditionVoice = (voice: VoiceProfile) => {
    if (playingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    try {
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

  const handleUseVoice = (voiceName: string) => {
    // track in recently used
    setRecentlyUsed((prev) => [voiceName, ...prev.filter((v) => v !== voiceName)].slice(0, 5));
    onOpenInStudio(voiceName);
  };

  // Filter pipeline
  const filteredVoices = primaryVoices.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.style.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.accent.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGender = genderFilter === 'all' || v.gender === genderFilter;
    const matchesLanguage =
      languageFilter === 'all' ||
      v.primaryLanguage === languageFilter ||
      v.supportedLanguages.includes(languageFilter as any);

    const isFav = favoriteVoiceIds.includes(v.id.toLowerCase());
    const matchesFavorite = !favoritesOnly || isFav;

    return matchesSearch && matchesGender && matchesLanguage && matchesFavorite;
  });

  return (
    <div className="flex-1 bg-[#0B0C10] overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Hidden audio element for preview playback */}
      <audio ref={audioRef} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1A1C29] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              {favoritesOnly ? 'Starred Voices & Favorites' : 'Voice Library & Discovery'}
            </h1>
            <span className="text-xs font-mono text-violet-400 font-normal px-2 py-0.5 rounded bg-violet-950/40 border border-violet-800/40">
              {favoritesOnly
                ? `${filteredVoices.length} Starred`
                : `${primaryVoices.length} Verified Timbre Actors`}
            </span>
          </div>
          <p className="text-xs text-[#8E92A8] mt-1">
            Audition Timbre v3.0 neural voice actors with full support for 13 directorial expression tags
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#6A6E85] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by actor, accent, or style..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 bg-[#11131C] border border-[#202334] rounded-lg pl-9 pr-3 text-xs text-white placeholder-[#60647E] focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#10121B] p-2.5 rounded-xl border border-[#1C1F2E]">
        {/* Gender Segmented Control */}
        <div className="flex items-center p-1 bg-[#141624] rounded-lg border border-[#1E2130]">
          <button
            onClick={() => setGenderFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              genderFilter === 'all'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-[#8E92A8] hover:text-white'
            }`}
          >
            All Genders
          </button>
          <button
            onClick={() => setGenderFilter('Female')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              genderFilter === 'Female'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-[#8E92A8] hover:text-white'
            }`}
          >
            Female
          </button>
          <button
            onClick={() => setGenderFilter('Male')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              genderFilter === 'Male'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-[#8E92A8] hover:text-white'
            }`}
          >
            Male
          </button>
        </div>

        {/* Language Dropdown Selector */}
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-[#6A6E85]" />
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="bg-[#141624] border border-[#1E2130] text-xs text-[#C5C8DB] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-500"
          >
            <option value="all">All Languages</option>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name} ({lang.nativeName})
              </option>
            ))}
          </select>

          {/* Starred Only Toggle */}
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              favoritesOnly
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                : 'bg-[#141624] border-[#1E2130] text-[#8E92A8] hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>Starred Only</span>
          </button>
        </div>
      </div>

      {/* Recently Used Bar (if available) */}
      {!favoritesOnly && recentlyUsed.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-[#71758C]">
          <span className="flex items-center gap-1 font-medium text-[#8E92A8]">
            <Clock className="w-3.5 h-3.5 text-violet-400" />
            <span>Recently Selected:</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {recentlyUsed.map((vName) => (
              <button
                key={vName}
                onClick={() => handleUseVoice(vName)}
                className="px-2 py-0.5 rounded bg-[#131520] hover:bg-[#1C1F30] border border-[#1F2232] text-xs text-[#C5C8DB] hover:text-white transition-colors"
              >
                {vName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voices Grid */}
      {filteredVoices.length === 0 ? (
        <div className="text-center py-20 px-4 border border-dashed border-[#202334] rounded-xl bg-[#0E1017]">
          <Radio className="w-10 h-10 text-[#4E5268] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No voice actors matched your filters</h3>
          <p className="text-xs text-[#71758C] mt-1 max-w-sm mx-auto">
            Try adjusting your search terms, language filter, or toggle off the Starred filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVoices.map((voice) => {
            const isSelected = activeVoice.toLowerCase() === voice.name.toLowerCase();
            const isPlaying = playingVoiceId === voice.id;
            const isFav = favoriteVoiceIds.includes(voice.id.toLowerCase());

            return (
              <div
                key={voice.id}
                className={`rounded-xl border p-5 flex flex-col justify-between transition-all bg-[#10121B] hover:bg-[#141622] hover:border-violet-500/40 relative group ${
                  isSelected
                    ? 'border-violet-500/70 shadow-lg shadow-violet-950/20'
                    : 'border-[#1C1F2E]'
                }`}
              >
                {/* Top Row: Avatar, Name, Accent & Favorite Star */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-violet-950/40 shrink-0">
                        {voice.name[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-white">{voice.name}</h3>
                          {isSelected && (
                            <span className="text-[10px] text-violet-400 font-mono">
                              Active
                            </span>
                          )}
                        </div>
                        {/* Unboxed metadata separator */}
                        <div className="flex items-center gap-1.5 text-[11px] text-[#7E8299] mt-0.5">
                          <span>{voice.gender}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[140px]">{voice.accent}</span>
                        </div>
                      </div>
                    </div>

                    {/* Favorite Star Button */}
                    <button
                      onClick={(e) => toggleFavorite(voice, e)}
                      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      className="p-1.5 rounded-lg text-[#5A5E78] hover:text-amber-400 hover:bg-[#1A1C2C] transition-colors"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          isFav ? 'fill-amber-400 text-amber-400' : 'text-[#6A6E85]'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Vocal Style & Description */}
                  <div className="mb-3">
                    <div className="text-xs font-medium text-violet-300/90">{voice.style}</div>
                    <p className="text-xs text-[#8E92A8] mt-1 line-clamp-2 leading-relaxed">
                      {voice.description}
                    </p>
                  </div>

                  {/* Recommended Use */}
                  <div className="text-[11px] text-[#6A6E85] mb-4">
                    <span className="text-[#8E92A8] font-medium">Best for: </span>
                    <span>{voice.recommendedUse}</span>
                  </div>
                </div>

                {/* Bottom Actions: Audition Sample Button + Use Voice Button */}
                <div className="pt-3 border-t border-[#181A25] flex items-center justify-between gap-2">
                  {/* Audition Trigger */}
                  <button
                    onClick={() => handleAuditionVoice(voice)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                      isPlaying
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#151724] hover:bg-[#1C1F30] text-[#9EA3BC] hover:text-white border border-[#202334]'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Playing</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Audition</span>
                      </>
                    )}
                  </button>

                  {/* Select in Studio Action */}
                  <button
                    onClick={() => handleUseVoice(voice.name)}
                    className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                  >
                    <span>Use Voice</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

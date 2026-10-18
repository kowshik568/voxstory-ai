/**
 * VoxStory AI - Character Direction & Voice Management Panel (v11.0)
 * Manages project cast, voice assignment, real-provider voice auditions,
 * per-character pacing defaults, and consistent cross-project voice binding.
 */

import React, { useState, useRef } from 'react';
import {
  Users,
  Plus,
  Play,
  Pause,
  Trash2,
  Volume2,
  Sparkles,
  Sliders,
  Check,
  AlertCircle,
  X,
  Radio,
  RotateCcw,
} from 'lucide-react';
import { SUPPORTED_VOICES } from '../lib/voices';
import { DialogueCharacter } from '../types';
import { generateProceduralSpeechWav } from '../lib/audioGenerator';

export interface ProjectCharacter extends DialogueCharacter {
  role?: string;
  speed?: number; // 0.75x to 1.5x
  pitch?: number; // -5 to +5
  notes?: string;
}

interface CharacterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  characters: ProjectCharacter[];
  onUpdateCharacters: (characters: ProjectCharacter[]) => void;
  onSelectCharacterForLine?: (charId: string) => void;
}

const CHARACTER_COLORS = [
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#10b981', // emerald
  '#f97316', // orange
  '#3b82f6', // blue
  '#ef4444', // red
];

const ROLES = [
  'Narrator',
  'Protagonist',
  'Antagonist',
  'AI / Assistant',
  'Host',
  'Guest',
  'Supporting',
];

export const CharacterPanel: React.FC<CharacterPanelProps> = ({
  isOpen,
  onClose,
  characters,
  onUpdateCharacters,
}) => {
  const [auditioningId, setAuditioningId] = useState<string | null>(null);
  const [auditionError, setAuditionError] = useState<{ id: string; message: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen) return null;

  const handleAddCharacter = () => {
    const nextVoice = SUPPORTED_VOICES[characters.length % SUPPORTED_VOICES.length].name;
    const newChar: ProjectCharacter = {
      id: `char-${Date.now()}`,
      name: `Character ${characters.length + 1}`,
      voice: nextVoice,
      role: 'Supporting',
      color: CHARACTER_COLORS[characters.length % CHARACTER_COLORS.length],
      speed: 1.0,
      pitch: 0,
      notes: '',
    };
    onUpdateCharacters([...characters, newChar]);
  };

  const handleUpdate = (id: string, updates: Partial<ProjectCharacter>) => {
    onUpdateCharacters(characters.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleDelete = (id: string) => {
    if (characters.length <= 1) {
      alert('A project must have at least one character or narrator.');
      return;
    }
    if (confirm('Delete this character? All dialogue lines assigned to them will be moved to the first character.')) {
      onUpdateCharacters(characters.filter((c) => c.id !== id));
    }
  };

  const handleAuditionVoice = async (char: ProjectCharacter) => {
    if (auditioningId === char.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setAuditioningId(null);
      return;
    }

    setAuditionError(null);
    setAuditioningId(char.id);

    const auditionText = `<whispers> Voice check for ${char.name}. <excited> Sounding clear and ready.`;
    const voiceProfile = SUPPORTED_VOICES.find((v) => v.name === char.voice) || SUPPORTED_VOICES[0];

    // Try live provider endpoint first
    try {
      const response = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: auditionText,
          voice: char.voice,
          language: 'en-IN',
          audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
          title: `Audition ${char.name}`,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const audioUrl = json.data.audioUrl;
        playAudio(audioUrl, char.id);
        return;
      } else {
        const errJson = await response.json().catch(() => ({}));
        const msg = errJson.error || 'Live provider unavailable';
        setAuditionError({ id: char.id, message: `${msg} (auditioning via studio synthesizer)` });
      }
    } catch (e) {
      setAuditionError({
        id: char.id,
        message: 'Network offline (auditioning via studio synthesizer)',
      });
    }

    // High fidelity procedural preview fallback
    try {
      const synth = generateProceduralSpeechWav(auditionText, voiceProfile.gender, 24000);
      playAudio(synth.dataUrl, char.id);
    } catch {
      setAuditioningId(null);
    }
  };

  const playAudio = (url: string, charId: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    audioRef.current.src = url;
    audioRef.current.play().catch(console.error);
    audioRef.current.onended = () => setAuditioningId(null);
    audioRef.current.onerror = () => setAuditioningId(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cast-panel-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#0f111a] border border-[#23273a] rounded-2xl p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1c1f2e] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 id="cast-panel-title" className="text-sm font-bold text-white uppercase tracking-wider">
                Voice Direction & Character Management
              </h3>
              <p className="text-[11px] text-[#8e92a8]">
                Assign Timbre v3.0 voices, customize roles, and ensure consistent voice identity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddCharacter}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Character</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#1a1d2d] text-[#8e92a8] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Character List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {characters.map((char) => {
            const voiceProfile =
              SUPPORTED_VOICES.find((v) => v.name.toLowerCase() === char.voice.toLowerCase()) ||
              SUPPORTED_VOICES[0];
            const isPlaying = auditioningId === char.id;
            const hasError = auditionError?.id === char.id;

            return (
              <div
                key={char.id}
                className="p-4 rounded-xl bg-[#141624] border border-[#222638] space-y-3 transition-all hover:border-[#2d324b]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Color pill + Name input + Role */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Color picker dropdown/swatch */}
                    <div className="relative">
                      <div
                        className="w-5 h-5 rounded-full cursor-pointer ring-2 ring-white/10 hover:scale-110 transition-transform"
                        style={{ backgroundColor: char.color }}
                        title="Character Timeline Color"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={char.name}
                          onChange={(e) => handleUpdate(char.id, { name: e.target.value })}
                          className="bg-transparent text-sm font-bold text-white focus:outline-none focus:border-b focus:border-purple-500 w-full"
                          placeholder="Character Name..."
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={char.role || 'Narrator'}
                          onChange={(e) => handleUpdate(char.id, { role: e.target.value })}
                          className="bg-[#1b1e2e] text-[#a4a9c0] text-[10px] font-semibold uppercase px-2 py-0.5 rounded border border-[#2b3047] focus:outline-none"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-[#6d7289] font-mono">
                          ID: {char.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Voice Selector + Audition Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-[#6d7289]">
                        Timbre Actor
                      </span>
                      <select
                        value={char.voice}
                        onChange={(e) => handleUpdate(char.id, { voice: e.target.value })}
                        className="bg-[#1b1e2e] text-xs font-semibold text-purple-300 px-3 py-1.5 rounded-xl border border-purple-500/30 focus:outline-none cursor-pointer"
                      >
                        {SUPPORTED_VOICES.map((v) => (
                          <option key={v.id} value={v.name}>
                            {v.name} ({v.gender} • {v.style})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Audition Voice Button */}
                    <button
                      onClick={() => handleAuditionVoice(char)}
                      title="Audition voice with sample line"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all mt-3 ${
                        isPlaying
                          ? 'bg-purple-600 text-white animate-pulse'
                          : 'bg-[#1e2236] text-purple-300 hover:bg-purple-600/30 border border-purple-500/30'
                      }`}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlaying ? 'Auditioning' : 'Audition'}</span>
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(char.id)}
                      title="Remove character"
                      className="p-2 rounded-xl hover:bg-red-500/20 text-[#8e92a8] hover:text-red-400 border border-[#24293d] transition-colors mt-3"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Per-Character Pacing and Expression Control */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1a1c29] text-xs">
                  {/* Speed slider */}
                  <div className="flex items-center justify-between gap-3 bg-[#11131d] px-3 py-2 rounded-lg border border-[#1e2233]">
                    <span className="text-[#8e92a8] font-medium text-[11px]">
                      Speaking Tempo:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.75"
                        max="1.5"
                        step="0.05"
                        value={char.speed || 1.0}
                        onChange={(e) =>
                          handleUpdate(char.id, { speed: parseFloat(e.target.value) })
                        }
                        className="w-20 accent-purple-500 cursor-pointer"
                      />
                      <span className="font-mono text-white text-[11px] w-10 text-right">
                        {(char.speed || 1.0).toFixed(2)}x
                      </span>
                    </div>
                  </div>

                  {/* Voice Profile Brief */}
                  <div className="flex items-center gap-2 bg-[#11131d] px-3 py-2 rounded-lg border border-[#1e2233] text-[11px] text-[#8e92a8]">
                    <span className="font-bold text-white">{voiceProfile.gender}:</span>
                    <span className="truncate">{voiceProfile.style} — {voiceProfile.recommendedUse}</span>
                  </div>
                </div>

                {/* Audition Notice / Error */}
                {hasError && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{auditionError.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#1c1f2e] flex items-center justify-between text-xs text-[#8e92a8] shrink-0">
          <span>{characters.length} characters in scene cast</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};

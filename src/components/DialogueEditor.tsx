/**
 * VoxStory AI - Multi-Character Dialogue Scene Studio (v5.0)
 * Precision multi-character timeline, speaker boundaries, inline tag directorship,
 * per-segment isolated regeneration, pause pacing control, and sequential master WAV assembly.
 */

import React, { useState, useRef } from 'react';
import {
  Users,
  Plus,
  Play,
  Pause,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Wand2,
  Sparkles,
  Volume2,
  AlertCircle,
  CheckCircle2,
  Layers,
  Music,
  RefreshCw,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DialogueCharacter,
  DialogueSegment,
  GenerationResult,
  SupportedLanguage,
} from '../types';
import { SUPPORTED_VOICES, SUPPORTED_LANGUAGES, DEFAULT_AUDIO_CONFIG } from '../lib/voices';
import { validateScript } from '../lib/tagCatalog';
import { stitchWavTracks } from '../lib/audioStitcher';

interface DialogueEditorProps {
  onSceneAssembled: (take: GenerationResult) => void;
  isGeneratingMaster: boolean;
  onOpenMixer?: () => void;
  onOpenExport?: () => void;
  hasAssembledTake?: boolean;
  onSwitchToMultitrack?: () => void;
}

const DEFAULT_CHARACTERS: DialogueCharacter[] = [
  { id: 'char-1', name: 'Elena (Commander)', voice: 'Nalini', color: '#ec4899' },
  { id: 'char-2', name: 'Rohan (Operative)', voice: 'Rohan', color: '#8b5cf6' },
  { id: 'char-3', name: 'Nexus (AI Voice)', voice: 'Ananya', color: '#06b6d4' },
];

const DEFAULT_SEGMENTS: DialogueSegment[] = [
  {
    id: 'seg-1',
    characterId: 'char-1',
    characterName: 'Elena (Commander)',
    voice: 'Nalini',
    language: 'en-IN',
    text: '<whispers> Status report. Have we bypassed their automated sentries yet?',
    status: 'idle',
  },
  {
    id: 'seg-2',
    characterId: 'char-2',
    characterName: 'Rohan (Operative)',
    voice: 'Rohan',
    language: 'en-IN',
    text: '<laugh> Barely. Their security protocols were outdated. <slow> But we only have four minutes before the system reboots.',
    status: 'idle',
  },
  {
    id: 'seg-3',
    characterId: 'char-3',
    characterName: 'Nexus (AI Voice)',
    voice: 'Ananya',
    language: 'en-IN',
    text: '<excited> Mainframe connection established! I have downloaded the coordinates.',
    status: 'idle',
  },
  {
    id: 'seg-4',
    characterId: 'char-1',
    characterName: 'Elena (Commander)',
    voice: 'Nalini',
    language: 'en-IN',
    text: '<shouting> Everyone fall back to extraction point Bravo! Move, move, move!',
    status: 'idle',
  },
];

export const DialogueEditor: React.FC<DialogueEditorProps> = ({
  onSceneAssembled,
  isGeneratingMaster,
  onOpenMixer,
  onOpenExport,
  hasAssembledTake,
  onSwitchToMultitrack,
}) => {
  const [sceneTitle, setSceneTitle] = useState('Operation Nightfall — Vault Infiltration');
  const [characters, setCharacters] = useState<DialogueCharacter[]>(DEFAULT_CHARACTERS);
  const [segments, setSegments] = useState<DialogueSegment[]>(DEFAULT_SEGMENTS);
  const [pauseDurationMs, setPauseDurationMs] = useState<number>(350);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [regeneratingSegmentId, setRegeneratingSegmentId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isAssembling, setIsAssembling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const segmentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Character Management
  const handleAddCharacter = () => {
    const nextVoice = SUPPORTED_VOICES[characters.length % SUPPORTED_VOICES.length].name;
    const colors = ['#ec4899', '#8b5cf6', '#06b6d4', '#eab308', '#10b981', '#f97316'];
    const newChar: DialogueCharacter = {
      id: `char-${Date.now()}`,
      name: `Character ${characters.length + 1}`,
      voice: nextVoice,
      color: colors[characters.length % colors.length],
    };
    setCharacters([...characters, newChar]);
  };

  const handleUpdateCharacter = (id: string, name: string, voice: string) => {
    setCharacters(
      characters.map((c) => (c.id === id ? { ...c, name, voice } : c))
    );
    setSegments(
      segments.map((s) => (s.characterId === id ? { ...s, characterName: name, voice } : s))
    );
  };

  const handleDeleteCharacter = (id: string) => {
    if (characters.length <= 1) {
      setStatusMessage('Dialogue scene requires at least one character.');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    setCharacters(characters.filter((c) => c.id !== id));
    const remaining = characters.filter((c) => c.id !== id)[0];
    setSegments(
      segments.map((s) =>
        s.characterId === id
          ? { ...s, characterId: remaining.id, characterName: remaining.name, voice: remaining.voice }
          : s
      )
    );
  };

  // Segment Management
  const handleAddSegment = () => {
    const defaultChar = characters[0];
    const newSeg: DialogueSegment = {
      id: `seg-${Date.now()}`,
      characterId: defaultChar.id,
      characterName: defaultChar.name,
      voice: defaultChar.voice,
      language: 'en-IN',
      text: '<whispers> Enter spoken line here...',
      status: 'idle',
    };
    setSegments([...segments, newSeg]);
  };

  const handleUpdateSegment = (id: string, updates: Partial<DialogueSegment>) => {
    setSegments(segments.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleDuplicateSegment = (seg: DialogueSegment, index: number) => {
    const duplicate: DialogueSegment = {
      ...seg,
      id: `seg-${Date.now()}`,
      status: 'idle',
      audioUrl: undefined,
    };
    const updated = [...segments];
    updated.splice(index + 1, 0, duplicate);
    setSegments(updated);
  };

  const handleDeleteSegment = (id: string) => {
    if (segments.length <= 1) {
      setStatusMessage('Dialogue scene requires at least one dialogue line.');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    setSegments(segments.filter((s) => s.id !== id));
  };

  const handleMoveSegment = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= segments.length) return;
    const updated = [...segments];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSegments(updated);
  };

  const handleInsertTag = (segId: string, tag: string) => {
    setSegments(
      segments.map((s) => {
        if (s.id === segId) {
          return { ...s, text: `${s.text} ${tag} ` };
        }
        return s;
      })
    );
  };

  // Individual segment preview / play / pause
  const handlePreviewSegment = async (seg: DialogueSegment) => {
    if (activePreviewId === seg.id) {
      if (previewAudio) {
        previewAudio.pause();
        setActivePreviewId(null);
      }
      return;
    }

    // If segment already has generated audio, play it immediately
    if (seg.audioUrl) {
      if (previewAudio) previewAudio.pause();
      const audio = new Audio(seg.audioUrl);
      setPreviewAudio(audio);
      setActivePreviewId(seg.id);
      audio.play().catch(console.error);
      audio.onended = () => setActivePreviewId(null);
      return;
    }

    // Otherwise generate and play
    await handleRegenerateSegment(seg);
  };

  // Regenerate an individual dialogue segment in isolation
  const handleRegenerateSegment = async (seg: DialogueSegment) => {
    setRegeneratingSegmentId(seg.id);
    handleUpdateSegment(seg.id, { status: 'generating' });

    try {
      const response = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: seg.text,
          voice: seg.voice,
          language: seg.language || 'en-IN',
          audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
          title: `${seg.characterName} Line`,
        }),
      });

      if (!response.ok) throw new Error('Speech synthesis failed');
      const json = await response.json();
      const take: GenerationResult = json.data;

      handleUpdateSegment(seg.id, {
        status: 'ready',
        audioUrl: take.audioUrl,
        duration: take.durationSeconds,
      });

      if (previewAudio) previewAudio.pause();
      const audio = new Audio(take.audioUrl);
      setPreviewAudio(audio);
      setActivePreviewId(seg.id);
      audio.play().catch(console.error);
      audio.onended = () => setActivePreviewId(null);
    } catch {
      handleUpdateSegment(seg.id, { status: 'error', errorMessage: 'Generation failed' });
    } finally {
      setRegeneratingSegmentId(null);
    }
  };

  // Assemble full multi-character scene
  const handleAssembleScene = async () => {
    setIsAssembling(true);
    setStatusMessage('Synthesizing dialogue lines and concatenating master track...');

    try {
      const response = await fetch('/api/dialogue/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sceneTitle,
          language: 'en-IN',
          segments: segments.map((s) => ({
            id: s.id,
            characterName: s.characterName,
            voice: s.voice,
            language: s.language,
            text: s.text,
          })),
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Assembly endpoint returned error');
      }

      const json = await response.json();
      const assembledTake: GenerationResult = json.data.assembledTake;

      // Update segment duration/urls from response
      if (Array.isArray(json.data.segments)) {
        setSegments((prev) =>
          prev.map((s) => {
            const found = json.data.segments.find((gs: any) => gs.id === s.id);
            if (found) {
              return { ...s, audioUrl: found.audioUrl, duration: found.duration, status: 'ready' };
            }
            return s;
          })
        );
      }

      setStatusMessage('Dialogue scene successfully assembled!');
      onSceneAssembled(assembledTake);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      console.warn('Backend dialogue assembly fallback:', err);
      try {
        const segmentUrls: string[] = [];
        for (const seg of segments) {
          const res = await fetch('/api/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              script: seg.text,
              voice: seg.voice,
              language: seg.language || 'en-IN',
              audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
              title: `${seg.characterName} line`,
            }),
          });
          const d = await res.json();
          segmentUrls.push(d.data.audioUrl);
        }

        const pauseSec = pauseDurationMs / 1000;
        const stitched = await stitchWavTracks(segmentUrls, pauseSec, 24000);

        const fallbackTake: GenerationResult = {
          id: `assembled-${Date.now()}`,
          title: sceneTitle,
          script: segments.map((s) => `${s.characterName}: ${s.text}`).join('\n\n'),
          voice: `Multi-Character (${characters.length} actors)`,
          language: 'en-IN',
          audioConfig: { ...DEFAULT_AUDIO_CONFIG },
          audioUrl: stitched.dataUrl,
          durationSeconds: stitched.durationSeconds,
          wordCount: segments.reduce((acc, s) => acc + s.text.split(/\s+/).length, 0),
          detectedTags: Array.from(new Set(segments.flatMap((s) => s.text.match(/<[^>]+>/g) || []))),
          createdAt: new Date().toISOString(),
          provider: 'studio-demo',
          generationMode: 'procedural-demo',
          isDemo: true,
          fileSizeBytes: stitched.sizeBytes,
        };

        setStatusMessage('Dialogue scene assembled via master stitcher!');
        onSceneAssembled(fallbackTake);
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (clientErr) {
        setStatusMessage(
          `Assembly failed: ${clientErr instanceof Error ? clientErr.message : String(clientErr)}`
        );
      }
    } finally {
      setIsAssembling(false);
    }
  };

  // Scroll to segment
  const scrollToSegment = (segId: string) => {
    const el = segmentRefs.current[segId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Calculate estimated duration for each segment
  const segmentStats = segments.map((seg) => {
    const val = validateScript(seg.text);
    return {
      id: seg.id,
      estDuration: seg.duration || Math.max(1.8, val.estimatedDurationSeconds),
      wordCount: val.wordCount,
      tags: val.detectedTags,
    };
  });
  const totalEstDuration =
    segmentStats.reduce((sum, s) => sum + s.estDuration, 0) +
    ((segments.length - 1) * pauseDurationMs) / 1000;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0c12] overflow-y-auto p-4 lg:p-6 space-y-6">
      {/* 1. Scene Header */}
      <div className="p-4 rounded-2xl bg-[#11131d] border border-[#1e2230] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
              Multi-Character Dialogue Studio
            </span>
          </div>
          <input
            type="text"
            value={sceneTitle}
            onChange={(e) => setSceneTitle(e.target.value)}
            className="w-full bg-transparent text-lg font-bold text-white focus:outline-none focus:border-b focus:border-purple-500"
            placeholder="Scene Title (e.g. Infiltration Briefing)"
          />
        </div>

        {/* Master Assembly & Tools CTA */}
        <div className="flex items-center gap-2.5">
          {statusMessage && (
            <span className="text-xs text-purple-300 font-mono hidden sm:inline">
              {statusMessage}
            </span>
          )}

          {/* Pause Pacing Control */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141622] border border-[#222638] text-xs">
            <Clock className="w-3.5 h-3.5 text-[#8e92a8]" />
            <span className="text-[11px] text-[#8e92a8] hidden sm:inline">Pause:</span>
            <select
              value={pauseDurationMs}
              onChange={(e) => setPauseDurationMs(Number(e.target.value))}
              className="bg-transparent text-purple-300 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value={200} className="bg-[#141622]">200ms</option>
              <option value={350} className="bg-[#141622]">350ms</option>
              <option value={500} className="bg-[#141622]">500ms</option>
              <option value={750} className="bg-[#141622]">750ms</option>
              <option value={1000} className="bg-[#141622]">1000ms</option>
            </select>
          </div>

          {onOpenMixer && (
            <button
              onClick={onOpenMixer}
              title="Open Background Audio Mixer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#181a26] hover:bg-purple-600/20 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition-colors"
            >
              <Music className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mixer</span>
            </button>
          )}

          {onOpenExport && hasAssembledTake && (
            <button
              onClick={onOpenExport}
              title="Export Creator Package (SRT, VTT, Assembled WAV)"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#181a26] hover:bg-indigo-600/20 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          <button
            onClick={handleAssembleScene}
            disabled={isAssembling || isGeneratingMaster}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <Wand2 className={`w-4 h-4 ${isAssembling ? 'animate-spin' : ''}`} />
            <span>{isAssembling ? 'Assembling Master Scene...' : 'Assemble Full Scene WAV'}</span>
          </button>
        </div>
      </div>

      {/* 2. Visual Dialogue Timeline Strip */}
      <div className="p-4 rounded-2xl bg-[#11131d] border border-[#1e2230] space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[#8e92a8]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
            <span>Timeline Visualization ({segments.length} lines · ~{totalEstDuration.toFixed(1)}s)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#6d7288] font-mono">
              {pauseDurationMs}ms gap pacing
            </span>
            {onSwitchToMultitrack && (
              <button
                onClick={onSwitchToMultitrack}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-[11px] font-semibold transition-all"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Open Multitrack DAW</span>
              </button>
            )}
          </div>
        </div>

        {/* Visual blocks */}
        <div className="w-full flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          {segments.map((seg, idx) => {
            const char = characters.find((c) => c.id === seg.characterId) || characters[0];
            const stat = segmentStats[idx];
            const widthPct = Math.max(14, Math.min(35, (stat.estDuration / totalEstDuration) * 100));
            const isPlayingThis = activePreviewId === seg.id;

            return (
              <React.Fragment key={seg.id}>
                <button
                  onClick={() => scrollToSegment(seg.id)}
                  style={{ minWidth: `${widthPct}%`, borderColor: char.color }}
                  title={`#${idx + 1} ${char.name}: ${stat.estDuration.toFixed(1)}s (click to scroll)`}
                  className={`group relative h-10 rounded-xl px-2.5 flex items-center justify-between gap-1.5 border text-left transition-all ${
                    isPlayingThis
                      ? 'bg-purple-600/30 shadow-md ring-1 ring-purple-400'
                      : 'bg-[#151724] hover:bg-[#1b1e2e]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: char.color }}
                    />
                    <span className="text-[11px] font-semibold text-white truncate">
                      {char.name.split(' ')[0]}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8e92a8] shrink-0">
                    {stat.estDuration.toFixed(1)}s
                  </span>
                </button>

                {/* Pause separator */}
                {idx < segments.length - 1 && (
                  <div
                    title={`${pauseDurationMs}ms pause`}
                    className="shrink-0 px-1 py-0.5 rounded bg-[#181a26] text-[9px] font-mono text-[#5f6479] border border-[#222638]"
                  >
                    ⏸
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 3. Cast & Voice Actors Palette */}
      <div className="p-4 rounded-2xl bg-[#11131d] border border-[#1e2230] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#8e92a8]">
            Scene Cast & Voice Actors ({characters.length})
          </h4>
          <button
            onClick={handleAddCharacter}
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Role</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {characters.map((char) => (
            <div
              key={char.id}
              className="p-3 rounded-xl bg-[#141622] border border-[#222638] flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: char.color }}
                />
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={char.name}
                    onChange={(e) => handleUpdateCharacter(char.id, e.target.value, char.voice)}
                    className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                  />
                  <div className="flex items-center gap-1 text-[11px] text-[#8e92a8]">
                    <span>Actor:</span>
                    <select
                      value={char.voice}
                      onChange={(e) => handleUpdateCharacter(char.id, char.name, e.target.value)}
                      className="bg-transparent text-purple-300 font-mono text-[11px] focus:outline-none cursor-pointer"
                    >
                      {SUPPORTED_VOICES.map((v) => (
                        <option key={v.id} value={v.name} className="bg-[#141622] text-white">
                          {v.name} ({v.gender})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDeleteCharacter(char.id)}
                title="Remove Character"
                className="text-[#6d7288] hover:text-red-400 p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Dialogue Script Sequence */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#8e92a8]">
            Dialogue Script Sequence ({segments.length} lines)
          </h4>
          <span className="text-[11px] text-[#787e94]">
            Per-segment regeneration & expression directorship
          </span>
        </div>

        <div className="space-y-3">
          {segments.map((seg, index) => {
            const char = characters.find((c) => c.id === seg.characterId) || characters[0];
            const isPlayingThis = activePreviewId === seg.id;
            const isRegeneratingThis = regeneratingSegmentId === seg.id;

            return (
              <div
                key={seg.id}
                ref={(el) => {
                  segmentRefs.current[seg.id] = el;
                }}
                className="p-4 rounded-xl bg-[#12141e] border border-[#202434] space-y-3 transition-colors hover:border-[#2f354c]"
              >
                {/* Line Header */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: char.color }}
                    />
                    <select
                      value={seg.characterId}
                      onChange={(e) => {
                        const newC = characters.find((c) => c.id === e.target.value);
                        if (newC) {
                          handleUpdateSegment(seg.id, {
                            characterId: newC.id,
                            characterName: newC.name,
                            voice: newC.voice,
                          });
                        }
                      }}
                      className="bg-[#181b2b] text-xs font-bold text-white px-2.5 py-1 rounded-lg border border-[#262b3d] focus:outline-none cursor-pointer"
                    >
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.voice})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] font-mono text-[#8e92a8]">
                      #{index + 1}
                    </span>
                    {seg.duration && (
                      <span className="text-[10px] font-mono text-purple-300 bg-purple-900/30 px-1.5 py-0.5 rounded border border-purple-500/20">
                        {seg.duration.toFixed(1)}s WAV
                      </span>
                    )}
                  </div>

                  {/* Line Actions */}
                  <div className="flex items-center gap-1.5 text-[#8e92a8]">
                    {/* Preview / Play Line Button */}
                    <button
                      onClick={() => handlePreviewSegment(seg)}
                      title="Play or Preview this line"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                        isPlayingThis
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-[#181b2b] hover:bg-[#222638] text-purple-300 border-[#262b3d]'
                      }`}
                    >
                      {isPlayingThis ? (
                        <>
                          <Pause className="w-3 h-3" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 ml-0.5" />
                          <span>{seg.audioUrl ? 'Play Line' : 'Preview'}</span>
                        </>
                      )}
                    </button>

                    {/* Isolated Line Regeneration */}
                    <button
                      onClick={() => handleRegenerateSegment(seg)}
                      disabled={isRegeneratingThis}
                      title="Regenerate this line in isolation"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#181b2b] hover:bg-purple-600/20 text-[#a0a6bd] hover:text-purple-300 border border-[#262b3d] text-xs transition-colors disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isRegeneratingThis ? 'animate-spin text-purple-400' : ''}`}
                      />
                      <span className="hidden sm:inline">Regenerate</span>
                    </button>

                    {/* Move Up / Down */}
                    <button
                      onClick={() => handleMoveSegment(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:text-white disabled:opacity-30"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveSegment(index, 'down')}
                      disabled={index === segments.length - 1}
                      className="p-1 hover:text-white disabled:opacity-30"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Duplicate */}
                    <button
                      onClick={() => handleDuplicateSegment(seg, index)}
                      className="p-1 hover:text-purple-300"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteSegment(seg.id)}
                      className="p-1 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Script Line Textarea */}
                <textarea
                  value={seg.text}
                  onChange={(e) => handleUpdateSegment(seg.id, { text: e.target.value })}
                  rows={2}
                  className="w-full bg-[#0b0c10] border border-[#1b1f2e] rounded-lg p-2.5 text-xs font-mono text-[#e2e5f1] resize-none focus:outline-none focus:border-purple-500"
                />

                {/* Quick expression tag insertion buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono scrollbar-none">
                  <span className="text-[#64697d] mr-1">Tags:</span>
                  {['<whispers>', '<excited>', '<laugh>', '<pauses>', '<slow>', '<shouting>', '<sigh>'].map((t) => (
                    <button
                      key={t}
                      onClick={() => handleInsertTag(seg.id, t)}
                      className="px-1.5 py-0.5 rounded bg-[#161926] hover:bg-purple-600 hover:text-white text-[#9aa0b6] border border-[#232738] transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add line button */}
        <button
          onClick={handleAddSegment}
          className="w-full py-3 rounded-xl border border-dashed border-[#282d3f] hover:border-purple-500/60 text-xs font-semibold text-[#8e92a8] hover:text-purple-300 flex items-center justify-center gap-2 transition-colors bg-[#0e1017]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Dialogue Line</span>
        </button>
      </div>
    </div>
  );
};

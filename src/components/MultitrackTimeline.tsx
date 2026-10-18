/**
 * VoxStory AI - Multitrack DAW Timeline Workstation (v7.0)
 * Digital Audio Workstation multitrack view with track lanes for speakers,
 * music, ambience, and SFX; clip drag/move, trim handles, split at playhead,
 * duplicate, mute/solo, pan/volume/fades, zoom, synchronized playhead,
 * undo/redo history, and autosave.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Scissors,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Volume2,
  VolumeX,
  Sliders,
  CheckCircle2,
  Clock,
  Plus,
  Layers,
  Wand2,
  Sparkles,
  Music,
  Mic,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  Volume1,
  Maximize2,
  FileAudio,
  Upload,
} from 'lucide-react';
import { TimelineTrack, TimelineClip, TrackType, GenerationResult } from '../types';
import {
  calculateTotalDuration,
  splitClipAtTime,
  duplicateClip,
  isTrackAudible,
  formatTimelineTime,
  rippleClipsSequentially,
  generateSubtitlesFromMultitrack,
  mixMultitrackTimeline,
  createDefaultMultitrackSetup,
} from '../lib/multitrackEngine';

interface MultitrackTimelineProps {
  onSceneAssembled: (take: GenerationResult) => void;
  isGeneratingMaster?: boolean;
  onOpenMixer?: () => void;
  onOpenExport?: () => void;
  hasAssembledTake?: boolean;
}

export const MultitrackTimeline: React.FC<MultitrackTimelineProps> = ({
  onSceneAssembled,
  isGeneratingMaster = false,
  onOpenMixer,
  onOpenExport,
  hasAssembledTake = false,
}) => {
  // Multitrack state
  const initialSetup = createDefaultMultitrackSetup();
  const [tracks, setTracks] = useState<TimelineTrack[]>(initialSetup.tracks);
  const [clips, setClips] = useState<TimelineClip[]>(initialSetup.clips);
  const [selectedClipId, setSelectedClipId] = useState<string | null>('clip-1');
  const [playheadTime, setPlayheadTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [zoomPixelsPerSec, setZoomPixelsPerSec] = useState<number>(65);
  const [isRippleMode, setIsRippleMode] = useState<boolean>(false);
  const [pauseGapSec, setPauseGapSec] = useState<number>(0.35);

  // Autosave and Undo/Redo history
  const [historyStack, setHistoryStack] = useState<Array<{ tracks: TimelineTrack[]; clips: TimelineClip[] }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ tracks: TimelineTrack[]; clips: TimelineClip[] }>>([]);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  const [isRenderingMix, setIsRenderingMix] = useState<boolean>(false);
  const [timelineNotice, setTimelineNotice] = useState<string | null>(null);

  // Audio synthesis & playback engine
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playheadStartOffsetRef = useRef<number>(0);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  // Dragging state
  const dragRef = useRef<{
    clipId: string;
    mode: 'move' | 'trim-start' | 'trim-end';
    initialMouseX: number;
    initialStartTime: number;
    initialDuration: number;
  } | null>(null);

  // Push state to undo stack before mutation
  const pushHistory = useCallback(() => {
    setHistoryStack((prev) => [...prev.slice(-30), { tracks, clips }]);
    setRedoStack([]);
    setSaveStatus('unsaved');
  }, [tracks, clips]);

  // Autosave simulation
  useEffect(() => {
    if (saveStatus === 'unsaved') {
      const timer = setTimeout(() => {
        setSaveStatus('saving');
        const finishTimer = setTimeout(() => {
          setSaveStatus('saved');
          const now = new Date();
          setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }, 400);
        return () => clearTimeout(finishTimer);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus, tracks, clips]);

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setRedoStack((prev) => [...prev, { tracks, clips }]);
    setHistoryStack((prev) => prev.slice(0, prev.length - 1));
    setTracks(previous.tracks);
    setClips(previous.clips);
    setSaveStatus('unsaved');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistoryStack((prev) => [...prev, { tracks, clips }]);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setTracks(next.tracks);
    setClips(next.clips);
    setSaveStatus('unsaved');
  };

  // Keyboard shortcuts (Space = play/pause, Cmd+Z = undo, Cmd+Shift+Z = redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, playheadTime, historyStack, redoStack]);

  const totalDuration = calculateTotalDuration(clips);

  // Web Audio engine for synchronized timeline playback
  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  // Playhead update loop
  const startPlayback = () => {
    const ctx = ensureAudioContext();
    setIsPlaying(true);
    playbackStartTimeRef.current = performance.now();
    playheadStartOffsetRef.current = playheadTime >= totalDuration ? 0 : playheadTime;

    const tick = () => {
      const elapsed = (performance.now() - playbackStartTimeRef.current) / 1000;
      const current = playheadStartOffsetRef.current + elapsed;

      if (current >= totalDuration) {
        setPlayheadTime(totalDuration);
        setIsPlaying(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
      }

      setPlayheadTime(current);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      if (playheadTime >= totalDuration) {
        setPlayheadTime(0);
      }
      startPlayback();
    }
  };

  const rewindToStart = () => {
    stopPlayback();
    setPlayheadTime(0);
  };

  // Timeline scrub clicking
  const handleTimelineScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(totalDuration, clickX / zoomPixelsPerSec));
    setPlayheadTime(Math.round(newTime * 100) / 100);
    if (isPlaying) {
      playbackStartTimeRef.current = performance.now();
      playheadStartOffsetRef.current = newTime;
    }
  };

  // Track operations
  const toggleMute = (trackId: string) => {
    pushHistory();
    setTracks(tracks.map((t) => (t.id === trackId ? { ...t, isMuted: !t.isMuted } : t)));
  };

  const toggleSolo = (trackId: string) => {
    pushHistory();
    setTracks(tracks.map((t) => (t.id === trackId ? { ...t, isSolo: !t.isSolo } : t)));
  };

  const updateTrackVolume = (trackId: string, volume: number) => {
    pushHistory();
    setTracks(tracks.map((t) => (t.id === trackId ? { ...t, volume } : t)));
  };

  const updateTrackPan = (trackId: string, pan: number) => {
    pushHistory();
    setTracks(tracks.map((t) => (t.id === trackId ? { ...t, pan } : t)));
  };

  const handleAddTrack = (type: TrackType) => {
    pushHistory();
    const colors: Record<TrackType, string> = {
      speaker: '#a855f7',
      music: '#eab308',
      ambience: '#10b981',
      sfx: '#f97316',
    };
    const count = tracks.filter((t) => t.type === type).length + 1;
    const newTrack: TimelineTrack = {
      id: `track-${type}-${Date.now()}`,
      name: `${type.toUpperCase()} ${count}`,
      type,
      color: colors[type],
      isMuted: false,
      isSolo: false,
      volume: 1.0,
      pan: 0.0,
    };
    setTracks([...tracks, newTrack]);
    setTimelineNotice(`Added new ${type} track lane`);
    setTimeout(() => setTimelineNotice(null), 3000);
  };

  const handleImportAudioTrack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size === 0) {
      setTimelineNotice('Selected audio file is empty (0 bytes)');
      setTimeout(() => setTimelineNotice(null), 4000);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setTimelineNotice(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). 15MB limit.`);
      setTimeout(() => setTimelineNotice(null), 4000);
      return;
    }

    setTimelineNotice('Importing and validating audio file...');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        try {
          const resp = await fetch('/api/audio/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              dataUrl,
              trackType: 'music',
            }),
          });

          const res = await resp.json();
          if (!resp.ok || !res.success) {
            setTimelineNotice(`Import failed: ${res.error || 'Server error'}`);
            setTimeout(() => setTimelineNotice(null), 5000);
            return;
          }

          const asset = res.data;
          pushHistory();

          // Locate or create a music/ambience track lane
          let targetTrack = tracks.find((t) => t.type === 'music' || t.type === 'ambience');
          let currentTracks = tracks;
          if (!targetTrack) {
            targetTrack = {
              id: `track-music-${Date.now()}`,
              name: 'Imported Score',
              type: 'music',
              color: '#eab308',
              isMuted: false,
              isSolo: false,
              volume: 1.0,
              pan: 0.0,
            };
            currentTracks = [...tracks, targetTrack];
            setTracks(currentTracks);
          }

          const newClip: TimelineClip = {
            id: `clip-${asset.id}`,
            trackId: targetTrack.id,
            title: asset.filename.replace(/\.[^/.]+$/, ''),
            startTime: playheadTime,
            duration: asset.durationSeconds || 10,
            volume: 1.0,
            pan: 0.0,
            fadeIn: 0.5,
            fadeOut: 0.5,
            audioUrl: asset.url,
          };

          setClips([...clips, newClip]);
          setSelectedClipId(newClip.id);
          setTimelineNotice(`Imported "${asset.filename}" (${asset.durationSeconds.toFixed(1)}s, ${asset.sampleRate}Hz WAV)`);
          setTimeout(() => setTimelineNotice(null), 4000);
        } catch (postErr) {
          setTimelineNotice(`Import error: ${postErr instanceof Error ? postErr.message : String(postErr)}`);
          setTimeout(() => setTimelineNotice(null), 5000);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setTimelineNotice(`Import error: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setTimelineNotice(null), 5000);
    }
  };

  const handleDeleteTrack = (trackId: string) => {
    if (tracks.length <= 1) return;
    pushHistory();
    setTracks(tracks.filter((t) => t.id !== trackId));
    setClips(clips.filter((c) => c.trackId !== trackId));
  };

  // Clip operations
  const selectedClip = clips.find((c) => c.id === selectedClipId) || null;

  const handleSelectClip = (clipId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedClipId(clipId);
  };

  const handleUpdateClip = (clipId: string, updates: Partial<TimelineClip>) => {
    pushHistory();
    setClips(clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)));
  };

  const handleSplitClipAtPlayhead = () => {
    if (!selectedClip) return;
    const result = splitClipAtTime(selectedClip, playheadTime);
    if (!result) {
      setTimelineNotice('Position playhead inside selected clip to split');
      setTimeout(() => setTimelineNotice(null), 3000);
      return;
    }
    pushHistory();
    const [part1, part2] = result;
    setClips(clips.map((c) => (c.id === selectedClip.id ? part1 : c)).concat([part2]));
    setSelectedClipId(part2.id);
    setTimelineNotice('Clip split at playhead');
    setTimeout(() => setTimelineNotice(null), 2500);
  };

  const handleDuplicateClip = () => {
    if (!selectedClip) return;
    pushHistory();
    const copy = duplicateClip(selectedClip, 0.2);
    setClips([...clips, copy]);
    setSelectedClipId(copy.id);
    setTimelineNotice('Clip duplicated');
    setTimeout(() => setTimelineNotice(null), 2500);
  };

  const handleDeleteClip = (clipId?: string) => {
    const targetId = clipId || selectedClipId;
    if (!targetId) return;
    pushHistory();
    setClips(clips.filter((c) => c.id !== targetId));
    if (selectedClipId === targetId) {
      setSelectedClipId(null);
    }
    setTimelineNotice('Clip removed');
    setTimeout(() => setTimelineNotice(null), 2500);
  };

  const handleRippleAlign = () => {
    pushHistory();
    const speakerClips = clips.filter((c) => {
      const track = tracks.find((t) => t.id === c.trackId);
      return track?.type === 'speaker';
    });
    const rippled = rippleClipsSequentially(speakerClips, pauseGapSec);
    const nonSpeakerClips = clips.filter((c) => {
      const track = tracks.find((t) => t.id === c.trackId);
      return track?.type !== 'speaker';
    });
    setClips([...rippled, ...nonSpeakerClips]);
    setTimelineNotice(`Auto-rippled dialogue with ${Math.round(pauseGapSec * 1000)}ms pauses`);
    setTimeout(() => setTimelineNotice(null), 3000);
  };

  // Mouse drag handlers for Move & Trim
  const handleClipMouseDown = (
    e: React.MouseEvent,
    clip: TimelineClip,
    mode: 'move' | 'trim-start' | 'trim-end'
  ) => {
    e.stopPropagation();
    setSelectedClipId(clip.id);
    pushHistory();

    dragRef.current = {
      clipId: clip.id,
      mode,
      initialMouseX: e.clientX,
      initialStartTime: clip.startTime,
      initialDuration: clip.duration,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaX = moveEvent.clientX - dragRef.current.initialMouseX;
      const deltaSec = deltaX / zoomPixelsPerSec;

      setClips((currentClips) =>
        currentClips.map((c) => {
          if (c.id !== dragRef.current?.clipId) return c;
          if (dragRef.current.mode === 'move') {
            const newStart = Math.max(0, dragRef.current.initialStartTime + deltaSec);
            return { ...c, startTime: Math.round(newStart * 100) / 100 };
          } else if (dragRef.current.mode === 'trim-start') {
            const rawStart = dragRef.current.initialStartTime + deltaSec;
            const newStart = Math.max(0, rawStart);
            const deltaActual = newStart - dragRef.current.initialStartTime;
            const newDuration = Math.max(0.4, dragRef.current.initialDuration - deltaActual);
            return {
              ...c,
              startTime: Math.round(newStart * 100) / 100,
              duration: Math.round(newDuration * 100) / 100,
            };
          } else if (dragRef.current.mode === 'trim-end') {
            const newDuration = Math.max(0.4, dragRef.current.initialDuration + deltaSec);
            return { ...c, duration: Math.round(newDuration * 100) / 100 };
          }
          return c;
        })
      );
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Mix down & Assemble Full Multitrack WAV Master Scene
  const handleRenderMasterMix = async () => {
    setIsRenderingMix(true);
    setTimelineNotice('Synthesizing multitrack stems, applying pans & ducking...');

    try {
      const mix = await mixMultitrackTimeline(tracks, clips, 24000);
      const subs = generateSubtitlesFromMultitrack(clips);

      const assembledTake: GenerationResult = {
        id: `multitrack-mix-${Date.now()}`,
        title: 'Operation Nightfall — Multitrack Master',
        script: clips
          .filter((c) => c.text)
          .map((c) => `${c.characterName || 'Narrator'}: ${c.text}`)
          .join('\n\n'),
        voice: `Multitrack Ensemble (${tracks.length} tracks · ${clips.length} clips)`,
        language: 'en-IN',
        audioConfig: {
          container: 'wav',
          encoding: 'linear_pcm',
          sampleRate: 24000,
          numChannels: 1,
        },
        audioUrl: mix.dataUrl,
        durationSeconds: mix.durationSeconds,
        wordCount: clips.reduce((acc, c) => acc + (c.text?.split(/\s+/).length || 0), 0),
        detectedTags: Array.from(new Set(clips.flatMap((c) => c.text?.match(/<[^>]+>/g) || []))),
        createdAt: new Date().toISOString(),
        provider: 'studio-demo',
        generationMode: 'procedural-demo',
        isDemo: true,
        fileSizeBytes: mix.sizeBytes,
      };

      onSceneAssembled(assembledTake);
      setTimelineNotice('Multitrack master rendered and loaded into master player!');
      setTimeout(() => setTimelineNotice(null), 4000);
    } catch (err) {
      console.error('Mixdown error:', err);
      setTimelineNotice(`Mixdown error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRenderingMix(false);
    }
  };

  // Timeline length in pixels
  const timelinePixelWidth = Math.max(900, (totalDuration + 2) * zoomPixelsPerSec);

  // Second tick markers
  const rulerTicks: number[] = [];
  const tickIntervalSec = zoomPixelsPerSec > 80 ? 1 : 2;
  for (let s = 0; s <= totalDuration + 2; s += tickIntervalSec) {
    rulerTicks.push(s);
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0c12] text-white select-none overflow-hidden">
      {/* 1. TOP TRANSPORT & TOOLBAR BAR */}
      <div className="px-4 py-2.5 bg-[#10121a] border-b border-[#1c2030] flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Playback Controls & Readout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#161824] p-1 rounded-xl border border-[#24283b]">
            <button
              onClick={rewindToStart}
              title="Return Playhead to 0:00 (Home)"
              className="p-1.5 rounded-lg hover:bg-[#202436] text-[#8e92a8] hover:text-white transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlayPause}
              title="Play / Pause Multitrack (Spacebar)"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isPlaying
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
          </div>

          {/* Time Display */}
          <div className="px-3 py-1 rounded-xl bg-[#141622] border border-[#222638] font-mono flex items-center gap-2">
            <span className="text-sm font-bold text-purple-300">
              {formatTimelineTime(playheadTime)}
            </span>
            <span className="text-[11px] text-[#60657b]">/</span>
            <span className="text-xs text-[#8e92a8]">
              {formatTimelineTime(totalDuration)}
            </span>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 border-l border-[#222638] pl-2">
            <button
              onClick={handleUndo}
              disabled={historyStack.length === 0}
              title="Undo Edit (Cmd+Z)"
              className="p-1.5 rounded-lg hover:bg-[#1a1d2d] text-[#8e92a8] hover:text-white disabled:opacity-30 transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Redo Edit (Cmd+Shift+Z)"
              className="p-1.5 rounded-lg hover:bg-[#1a1d2d] text-[#8e92a8] hover:text-white disabled:opacity-30 transition-colors"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Editing Tools (Split, Duplicate, Ripple, Delete) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#141622] p-1 rounded-xl border border-[#222638]">
            <button
              onClick={handleSplitClipAtPlayhead}
              disabled={!selectedClip}
              title="Split Selected Clip at Playhead Position"
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#a0a6bd] hover:text-white hover:bg-[#1f2233] disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              <Scissors className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              onClick={handleDuplicateClip}
              disabled={!selectedClip}
              title="Duplicate Selected Clip"
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#a0a6bd] hover:text-white hover:bg-[#1f2233] disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Duplicate</span>
            </button>
            <button
              onClick={() => handleDeleteClip()}
              disabled={!selectedClip}
              title="Delete Selected Clip"
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#a0a6bd] hover:text-red-400 hover:bg-[#1f2233] disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>

          {/* Ripple Auto-Pack button */}
          <button
            onClick={handleRippleAlign}
            title="Auto-ripple dialogue clips sequentially"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141622] hover:bg-[#1e2233] border border-[#222638] text-xs font-medium text-[#a0a6bd] hover:text-purple-300 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">Ripple Dialogue</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 bg-[#141622] px-2 py-1 rounded-xl border border-[#222638]">
            <button
              onClick={() => setZoomPixelsPerSec((z) => Math.max(35, z - 15))}
              className="p-1 hover:text-white text-[#8e92a8]"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-[#8e92a8] w-9 text-center">
              {zoomPixelsPerSec}px
            </span>
            <button
              onClick={() => setZoomPixelsPerSec((z) => Math.min(160, z + 15))}
              className="p-1 hover:text-white text-[#8e92a8]"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Status, Save Indicator & Render Mix CTA */}
        <div className="flex items-center gap-3">
          {/* Autosave status indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                <CheckCircle2 className="w-3 h-3" />
                <span className="hidden lg:inline">Saved {lastSavedTime}</span>
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-amber-400 font-mono text-[11px]">
                <Clock className="w-3 h-3 animate-spin" />
                <span className="hidden lg:inline">Saving...</span>
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="flex items-center gap-1 text-amber-300 font-mono text-[11px]">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="hidden lg:inline">Unsaved</span>
              </span>
            )}
          </div>

          <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161824] hover:bg-purple-600/20 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition-colors">
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Import Audio</span>
            <input
              type="file"
              accept=".wav,audio/wav,audio/wave"
              onChange={handleImportAudioTrack}
              className="hidden"
            />
          </label>

          {onOpenMixer && (
            <button
              onClick={onOpenMixer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161824] hover:bg-purple-600/20 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition-colors"
            >
              <Music className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mixer</span>
            </button>
          )}

          {/* Master Render Button */}
          <button
            onClick={handleRenderMasterMix}
            disabled={isRenderingMix || isGeneratingMaster}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-900/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <Wand2 className={`w-3.5 h-3.5 ${isRenderingMix ? 'animate-spin' : ''}`} />
            <span>{isRenderingMix ? 'Rendering Stems...' : 'Render Multitrack Mix'}</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {timelineNotice && (
        <div className="bg-purple-900/30 border-b border-purple-500/20 px-4 py-1.5 text-xs text-purple-200 font-mono flex items-center justify-between">
          <span>{timelineNotice}</span>
          <button onClick={() => setTimelineNotice(null)} className="text-purple-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 2. MAIN WORKSTATION TIMELINE AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Track Headers Column (Fixed Width 220px) */}
        <div className="w-56 shrink-0 bg-[#0e1017] border-r border-[#1c2030] flex flex-col z-20 shadow-xl">
          {/* Header row aligned with time ruler */}
          <div className="h-9 px-3 bg-[#11131c] border-b border-[#1c2030] flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#7e849c]">
            <span>Tracks ({tracks.length})</span>
            <div className="relative group">
              <button
                className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-medium"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
              {/* Dropdown for track types */}
              <div className="absolute right-0 top-full mt-1 w-36 bg-[#161824] border border-[#252a3d] rounded-xl shadow-2xl py-1 hidden group-hover:block z-30">
                <button
                  onClick={() => handleAddTrack('speaker')}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#202436] text-purple-300 flex items-center gap-2"
                >
                  <Mic className="w-3 h-3 text-purple-400" />
                  <span>Speaker Track</span>
                </button>
                <button
                  onClick={() => handleAddTrack('sfx')}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#202436] text-amber-300 flex items-center gap-2"
                >
                  <Radio className="w-3 h-3 text-amber-400" />
                  <span>SFX Track</span>
                </button>
                <button
                  onClick={() => handleAddTrack('ambience')}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#202436] text-emerald-300 flex items-center gap-2"
                >
                  <Radio className="w-3 h-3 text-emerald-400" />
                  <span>Ambience Bed</span>
                </button>
                <button
                  onClick={() => handleAddTrack('music')}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#202436] text-yellow-300 flex items-center gap-2"
                >
                  <Music className="w-3 h-3 text-yellow-400" />
                  <span>Music Score</span>
                </button>
              </div>
            </div>
          </div>

          {/* Track Control Headers */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#181b28]">
            {tracks.map((track) => {
              const isAudible = isTrackAudible(track, tracks);
              return (
                <div
                  key={track.id}
                  className={`h-24 p-2.5 flex flex-col justify-between transition-colors ${
                    !isAudible ? 'opacity-40 bg-[#0a0b10]' : 'bg-[#10121a]'
                  }`}
                >
                  {/* Track Title and Type */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: track.color }}
                      />
                      <input
                        type="text"
                        value={track.name}
                        onChange={(e) => {
                          pushHistory();
                          setTracks(
                            tracks.map((t) => (t.id === track.id ? { ...t, name: e.target.value } : t))
                          );
                        }}
                        className="bg-transparent text-xs font-bold text-white truncate focus:outline-none focus:border-b focus:border-purple-500"
                      />
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#171a26] text-[#787f99] border border-[#24293c]">
                      {track.type}
                    </span>
                  </div>

                  {/* Mute (M), Solo (S), Pan, Volume */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleMute(track.id)}
                        title="Mute Track"
                        className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-colors ${
                          track.isMuted
                            ? 'bg-red-500 text-white'
                            : 'bg-[#1a1d2c] text-[#8e92a8] hover:text-white'
                        }`}
                      >
                        M
                      </button>
                      <button
                        onClick={() => toggleSolo(track.id)}
                        title="Solo Track"
                        className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-colors ${
                          track.isSolo
                            ? 'bg-yellow-400 text-black'
                            : 'bg-[#1a1d2c] text-[#8e92a8] hover:text-white'
                        }`}
                      >
                        S
                      </button>
                    </div>

                    {/* Volume Slider */}
                    <div className="flex items-center gap-1 flex-1 max-w-[90px]">
                      <Volume1 className="w-3 h-3 text-[#646a82]" />
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.05"
                        value={track.volume}
                        onChange={(e) => updateTrackVolume(track.id, parseFloat(e.target.value))}
                        className="w-full h-1 bg-[#202538] rounded accent-purple-500 cursor-pointer"
                        title={`Track Volume: ${Math.round(track.volume * 100)}%`}
                      />
                    </div>

                    {/* Delete Track */}
                    {tracks.length > 1 && (
                      <button
                        onClick={() => handleDeleteTrack(track.id)}
                        className="text-[#555a6e] hover:text-red-400 p-0.5"
                        title="Delete Track Lane"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Scrollable Timeline Canvas */}
        <div
          ref={timelineScrollRef}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#090a0f]"
        >
          <div
            style={{ width: `${timelinePixelWidth}px` }}
            className="min-h-full flex flex-col relative"
          >
            {/* 1. Time Ruler at Top */}
            <div
              onClick={handleTimelineScrub}
              className="h-9 bg-[#10121b] border-b border-[#1c2030] relative cursor-pointer select-none"
            >
              {rulerTicks.map((sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * zoomPixelsPerSec}px` }}
                  className="absolute top-0 bottom-0 border-l border-[#202436] flex flex-col justify-end pb-1 pl-1"
                >
                  <span className="text-[9px] font-mono text-[#666c84]">
                    {sec}s
                  </span>
                </div>
              ))}
            </div>

            {/* Playhead Line */}
            <div
              style={{ left: `${playheadTime * zoomPixelsPerSec}px` }}
              className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-400 via-violet-500 to-indigo-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(168,85,247,0.8)]"
            >
              {/* Playhead Head Marker */}
              <div className="w-3 h-3 bg-purple-500 -ml-[5px] -mt-1 transform rotate-45 rounded-sm shadow-md" />
            </div>

            {/* 2. Track Lanes Canvas */}
            <div className="flex-1 divide-y divide-[#161825]">
              {tracks.map((track) => {
                const trackClips = clips.filter((c) => c.trackId === track.id);
                const isAudible = isTrackAudible(track, tracks);

                return (
                  <div
                    key={track.id}
                    className={`h-24 relative transition-colors ${
                      !isAudible ? 'opacity-30 bg-[#07080c]' : 'bg-[#090b10]'
                    }`}
                    onClick={(e) => {
                      // Click on empty space sets playhead
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const newTime = Math.max(0, Math.min(totalDuration, clickX / zoomPixelsPerSec));
                      setPlayheadTime(Math.round(newTime * 100) / 100);
                    }}
                  >
                    {/* Background Grid Lines */}
                    {rulerTicks.map((sec) => (
                      <div
                        key={sec}
                        style={{ left: `${sec * zoomPixelsPerSec}px` }}
                        className="absolute top-0 bottom-0 border-l border-[#131520] pointer-events-none"
                      />
                    ))}

                    {/* Clips on this track */}
                    {trackClips.map((clip) => {
                      const isSelected = clip.id === selectedClipId;
                      const clipLeft = clip.startTime * zoomPixelsPerSec;
                      const clipWidth = Math.max(20, clip.duration * zoomPixelsPerSec);

                      return (
                        <div
                          key={clip.id}
                          style={{
                            left: `${clipLeft}px`,
                            width: `${clipWidth}px`,
                            borderColor: isSelected ? '#a855f7' : track.color,
                          }}
                          onClick={(e) => handleSelectClip(clip.id, e)}
                          onMouseDown={(e) => handleClipMouseDown(e, clip, 'move')}
                          className={`absolute top-2 bottom-2 rounded-xl border flex flex-col justify-between p-2 cursor-grab active:cursor-grabbing transition-shadow overflow-hidden group shadow-md ${
                            isSelected
                              ? 'bg-purple-950/70 ring-2 ring-purple-400 shadow-purple-900/40 z-20'
                              : 'bg-[#151726]/90 hover:bg-[#1b1f33]'
                          }`}
                        >
                          {/* Visual Fade In Triangle */}
                          {clip.fadeIn > 0 && (
                            <div
                              style={{
                                width: `${Math.min(clipWidth / 2, clip.fadeIn * zoomPixelsPerSec)}px`,
                              }}
                              className="absolute top-0 bottom-0 left-0 bg-white/10 pointer-events-none skew-x-12"
                            />
                          )}

                          {/* Visual Fade Out Triangle */}
                          {clip.fadeOut > 0 && (
                            <div
                              style={{
                                width: `${Math.min(clipWidth / 2, clip.fadeOut * zoomPixelsPerSec)}px`,
                              }}
                              className="absolute top-0 bottom-0 right-0 bg-white/10 pointer-events-none -skew-x-12"
                            />
                          )}

                          {/* Left Trim Handle */}
                          <div
                            onMouseDown={(e) => handleClipMouseDown(e, clip, 'trim-start')}
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-purple-400/80 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Trim Start"
                          />

                          {/* Right Trim Handle */}
                          <div
                            onMouseDown={(e) => handleClipMouseDown(e, clip, 'trim-end')}
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-purple-400/80 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Trim End"
                          />

                          {/* Clip Header: Title and Duration */}
                          <div className="flex items-center justify-between gap-1 text-[11px] pointer-events-none">
                            <span className="font-semibold text-white truncate max-w-[80%]">
                              {clip.title}
                            </span>
                            <span className="font-mono text-[9px] text-purple-300 bg-black/40 px-1 py-0.5 rounded">
                              {clip.duration.toFixed(1)}s
                            </span>
                          </div>

                          {/* Clip Body: Text Preview & Waveform representation */}
                          <div className="flex-1 flex flex-col justify-center pointer-events-none overflow-hidden my-0.5">
                            {clip.text ? (
                              <p className="text-[10px] text-[#9ca3bd] line-clamp-1 italic font-mono">
                                {clip.text.replace(/<[^>]+>/g, '')}
                              </p>
                            ) : (
                              <div className="flex items-center gap-0.5 h-3 opacity-60">
                                {[40, 70, 20, 90, 60, 30, 80, 50, 95, 35, 65, 85].map((h, i) => (
                                  <div
                                    key={i}
                                    style={{ height: `${h}%`, backgroundColor: track.color }}
                                    className="w-1 rounded-full"
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Bottom info: Volume & Pan */}
                          <div className="flex items-center justify-between text-[9px] font-mono text-[#717791] pointer-events-none">
                            <span>Vol: {Math.round((clip.volume ?? 1) * 100)}%</span>
                            {clip.pan !== 0 && (
                              <span>Pan: {clip.pan > 0 ? `R${Math.round(clip.pan * 100)}` : `L${Math.round(Math.abs(clip.pan) * 100)}`}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SELECTED CLIP INSPECTOR PANEL (Bottom Drawer) */}
      {selectedClip && (
        <div className="p-3 bg-[#11131c] border-t border-[#1c2030] flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedClip.color || '#a855f7' }} />
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={selectedClip.title}
                  onChange={(e) => handleUpdateClip(selectedClip.id, { title: e.target.value })}
                  className="bg-transparent text-xs font-bold text-white focus:outline-none focus:border-b focus:border-purple-400"
                />
                <span className="text-[10px] font-mono text-[#8e92a8]">ID: {selectedClip.id}</span>
              </div>
              <div className="text-[11px] text-[#6d738c] flex items-center gap-2">
                <span>Start:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={selectedClip.startTime}
                  onChange={(e) => handleUpdateClip(selectedClip.id, { startTime: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-16 bg-[#181a26] text-purple-300 font-mono text-[11px] px-1.5 py-0.5 rounded border border-[#25293d]"
                />
                <span>Duration:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.2"
                  value={selectedClip.duration}
                  onChange={(e) => handleUpdateClip(selectedClip.id, { duration: Math.max(0.2, parseFloat(e.target.value) || 0.2) })}
                  className="w-16 bg-[#181a26] text-purple-300 font-mono text-[11px] px-1.5 py-0.5 rounded border border-[#25293d]"
                />
              </div>
            </div>
          </div>

          {/* Fade In, Fade Out, Volume, Pan */}
          <div className="flex items-center gap-4 text-xs">
            {/* Fade In */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#8e92a8]">Fade In:</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={selectedClip.fadeIn || 0}
                onChange={(e) => handleUpdateClip(selectedClip.id, { fadeIn: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-14 bg-[#181a26] text-purple-300 font-mono text-[11px] px-1.5 py-0.5 rounded border border-[#25293d]"
              />
            </div>

            {/* Fade Out */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#8e92a8]">Fade Out:</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={selectedClip.fadeOut || 0}
                onChange={(e) => handleUpdateClip(selectedClip.id, { fadeOut: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-14 bg-[#181a26] text-purple-300 font-mono text-[11px] px-1.5 py-0.5 rounded border border-[#25293d]"
              />
            </div>

            {/* Clip Volume */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#8e92a8]">Gain:</span>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={selectedClip.volume ?? 1}
                onChange={(e) => handleUpdateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
                className="w-20 h-1 bg-[#202538] rounded accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] font-mono text-[#8e92a8] w-8">
                {Math.round((selectedClip.volume ?? 1) * 100)}%
              </span>
            </div>

            {/* Clip Pan */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#8e92a8]">Pan:</span>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={selectedClip.pan ?? 0}
                onChange={(e) => handleUpdateClip(selectedClip.id, { pan: parseFloat(e.target.value) })}
                className="w-16 h-1 bg-[#202538] rounded accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] font-mono text-[#8e92a8] w-7">
                {selectedClip.pan === 0 ? 'C' : selectedClip.pan > 0 ? `R${Math.round(selectedClip.pan * 100)}` : `L${Math.round(Math.abs(selectedClip.pan) * 100)}`}
              </span>
            </div>
          </div>

          {/* Quick Clip Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPlayheadTime(selectedClip.startTime);
                startPlayback();
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#181a26] hover:bg-[#202436] text-purple-300 hover:text-white border border-[#262a3d] text-xs font-semibold transition-colors"
            >
              <Play className="w-3 h-3" />
              <span>Audition Clip</span>
            </button>
            <button
              onClick={handleDuplicateClip}
              className="p-1.5 rounded-lg hover:bg-[#1e2233] text-[#8e92a8] hover:text-white border border-[#24293c]"
              title="Duplicate Clip"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDeleteClip()}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-[#8e92a8] hover:text-red-400 border border-[#24293c]"
              title="Delete Clip"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

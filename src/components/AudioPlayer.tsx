/**
 * VoxStory AI - DAW Master Audio Player (v2.0)
 * Features real acoustic waveform analysis from decoded PCM audio,
 * explicit generation-mode badges, object URL cleanup, variable speed,
 * and synchronized A/B take comparison.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  RotateCcw,
  History,
  FileAudio,
  Sparkles,
  ChevronDown,
  X,
  Clock,
  Mic,
  SplitSquareVertical,
  Activity,
  CheckCircle2,
  AlertCircle,
  Music,
  Layers,
} from 'lucide-react';
import { GenerationResult, WaveformData } from '../types';
import { analyzeAudioWaveform } from '../lib/waveformAnalyzer';

interface AudioPlayerProps {
  currentGeneration: GenerationResult | null;
  history: GenerationResult[];
  onSelectTake: (take: GenerationResult) => void;
  onRegenerate: () => void;
  isGenerating: boolean;
  onOpenMixer?: () => void;
  onOpenExport?: () => void;
  hasMixedAudio?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentGeneration,
  history,
  onSelectTake,
  onRegenerate,
  isGenerating,
  onOpenMixer,
  onOpenExport,
  hasMixedAudio,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [showABCompare, setShowABCompare] = useState(false);

  // A/B Comparison state
  const [takeB, setTakeB] = useState<GenerationResult | null>(null);
  const [activeCompareTrack, setActiveCompareTrack] = useState<'A' | 'B'>('A');

  // Real waveform data derived from actual decoded audio
  const [realWaveform, setRealWaveform] = useState<WaveformData | null>(null);
  const [isAnalyzingWaveform, setIsAnalyzingWaveform] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousBlobUrlRef = useRef<string | null>(null);

  // Analyze actual audio waveform whenever currentGeneration changes
  useEffect(() => {
    if (currentGeneration?.audioUrl) {
      setIsAnalyzingWaveform(true);
      analyzeAudioWaveform(currentGeneration.audioUrl, 72)
        .then((wf) => {
          setRealWaveform(wf);
          setIsAnalyzingWaveform(false);
        })
        .catch(() => {
          setIsAnalyzingWaveform(false);
        });

      // Cleanup previously generated blob URLs to avoid memory leaks
      if (previousBlobUrlRef.current && previousBlobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousBlobUrlRef.current);
      }
      if (currentGeneration.audioUrl.startsWith('blob:')) {
        previousBlobUrlRef.current = currentGeneration.audioUrl;
      }
    } else {
      setRealWaveform(null);
    }

    return () => {
      if (previousBlobUrlRef.current && previousBlobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousBlobUrlRef.current);
      }
    };
  }, [currentGeneration?.id, currentGeneration?.audioUrl]);

  // Sync audio source when currentGeneration or A/B active track changes
  useEffect(() => {
    const activeTake = showABCompare && activeCompareTrack === 'B' && takeB ? takeB : currentGeneration;

    if (activeTake?.audioUrl && audioRef.current) {
      const prevTime = audioRef.current.currentTime;
      audioRef.current.src = activeTake.audioUrl;
      audioRef.current.load();
      audioRef.current.playbackRate = playbackSpeed;
      if (showABCompare && prevTime > 0) {
        audioRef.current.currentTime = Math.min(prevTime, activeTake.durationSeconds || prevTime);
      } else {
        setCurrentTime(0);
      }
      setIsPlaying(false);
    }
  }, [currentGeneration?.id, activeCompareTrack, showABCompare, takeB?.id]);

  // Audio element events
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || currentGeneration?.durationSeconds || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentGeneration) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleDownload = () => {
    const activeTake = showABCompare && activeCompareTrack === 'B' && takeB ? takeB : currentGeneration;
    if (!activeTake) return;

    const a = document.createElement('a');
    a.href = activeTake.audioUrl;
    const ext = activeTake.audioConfig?.container || 'wav';
    const safeTitle = (activeTake.title || 'voxstory_take')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    a.download = `${safeTitle}_${activeTake.voice.toLowerCase()}_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Draw real waveform on canvas from decoded audio peaks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderRealWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const peaks = realWaveform?.peaks;

      if (!peaks || peaks.length === 0) {
        // Subtle idle grid lines
        ctx.fillStyle = '#1c2030';
        for (let i = 0; i < 48; i++) {
          ctx.fillRect(i * (width / 48) + 1, height / 2 - 2, (width / 48) - 2, 4);
        }
        return;
      }

      const bars = peaks.length;
      const barWidth = width / bars;
      const progress = duration > 0 ? currentTime / duration : 0;

      for (let i = 0; i < bars; i++) {
        const x = i * barWidth;
        const barProgress = i / bars;
        const isPast = barProgress <= progress;

        // Exact measured peak height
        const peakHeight = Math.max(3, peaks[i] * (height * 0.88));

        ctx.fillStyle = isPast
          ? '#a855f7' // purple playhead trail
          : '#2d3246'; // unplayed soundwave
        ctx.fillRect(x + 1, (height - peakHeight) / 2, barWidth - 2, peakHeight);
      }
    };

    renderRealWave();
  }, [realWaveform, currentTime, duration, isPlaying]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Generation mode badge helper
  const renderModeBadge = (mode?: string, isDemo?: boolean) => {
    if (mode === 'live-provider') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          Live Gnani Timbre
        </span>
      );
    }
    if (mode === 'prerecorded-showcase') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          Showcase Track
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
        Procedural Demo
      </span>
    );
  };

  return (
    <div className="border-t border-[#1f2231] bg-[#0c0e15] px-4 lg:px-6 py-3 relative z-30">
      {/* Hidden HTML audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Main player controls row */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-3 md:gap-6 justify-between">
        {/* Left: Take Info & Mode Badge */}
        <div className="flex items-center gap-3 w-full md:w-72 truncate">
          <div className="w-10 h-10 rounded-xl bg-[#161824] border border-[#262b3d] flex items-center justify-center shrink-0">
            <FileAudio className="w-5 h-5 text-purple-400" />
          </div>

          <div className="truncate flex-1">
            <h4 className="text-xs font-bold text-white truncate">
              {currentGeneration ? currentGeneration.title : 'No Audio Generated Yet'}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-[#8e92a8] mt-0.5 flex-wrap">
              <span>{currentGeneration?.voice || 'Direct voice'}</span>
              <span>•</span>
              <span className="uppercase text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#1b1f30] text-purple-300">
                {currentGeneration?.audioConfig?.container || 'WAV'}
              </span>
              {currentGeneration && renderModeBadge(currentGeneration.generationMode, currentGeneration.isDemo)}
            </div>
          </div>
        </div>

        {/* Center: Play, Real Waveform & Scrubber */}
        <div className="flex-1 w-full max-w-2xl flex flex-col items-center gap-1">
          <div className="flex items-center gap-3 w-full">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              disabled={!currentGeneration || isGenerating}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform ${
                !currentGeneration || isGenerating
                  ? 'bg-[#1b1e2b] text-[#555a73] cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 shadow-md hover:scale-105 active:scale-95'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            {/* Time Elapsed */}
            <span className="text-[11px] font-mono text-[#8e92a8] w-10 text-right">
              {formatTime(currentTime)}
            </span>

            {/* Real Audio Waveform Canvas & Progress Bar */}
            <div className="flex-1 relative flex items-center h-8 bg-[#10121a] rounded-lg px-2 border border-[#202434] overflow-hidden">
              <canvas
                ref={canvasRef}
                width={420}
                height={28}
                className="w-full h-full pointer-events-none"
              />
              <input
                type="range"
                min="0"
                max={duration || 1}
                step="0.01"
                value={currentTime}
                onChange={handleSeek}
                disabled={!currentGeneration}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* Total Duration */}
            <span className="text-[11px] font-mono text-[#8e92a8] w-10">
              {formatTime(duration)}
            </span>
          </div>

          {/* Waveform acoustic indicator */}
          <div className="flex items-center justify-between w-full text-[10px] text-[#696f84] font-mono px-12">
            <span>
              {isAnalyzingWaveform
                ? 'Decoding actual PCM waveform...'
                : realWaveform
                ? 'Measured acoustic waveform'
                : 'Waveform ready upon generation'}
            </span>
            {currentGeneration?.fileSizeBytes ? (
              <span>{(currentGeneration.fileSizeBytes / 1024).toFixed(1)} KB</span>
            ) : null}
          </div>
        </div>

        {/* Right: Tools & Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Playback speed selector */}
          <div className="flex items-center bg-[#151722] rounded-lg border border-[#242738] p-0.5 text-[11px]">
            {[0.75, 1, 1.25, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className={`px-2 py-0.5 rounded font-mono transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-[#8e92a8] hover:text-white'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Volume Control */}
          <div className="hidden sm:flex items-center gap-1.5 pl-1">
            <button
              onClick={toggleMute}
              className="text-[#8e92a8] hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-14 h-1 accent-purple-500 bg-[#25293d] rounded cursor-pointer"
            />
          </div>

          {/* A/B Compare Toggle */}
          {history.length >= 2 && (
            <button
              onClick={() => {
                setShowABCompare(!showABCompare);
                if (!takeB && history.length >= 2) {
                  setTakeB(history[1]);
                }
              }}
              title="A/B Compare Takes"
              className={`p-2 rounded-lg border text-xs transition-colors ${
                showABCompare
                  ? 'bg-purple-600 text-white border-purple-500'
                  : 'bg-[#181a26] text-[#8e92a8] hover:text-white border-[#262b3d]'
              }`}
            >
              <SplitSquareVertical className="w-4 h-4" />
            </button>
          )}

          {/* Regenerate Action */}
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            title="Regenerate speech take"
            className="p-2 rounded-lg bg-[#181a26] hover:bg-[#222638] text-[#8e92a8] hover:text-white border border-[#262b3d] transition-colors"
          >
            <RotateCcw className={`w-4 h-4 ${isGenerating ? 'animate-spin text-purple-400' : ''}`} />
          </button>

          {/* Background Audio Mixer Trigger */}
          {onOpenMixer && (
            <button
              onClick={onOpenMixer}
              disabled={!currentGeneration}
              title="Open Background Audio Mixer & Voice Ducking"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181a26] hover:bg-purple-600/20 text-purple-300 hover:text-white border border-purple-500/30 hover:border-purple-500 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              <Music className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mixer</span>
            </button>
          )}

          {/* Creator Export Package Trigger */}
          {onOpenExport && (
            <button
              onClick={onOpenExport}
              disabled={!currentGeneration}
              title="Creator Export Package (SRT, VTT, WAV, Metadata)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181a26] hover:bg-indigo-600/20 text-indigo-300 hover:text-white border border-indigo-500/30 hover:border-indigo-500 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {/* Download Action */}
          <button
            onClick={handleDownload}
            disabled={!currentGeneration}
            title="Download generated audio file"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181a26] hover:bg-purple-600 text-white text-xs font-medium border border-[#262b3d] hover:border-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Download</span>
          </button>

          {/* Takes History Drawer Trigger */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            title="View Generation History"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#181a26] hover:bg-[#222638] text-xs text-[#8e92a8] hover:text-white border border-[#262b3d] transition-colors relative"
          >
            <History className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono">{history.length}</span>
          </button>
        </div>
      </div>

      {/* A/B Synchronized Comparison Bar */}
      {showABCompare && takeB && (
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-[#1b1e2c] flex items-center justify-between gap-4 bg-[#10121a] px-4 py-2 rounded-xl text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-purple-400 flex items-center gap-1">
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Synchronized Take Comparison:</span>
            </span>
            <div className="flex items-center bg-[#171a26] p-1 rounded-lg border border-[#262a3d]">
              <button
                onClick={() => setActiveCompareTrack('A')}
                className={`px-3 py-1 rounded font-semibold transition-colors ${
                  activeCompareTrack === 'A'
                    ? 'bg-purple-600 text-white'
                    : 'text-[#8e92a8] hover:text-white'
                }`}
              >
                Take A: {currentGeneration?.voice}
              </button>
              <button
                onClick={() => setActiveCompareTrack('B')}
                className={`px-3 py-1 rounded font-semibold transition-colors ${
                  activeCompareTrack === 'B'
                    ? 'bg-purple-600 text-white'
                    : 'text-[#8e92a8] hover:text-white'
                }`}
              >
                Take B: {takeB.voice}
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowABCompare(false)}
            className="text-[#8e92a8] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Generation History Drawer / Modal */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-[#0e1017] border-l border-[#222638] shadow-2xl z-50 p-5 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-[#212536] mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Generation Takes History</h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300">
                {history.length}
              </span>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 rounded-lg text-[#8e92a8] hover:text-white hover:bg-[#1a1d2b]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {history.length === 0 ? (
              <div className="text-center py-12 text-[#686d82] text-xs">
                No past takes recorded. Direct and generate audio in the studio to populate history.
              </div>
            ) : (
              history.map((take) => {
                const isCurrent = take.id === currentGeneration?.id;
                return (
                  <div
                    key={take.id}
                    onClick={() => {
                      onSelectTake(take);
                      setShowHistory(false);
                    }}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isCurrent
                        ? 'bg-[#181b2b] border-purple-500 shadow-md ring-1 ring-purple-500/30'
                        : 'bg-[#12141e] border-[#202434] hover:border-[#2f344a] hover:bg-[#161825]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white truncate max-w-[180px]">
                        {take.title}
                      </span>
                      <span className="text-[10px] font-mono text-[#8e92a8]">
                        {formatTime(take.durationSeconds)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#8e92a8] mb-2">
                      <span className="text-purple-300">{take.voice}</span>
                      <span>•</span>
                      <span>{take.language}</span>
                      <span>•</span>
                      <span className="uppercase text-[10px]">{take.audioConfig.container}</span>
                    </div>

                    <p className="text-[11px] text-[#a0a5bc] line-clamp-2 font-mono bg-[#0b0c10] p-2 rounded border border-[#1b1e2a]">
                      {take.script}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1b1f2e] text-[10px] text-[#71768c]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(take.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {renderModeBadge(take.generationMode, take.isDemo)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

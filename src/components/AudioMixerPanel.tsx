/**
 * VoxStory AI - Background Audio Mixer Panel
 * Provides background track import, procedural ambient presets, volume,
 * fade in/out, voice-priority ducking, and mixed master WAV export.
 */

import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Music,
  Upload,
  Play,
  Pause,
  Sliders,
  Sparkles,
  Layers,
  Wand2,
  Trash2,
  CheckCircle2,
  RefreshCw,
  X,
  Radio,
} from 'lucide-react';
import { BackgroundTrackConfig, GenerationResult } from '../types';
import { BUILTIN_AMBIENT_PRESETS, generateProceduralAmbience, mixAudioTracks } from '../lib/audioMixer';

interface AudioMixerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentTake: GenerationResult | null;
  bgConfig: BackgroundTrackConfig | null;
  onUpdateBgConfig: (config: BackgroundTrackConfig | null) => void;
  onMixedTakeCreated: (take: GenerationResult) => void;
}

export const AudioMixerPanel: React.FC<AudioMixerPanelProps> = ({
  isOpen,
  onClose,
  currentTake,
  bgConfig,
  onUpdateBgConfig,
  onMixedTakeCreated,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('cinematic-drone');
  const [isMixing, setIsMixing] = useState(false);
  const [mixStatus, setMixStatus] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  if (!isOpen) return null;

  // Initialize or retrieve background config
  const activeConfig: BackgroundTrackConfig = bgConfig || {
    id: 'bg-default',
    name: 'Cinematic Deep Drone',
    audioUrl: '',
    volume: 0.25,
    fadeInSeconds: 1.0,
    fadeOutSeconds: 1.5,
    loop: true,
    duckingEnabled: true,
    duckingAmount: 0.7,
    isMuted: false,
  };

  // Generate or load built-in preset
  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = BUILTIN_AMBIENT_PRESETS.find((p) => p.id === presetId);
    const ambient = generateProceduralAmbience(presetId, Math.max(15, currentTake?.durationSeconds || 20));

    onUpdateBgConfig({
      ...activeConfig,
      name: preset?.name || 'Ambient Ambience',
      audioUrl: ambient.dataUrl,
      duration: ambient.duration,
    });
  };

  // User file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    onUpdateBgConfig({
      ...activeConfig,
      name: file.name.replace(/\.[^/.]+$/, ''),
      audioUrl: url,
    });
  };

  // Preview background track
  const togglePreview = () => {
    if (!activeConfig.audioUrl) {
      handleSelectPreset(selectedPreset);
      return;
    }

    if (isPlayingPreview && previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    } else {
      if (previewAudio) previewAudio.pause();
      const audio = new Audio(activeConfig.audioUrl);
      audio.volume = activeConfig.isMuted ? 0 : activeConfig.volume;
      audio.loop = activeConfig.loop;
      audio.play().catch(console.error);
      setPreviewAudio(audio);
      setIsPlayingPreview(true);
      audio.onended = () => setIsPlayingPreview(false);
    }
  };

  // Render and mix master audio with voice take
  const handleRenderMix = async () => {
    if (!currentTake) {
      setMixStatus('Please generate or select a voice narration take before rendering a mix.');
      setTimeout(() => setMixStatus(null), 4000);
      return;
    }

    let trackToMix = activeConfig.audioUrl;
    if (!trackToMix) {
      const ambient = generateProceduralAmbience(selectedPreset, currentTake.durationSeconds);
      trackToMix = ambient.dataUrl;
    }

    setIsMixing(true);
    setMixStatus('Blending narration with ducked background ambience...');

    try {
      const mixed = await mixAudioTracks(
        currentTake.audioUrl,
        {
          ...activeConfig,
          audioUrl: trackToMix,
        },
        24000
      );

      const mixedResult: GenerationResult = {
        id: `mixed-${Date.now()}`,
        projectId: currentTake.projectId,
        title: `${currentTake.title} (Mixed Master)`,
        script: currentTake.script,
        voice: `${currentTake.voice} + ${activeConfig.name}`,
        language: currentTake.language,
        audioConfig: currentTake.audioConfig,
        audioUrl: mixed.dataUrl,
        durationSeconds: mixed.durationSeconds,
        wordCount: currentTake.wordCount,
        detectedTags: currentTake.detectedTags,
        createdAt: new Date().toISOString(),
        provider: currentTake.provider,
        generationMode: currentTake.generationMode,
        isDemo: currentTake.isDemo,
        fileSizeBytes: mixed.sizeBytes,
      };

      onMixedTakeCreated(mixedResult);
      setMixStatus('Master mix created and loaded into player!');
      setTimeout(() => {
        setMixStatus(null);
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setMixStatus(`Mixing failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsMixing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#10121a] border border-[#232738] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#1f2231] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Music className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Background Audio Mixer & Voice Ducking
              </h3>
              <p className="text-xs text-[#8e92a8]">
                Blend musical atmosphere or ambient room presence behind your voiceover
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (previewAudio) previewAudio.pause();
              onClose();
            }}
            className="p-1.5 rounded-lg text-[#8e92a8] hover:text-white hover:bg-[#1b1f2e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-[#b8bdcf]">
          {/* Active Voice Take Banner */}
          <div className="p-3.5 rounded-xl bg-[#141622] border border-[#222638] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <div>
                <span className="text-[10px] uppercase text-[#8e92a8] font-semibold">Primary Voice Track</span>
                <h4 className="text-xs font-bold text-white">{currentTake?.title || 'No take selected'}</h4>
              </div>
            </div>
            <span className="text-[11px] font-mono text-purple-300">
              {currentTake ? `${currentTake.durationSeconds}s` : '0s'}
            </span>
          </div>

          {/* Source Selection: Preset or Custom Upload */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[#8e92a8]">
              Background Audio Source
            </label>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {BUILTIN_AMBIENT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedPreset === p.id && (!activeConfig.audioUrl || activeConfig.name.includes(p.name.split(' ')[0]))
                      ? 'bg-[#1b1e2c] border-purple-500 text-white shadow-sm ring-1 ring-purple-500/40'
                      : 'bg-[#131622] border-[#202434] text-[#8e92a8] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 font-bold text-xs text-white">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">{p.name.split(' ')[0]}</span>
                  </div>
                  <p className="text-[10px] text-[#787e94] line-clamp-2 leading-tight">
                    {p.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Upload Custom Track */}
            <div className="p-3 rounded-xl bg-[#12141e] border border-[#202434] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-white">Import Custom Audio (MP3/WAV)</span>
              </div>
              <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-[#1a1d2c] hover:bg-purple-600 hover:text-white text-xs font-semibold text-purple-300 transition-colors">
                <span>Browse File</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Mixing Parameters */}
          <div className="p-4 rounded-xl bg-[#131622] border border-[#222638] space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Mixer Controls & Ducking
              </h4>
              <button
                onClick={togglePreview}
                className="flex items-center gap-1.5 text-xs text-purple-300 hover:text-white font-medium"
              >
                {isPlayingPreview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlayingPreview ? 'Stop Preview' : 'Test Background'}</span>
              </button>
            </div>

            {/* Volume Slider */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span>Background Volume</span>
                <span className="font-mono text-purple-300">{Math.round(activeConfig.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={activeConfig.volume}
                onChange={(e) => onUpdateBgConfig({ ...activeConfig, volume: parseFloat(e.target.value) })}
                className="w-full accent-purple-500"
              />
            </div>

            {/* Fade In & Fade Out */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span>Fade In</span>
                  <span className="font-mono text-purple-300">{activeConfig.fadeInSeconds}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={activeConfig.fadeInSeconds}
                  onChange={(e) => onUpdateBgConfig({ ...activeConfig, fadeInSeconds: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span>Fade Out</span>
                  <span className="font-mono text-purple-300">{activeConfig.fadeOutSeconds}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={activeConfig.fadeOutSeconds}
                  onChange={(e) => onUpdateBgConfig({ ...activeConfig, fadeOutSeconds: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>

            {/* Voice-Priority Ducking */}
            <div className="pt-2 border-t border-[#1e2233] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-xs block">Voice-Priority Ducking</span>
                  <span className="text-[10px] text-[#7f859a]">
                    Lowers background volume by -10dB when narration is active, smoothly rising during pauses
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={activeConfig.duckingEnabled}
                  onChange={(e) => onUpdateBgConfig({ ...activeConfig, duckingEnabled: e.target.checked })}
                  className="w-4 h-4 accent-purple-500 rounded"
                />
              </div>
            </div>
          </div>

          {mixStatus && (
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs font-mono text-purple-300">
              {mixStatus}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#1f2231] bg-[#0c0e15] flex items-center justify-between">
          <button
            onClick={() => {
              if (previewAudio) previewAudio.pause();
              onUpdateBgConfig(null);
            }}
            className="flex items-center gap-1 text-xs text-[#8e92a8] hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Background</span>
          </button>

          <button
            onClick={handleRenderMix}
            disabled={isMixing || !currentTake}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
          >
            <Wand2 className={`w-3.5 h-3.5 ${isMixing ? 'animate-spin' : ''}`} />
            <span>{isMixing ? 'Rendering Master Mix...' : 'Render & Apply Mixed Master WAV'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

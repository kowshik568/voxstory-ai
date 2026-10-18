/**
 * VoxStory AI - Audio Mixer Console (v12 Beta)
 * Expansive digital audio workstation mixer for custom audio track upload,
 * voice-priority ducking, procedural soundscapes, and master export.
 */

import React, { useState, useRef } from 'react';
import {
  Music,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Layers,
  Wand2,
  Trash2,
  CheckCircle2,
  Play,
  Pause,
  Upload,
  Radio,
  FileAudio,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { BackgroundTrackConfig, GenerationResult, AudioAsset } from '../types';
import { BUILTIN_AMBIENT_PRESETS, generateProceduralAmbience, mixAudioTracks } from '../lib/audioMixer';

interface MixerViewProps {
  currentTake: GenerationResult | null;
  bgConfig: BackgroundTrackConfig | null;
  onUpdateBgConfig: (config: BackgroundTrackConfig | null) => void;
  onMixedTakeCreated: (take: GenerationResult) => void;
  mixedAudioUrl: string | null;
  onOpenStudio: () => void;
}

export const MixerView: React.FC<MixerViewProps> = ({
  currentTake,
  bgConfig,
  onUpdateBgConfig,
  onMixedTakeCreated,
  mixedAudioUrl,
  onOpenStudio,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('cinematic-drone');
  const [isMixing, setIsMixing] = useState(false);
  const [mixStatus, setMixStatus] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<AudioAsset | null>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);

  // Track name editing
  const [isEditingTrackName, setIsEditingTrackName] = useState(false);
  const [trackNameDraft, setTrackNameDraft] = useState('');

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

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    setUploadError(null);
    setUploadedAsset(null);
    const preset = BUILTIN_AMBIENT_PRESETS.find((p) => p.id === presetId);
    const ambient = generateProceduralAmbience(presetId, Math.max(15, currentTake?.durationSeconds || 20));

    onUpdateBgConfig({
      ...activeConfig,
      id: `preset-${presetId}`,
      name: preset?.name || 'Ambient Ambience',
      audioUrl: ambient.dataUrl,
      duration: ambient.duration,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Client-side quick checks
    if (file.size === 0) {
      setUploadError('Selected file is empty (0 bytes).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError(`File is too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds the 15MB limit.`);
      return;
    }

    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setIsUploading(true);
    setUploadProgress(15);

    try {
      const reader = new FileReader();
      reader.onerror = () => {
        setUploadError('Failed to read local file.');
        setIsUploading(false);
      };

      reader.onload = async () => {
        setUploadProgress(40);
        const dataUrl = reader.result as string;

        try {
          const resp = await fetch('/api/audio/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              dataUrl,
              trackType: 'ambience',
              projectId: currentTake?.projectId,
            }),
            signal: controller.signal,
          });

          setUploadProgress(80);

          const result = await resp.json();
          if (!resp.ok || !result.success) {
            const errDetail = result.details ? `: ${result.details.join(', ')}` : '';
            throw new Error((result.error || 'Audio upload failed') + errDetail);
          }

          const asset: AudioAsset = result.data;
          setUploadedAsset(asset);
          setUploadProgress(100);

          onUpdateBgConfig({
            ...activeConfig,
            id: asset.id,
            name: asset.filename.replace(/\.[^/.]+$/, ''),
            audioUrl: asset.url,
            duration: asset.durationSeconds,
          });

          setTimeout(() => {
            setIsUploading(false);
            setUploadProgress(0);
          }, 500);
        } catch (err: unknown) {
          if (controller.signal.aborted) {
            setUploadError('Audio upload was cancelled.');
          } else {
            setUploadError(err instanceof Error ? err.message : String(err));
          }
          setIsUploading(false);
          setUploadProgress(0);
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCancelUpload = () => {
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort();
      uploadControllerRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError('Upload cancelled.');
  };

  const handleSaveTrackName = () => {
    if (trackNameDraft.trim()) {
      onUpdateBgConfig({
        ...activeConfig,
        name: trackNameDraft.trim(),
      });
    }
    setIsEditingTrackName(false);
  };

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

  const handleRenderMix = async () => {
    if (!currentTake) return;

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

      const mixedTake: GenerationResult = {
        ...currentTake,
        id: `take-mixed-${Date.now()}`,
        title: `${currentTake.title} (Master Mix)`,
        audioUrl: mixed.dataUrl,
        durationSeconds: mixed.durationSeconds,
        fileSizeBytes: mixed.sizeBytes,
        createdAt: new Date().toISOString(),
      };

      onMixedTakeCreated(mixedTake);
      setMixStatus(`Master mix rendered successfully (${mixed.durationSeconds.toFixed(1)}s, 24kHz WAV).`);
      setTimeout(() => setMixStatus(null), 5000);
    } catch (err) {
      setMixStatus(`Mixing error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsMixing(false);
    }
  };

  return (
    <div className="flex-1 bg-[#0B0C10] overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1A1C29] pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Audio Mixer & Soundscapes</span>
            <span className="text-xs font-mono text-violet-400 font-normal px-2 py-0.5 rounded bg-violet-950/40 border border-violet-800/40">
              Voice-Priority Ducking
            </span>
          </h1>
          <p className="text-xs text-[#8E92A8] mt-1">
            Layer atmospheric soundscapes, configure automatic voice ducking, and render mixed master WAV audio
          </p>
        </div>

        {/* Master Render Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRenderMix}
            disabled={isMixing || !currentTake}
            className={`h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-sm shadow-violet-900/30 whitespace-nowrap ${
              isMixing || !currentTake
                ? 'bg-violet-900/40 text-violet-300/60 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            <Wand2 className={`w-4 h-4 ${isMixing ? 'animate-spin' : ''}`} />
            <span>{isMixing ? 'Rendering Master Mix...' : 'Render Master Mix WAV'}</span>
          </button>
        </div>
      </div>

      {!currentTake && (
        <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-violet-400 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-white">No active voice narration take loaded</span>
              <p className="text-[#8E92A8] mt-0.5">
                Generate or load a speech take in the Studio to audition real voice ducking and render mixed files.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenStudio}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
          >
            Go to Studio
          </button>
        </div>
      )}

      {/* Main 2-Column Mixer Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preset Selector & Track Import */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-[#10121B] border border-[#1C1F2E] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-violet-400" />
                <span>Procedural Ambient Presets</span>
              </h3>
              <span className="text-[10px] font-mono text-[#71758C]">Built-in</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {BUILTIN_AMBIENT_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-violet-950/25 border-violet-500/60 text-white'
                        : 'bg-[#141622] border-[#202334] text-[#8E92A8] hover:border-[#2C3048] hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-white">{preset.name}</div>
                      <div className="text-[11px] text-[#787D96] mt-0.5">{preset.description}</div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-mono text-violet-400 font-medium">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Track Upload */}
            <div className="pt-3 border-t border-[#1C1F2E] space-y-3">
              <label className="text-[11px] font-semibold text-[#8E92A8] block">
                Or Import Audio File (WAV):
              </label>

              <label className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-[#24283C] bg-[#141622] hover:bg-[#181B2A] cursor-pointer transition-colors text-xs text-[#8E92A8] hover:text-white">
                <Upload className="w-4 h-4 text-violet-400" />
                <span>Choose WAV Audio File</span>
                <input
                  type="file"
                  accept=".wav,audio/wav,audio/wave"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>

              {/* Progress Bar */}
              {isUploading && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-violet-300 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Uploading & validating... {uploadProgress}%
                    </span>
                    <button
                      onClick={handleCancelUpload}
                      className="text-[11px] text-red-400 hover:text-red-300 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="h-1.5 w-full bg-[#1C1F2E] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 flex items-center justify-between gap-2 text-xs text-red-300">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                  <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Uploaded Track Metadata Badge */}
              {uploadedAsset && (
                <div className="p-2.5 rounded-lg bg-violet-950/20 border border-violet-500/30 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <FileAudio className="w-4 h-4 text-violet-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-white">{uploadedAsset.filename}</span>
                      <div className="flex items-center gap-2 text-[10px] text-violet-300/80 font-mono mt-0.5">
                        <span>{uploadedAsset.sampleRate} Hz</span>
                        <span>•</span>
                        <span>{uploadedAsset.channels === 1 ? 'Mono' : 'Stereo'}</span>
                        <span>•</span>
                        <span>{uploadedAsset.durationSeconds.toFixed(1)}s</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    Imported
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Audio Faders & Voice Ducking Engine */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl bg-[#10121B] border border-[#1C1F2E] space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#1C1F2E]">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Mixer Channels & Dynamics
                </h3>
                {isEditingTrackName ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="text"
                      value={trackNameDraft}
                      onChange={(e) => setTrackNameDraft(e.target.value)}
                      className="h-6 px-2 text-xs rounded bg-[#181B28] border border-violet-500 text-white font-medium focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveTrackName}
                      className="p-1 rounded bg-violet-600 text-white hover:bg-violet-500"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#7E8299] mt-0.5 flex items-center gap-1.5">
                    Track: <span className="text-white font-medium">{activeConfig.name}</span>
                    <button
                      onClick={() => {
                        setTrackNameDraft(activeConfig.name);
                        setIsEditingTrackName(true);
                      }}
                      className="text-[#7E8299] hover:text-white"
                      title="Rename track"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </p>
                )}
              </div>

              {/* Audition Preset */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateBgConfig({ ...activeConfig, isMuted: !activeConfig.isMuted })}
                  className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    activeConfig.isMuted
                      ? 'bg-red-950/40 border-red-500/50 text-red-300'
                      : 'bg-[#181B28] border-[#23273C] text-[#8E92A8] hover:text-white'
                  }`}
                  title={activeConfig.isMuted ? 'Unmute' : 'Mute'}
                >
                  {activeConfig.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={togglePreview}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181B28] hover:bg-[#202436] text-white border border-[#23273C] text-xs font-medium transition-colors"
                >
                  {isPlayingPreview ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-violet-400" />
                      <span>Stop Audition</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-violet-400" />
                      <span>Audition Audio</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Track 1: Voice Narration (Static Master Level) */}
            <div className="space-y-2 p-4 rounded-lg bg-[#141622] border border-[#1E2130]">
              <div className="flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                  <span className="text-white">Channel 1: Voice Narration</span>
                  <span className="text-[10px] text-[#6A6E85] font-mono">
                    ({currentTake?.voice || 'No take loaded'})
                  </span>
                </div>
                <span className="font-mono text-violet-300">0.0 dB (100%)</span>
              </div>
              <div className="w-full bg-[#1C1F2E] h-2 rounded-full overflow-hidden">
                <div className="bg-violet-500 h-full w-full rounded-full" />
              </div>
            </div>

            {/* Track 2: Ambience Level Fader */}
            <div className="space-y-2 p-4 rounded-lg bg-[#141622] border border-[#1E2130]">
              <div className="flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                  <span className="text-white">Channel 2: Background Volume</span>
                </div>
                <span className="font-mono text-indigo-300 tabular-nums">
                  {activeConfig.isMuted ? 'Muted' : `${Math.round(activeConfig.volume * 100)}%`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={activeConfig.volume}
                onChange={(e) =>
                  onUpdateBgConfig({ ...activeConfig, volume: parseFloat(e.target.value) })
                }
                className="w-full accent-violet-500 cursor-pointer h-2 bg-[#1C1F2E] rounded-lg"
              />
            </div>

            {/* Fades Controls */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 p-3.5 rounded-lg bg-[#141622] border border-[#1E2130]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E92A8]">Fade-In Duration</span>
                  <span className="font-mono text-white tabular-nums">
                    {activeConfig.fadeInSeconds.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={activeConfig.fadeInSeconds}
                  onChange={(e) =>
                    onUpdateBgConfig({ ...activeConfig, fadeInSeconds: parseFloat(e.target.value) })
                  }
                  className="w-full accent-violet-500 cursor-pointer h-1.5 bg-[#1C1F2E] rounded-lg"
                />
              </div>

              <div className="space-y-1.5 p-3.5 rounded-lg bg-[#141622] border border-[#1E2130]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E92A8]">Fade-Out Duration</span>
                  <span className="font-mono text-white tabular-nums">
                    {activeConfig.fadeOutSeconds.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={activeConfig.fadeOutSeconds}
                  onChange={(e) =>
                    onUpdateBgConfig({ ...activeConfig, fadeOutSeconds: parseFloat(e.target.value) })
                  }
                  className="w-full accent-violet-500 cursor-pointer h-1.5 bg-[#1C1F2E] rounded-lg"
                />
              </div>
            </div>

            {/* Voice-Priority Ducking Section */}
            <div className="p-4 rounded-lg bg-[#141622] border border-[#1E2130] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-violet-400" />
                    <span>Voice-Priority Automatic Ducking</span>
                  </h4>
                  <p className="text-[11px] text-[#7E8299] mt-0.5">
                    Smoothly lowers background audio during narration
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={activeConfig.duckingEnabled}
                  onChange={(e) =>
                    onUpdateBgConfig({ ...activeConfig, duckingEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
                />
              </div>

              {activeConfig.duckingEnabled && (
                <div className="space-y-1.5 pt-2 border-t border-[#1C1F2E]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#8E92A8]">Ducking Reduction Amount</span>
                    <span className="font-mono text-violet-300 tabular-nums">
                      -{Math.round(activeConfig.duckingAmount * 20)} dB ({Math.round(activeConfig.duckingAmount * 100)}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="0.95"
                    step="0.05"
                    value={activeConfig.duckingAmount}
                    onChange={(e) =>
                      onUpdateBgConfig({ ...activeConfig, duckingAmount: parseFloat(e.target.value) })
                    }
                    className="w-full accent-violet-500 cursor-pointer h-1.5 bg-[#1C1F2E] rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Remove Track Button */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  if (previewAudio) previewAudio.pause();
                  setUploadedAsset(null);
                  onUpdateBgConfig(null);
                }}
                className="flex items-center gap-1.5 text-xs text-[#8E92A8] hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Background Track</span>
              </button>

              {mixStatus && (
                <span className="text-xs font-mono text-violet-300">
                  {mixStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

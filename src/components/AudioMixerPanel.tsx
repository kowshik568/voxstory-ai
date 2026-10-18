/**
 * VoxStory AI - Background Audio Mixer Panel (v12 Beta)
 * Provides custom background track upload, procedural ambient presets, track renaming,
 * volume, mute/solo, fade in/out, voice-priority ducking, and mixed master WAV export.
 */

import React, { useState, useRef } from 'react';
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
  FileAudio,
  AlertCircle,
  Loader2,
  Tag,
  Edit2,
  Check,
} from 'lucide-react';
import { BackgroundTrackConfig, GenerationResult, AudioAsset } from '../types';
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

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<AudioAsset | null>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);

  // Track name editing
  const [isEditingTrackName, setIsEditingTrackName] = useState(false);
  const [trackNameDraft, setTrackNameDraft] = useState('');

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

  // User file upload with validation & server persistence
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Client-side quick size validation (15MB)
    if (file.size === 0) {
      setUploadError('Selected file is empty (0 bytes).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 15MB upload limit.`);
      return;
    }

    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setIsUploading(true);
    setUploadProgress(15);

    try {
      const reader = new FileReader();
      reader.onerror = () => {
        setUploadError('Failed to read local audio file.');
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
    setMixStatus('Blending narration with ducked background audio...');

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
      setMixStatus(`Master mix successfully rendered (${mixed.durationSeconds.toFixed(1)}s, 24kHz WAV).`);
      setTimeout(() => setMixStatus(null), 5000);
    } catch (err) {
      setMixStatus(`Mix error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsMixing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#0f111a] border border-[#232738] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1f2231] bg-[#141622]">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="font-bold text-white text-sm">Background Audio Mixer</h3>
              <p className="text-[11px] text-[#8e92a8]">Voice ducking, atmospheric presets, and custom track uploads</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (previewAudio) previewAudio.pause();
              onClose();
            }}
            className="p-1 rounded-lg text-[#8e92a8] hover:text-white hover:bg-[#1f2334]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Active Voice Take Indicator */}
          <div className="p-3.5 rounded-xl bg-[#141622] border border-[#202434] flex items-center justify-between">
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
            <div className="p-3.5 rounded-xl bg-[#12141e] border border-[#202434] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-400" />
                  <div>
                    <span className="text-xs font-medium text-white block">Import Audio File</span>
                    <span className="text-[10px] text-[#787e94]">Supports standard RIFF/WAVE files up to 15MB</span>
                  </div>
                </div>
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-[#1a1d2c] hover:bg-purple-600 hover:text-white text-xs font-semibold text-purple-300 transition-colors">
                  <span>Browse WAV</span>
                  <input
                    type="file"
                    accept=".wav,audio/wav,audio/wave"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="space-y-1.5 pt-2 border-t border-[#1e2232]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-purple-300 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Uploading & validating audio... {uploadProgress}%
                    </span>
                    <button
                      onClick={handleCancelUpload}
                      className="text-[11px] text-red-400 hover:text-red-300 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="h-1.5 w-full bg-[#1e2234] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-300"
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

              {/* Uploaded Track Details */}
              {uploadedAsset && (
                <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/30 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <FileAudio className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-white">{uploadedAsset.filename}</span>
                      <div className="flex items-center gap-2 text-[10px] text-purple-300/80 font-mono mt-0.5">
                        <span>{uploadedAsset.sampleRate} Hz</span>
                        <span>•</span>
                        <span>{uploadedAsset.channels === 1 ? 'Mono' : 'Stereo'}</span>
                        <span>•</span>
                        <span>{uploadedAsset.durationSeconds.toFixed(1)}s</span>
                        <span>•</span>
                        <span>{(uploadedAsset.sizeBytes / 1024).toFixed(0)} KB</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    Uploaded
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Mixing Parameters & Track Controls */}
          <div className="p-4 rounded-xl bg-[#131622] border border-[#222638] space-y-4">
            <div className="flex items-center justify-between">
              {isEditingTrackName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={trackNameDraft}
                    onChange={(e) => setTrackNameDraft(e.target.value)}
                    className="h-7 px-2 text-xs rounded bg-[#1a1d2c] border border-purple-500 text-white font-medium focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTrackName}
                    className="p-1 rounded bg-purple-600 text-white hover:bg-purple-500"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                    Track: {activeConfig.name}
                  </h4>
                  <button
                    onClick={() => {
                      setTrackNameDraft(activeConfig.name);
                      setIsEditingTrackName(true);
                    }}
                    className="p-1 text-[#8e92a8] hover:text-white"
                    title="Rename track"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateBgConfig({ ...activeConfig, isMuted: !activeConfig.isMuted })}
                  className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    activeConfig.isMuted
                      ? 'bg-red-950/40 border-red-500/50 text-red-300'
                      : 'bg-[#1b1e2c] border-[#25293d] text-[#8e92a8] hover:text-white'
                  }`}
                  title={activeConfig.isMuted ? 'Unmute' : 'Mute'}
                >
                  {activeConfig.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={togglePreview}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1b1e2c] hover:bg-[#23273a] text-purple-300 hover:text-white border border-[#25293d] text-xs font-medium transition-colors"
                >
                  {isPlayingPreview ? <Pause className="w-3.5 h-3.5 text-purple-400" /> : <Play className="w-3.5 h-3.5 text-purple-400" />}
                  <span>{isPlayingPreview ? 'Stop' : 'Audition'}</span>
                </button>
              </div>
            </div>

            {/* Volume Slider */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#8e92a8]">Background Volume</span>
                <span className="font-mono text-purple-300">
                  {activeConfig.isMuted ? 'Muted (0%)' : `${Math.round(activeConfig.volume * 100)}%`}
                </span>
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
                  <span className="text-[#8e92a8]">Fade In</span>
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
                  <span className="text-[#8e92a8]">Fade Out</span>
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
                    Lowers background volume when voice narration is speaking
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={activeConfig.duckingEnabled}
                  onChange={(e) => onUpdateBgConfig({ ...activeConfig, duckingEnabled: e.target.checked })}
                  className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                />
              </div>

              {activeConfig.duckingEnabled && (
                <div className="pt-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#8e92a8]">Ducking Reduction Amount</span>
                    <span className="font-mono text-purple-300">
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
                    className="w-full accent-purple-500"
                  />
                </div>
              )}
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
              setUploadedAsset(null);
              onUpdateBgConfig(null);
            }}
            className="flex items-center gap-1 text-xs text-[#8e92a8] hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Track</span>
          </button>

          <button
            onClick={handleRenderMix}
            disabled={isMixing || !currentTake}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
          >
            <Wand2 className={`w-3.5 h-3.5 ${isMixing ? 'animate-spin' : ''}`} />
            <span>{isMixing ? 'Rendering Master Mix...' : 'Render & Apply Master WAV'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

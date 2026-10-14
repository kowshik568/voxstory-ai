/**
 * VoxStory AI - Dedicated Export Center (v4.0)
 * Precision export studio for SRT, WebVTT, Master WAV,
 * mixed soundscapes, and full production bundles.
 */

import React, { useState } from 'react';
import {
  Download,
  FileText,
  FileAudio,
  Film,
  Code,
  Check,
  Copy,
  Layers,
  Music,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { GenerationResult, DialogueScene } from '../types';
import {
  generateSoloNarrationCues,
  generateDialogueCues,
  cuesToSrt,
  cuesToVtt,
  cuesToTranscript,
} from '../lib/subtitleGenerator';

interface ExportsViewProps {
  currentTake: GenerationResult | null;
  dialogueScene?: DialogueScene | null;
  mixedAudioUrl?: string | null;
  onOpenStudio: () => void;
}

export const ExportsView: React.FC<ExportsViewProps> = ({
  currentTake,
  dialogueScene,
  mixedAudioUrl,
  onOpenStudio,
}) => {
  const [activeTab, setActiveTab] = useState<'srt' | 'vtt' | 'transcript' | 'json'>('srt');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!currentTake) {
    return (
      <div className="flex-1 bg-[#0B0C10] flex flex-col items-center justify-center p-8 text-center">
        <Download className="w-12 h-12 text-[#4E5268] mb-4" />
        <h2 className="text-lg font-bold text-white">No Audio Generated Yet</h2>
        <p className="text-xs text-[#7E8299] max-w-sm mt-1">
          Synthesize an audio script or assemble a dialogue scene in the studio first to generate subtitles, transcripts, and master WAV deliverables.
        </p>
        <button
          onClick={onOpenStudio}
          className="mt-5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
        >
          Open Solo Studio
        </button>
      </div>
    );
  }

  // Derive cues from solo or dialogue
  const cues =
    dialogueScene && dialogueScene.segments.length > 0
      ? generateDialogueCues(dialogueScene.segments)
      : generateSoloNarrationCues(
          currentTake.script,
          currentTake.durationSeconds,
          currentTake.voice
        );

  const srtContent = cuesToSrt(cues);
  const vttContent = cuesToVtt(cues);
  const transcriptContent = cuesToTranscript(cues);

  const metadataJson = JSON.stringify(
    {
      app: 'VoxStory AI',
      version: '4.0.0',
      title: currentTake.title,
      voice: currentTake.voice,
      language: currentTake.language,
      format: currentTake.audioConfig.container,
      sampleRate: currentTake.audioConfig.sampleRate,
      durationSeconds: currentTake.durationSeconds,
      wordCount: currentTake.wordCount,
      detectedTags: currentTake.detectedTags,
      generationMode: currentTake.generationMode,
      createdAt: currentTake.createdAt,
      subtitles: {
        cueCount: cues.length,
        formats: ['srt', 'vtt'],
      },
    },
    null,
    2
  );

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const triggerDownload = (content: string | Blob, filename: string, mimeType: string) => {
    let url = '';
    if (typeof content === 'string' && content.startsWith('data:')) {
      url = content;
    } else if (content instanceof Blob) {
      url = URL.createObjectURL(content);
    } else {
      const blob = new Blob([content as string], { type: mimeType });
      url = URL.createObjectURL(blob);
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getActiveContent = () => {
    switch (activeTab) {
      case 'srt':
        return srtContent;
      case 'vtt':
        return vttContent;
      case 'transcript':
        return transcriptContent;
      case 'json':
        return metadataJson;
    }
  };

  return (
    <div className="flex-1 bg-[#0B0C10] overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1A1C29] pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Production Export Center</span>
            <span className="text-xs font-mono text-violet-400 font-normal px-2 py-0.5 rounded bg-violet-950/40 border border-violet-800/40">
              Deliverables Ready
            </span>
          </h1>
          <p className="text-xs text-[#8E92A8] mt-1">
            Export broadcast-grade PCM WAV audio, frame-accurate subtitles, transcripts, and metadata
          </p>
        </div>

        {/* Deliverables Overview Bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              triggerDownload(
                currentTake.audioUrl,
                `${currentTake.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_master.wav`,
                'audio/wav'
              )
            }
            className="h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-sm shadow-violet-900/30 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Download Master WAV</span>
          </button>
        </div>
      </div>

      {/* Deliverable Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Master Speech Audio */}
        <div className="rounded-xl border border-[#1C1F2E] p-4 bg-[#10121B] flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/25 flex items-center justify-center mb-3">
              <FileAudio className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-xs text-white">Clean Voice WAV</h3>
            <p className="text-[11px] text-[#7E8299] mt-1">
              Linear 16-bit PCM @ {currentTake.audioConfig.sampleRate}Hz
            </p>
          </div>
          <button
            onClick={() =>
              triggerDownload(
                currentTake.audioUrl,
                `${currentTake.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_clean.wav`,
                'audio/wav'
              )
            }
            className="mt-4 w-full h-8 rounded-lg bg-[#181B28] hover:bg-[#202436] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-[#23273C]"
          >
            <Download className="w-3.5 h-3.5 text-violet-400" />
            <span>Export Clean WAV</span>
          </button>
        </div>

        {/* 2. Mixed Soundscape */}
        <div className="rounded-xl border border-[#1C1F2E] p-4 bg-[#10121B] flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 flex items-center justify-center mb-3">
              <Music className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-xs text-white">Mixed Ambience WAV</h3>
            <p className="text-[11px] text-[#7E8299] mt-1">
              {mixedAudioUrl ? 'Ambience with active ducking' : 'Configure in Audio Mixer'}
            </p>
          </div>
          <button
            onClick={() => {
              if (mixedAudioUrl) {
                triggerDownload(
                  mixedAudioUrl,
                  `${currentTake.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_mixed.wav`,
                  'audio/wav'
                );
              }
            }}
            disabled={!mixedAudioUrl}
            className={`mt-4 w-full h-8 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border ${
              mixedAudioUrl
                ? 'bg-[#181B28] hover:bg-[#202436] text-white border-[#23273C]'
                : 'bg-[#11131C] text-[#555970] border-[#181A25] cursor-not-allowed'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{mixedAudioUrl ? 'Export Mixed WAV' : 'Not Mixed Yet'}</span>
          </button>
        </div>

        {/* 3. Subtitles */}
        <div className="rounded-xl border border-[#1C1F2E] p-4 bg-[#10121B] flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center justify-center mb-3">
              <Film className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-xs text-white">Subtitles (SRT & VTT)</h3>
            <p className="text-[11px] text-[#7E8299] mt-1">
              {cues.length} frame-accurate timed cues
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() =>
                triggerDownload(
                  srtContent,
                  `${currentTake.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.srt`,
                  'text/plain'
                )
              }
              className="flex-1 h-8 rounded-lg bg-[#181B28] hover:bg-[#202436] text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors border border-[#23273C]"
            >
              <Download className="w-3 h-3 text-emerald-400" />
              <span>.SRT</span>
            </button>
            <button
              onClick={() =>
                triggerDownload(
                  vttContent,
                  `${currentTake.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.vtt`,
                  'text/vtt'
                )
              }
              className="flex-1 h-8 rounded-lg bg-[#181B28] hover:bg-[#202436] text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors border border-[#23273C]"
            >
              <Download className="w-3 h-3 text-emerald-400" />
              <span>.VTT</span>
            </button>
          </div>
        </div>

        {/* 4. Transcript & Metadata */}
        <div className="rounded-xl border border-[#1C1F2E] p-4 bg-[#10121B] flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/25 flex items-center justify-center mb-3">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-xs text-white">Transcript & JSON</h3>
            <p className="text-[11px] text-[#7E8299] mt-1">
              Formatted cues and production metadata
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() =>
                triggerDownload(
                  transcriptContent,
                  `${currentTake.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_transcript.txt`,
                  'text/plain'
                )
              }
              className="flex-1 h-8 rounded-lg bg-[#181B28] hover:bg-[#202436] text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors border border-[#23273C]"
            >
              <Download className="w-3 h-3 text-pink-400" />
              <span>.TXT</span>
            </button>
            <button
              onClick={() =>
                triggerDownload(
                  metadataJson,
                  `${currentTake.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_manifest.json`,
                  'application/json'
                )
              }
              className="flex-1 h-8 rounded-lg bg-[#181B28] hover:bg-[#202436] text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors border border-[#23273C]"
            >
              <Download className="w-3 h-3 text-pink-400" />
              <span>.JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Code Inspector & Live Preview Area */}
      <div className="bg-[#10121B] border border-[#1C1F2E] rounded-xl overflow-hidden shadow-sm flex flex-col">
        {/* Tabs Bar */}
        <div className="bg-[#141622] border-b border-[#1C1F2E] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1 p-0.5 bg-[#0E1017] rounded-lg border border-[#1E2130]">
            <button
              onClick={() => setActiveTab('srt')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'srt'
                  ? 'bg-violet-600 text-white'
                  : 'text-[#8E92A8] hover:text-white'
              }`}
            >
              SubRip (.srt)
            </button>
            <button
              onClick={() => setActiveTab('vtt')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'vtt'
                  ? 'bg-violet-600 text-white'
                  : 'text-[#8E92A8] hover:text-white'
              }`}
            >
              WebVTT (.vtt)
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'transcript'
                  ? 'bg-violet-600 text-white'
                  : 'text-[#8E92A8] hover:text-white'
              }`}
            >
              Transcript (.txt)
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'json'
                  ? 'bg-violet-600 text-white'
                  : 'text-[#8E92A8] hover:text-white'
              }`}
            >
              Metadata (.json)
            </button>
          </div>

          <button
            onClick={() => handleCopy(getActiveContent(), activeTab)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1C1F2E] hover:bg-[#25293D] text-white text-xs font-medium transition-colors"
          >
            {copiedType === activeTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#8E92A8]" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Content Box */}
        <pre className="p-5 text-xs font-mono text-[#D1D5DB] bg-[#0C0E14] overflow-x-auto max-h-96 leading-relaxed select-text">
          {getActiveContent()}
        </pre>
      </div>
    </div>
  );
};

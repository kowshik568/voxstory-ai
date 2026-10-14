/**
 * VoxStory AI - Creator Export Package Modal
 * Supports export of clean voice WAV, mixed master WAV, SRT subtitles,
 * WebVTT subtitles, plain-text transcripts, and project metadata JSON.
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
  X,
  Sparkles,
  Layers,
  Music,
} from 'lucide-react';
import { GenerationResult, DialogueScene } from '../types';
import {
  generateSoloNarrationCues,
  generateDialogueCues,
  cuesToSrt,
  cuesToVtt,
  cuesToTranscript,
} from '../lib/subtitleGenerator';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTake: GenerationResult | null;
  dialogueScene?: DialogueScene | null;
  mixedAudioUrl?: string | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  currentTake,
  dialogueScene,
  mixedAudioUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'subtitles' | 'metadata'>('overview');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen || !currentTake) return null;

  // Compute subtitles based on solo or dialogue
  const cues = dialogueScene && dialogueScene.segments.length > 0
    ? generateDialogueCues(dialogueScene.segments)
    : generateSoloNarrationCues(currentTake.script, currentTake.durationSeconds, currentTake.voice);

  const srtText = cuesToSrt(cues);
  const vttText = cuesToVtt(cues);
  const transcriptText = cuesToTranscript(cues);

  // Generate safe metadata JSON (no private keys or tokens)
  const safeMetadata = {
    app: 'VoxStory AI',
    version: '3.0.0',
    title: currentTake.title,
    voice: currentTake.voice,
    language: currentTake.language,
    format: currentTake.audioConfig.container,
    durationSeconds: currentTake.durationSeconds,
    wordCount: currentTake.wordCount,
    detectedTags: currentTake.detectedTags,
    generationMode: currentTake.generationMode,
    createdAt: currentTake.createdAt,
    subtitles: {
      cueCount: cues.length,
      format: ['srt', 'vtt'],
    },
  };
  const metadataJson = JSON.stringify(safeMetadata, null, 2);

  // Download helper
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

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const safeFilename = (currentTake.title || 'voxstory_take')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#10121a] border border-[#232738] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#1f2231] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Download className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Creator Export Package
              </h3>
              <p className="text-xs text-[#8e92a8]">
                Export broadcast audio, captions, and project transcripts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e92a8] hover:text-white hover:bg-[#1b1f2e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 py-2.5 border-b border-[#1f2231] bg-[#0c0e15] flex gap-2 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'bg-purple-600 text-white'
                : 'text-[#8e92a8] hover:text-white'
            }`}
          >
            All Assets
          </button>
          <button
            onClick={() => setActiveTab('subtitles')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'subtitles'
                ? 'bg-purple-600 text-white'
                : 'text-[#8e92a8] hover:text-white'
            }`}
          >
            Captions Preview (SRT / VTT)
          </button>
          <button
            onClick={() => setActiveTab('metadata')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'metadata'
                ? 'bg-purple-600 text-white'
                : 'text-[#8e92a8] hover:text-white'
            }`}
          >
            Project JSON
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-[#b8bdcf]">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Clean Voice WAV */}
                <div className="p-4 rounded-xl bg-[#131622] border border-[#222638] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <FileAudio className="w-4 h-4 text-purple-400" />
                        <span>Clean Vocal Master</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1b1f30] text-purple-300 uppercase">
                        {currentTake.audioConfig.container}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7d8398]">
                      Isolated spoken dialogue with full expression inflections.
                    </p>
                  </div>
                  <button
                    onClick={() => triggerDownload(currentTake.audioUrl, `${safeFilename}_vocal.${currentTake.audioConfig.container}`, `audio/${currentTake.audioConfig.container}`)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#1a1d2d] hover:bg-purple-600 hover:text-white text-xs font-semibold text-purple-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Vocal WAV</span>
                  </button>
                </div>

                {/* 2. Mixed Master WAV */}
                {mixedAudioUrl ? (
                  <div className="p-4 rounded-xl bg-[#131622] border border-[#222638] flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white text-xs flex items-center gap-1.5">
                          <Music className="w-4 h-4 text-indigo-400" />
                          <span>Mixed Master Track</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1b1f30] text-indigo-300 uppercase">
                          WAV
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7d8398]">
                        Voice blended with ducked background music & limiter.
                      </p>
                    </div>
                    <button
                      onClick={() => triggerDownload(mixedAudioUrl, `${safeFilename}_master_mix.wav`, 'audio/wav')}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Mixed Master</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#131622]/60 border border-[#222638] flex flex-col justify-between space-y-3 opacity-60">
                    <div>
                      <span className="font-bold text-[#8e92a8] text-xs flex items-center gap-1.5">
                        <Music className="w-4 h-4" />
                        <span>Mixed Master Track</span>
                      </span>
                      <p className="text-[11px] text-[#6d7285] mt-1">
                        Use the Background Audio Mixer to blend music or room presence.
                      </p>
                    </div>
                    <span className="text-[10px] text-[#6d7285] text-center">Not yet rendered</span>
                  </div>
                )}

                {/* 3. SubRip (.srt) */}
                <div className="p-4 rounded-xl bg-[#131622] border border-[#222638] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <Film className="w-4 h-4 text-cyan-400" />
                        <span>SubRip Subtitles (.srt)</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1b1f30] text-cyan-300">
                        {cues.length} cues
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7d8398]">
                      Compatible with YouTube Studio, Premiere Pro, DaVinci Resolve.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(srtText, 'srt')}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#181a28] hover:bg-[#222638] text-xs font-medium text-[#b5bacf]"
                    >
                      {copiedType === 'srt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedType === 'srt' ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={() => triggerDownload(srtText, `${safeFilename}.srt`, 'text/plain')}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white text-xs font-medium border border-cyan-500/30 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* 4. WebVTT (.vtt) */}
                <div className="p-4 rounded-xl bg-[#131622] border border-[#222638] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <Film className="w-4 h-4 text-pink-400" />
                        <span>WebVTT Subtitles (.vtt)</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1b1f30] text-pink-300">
                        HTML5
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7d8398]">
                      Includes speaker voice tags for web video players.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(vttText, 'vtt')}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#181a28] hover:bg-[#222638] text-xs font-medium text-[#b5bacf]"
                    >
                      {copiedType === 'vtt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedType === 'vtt' ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={() => triggerDownload(vttText, `${safeFilename}.vtt`, 'text/vtt')}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-pink-600/20 hover:bg-pink-600 text-pink-300 hover:text-white text-xs font-medium border border-pink-500/30 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* 5. Plain Transcript (.txt) */}
                <div className="p-4 rounded-xl bg-[#131622] border border-[#222638] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-400" />
                        <span>Plain Text Transcript (.txt)</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7d8398]">
                      Timestamped clean transcript with speaker labels.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(transcriptText, 'txt')}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#181a28] hover:bg-[#222638] text-xs font-medium text-[#b5bacf]"
                    >
                      {copiedType === 'txt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedType === 'txt' ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={() => triggerDownload(transcriptText, `${safeFilename}_transcript.txt`, 'text/plain')}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white text-xs font-medium border border-amber-500/30 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* 6. Metadata JSON */}
                <div className="p-4 rounded-xl bg-[#131622] border border-[#222638] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <Code className="w-4 h-4 text-emerald-400" />
                        <span>Project Metadata (.json)</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7d8398]">
                      Detailed take parameters, expression tags, and timestamps.
                    </p>
                  </div>
                  <button
                    onClick={() => triggerDownload(metadataJson, `${safeFilename}_metadata.json`, 'application/json')}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#181a28] hover:bg-[#222638] text-xs font-medium text-emerald-300 border border-emerald-500/30 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'subtitles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Generated SubRip (.srt) Preview
                </span>
                <button
                  onClick={() => handleCopy(srtText, 'srt-tab')}
                  className="flex items-center gap-1 text-xs text-purple-300 hover:text-white"
                >
                  {copiedType === 'srt-tab' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'srt-tab' ? 'Copied' : 'Copy SRT'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-[#0b0c10] border border-[#1d202d] font-mono text-[11px] text-[#cad0e4] overflow-x-auto max-h-72 leading-relaxed">
                {srtText}
              </pre>
            </div>
          )}

          {activeTab === 'metadata' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Sanitized Project Metadata JSON
                </span>
                <button
                  onClick={() => handleCopy(metadataJson, 'json-tab')}
                  className="flex items-center gap-1 text-xs text-purple-300 hover:text-white"
                >
                  {copiedType === 'json-tab' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'json-tab' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-[#0b0c10] border border-[#1d202d] font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-72 leading-relaxed">
                {metadataJson}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1f2231] bg-[#0c0e15] flex items-center justify-between">
          <span className="text-xs text-[#8e92a8]">
            {cues.length} subtitle cues generated
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

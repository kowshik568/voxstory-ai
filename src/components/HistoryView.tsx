/**
 * VoxStory AI - Generation History Log (v4.0)
 * Precision audit table of all audio takes generated during the session.
 * Real playback, waveform preview, take comparison, and instant downloads.
 */

import React, { useState, useRef } from 'react';
import {
  History,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  Volume2,
  FileAudio,
  ShieldCheck,
  Cpu,
  Trash2,
} from 'lucide-react';
import { GenerationResult } from '../types';

interface HistoryViewProps {
  history: GenerationResult[];
  activeTake: GenerationResult | null;
  onSelectTake: (take: GenerationResult) => void;
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  activeTake,
  onSelectTake,
  onClearHistory,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (take: GenerationResult) => {
    if (playingId === take.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.src = take.audioUrl;
      audioRef.current.play().catch(console.error);
      setPlayingId(take.id);
      audioRef.current.onended = () => setPlayingId(null);
    }
  };

  const handleCopyTranscript = (take: GenerationResult) => {
    navigator.clipboard.writeText(take.script);
    setCopiedId(take.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (take: GenerationResult) => {
    const a = document.createElement('a');
    a.href = take.audioUrl;
    a.download = `${take.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${take.id}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="flex-1 bg-[#0B0C10] overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Hidden audio element for preview */}
      <audio ref={audioRef} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1A1C29] pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Generation History Log</span>
            <span className="text-xs font-mono text-violet-400 font-normal px-2 py-0.5 rounded bg-violet-950/40 border border-violet-800/40 tabular-nums">
              {history.length} Takes
            </span>
          </h1>
          <p className="text-xs text-[#8E92A8] mt-1">
            Audit and audition every speech take, compare durations, and download broadcast-quality WAV files
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="h-8 px-3 rounded-lg bg-[#161824] hover:bg-rose-950/30 text-[#8E92A8] hover:text-rose-400 border border-[#202334] text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Takes Table */}
      {history.length === 0 ? (
        <div className="text-center py-20 px-4 border border-dashed border-[#202334] rounded-xl bg-[#0E1017]">
          <History className="w-10 h-10 text-[#4E5268] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No audio takes recorded yet</h3>
          <p className="text-xs text-[#71758C] mt-1 max-w-sm mx-auto">
            Generate speech in the Solo Narration or Dialogue Studio to build your session history log.
          </p>
        </div>
      ) : (
        <div className="bg-[#10121B] border border-[#1C1F2E] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141622] border-b border-[#1C1F2E] text-[#71758C] uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Play</th>
                  <th className="py-3 px-4">Take / Title</th>
                  <th className="py-3 px-4">Voice Actor</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Tags Used</th>
                  <th className="py-3 px-4">Engine Mode</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#181B27]">
                {history.map((take) => {
                  const isPlaying = playingId === take.id;
                  const isActive = activeTake?.id === take.id;
                  const isCopied = copiedId === take.id;

                  return (
                    <tr
                      key={take.id}
                      className={`hover:bg-[#151724] transition-colors ${
                        isActive ? 'bg-violet-950/15' : ''
                      }`}
                    >
                      {/* Play Action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => togglePlay(take)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            isPlaying
                              ? 'bg-violet-600 text-white'
                              : 'bg-[#181B28] hover:bg-violet-600/30 text-[#8E92A8] hover:text-white'
                          }`}
                        >
                          {isPlaying ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      {/* Title & Excerpt */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white max-w-xs truncate">
                          {take.title}
                        </div>
                        <div className="text-[11px] text-[#7E8299] max-w-xs truncate font-mono">
                          {take.script}
                        </div>
                      </td>

                      {/* Voice & Lang */}
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{take.voice}</div>
                        <div className="text-[10px] text-[#71758C] font-mono">
                          {take.language} · {take.audioConfig.sampleRate}Hz
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 font-mono tabular-nums text-white">
                        {formatDuration(take.durationSeconds)}
                      </td>

                      {/* Tags */}
                      <td className="py-3 px-4">
                        {take.detectedTags && take.detectedTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {take.detectedTags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-mono text-violet-300 bg-violet-950/40 border border-violet-800/40 px-1.5 py-0.2 rounded"
                              >
                                &lt;{tag}&gt;
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#555970]">None</span>
                        )}
                      </td>

                      {/* Engine */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {take.isDemo ? (
                            <Cpu className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span
                            className={`text-[11px] font-medium ${
                              take.isDemo ? 'text-amber-300' : 'text-emerald-300'
                            }`}
                          >
                            {take.isDemo ? 'Studio Demo' : 'Live Gnani'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Set Active */}
                          <button
                            onClick={() => onSelectTake(take)}
                            title="Load into Master Player"
                            className="px-2 py-1 rounded bg-[#181B28] hover:bg-[#202436] text-[#8E92A8] hover:text-white text-[11px] font-medium transition-colors"
                          >
                            Load
                          </button>

                          {/* Copy Transcript */}
                          <button
                            onClick={() => handleCopyTranscript(take)}
                            title="Copy Script"
                            className="p-1.5 rounded bg-[#181B28] hover:bg-[#202436] text-[#8E92A8] hover:text-white transition-colors"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Download WAV */}
                          <button
                            onClick={() => handleDownload(take)}
                            title="Download WAV file"
                            className="p-1.5 rounded bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

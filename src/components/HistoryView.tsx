/**
 * VoxStory AI - Generation History Log (v13.0)
 * Searchable, persistent audit log of all speech takes.
 * Real audio playback, script recovery, instant WAV downloads,
 * and individual take or full log management.
 */

import React, { useState, useRef, useEffect } from 'react';
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
  Search,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { GenerationResult } from '../types';

interface HistoryViewProps {
  history: GenerationResult[];
  activeTake: GenerationResult | null;
  onSelectTake: (take: GenerationResult) => void;
  onClearHistory: () => void;
  onOpenInStudio?: (take: GenerationResult) => void;
  onDeleteTake?: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history: propHistory,
  activeTake,
  onSelectTake,
  onClearHistory,
  onOpenInStudio,
  onDeleteTake,
}) => {
  const [historyList, setHistoryList] = useState<GenerationResult[]>(propHistory);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync when parent history changes
  useEffect(() => {
    setHistoryList(propHistory);
  }, [propHistory]);

  // Fetch persisted history from backend on mount
  const fetchBackendHistory = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/generations');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          setHistoryList(json.data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch generation history:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBackendHistory();
  }, []);

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
    const safeTitle = (take.title || 'voxstory_take')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    a.download = `${safeTitle}_${take.voice.toLowerCase()}_${take.id}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDeleteTake = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/generations/${id}`, { method: 'DELETE' });
      setHistoryList((prev) => prev.filter((t) => t.id !== id));
      if (onDeleteTake) onDeleteTake(id);
    } catch {
      // ignore
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear your entire generation history?')) {
      try {
        await fetch('/api/generations', { method: 'DELETE' });
        setHistoryList([]);
        onClearHistory();
      } catch {
        // ignore
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const filteredHistory = historyList.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.script.toLowerCase().includes(q) ||
      t.voice.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 bg-[#0B0C10] overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Hidden audio element for preview */}
      <audio ref={audioRef} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1A1C29] pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Generation History Log</span>
            <span className="text-xs font-mono text-violet-400 font-normal px-2 py-0.5 rounded bg-violet-950/40 border border-violet-800/40 tabular-nums">
              {historyList.length} Takes
            </span>
          </h1>
          <p className="text-xs text-[#8E92A8] mt-1">
            Audit and audition every speech take, compare durations, and download broadcast-quality WAV files
          </p>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#6A6E85] absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter takes by text or voice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 sm:w-64 h-8 bg-[#11131C] border border-[#202334] rounded-lg pl-8 pr-3 text-xs text-white placeholder-[#60647E] focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <button
            onClick={fetchBackendHistory}
            title="Refresh History"
            className="w-8 h-8 rounded-lg bg-[#151722] hover:bg-[#1C1F2E] border border-[#202334] text-[#8E92A8] hover:text-white flex items-center justify-center transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {historyList.length > 0 && (
            <button
              onClick={handleClearAll}
              className="h-8 px-3 rounded-lg bg-[#161824] hover:bg-rose-950/30 text-[#8E92A8] hover:text-rose-400 border border-[#202334] text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Takes Table */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-20 px-4 border border-dashed border-[#202334] rounded-xl bg-[#0E1017]">
          <History className="w-10 h-10 text-[#4E5268] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">
            {searchQuery ? 'No takes matched your search' : 'No audio takes recorded yet'}
          </h3>
          <p className="text-xs text-[#71758C] mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Try searching with a different term or clear the filter.'
              : 'Generate speech in the Voice Studio or Dialogue Studio to build your session history log.'}
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
                {filteredHistory.map((take) => {
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
                          {take.language} · {take.audioConfig?.sampleRate || 24000}Hz
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
                          {/* Load into master player */}
                          <button
                            onClick={() => onSelectTake(take)}
                            title="Load into Master Player"
                            className="px-2 py-1 rounded bg-[#181B28] hover:bg-[#202436] text-[#8E92A8] hover:text-white text-[11px] font-medium transition-colors"
                          >
                            Load
                          </button>

                          {/* Open in Studio */}
                          {onOpenInStudio && (
                            <button
                              onClick={() => onOpenInStudio(take)}
                              title="Open Script in Studio"
                              className="p-1.5 rounded bg-[#181B28] hover:bg-[#202436] text-[#8E92A8] hover:text-white transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}

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

                          {/* Delete Take */}
                          <button
                            onClick={(e) => handleDeleteTake(take.id, e)}
                            title="Delete take"
                            className="p-1.5 rounded hover:bg-rose-950/30 text-[#60647E] hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

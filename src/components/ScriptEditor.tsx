/**
 * VoxStory AI - Directorial Script Editor
 * Cursor-aware tag insertion, text-selection wrapping, span visualizer, and validation
 */

import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Undo2,
  Redo2,
  Trash2,
  Eye,
  Edit3,
  Layers,
  Wand2,
  Save,
  HelpCircle,
  Copy,
  Check,
  Zap,
  Music,
  X,
  Radio,
} from 'lucide-react';
import { VERIFIED_TAGS, parseScriptToSpans, validateScript, normalizeTag } from '../lib/tagCatalog';
import { ExpressionTag, ScriptValidationResult } from '../types';

interface ScriptEditorProps {
  title: string;
  onTitleChange: (title: string) => void;
  script: string;
  onScriptChange: (script: string) => void;
  onGenerate: () => void;
  onSave: () => void;
  isGenerating: boolean;
  onOpenTagPalette: () => void;
  isStreamingMode?: boolean;
  onToggleStreamingMode?: (streaming: boolean) => void;
  streamingProgress?: { bytes: number; chunks: number } | null;
  onCancelStream?: () => void;
  onOpenMixer?: () => void;
  onOpenExport?: () => void;
  hasGeneration?: boolean;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  title,
  onTitleChange,
  script,
  onScriptChange,
  onGenerate,
  onSave,
  isGenerating,
  onOpenTagPalette,
  isStreamingMode = false,
  onToggleStreamingMode,
  streamingProgress,
  onCancelStream,
  onOpenMixer,
  onOpenExport,
  hasGeneration = false,
}) => {
  const [viewMode, setViewMode] = useState<'editor' | 'spans'>('editor');
  const [history, setHistory] = useState<string[]>([script]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [hasCopied, setHasCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Validate current script
  const validation: ScriptValidationResult = validateScript(script);

  // Parse spans for visual inspector
  const spans = parseScriptToSpans(script);

  const updateScriptWithHistory = (newScript: string) => {
    onScriptChange(newScript);
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newScript);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onScriptChange(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onScriptChange(next);
    }
  };

  /**
   * Insert tag at cursor or wrap selected text without destroying selection
   */
  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      updateScriptWithHistory(`${script} ${tag} `);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = script.substring(start, end);

    let newScript = '';
    let newCursorPos = 0;

    if (selectedText.length > 0) {
      // Wrap selected text: <tag> selected text
      newScript = script.substring(0, start) + `${tag} ` + selectedText + script.substring(end);
      newCursorPos = start + tag.length + 1 + selectedText.length;
    } else {
      // Insert at cursor
      newScript = script.substring(0, start) + `${tag} ` + script.substring(end);
      newCursorPos = start + tag.length + 1;
    }

    updateScriptWithHistory(newScript);

    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const handleClear = () => {
    if (confirm('Clear the current script?')) {
      updateScriptWithHistory('');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0f17] border-x border-[#1c1f2e] min-w-0">
      {/* Top Header Bar */}
      <div className="px-5 py-3 border-b border-[#1c1f2e] bg-[#11131d] flex flex-wrap items-center justify-between gap-3">
        {/* Project Title Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Edit3 className="w-4 h-4 text-purple-400 shrink-0" />
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Project Title (e.g. YouTube Tech Hook)"
            className="bg-transparent text-sm font-bold text-white placeholder-[#5d6278] focus:outline-none focus:border-b focus:border-purple-500 w-full"
          />
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-1.5">
          {/* Mode toggle */}
          <div className="flex items-center bg-[#171a26] p-0.5 rounded-lg border border-[#25293d] text-xs">
            <button
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
                viewMode === 'editor'
                  ? 'bg-purple-600 text-white'
                  : 'text-[#8e92a8] hover:text-white'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Script</span>
            </button>
            <button
              onClick={() => setViewMode('spans')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
                viewMode === 'spans'
                  ? 'bg-purple-600 text-white'
                  : 'text-[#8e92a8] hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Expression Spans</span>
            </button>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center bg-[#171a26] rounded-lg border border-[#25293d] p-0.5 text-[#8e92a8]">
            <button
              onClick={handleUndo}
              disabled={historyIndex === 0}
              title="Undo (Ctrl+Z)"
              className="p-1.5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo (Ctrl+Y)"
              className="p-1.5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copy Script */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(script);
              setHasCopied(true);
              setTimeout(() => setHasCopied(false), 2000);
            }}
            title="Copy Script to Clipboard"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#171a26] hover:bg-[#252a3d] text-xs text-[#8e92a8] hover:text-white border border-[#25293d] transition-colors"
          >
            {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{hasCopied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Clear Script */}
          <button
            onClick={handleClear}
            title="Clear Script"
            className="p-1.5 rounded-lg bg-[#171a26] hover:bg-red-500/20 text-[#8e92a8] hover:text-red-300 border border-[#25293d] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Streaming Mode Toggle */}
          {onToggleStreamingMode && (
            <button
              onClick={() => onToggleStreamingMode(!isStreamingMode)}
              title={isStreamingMode ? 'Streaming Mode enabled (SSE chunked audio)' : 'Click to enable real-time SSE streaming mode'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                isStreamingMode
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-xs'
                  : 'bg-[#171a26] text-[#8e92a8] hover:text-white border-[#25293d]'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isStreamingMode ? 'text-amber-400 fill-amber-400' : ''}`} />
              <span>{isStreamingMode ? 'Streaming' : 'Batch'}</span>
            </button>
          )}

          {/* Quick Mixer button */}
          {onOpenMixer && (
            <button
              onClick={onOpenMixer}
              title="Open Background Audio Mixer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#171a26] hover:bg-purple-600/20 text-purple-300 hover:text-white text-xs font-medium border border-purple-500/30 transition-colors"
            >
              <Music className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Mixer</span>
            </button>
          )}

          {/* Quick Export button */}
          {onOpenExport && hasGeneration && (
            <button
              onClick={onOpenExport}
              title="Open Creator Export Package"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#171a26] hover:bg-indigo-600/20 text-indigo-300 hover:text-white text-xs font-medium border border-indigo-500/30 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Export</span>
            </button>
          )}

          {/* Save Project */}
          <button
            onClick={onSave}
            title="Save Project"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#171a26] hover:bg-[#252a3d] text-white text-xs font-medium border border-[#25293d] transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-purple-400" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Quick Tag Insertion Ribbon */}
      <div className="px-5 py-2.5 border-b border-[#1c1f2e] bg-[#10121a] flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
          <span className="text-[11px] font-semibold text-[#6d7288] uppercase tracking-wider mr-1 shrink-0">
            Insert Tag:
          </span>

          {/* Featured quick tags */}
          {[
            { tag: '<excited>', label: 'Excited', color: 'hover:border-pink-500 hover:text-pink-300' },
            { tag: '<whispers>', label: 'Whispers', color: 'hover:border-purple-500 hover:text-purple-300' },
            { tag: '<laugh>', label: 'Laugh', color: 'hover:border-yellow-500 hover:text-yellow-300' },
            { tag: '<pauses>', label: 'Pauses', color: 'hover:border-indigo-500 hover:text-indigo-300' },
            { tag: '<slow>', label: 'Slow', color: 'hover:border-blue-500 hover:text-blue-300' },
            { tag: '<sigh>', label: 'Sigh', color: 'hover:border-cyan-500 hover:text-cyan-300' },
            { tag: '<giggle>', label: 'Giggle', color: 'hover:border-amber-500 hover:text-amber-300' },
            { tag: '<shouting>', label: 'Shouting', color: 'hover:border-red-500 hover:text-red-300' },
            { tag: '<clears throat>', label: 'Clears Throat', color: 'hover:border-lime-500 hover:text-lime-300' },
          ].map((item) => (
            <button
              key={item.tag}
              onClick={() => insertTag(item.tag)}
              title={`Insert ${item.tag} at cursor`}
              className={`shrink-0 px-2 py-1 rounded-md bg-[#161824] border border-[#232738] text-xs font-mono text-[#aeb3c8] transition-all active:scale-95 ${item.color}`}
            >
              {item.tag}
            </button>
          ))}
        </div>

        <button
          onClick={onOpenTagPalette}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-medium transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          <span>All 13 Tags</span>
        </button>
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative p-5 overflow-y-auto">
        {viewMode === 'editor' ? (
          <div className="h-full flex flex-col">
            <textarea
              ref={textareaRef}
              value={script}
              onChange={(e) => updateScriptWithHistory(e.target.value)}
              placeholder="Enter your script here. Insert audio tags like <whispers>, <laugh>, or <excited> to direct vocal emotion and delivery..."
              className="flex-1 w-full bg-transparent text-[#e5e7eb] font-mono text-sm sm:text-base leading-relaxed resize-none focus:outline-none placeholder-[#4b5066] selection:bg-purple-600/40"
              spellCheck={false}
            />
          </div>
        ) : (
          /* Visual Expression Spans Inspector */
          <div className="h-full bg-[#0a0b10] rounded-xl p-5 border border-[#1d202d] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1c1f2e]">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  Expression Continuation Timeline
                </h4>
                <p className="text-[11px] text-[#8e92a8]">
                  In Timbre v3.0, each expression tag governs subsequent vocal delivery until the next tag is encountered.
                </p>
              </div>
            </div>

            {spans.length === 0 ? (
              <div className="text-center py-12 text-[#5a5f75] text-xs font-mono">
                No script text to inspect. Switch back to Script mode and write lines with expression tags.
              </div>
            ) : (
              <div className="space-y-3 font-mono text-sm leading-relaxed">
                {spans.map((span) => {
                  if (span.type === 'tag') {
                    const tag = span.tagInfo;
                    return (
                      <div
                        key={span.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold mr-2 my-1 shadow-sm"
                        style={{
                          backgroundColor: tag?.badgeBg || 'rgba(168, 85, 247, 0.15)',
                          borderColor: tag?.badgeBorder || 'rgba(168, 85, 247, 0.4)',
                          color: tag?.color || '#a855f7',
                        }}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{span.content}</span>
                        <span className="text-[10px] font-sans uppercase opacity-75 font-normal ml-1">
                          ({tag?.category || 'tag'})
                        </span>
                      </div>
                    );
                  }

                  const activeTag = span.activeTag;
                  return (
                    <span
                      key={span.id}
                      className="px-1.5 py-0.5 rounded transition-colors"
                      style={{
                        backgroundColor: activeTag ? `${activeTag.badgeBg}` : 'transparent',
                        color: activeTag ? '#f3f4f6' : '#9ca3af',
                        borderLeft: activeTag ? `2px solid ${activeTag.color}` : 'none',
                      }}
                      title={activeTag ? `Active expression: ${activeTag.tag} (${activeTag.name})` : 'Natural delivery'}
                    >
                      {span.content}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Validation Warnings / Error Banner */}
      {(!validation.isValid || validation.warnings.length > 0) && (
        <div className="px-5 py-2.5 bg-[#14121a] border-t border-[#261f30] text-xs">
          {validation.errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-red-400 py-0.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
          {validation.warnings.map((warn, i) => (
            <div key={i} className="flex items-center gap-2 text-amber-300 py-0.5">
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Script Statistics & Primary Execution Bar */}
      <div className="px-5 py-3 border-t border-[#1c1f2e] bg-[#10121a] flex flex-wrap items-center justify-between gap-3">
        {/* Statistics Pill */}
        <div className="flex items-center gap-4 text-xs font-mono text-[#8e92a8]">
          <span title="Spoken word count">
            <strong className="text-white">{validation.wordCount}</strong> words
          </span>
          <span>•</span>
          <span title="Total characters">
            <strong className="text-white">{validation.characterCount}</strong> chars
          </span>
          <span>•</span>
          <span title="Estimated spoken duration">
            Est. <strong className="text-purple-300">{validation.estimatedDurationSeconds}s</strong>
          </span>
          <span>•</span>
          <span title="Expression tags detected">
            <strong className="text-purple-400">{validation.detectedTags.length}</strong> tags
          </span>
        </div>

        {/* Execution & Streaming Controls */}
        <div className="flex items-center gap-2">
          {/* Active Streaming Progress & Cancel */}
          {isGenerating && isStreamingMode && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-300">
              <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>
                {streamingProgress && streamingProgress.chunks > 0
                  ? `Chunk ${streamingProgress.chunks} • ${(streamingProgress.bytes / 1024).toFixed(1)} KB`
                  : 'Buffering stream...'}
              </span>
              {onCancelStream && (
                <button
                  onClick={onCancelStream}
                  title="Cancel stream request"
                  className="p-1 rounded hover:bg-amber-500/20 text-amber-200 transition-colors ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Primary Action Button */}
          <button
            onClick={onGenerate}
            disabled={isGenerating || !validation.isValid}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs shadow-lg transition-all ${
              isGenerating || !validation.isValid
                ? 'bg-[#1e2233] text-[#555a73] cursor-not-allowed shadow-none'
                : isStreamingMode
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-900/30 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white shadow-purple-900/30 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isStreamingMode ? (
              <Zap className={`w-4 h-4 ${isGenerating ? 'animate-bounce text-yellow-200' : ''}`} />
            ) : (
              <Wand2 className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            )}
            <span>
              {isGenerating
                ? isStreamingMode
                  ? 'Streaming Audio...'
                  : 'Synthesizing Audio...'
                : isStreamingMode
                ? 'Stream Expressive Speech (SSE)'
                : 'Generate Expressive Speech'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

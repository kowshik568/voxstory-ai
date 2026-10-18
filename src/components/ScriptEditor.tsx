/**
 * VoxStory AI - Directorial Script Editor (v11.0)
 * Dual-Mode Script Workstation: Paragraph Flow & Structured Dialogue Line Cast.
 * Features:
 * - Speaker assignment for each line
 * - Inline tag suggestions & autocomplete
 * - Real-time character count, word count, and estimated duration
 * - Unsupported tag validation with 1-click quick-fix
 * - Empty line detection
 * - Full Undo / Redo history stack
 * - Autosave with explicit Saved / Saving / Unsaved states
 * - Keyboard shortcuts (Cmd+S, Cmd+Enter, Cmd+Z, Cmd+Shift+Z, Alt+T, ?)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Plus,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Users,
  Keyboard,
  Clock,
  Volume2,
  SlidersHorizontal,
} from 'lucide-react';
import {
  VERIFIED_TAGS,
  TAG_MAP,
  parseScriptToSpans,
  validateScript,
  normalizeTag,
} from '../lib/tagCatalog';
import { ExpressionTag, ScriptValidationResult } from '../types';
import { ProjectCharacter } from './CharacterPanel';
import { TagAutocomplete } from './TagAutocomplete';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { SUPPORTED_VOICES } from '../lib/voices';
import { generateProceduralSpeechWav } from '../lib/audioGenerator';

export interface ScriptLine {
  id: string;
  characterId: string;
  text: string;
}

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
  characters?: ProjectCharacter[];
  onOpenCharacterPanel?: () => void;
  onSwitchToMultitrack?: () => void;
}

const DEFAULT_CHARACTERS_LIST: ProjectCharacter[] = [
  { id: 'char-1', name: 'Nalini (Narrator)', voice: 'Nalini', role: 'Narrator', color: '#ec4899', speed: 1.0 },
  { id: 'char-2', name: 'Rohan (Lead)', voice: 'Rohan', role: 'Protagonist', color: '#8b5cf6', speed: 1.0 },
  { id: 'char-3', name: 'Aarav (Tech)', voice: 'Aarav', role: 'AI / Assistant', color: '#06b6d4', speed: 1.0 },
];

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
  characters = DEFAULT_CHARACTERS_LIST,
  onOpenCharacterPanel,
  onSwitchToMultitrack,
}) => {
  // Mode: 'flow' (paragraph/narration) | 'dialogue' (structured lines) | 'spans' (visual tags)
  const [editorMode, setEditorMode] = useState<'flow' | 'dialogue' | 'spans'>('flow');

  // Undo / Redo history
  const [history, setHistory] = useState<string[]>([script]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Autosave status indicator
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tag autocomplete popover state
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  // Audition single line state
  const [auditioningLineId, setAuditioningLineId] = useState<string | null>(null);
  const lineAudioRef = useRef<HTMLAudioElement | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Parse structured dialogue lines from script or state
  const [lines, setLines] = useState<ScriptLine[]>(() => parseScriptToLines(script, characters));

  // Keep script and lines in sync when user edits
  function parseScriptToLines(rawText: string, chars: ProjectCharacter[]): ScriptLine[] {
    const rawParagraphs = rawText.split('\n\n').filter((p) => p.trim().length > 0);
    if (rawParagraphs.length === 0) {
      return [{ id: 'line-1', characterId: chars[0]?.id || 'char-1', text: rawText }];
    }

    return rawParagraphs.map((para, idx) => {
      // Check if paragraph starts with "CharacterName:"
      const match = para.match(/^([A-Za-z0-9\s()_-]+):\s*(.*)$/s);
      if (match) {
        const charName = match[1].trim();
        const found = chars.find((c) => c.name.toLowerCase() === charName.toLowerCase());
        return {
          id: `line-${idx + 1}-${Date.now()}`,
          characterId: found ? found.id : chars[idx % chars.length]?.id || 'char-1',
          text: match[2].trim(),
        };
      }
      return {
        id: `line-${idx + 1}-${Date.now()}`,
        characterId: chars[idx % chars.length]?.id || 'char-1',
        text: para.trim(),
      };
    });
  }

  // Validate script
  const validation: ScriptValidationResult = validateScript(script);

  // Parse spans for visual expression inspector
  const spans = parseScriptToSpans(script);

  // Check for empty lines or warnings
  const scriptParagraphs = script.split('\n\n');
  const hasEmptyLines = scriptParagraphs.some((p) => p.trim() === '' && scriptParagraphs.length > 1);

  // Update script with undo/redo history tracking
  const updateScriptWithHistory = useCallback(
    (newScript: string) => {
      onScriptChange(newScript);
      const updatedHistory = history.slice(0, historyIndex + 1);
      updatedHistory.push(newScript);
      setHistory(updatedHistory);
      setHistoryIndex(updatedHistory.length - 1);

      // Trigger autosave debounced state
      setSaveStatus('unsaved');
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => {
        setSaveStatus('saving');
        setTimeout(() => {
          setSaveStatus('saved');
          const now = new Date();
          setLastSavedTime(
            now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          );
          onSave();
        }, 500);
      }, 1200);
    },
    [history, historyIndex, onScriptChange, onSave]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onScriptChange(prev);
      setLines(parseScriptToLines(prev, characters));
    }
  }, [history, historyIndex, onScriptChange, characters]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onScriptChange(next);
      setLines(parseScriptToLines(next, characters));
    }
  }, [history, historyIndex, onScriptChange, characters]);

  // Insert tag at cursor or wrap selected text
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
      newScript = script.substring(0, start) + `${tag} ` + selectedText + script.substring(end);
      newCursorPos = start + tag.length + 1 + selectedText.length;
    } else {
      newScript = script.substring(0, start) + `${tag} ` + script.substring(end);
      newCursorPos = start + tag.length + 1;
    }

    updateScriptWithHistory(newScript);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  // Quick fix unsupported tags (e.g. <whisper> -> <whispers>)
  const handleFixInvalidTag = (invalidTag: string) => {
    const clean = invalidTag.replace(/^[<[]+|[>\]]+$/g, '').toLowerCase();
    // Find closest match in VERIFIED_TAGS
    const match = VERIFIED_TAGS.find(
      (t) =>
        t.name.toLowerCase().startsWith(clean) ||
        clean.startsWith(t.name.toLowerCase()) ||
        t.id.includes(clean)
    );
    if (match) {
      const fixedScript = script.replaceAll(invalidTag, match.tag);
      updateScriptWithHistory(fixedScript);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave();
        setSaveStatus('saved');
        const now = new Date();
        setLastSavedTime(
          now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (validation.isValid && !isGenerating) {
          onGenerate();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setIsAutocompleteOpen(true);
      } else if (e.key === '?' && !isInput) {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onGenerate, validation.isValid, isGenerating, handleUndo, handleRedo]);

  // Line operations for Structured Dialogue mode
  const handleUpdateLine = (id: string, text: string) => {
    const updated = lines.map((l) => (l.id === id ? { ...l, text } : l));
    setLines(updated);
    // Sync to consolidated script without rewriting unexpectedly
    const consolidated = updated.map((l) => l.text).join('\n\n');
    updateScriptWithHistory(consolidated);
  };

  const handleUpdateLineCharacter = (lineId: string, charId: string) => {
    const updated = lines.map((l) => (l.id === lineId ? { ...l, characterId: charId } : l));
    setLines(updated);
  };

  const handleAddLine = () => {
    const defaultChar = characters[0]?.id || 'char-1';
    const newLine: ScriptLine = {
      id: `line-${Date.now()}`,
      characterId: defaultChar,
      text: '<whispers> Add dialogue line here...',
    };
    const updated = [...lines, newLine];
    setLines(updated);
    updateScriptWithHistory(updated.map((l) => l.text).join('\n\n'));
  };

  const handleDeleteLine = (id: string) => {
    if (lines.length <= 1) {
      alert('The script requires at least one dialogue line.');
      return;
    }
    const updated = lines.filter((l) => l.id !== id);
    setLines(updated);
    updateScriptWithHistory(updated.map((l) => l.text).join('\n\n'));
  };

  const handleDuplicateLine = (idx: number) => {
    const target = lines[idx];
    const dup: ScriptLine = { ...target, id: `line-${Date.now()}` };
    const updated = [...lines];
    updated.splice(idx + 1, 0, dup);
    setLines(updated);
    updateScriptWithHistory(updated.map((l) => l.text).join('\n\n'));
  };

  const handleMoveLine = (idx: number, dir: 'up' | 'down') => {
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= lines.length) return;
    const updated = [...lines];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setLines(updated);
    updateScriptWithHistory(updated.map((l) => l.text).join('\n\n'));
  };

  // Audition individual line
  const handleAuditionLine = async (line: ScriptLine) => {
    if (auditioningLineId === line.id) {
      if (lineAudioRef.current) lineAudioRef.current.pause();
      setAuditioningLineId(null);
      return;
    }

    const char = characters.find((c) => c.id === line.characterId) || characters[0];
    setAuditioningLineId(line.id);

    try {
      const response = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: line.text,
          voice: char?.voice || 'Nalini',
          language: 'en-IN',
          audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
          title: `Line Preview: ${char?.name || 'Actor'}`,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        playLineAudio(json.data.audioUrl, line.id);
      } else {
        throw new Error('Live generation failed');
      }
    } catch {
      // Fallback procedural
      const voice = SUPPORTED_VOICES.find((v) => v.name === char?.voice) || SUPPORTED_VOICES[0];
      const synth = generateProceduralSpeechWav(line.text, voice.gender, 24000);
      playLineAudio(synth.dataUrl, line.id);
    }
  };

  const playLineAudio = (url: string, lineId: string) => {
    if (!lineAudioRef.current) lineAudioRef.current = new Audio();
    lineAudioRef.current.src = url;
    lineAudioRef.current.play().catch(console.error);
    lineAudioRef.current.onended = () => setAuditioningLineId(null);
    lineAudioRef.current.onerror = () => setAuditioningLineId(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0f17] border-x border-[#1c1f2e] min-w-0">
      {/* Audio element for line auditioning */}
      <audio ref={lineAudioRef} />

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

        {/* Center / Right Toolbar Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Editor Mode Selector: Flow vs Dialogue vs Spans */}
          <div className="flex items-center bg-[#171a26] p-0.5 rounded-lg border border-[#25293d] text-xs">
            <button
              onClick={() => setEditorMode('flow')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
                editorMode === 'flow'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-[#8e92a8] hover:text-white'
              }`}
              title="Standard paragraph script mode"
            >
              <Edit3 className="w-3 h-3" />
              <span>Narration</span>
            </button>

            <button
              onClick={() => setEditorMode('dialogue')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
                editorMode === 'dialogue'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-[#8e92a8] hover:text-white'
              }`}
              title="Structured dialogue lines with character assignments"
            >
              <Users className="w-3 h-3" />
              <span>Line Cast</span>
            </button>

            <button
              onClick={() => setEditorMode('spans')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
                editorMode === 'spans'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-[#8e92a8] hover:text-white'
              }`}
              title="Inspect acoustic expression spans"
            >
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">Expression Spans</span>
            </button>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center bg-[#171a26] rounded-lg border border-[#25293d] p-0.5 text-[#8e92a8]">
            <button
              onClick={handleUndo}
              disabled={historyIndex === 0}
              title="Undo (Cmd+Z)"
              className="p-1.5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo (Cmd+Shift+Z)"
              className="p-1.5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Character Management Drawer Trigger */}
          {onOpenCharacterPanel && (
            <button
              onClick={onOpenCharacterPanel}
              title="Manage Project Characters & Voices"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#171a26] hover:bg-purple-600/20 text-purple-300 hover:text-white text-xs font-semibold border border-purple-500/30 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden lg:inline">Cast ({characters.length})</span>
            </button>
          )}

          {/* Multitrack Timeline Direct Link */}
          {onSwitchToMultitrack && (
            <button
              onClick={onSwitchToMultitrack}
              title="Open in Multitrack DAW Timeline"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#171a26] hover:bg-purple-600/20 text-purple-300 hover:text-white text-xs font-semibold border border-purple-500/30 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden xl:inline">DAW Timeline</span>
            </button>
          )}

          {/* Copy Script */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(script);
              setHasCopied(true);
              setTimeout(() => setHasCopied(false), 2000);
            }}
            title="Copy Full Script"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#171a26] hover:bg-[#252a3d] text-xs text-[#8e92a8] hover:text-white border border-[#25293d] transition-colors"
          >
            {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Keyboard Shortcuts Guide */}
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            title="Workstation Keyboard Shortcuts (?)"
            className="p-1.5 rounded-lg bg-[#171a26] hover:bg-[#252a3d] text-xs text-[#8e92a8] hover:text-white border border-[#25293d] transition-colors"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {/* Streaming Toggle */}
          {onToggleStreamingMode && (
            <button
              onClick={() => onToggleStreamingMode(!isStreamingMode)}
              title={isStreamingMode ? 'SSE Streaming Active' : 'Switch to SSE real-time streaming'}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                isStreamingMode
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-xs'
                  : 'bg-[#171a26] text-[#8e92a8] hover:text-white border-[#25293d]'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isStreamingMode ? 'text-amber-400 fill-amber-400' : ''}`} />
              <span className="hidden sm:inline">{isStreamingMode ? 'Streaming' : 'Batch'}</span>
            </button>
          )}

          {/* Quick Mixer */}
          {onOpenMixer && (
            <button
              onClick={onOpenMixer}
              title="Open Ambience & Audio Mixer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#171a26] hover:bg-purple-600/20 text-purple-300 hover:text-white text-xs font-medium border border-purple-500/30 transition-colors"
            >
              <Music className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">Mixer</span>
            </button>
          )}

          {/* Quick Export */}
          {onOpenExport && hasGeneration && (
            <button
              onClick={onOpenExport}
              title="Creator Export (SRT / VTT / WAV)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#171a26] hover:bg-indigo-600/20 text-indigo-300 hover:text-white text-xs font-medium border border-indigo-500/30 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">Export</span>
            </button>
          )}

          {/* Autosave Status Pill & Save Button */}
          <div className="flex items-center gap-1.5 pl-1 border-l border-[#24283c]">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono text-[#7a8099]"
              title={`Autosave: ${saveStatus}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  saveStatus === 'saved'
                    ? 'bg-emerald-400'
                    : saveStatus === 'saving'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-amber-500'
                }`}
              />
              <span className="capitalize">{saveStatus}</span>
            </div>

            <button
              onClick={onSave}
              title="Save Project (Cmd+S)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1a1d2c] hover:bg-[#252a3d] text-white text-xs font-medium border border-[#282d42] transition-colors"
            >
              <Save className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Save</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Tag Insertion Ribbon */}
      <div className="px-5 py-2.5 border-b border-[#1c1f2e] bg-[#10121a] flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
          <span className="text-[11px] font-semibold text-[#6d7288] uppercase tracking-wider mr-1 shrink-0">
            Insert Tag:
          </span>

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

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAutocompleteOpen(true)}
            title="Search expression tags (Alt+T)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            <span>Search All 13 Tags</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative p-5 overflow-y-auto min-h-0">
        {editorMode === 'flow' ? (
          /* 1. Freeform Narration / Paragraphs View */
          <div className="h-full flex flex-col">
            <textarea
              ref={textareaRef}
              value={script}
              onChange={(e) => {
                const val = e.target.value;
                updateScriptWithHistory(val);
                // If user just typed '<', trigger autocomplete
                if (val.endsWith('<')) {
                  setIsAutocompleteOpen(true);
                  setAutocompleteQuery('');
                }
              }}
              placeholder="Enter your vocal script here. Insert audio emotion tags like <whispers>, <laugh>, or <excited> to direct vocal delivery..."
              className="flex-1 w-full bg-transparent text-[#e5e7eb] font-mono text-sm sm:text-base leading-relaxed resize-none focus:outline-none placeholder-[#4b5066] selection:bg-purple-600/40"
              spellCheck={false}
            />
          </div>
        ) : editorMode === 'dialogue' ? (
          /* 2. Structured Dialogue Lines & Speaker Cast View */
          <div className="h-full flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1c1f2e]">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  Dialogue Cast & Speaker Sequencing
                </h4>
                <p className="text-[11px] text-[#8e92a8]">
                  Assign voice actors to each line, audition takes individually, and adjust pacing.
                </p>
              </div>

              <button
                onClick={handleAddLine}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Dialogue Line</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {lines.map((line, idx) => {
                const char = characters.find((c) => c.id === line.characterId) || characters[0];
                const lineVal = validateScript(line.text);
                const isAuditioning = auditioningLineId === line.id;

                return (
                  <div
                    key={line.id}
                    className="p-3.5 rounded-xl bg-[#12141f] border border-[#202436] hover:border-[#2c324a] space-y-2 transition-all"
                  >
                    {/* Line Header: Line Number, Speaker Pill, Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-[#646a82]">
                          #{idx + 1}
                        </span>

                        {/* Speaker Selector */}
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#181a28] border border-[#282d42]">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: char?.color || '#ec4899' }}
                          />
                          <select
                            value={line.characterId}
                            onChange={(e) => handleUpdateLineCharacter(line.id, e.target.value)}
                            className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
                          >
                            {characters.map((c) => (
                              <option key={c.id} value={c.id} className="bg-[#181a28] text-white">
                                {c.name} ({c.voice})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Duration estimate badge */}
                        <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                          ~{lineVal.estimatedDurationSeconds}s ({lineVal.wordCount} words)
                        </span>
                      </div>

                      {/* Line Toolbar */}
                      <div className="flex items-center gap-1 text-[#8e92a8]">
                        {/* Audition Single Line */}
                        <button
                          onClick={() => handleAuditionLine(line)}
                          title="Audition this single dialogue line"
                          className={`p-1.5 rounded-lg transition-colors ${
                            isAuditioning
                              ? 'bg-purple-600 text-white animate-pulse'
                              : 'hover:bg-[#1f2336] hover:text-white'
                          }`}
                        >
                          {isAuditioning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>

                        {/* Insert tag to this line */}
                        <button
                          onClick={() => {
                            setIsAutocompleteOpen(true);
                          }}
                          title="Add expression tag"
                          className="p-1.5 rounded-lg hover:bg-[#1f2336] hover:text-purple-300 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>

                        {/* Move Up */}
                        <button
                          onClick={() => handleMoveLine(idx, 'up')}
                          disabled={idx === 0}
                          title="Move up"
                          className="p-1.5 rounded-lg hover:bg-[#1f2336] disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Move Down */}
                        <button
                          onClick={() => handleMoveLine(idx, 'down')}
                          disabled={idx === lines.length - 1}
                          title="Move down"
                          className="p-1.5 rounded-lg hover:bg-[#1f2336] disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Duplicate */}
                        <button
                          onClick={() => handleDuplicateLine(idx)}
                          title="Duplicate line"
                          className="p-1.5 rounded-lg hover:bg-[#1f2336] hover:text-white transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteLine(line.id)}
                          title="Delete line"
                          className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Line Text Area */}
                    <textarea
                      value={line.text}
                      onChange={(e) => handleUpdateLine(line.id, e.target.value)}
                      rows={2}
                      className="w-full bg-[#0a0b10] border border-[#1b1e2c] focus:border-purple-500 rounded-lg p-2.5 text-xs sm:text-sm font-mono text-[#e5e7eb] focus:outline-none resize-none"
                    />

                    {/* Line Warnings */}
                    {!lineVal.isValid && (
                      <div className="text-[11px] text-red-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{lineVal.errors[0]}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* 3. Visual Expression Spans Inspector */
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
                No script text to inspect. Switch back to Narration mode and write lines with expression tags.
              </div>
            ) : (
              <div className="space-y-3 font-mono text-sm leading-relaxed">
                {spans.map((span) => {
                  if (span.type === 'tag') {
                    const tag = span.tagInfo;
                    return (
                      <div
                        key={span.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold mr-2 my-1 shadow-xs"
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

      {/* Validation Warnings / Error Banner & Quick Fix */}
      {(!validation.isValid || validation.warnings.length > 0 || hasEmptyLines) && (
        <div className="px-5 py-2.5 bg-[#14121a] border-t border-[#261f30] text-xs space-y-1">
          {validation.errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-red-400 py-0.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}

          {/* Invalid tags warnings with quick fix button */}
          {validation.invalidTags.map((badTag, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-amber-300 py-0.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>
                  Unsupported tag <strong className="font-mono text-amber-200">{badTag}</strong>. Timbre v3.0 supports 13 verified tags.
                </span>
              </div>
              <button
                onClick={() => handleFixInvalidTag(badTag)}
                className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-semibold border border-amber-500/40"
              >
                Auto-fix tag
              </button>
            </div>
          ))}

          {hasEmptyLines && (
            <div className="flex items-center gap-2 text-amber-300/80 py-0.5 text-[11px]">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Multiple empty paragraph breaks detected. Use &lt;pauses&gt; for deliberate silences.</span>
            </div>
          )}
        </div>
      )}

      {/* Script Statistics & Primary Execution Bar */}
      <div className="px-5 py-3 border-t border-[#1c1f2e] bg-[#10121a] flex flex-wrap items-center justify-between gap-3">
        {/* Statistics Pill */}
        <div className="flex items-center gap-3 text-xs font-mono text-[#8e92a8]">
          <span title="Spoken word count">
            <strong className="text-white">{validation.wordCount}</strong> words
          </span>
          <span>•</span>
          <span title="Total characters">
            <strong className="text-white">{validation.characterCount}</strong> chars
          </span>
          <span>•</span>
          <span title="Estimated spoken duration factoring tag pacing">
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
                ? 'Stream Speech (SSE)'
                : 'Generate Expressive Speech'}
            </span>
          </button>
        </div>
      </div>

      {/* Autocomplete Popover */}
      <TagAutocomplete
        isOpen={isAutocompleteOpen}
        onClose={() => setIsAutocompleteOpen(false)}
        query={autocompleteQuery}
        onSelectTag={(tag) => {
          insertTag(tag);
        }}
      />

      {/* Keyboard Shortcuts Reference Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
};

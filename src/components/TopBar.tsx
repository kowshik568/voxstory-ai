/**
 * VoxStory AI - Studio Top Workspace Bar (v4.0)
 * Linear & Vercel inspired single-row precision header.
 * Inline project title editor, save status, breadcrumb trail,
 * live provider indicator, and primary generation CTA.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Check,
  RefreshCw,
  Radio,
  Download,
  Share2,
  Copy,
  Edit2,
  ChevronRight,
  ShieldCheck,
  Sliders,
  Play,
  RotateCcw,
} from 'lucide-react';
import { ProviderHealth, SupportedLanguage } from '../types';

interface TopBarProps {
  currentView: string;
  projectTitle: string;
  onTitleChange: (newTitle: string) => void;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  health: ProviderHealth | null;
  activeVoice: string;
  activeLanguage: SupportedLanguage;
  isGenerating: boolean;
  onGenerate: () => void;
  isStreamingMode: boolean;
  onToggleStreamingMode: (enabled: boolean) => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  hasAudio: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  projectTitle,
  onTitleChange,
  saveStatus,
  health,
  activeVoice,
  activeLanguage,
  isGenerating,
  onGenerate,
  isStreamingMode,
  onToggleStreamingMode,
  onOpenExport,
  onOpenSettings,
  hasAudio,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(projectTitle);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setEditedTitle(projectTitle);
  }, [projectTitle]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const commitTitle = () => {
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== projectTitle) {
      onTitleChange(trimmed);
    } else {
      setEditedTitle(projectTitle);
    }
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitTitle();
    } else if (e.key === 'Escape') {
      setEditedTitle(projectTitle);
      setIsEditingTitle(false);
    }
  };

  const isLive = health?.hasApiKey;

  // View name helper
  const getViewName = () => {
    switch (currentView) {
      case 'studio':
        return 'Solo Studio';
      case 'dialogue':
        return 'Dialogue Studio';
      case 'mixer':
        return 'Audio Mixer';
      case 'projects':
        return 'Project Library';
      case 'history':
        return 'Generation Log';
      case 'voices':
        return 'Voice Directory';
      case 'exports':
        return 'Export Center';
      case 'showcase':
        return 'A/B Showcase';
      default:
        return 'Workspace';
    }
  };

  return (
    <header className="h-14 bg-[#0B0C12] border-b border-[#1A1C29] px-4 lg:px-6 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Breadcrumb & Editable Project Title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-1.5 text-xs text-[#71758C] shrink-0 font-medium">
          <span className="hover:text-white transition-colors cursor-default">VoxStory</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#4E5268]" />
          <span className="text-[#969AB2]">{getViewName()}</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#4E5268]" />
        </div>

        {/* Project Title Editor */}
        <div className="flex items-center gap-2 min-w-0">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={handleKeyDown}
              className="bg-[#151722] border border-violet-500 rounded px-2 py-0.5 text-xs font-semibold text-white focus:outline-none w-56 sm:w-72"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-center gap-1.5 text-left text-xs font-semibold text-white hover:text-violet-300 transition-colors truncate max-w-[200px] sm:max-w-xs focus:outline-none"
              title="Click to rename project"
            >
              <span className="truncate">{projectTitle}</span>
              <Edit2 className="w-3 h-3 text-[#5A5E78] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}

          {/* Unboxed Save Status */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#6A6E85] shrink-0 font-medium ml-1">
            {saveStatus === 'saving' ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-violet-400" />
                <span>Saving</span>
              </>
            ) : saveStatus === 'unsaved' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-amber-400/80">Unsaved</span>
              </>
            ) : (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Saved</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Controls: Voice Metadata, Stream Toggle, Export, Primary Synthesize */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Active Voice Pill / Text Indicator */}
        <div className="hidden md:flex items-center gap-2 text-xs text-[#8E92A8] px-2.5 py-1 rounded bg-[#131520] border border-[#1E2130]">
          <span className="text-white font-medium">{activeVoice}</span>
          <span className="text-[#52566F]">·</span>
          <span className="font-mono text-[11px] text-[#9EA3BC]">{activeLanguage}</span>
        </div>

        {/* SSE Streaming Mode Toggle */}
        <button
          onClick={() => onToggleStreamingMode(!isStreamingMode)}
          title="Toggle live SSE audio streaming vs standard inference"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
            isStreamingMode
              ? 'bg-violet-950/30 border-violet-500/40 text-violet-300'
              : 'bg-[#131520] border-[#1E2130] text-[#787C94] hover:text-white'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${isStreamingMode ? 'text-violet-400' : 'text-[#5C6078]'}`} />
          <span className="hidden lg:inline">{isStreamingMode ? 'SSE Streaming' : 'Direct Render'}</span>
        </button>

        {/* Export Shortcut */}
        <button
          onClick={onOpenExport}
          title="Export audio and subtitles package"
          disabled={!hasAudio}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
            hasAudio
              ? 'bg-[#151724] border-[#222538] text-white hover:bg-[#1E2133]'
              : 'bg-[#11131C] border-[#181A25] text-[#555970] cursor-not-allowed'
          }`}
        >
          <Download className="w-3.5 h-3.5 text-[#8E92A8]" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Primary Synthesize CTA */}
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          title="Synthesize Audio (⌘ + Enter)"
          className={`h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-sm shadow-violet-900/30 whitespace-nowrap active:scale-[0.98] ${
            isGenerating
              ? 'bg-violet-800 text-violet-200 cursor-wait'
              : 'bg-violet-600 hover:bg-violet-500 text-white'
          }`}
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-violet-200" />
              <span>Synthesize</span>
              <kbd className="hidden xl:inline text-[10px] font-mono opacity-60 bg-violet-700/60 px-1 py-0.2 rounded">
                ⌘↵
              </kbd>
            </>
          )}
        </button>
      </div>
    </header>
  );
};

/**
 * VoxStory AI - Studio Top Workspace Bar (v13.0)
 * Precision header with mobile drawer trigger, editable project title,
 * real usage disclosure, quick voice/script search, and primary synthesis CTA.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Check,
  RefreshCw,
  Radio,
  Download,
  Edit2,
  ChevronRight,
  Menu,
  Search,
  Activity,
  User,
  ShieldCheck,
  X,
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
  onToggleMobileMenu?: () => void;
  onSearch?: (query: string) => void;
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
  onToggleMobileMenu,
  onSearch,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(projectTitle);
  const [searchVal, setSearchVal] = useState('');
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageData, setUsageData] = useState<{
    totalRequests: number;
    totalCharactersProcessed: number;
    totalAudioSecondsGenerated: number;
    creditAccountingNotice?: string;
  } | null>(null);

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

  // Load real usage metrics
  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/usage');
      if (res.ok) {
        const json = await res.json();
        setUsageData(json.data);
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchUsage();
  }, [isGenerating]);

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

  const getViewName = () => {
    switch (currentView) {
      case 'studio':
        return 'Voice Studio';
      case 'voices':
        return 'Voice Library';
      case 'favorites':
        return 'Favorites';
      case 'dialogue':
        return 'Dialogue Studio';
      case 'mixer':
        return 'Audio Mixer';
      case 'projects':
        return 'My Projects';
      case 'history':
        return 'Generation History';
      case 'exports':
        return 'Export Center';
      case 'showcase':
        return 'A/B Showcase';
      default:
        return 'Workspace';
    }
  };

  return (
    <header className="h-14 bg-[#0B0C12] border-b border-[#1A1C29] px-3 sm:px-4 lg:px-6 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Mobile Drawer Trigger + Breadcrumb + Editable Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Toggle */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden w-8 h-8 rounded-lg text-[#8E92A8] hover:text-white hover:bg-[#161824] flex items-center justify-center transition-colors shrink-0"
          title="Open Navigation"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Breadcrumb Trail */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#71758C] shrink-0 font-medium">
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
              className="bg-[#151722] border border-violet-500 rounded px-2 py-0.5 text-xs font-semibold text-white focus:outline-none w-44 sm:w-64"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-center gap-1.5 text-left text-xs font-semibold text-white hover:text-violet-300 transition-colors truncate max-w-[150px] sm:max-w-xs focus:outline-none"
              title="Click to rename project"
            >
              <span className="truncate">{projectTitle}</span>
              <Edit2 className="w-3 h-3 text-[#5A5E78] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}

          {/* Unboxed Save Status */}
          <div className="hidden md:flex items-center gap-1 text-[11px] text-[#6A6E85] shrink-0 font-medium ml-1">
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

      {/* Center Search (Visible on large screens) */}
      <div className="hidden xl:flex items-center relative w-56">
        <Search className="w-3.5 h-3.5 text-[#60647E] absolute left-2.5 top-2.5 pointer-events-none" />
        <input
          type="text"
          placeholder="Quick search voices / takes..."
          value={searchVal}
          onChange={(e) => {
            setSearchVal(e.target.value);
            if (onSearch) onSearch(e.target.value);
          }}
          className="w-full h-8 bg-[#12141F] border border-[#1E2130] rounded-lg pl-8 pr-2.5 text-xs text-white placeholder-[#60647E] focus:outline-none focus:border-violet-500/50 transition-colors"
        />
      </div>

      {/* Right Controls: Real Usage, Stream Toggle, Export, Primary Synthesize */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Real Usage Popover Trigger */}
        <button
          onClick={() => {
            fetchUsage();
            setShowUsageModal(!showUsageModal);
          }}
          title="View Provider Usage & Credits"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[#131520] hover:bg-[#181B28] border border-[#1E2130] text-[#8E92A8] hover:text-white transition-all"
        >
          <Activity className="w-3 h-3 text-violet-400" />
          <span>
            {usageData?.totalCharactersProcessed
              ? `${usageData.totalCharactersProcessed} chars`
              : 'Usage Log'}
          </span>
        </button>

        {/* Active Voice Pill / Text Indicator */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-[#8E92A8] px-2.5 py-1 rounded bg-[#131520] border border-[#1E2130]">
          <span className="text-white font-medium">{activeVoice}</span>
          <span className="text-[#52566F]">·</span>
          <span className="font-mono text-[11px] text-[#9EA3BC]">{activeLanguage}</span>
        </div>

        {/* SSE Streaming Mode Toggle */}
        <button
          onClick={() => onToggleStreamingMode(!isStreamingMode)}
          title="Toggle live SSE audio streaming vs standard inference"
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
            isStreamingMode
              ? 'bg-violet-950/30 border-violet-500/40 text-violet-300'
              : 'bg-[#131520] border-[#1E2130] text-[#787C94] hover:text-white'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${isStreamingMode ? 'text-violet-400' : 'text-[#5C6078]'}`} />
          <span className="hidden xl:inline">{isStreamingMode ? 'SSE Stream' : 'Direct'}</span>
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
          <span className="hidden md:inline">Export</span>
        </button>

        {/* Primary Synthesize CTA */}
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          title="Synthesize Audio (⌘ + Enter)"
          className={`h-8 px-3 sm:px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all shadow-sm shadow-violet-900/30 whitespace-nowrap active:scale-[0.98] ${
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

      {/* Real Usage Popover Dialog */}
      {showUsageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#12141F] border border-[#222538] rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E2130] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-white">Usage & Provider Accounting</h3>
              </div>
              <button
                onClick={() => setShowUsageModal(false)}
                className="text-[#6A6E85] hover:text-white p-1 rounded hover:bg-[#1A1C2B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[#0E1018] rounded-lg border border-[#1A1C29]">
                <div className="text-[#71758C]">Total Characters</div>
                <div className="text-base font-bold font-mono text-white mt-1">
                  {usageData?.totalCharactersProcessed || 0}
                </div>
              </div>
              <div className="p-3 bg-[#0E1018] rounded-lg border border-[#1A1C29]">
                <div className="text-[#71758C]">Audio Generated</div>
                <div className="text-base font-bold font-mono text-white mt-1">
                  {usageData?.totalAudioSecondsGenerated || 0}s
                </div>
              </div>
              <div className="p-3 bg-[#0E1018] rounded-lg border border-[#1A1C29]">
                <div className="text-[#71758C]">Total Requests</div>
                <div className="text-base font-bold font-mono text-white mt-1">
                  {usageData?.totalRequests || 0}
                </div>
              </div>
              <div className="p-3 bg-[#0E1018] rounded-lg border border-[#1A1C29]">
                <div className="text-[#71758C]">Provider Mode</div>
                <div className="text-xs font-semibold text-emerald-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Timbre v3.0</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#71758C] bg-[#0B0C12] p-3 rounded-lg border border-[#181A25] leading-relaxed">
              {usageData?.creditAccountingNotice ||
                'Gnani Timbre v3.0 charges based on character volume and inference requests according to enterprise API quota. Consult provider console for exact balance ledger.'}
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => setShowUsageModal(false)}
                className="px-3.5 py-1.5 bg-[#1A1D2D] hover:bg-[#222538] text-white text-xs font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

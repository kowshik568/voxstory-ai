/**
 * VoxStory AI - Main Creative Studio
 * Coordinates Left Sidebar (Projects & Templates), Center Editor, Right Inspector, and Bottom Audio Player
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Sliders,
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  BookOpen,
  Settings,
  ChevronRight,
  Layers,
  FileText,
  Clock,
  Volume2,
  Users,
  Mic,
  AlertCircle,
  X,
  Music,
  Download,
  Radio,
} from 'lucide-react';
import { ScriptEditor } from './ScriptEditor';
import { Inspector } from './Inspector';
import { AudioPlayer } from './AudioPlayer';
import { ExpressionPaletteModal } from './ExpressionPaletteModal';
import { DialogueEditor } from './DialogueEditor';
import { AudioMixerPanel } from './AudioMixerPanel';
import { ExportModal } from './ExportModal';
import { CharacterPanel, ProjectCharacter } from './CharacterPanel';
import { TEMPLATES } from '../lib/templates';
import { SUPPORTED_VOICES, DEFAULT_AUDIO_CONFIG } from '../lib/voices';
import { validateScript } from '../lib/tagCatalog';
import { generateProceduralSpeechWav } from '../lib/audioGenerator';
import { StreamingSpeechClient } from '../lib/streamingClient';
import {
  StudioProject,
  GenerationResult,
  SupportedLanguage,
  AudioConfig,
  ScriptTemplate,
  BackgroundTrackConfig,
} from '../types';

interface StudioProps {
  initialTemplate?: ScriptTemplate | null;
  onOpenSettings: () => void;
  onOpenDocs: () => void;
}

export const Studio: React.FC<StudioProps> = ({
  initialTemplate,
  onOpenSettings,
  onOpenDocs,
}) => {
  // Projects State
  const [projects, setProjects] = useState<StudioProject[]>([
    {
      id: 'proj-1',
      title: 'YouTube Tech Reveal Hook',
      script: `<excited> What if I told you that everything you knew about battery technology just became obsolete? <pauses> Last Tuesday, researchers quietly published a paper. <whispers> And the numbers they reported are almost impossible to believe.`,
      voice: 'Aarav',
      language: 'en-IN',
      audioConfig: { ...DEFAULT_AUDIO_CONFIG },
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-2',
      title: 'The Midnight Archive Mystery',
      script: `<whispers> The clock in the vestibule struck three. <pauses> Eleanor stepped past the torn velvet curtain. <sigh> There was no turning back now. <slow> She recognized the handwriting in the margin.`,
      voice: 'Nalini',
      language: 'en-IN',
      audioConfig: { ...DEFAULT_AUDIO_CONFIG },
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const [activeProjectId, setActiveProjectId] = useState<string>('proj-1');

  // Active Project Fields
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const [title, setTitle] = useState(activeProject?.title || 'Untitled Project');
  const [script, setScript] = useState(activeProject?.script || '');
  const [voice, setVoice] = useState(activeProject?.voice || 'Nalini');
  const [language, setLanguage] = useState<SupportedLanguage>(activeProject?.language || 'en-IN');
  const [audioConfig, setAudioConfig] = useState<AudioConfig>(
    activeProject?.audioConfig || { ...DEFAULT_AUDIO_CONFIG }
  );

  // Generation & Player State
  const [currentGeneration, setCurrentGeneration] = useState<GenerationResult | null>(null);
  const [generationHistory, setGenerationHistory] = useState<GenerationResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTagPaletteOpen, setIsTagPaletteOpen] = useState(false);

  // Studio Mode: 'solo' | 'dialogue'
  const [studioMode, setStudioMode] = useState<'solo' | 'dialogue'>('solo');
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Streaming Mode & Client
  const [isStreamingMode, setIsStreamingMode] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState<{ bytes: number; chunks: number } | null>(null);
  const streamingClientRef = React.useRef(new StreamingSpeechClient());

  // Background Audio Mixer & Export State
  const [bgConfig, setBgConfig] = useState<BackgroundTrackConfig | null>(null);
  const [isMixerOpen, setIsMixerOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null);

  // Cast & Character Management
  const [characters, setCharacters] = useState<ProjectCharacter[]>([
    { id: 'char-1', name: 'Nalini (Narrator)', voice: 'Nalini', role: 'Narrator', color: '#ec4899', speed: 1.0 },
    { id: 'char-2', name: 'Rohan (Lead)', voice: 'Rohan', role: 'Protagonist', color: '#8b5cf6', speed: 1.0 },
    { id: 'char-3', name: 'Aarav (Tech)', voice: 'Aarav', role: 'AI / Assistant', color: '#06b6d4', speed: 1.0 },
  ]);
  const [isCharacterPanelOpen, setIsCharacterPanelOpen] = useState(false);

  // Left sidebar tab: 'projects' | 'templates'
  const [sidebarTab, setSidebarTab] = useState<'projects' | 'templates'>('projects');
  // Mobile active pane: 'editor' | 'inspector' | 'sidebar'
  const [mobilePane, setMobilePane] = useState<'editor' | 'inspector' | 'sidebar'>('editor');

  // Handle template selection from parent/landing
  useEffect(() => {
    if (initialTemplate) {
      loadTemplate(initialTemplate);
    }
  }, [initialTemplate]);

  // Load persisted projects on mount
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data) && d.data.length > 0) {
          setProjects(d.data);
          setActiveProjectId(d.data[0].id);
          if (d.data[0].backgroundTrack) {
            setBgConfig(d.data[0].backgroundTrack);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Sync state when active project changes
  useEffect(() => {
    if (activeProject) {
      setTitle(activeProject.title);
      setScript(activeProject.script);
      setVoice(activeProject.voice);
      setLanguage(activeProject.language);
      setAudioConfig(activeProject.audioConfig || { ...DEFAULT_AUDIO_CONFIG });
      if (activeProject.mode) {
        setStudioMode(activeProject.mode);
      }
      if (activeProject.backgroundTrack) {
        setBgConfig(activeProject.backgroundTrack);
      } else {
        setBgConfig(null);
      }
    }
  }, [activeProjectId]);

  // Validation
  const validation = validateScript(script);

  const handleCreateNewProject = (mode: 'solo' | 'dialogue' = 'solo') => {
    const newProj: StudioProject = {
      id: `proj-${Date.now()}`,
      title: mode === 'solo' ? 'New Director Take' : 'New Multi-Character Scene',
      script: `<excited> Welcome to our new episode! <pauses> Direct your story with real vocal emotion.`,
      voice: 'Nalini',
      language: 'en-IN',
      mode,
      audioConfig: { ...DEFAULT_AUDIO_CONFIG },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProjects([newProj, ...projects]);
    setActiveProjectId(newProj.id);
    setStudioMode(mode);
  };

  const handleSaveProject = () => {
    setProjects(
      projects.map((p) =>
        p.id === activeProjectId
          ? {
              ...p,
              title,
              script,
              voice,
              language,
              mode: studioMode,
              audioConfig,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  };

  const handleDuplicateProject = (proj: StudioProject, e: React.MouseEvent) => {
    e.stopPropagation();
    const dup: StudioProject = {
      ...proj,
      id: `proj-${Date.now()}`,
      title: `${proj.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProjects([dup, ...projects]);
    setActiveProjectId(dup.id);
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (projects.length <= 1) {
      setGenerationError('You must keep at least one project in your studio library.');
      setTimeout(() => setGenerationError(null), 3500);
      return;
    }
    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);
    if (activeProjectId === id) {
      setActiveProjectId(remaining[0].id);
    }
  };

  const loadTemplate = (tpl: ScriptTemplate) => {
    setTitle(tpl.title);
    setScript(tpl.script);
    setVoice(tpl.recommendedVoice);
    setLanguage(tpl.recommendedLanguage);
    setStudioMode('solo');
  };

  const handleCancelStream = () => {
    streamingClientRef.current.cancel();
    setIsGenerating(false);
    setStreamingProgress(null);
  };

  /**
   * Primary Speech Generation Workflow
   * Supports both real-time SSE streaming and batch REST generation.
   * Never silently falls back to demo audio after a failed live generation!
   */
  const handleGenerate = async () => {
    if (!validation.isValid) return;

    setIsGenerating(true);
    setGenerationError(null);

    if (isStreamingMode) {
      // SSE Streaming Generation
      await streamingClientRef.current.startStream(
        {
          script,
          voice,
          language,
          audioConfig,
          title: `${title} - ${voice}`,
          projectId: activeProjectId,
        },
        {
          onStart: () => setStreamingProgress({ bytes: 0, chunks: 0 }),
          onProgress: (bytes, chunks) => setStreamingProgress({ bytes, chunks }),
          onComplete: (result) => {
            setIsGenerating(false);
            setStreamingProgress(null);
            setCurrentGeneration(result);
            setGenerationHistory([result, ...generationHistory]);
            handleSaveProject();
          },
          onError: (err) => {
            setIsGenerating(false);
            setStreamingProgress(null);
            setGenerationError(err);
          },
        }
      );
      return;
    }

    // Standard REST Batch Generation
    try {
      const response = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          voice,
          language,
          audioConfig,
          title: `${title} - ${voice}`,
          projectId: activeProjectId,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const result: GenerationResult = json.data;
        setCurrentGeneration(result);
        setGenerationHistory([result, ...generationHistory]);
      } else {
        const errJson = await response.json().catch(() => ({}));
        const errorMsg = errJson.error || `Provider HTTP error ${response.status}: ${response.statusText}`;
        setGenerationError(errorMsg);
      }
    } catch (err) {
      setGenerationError(
        `Failed to reach voice generation backend: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsGenerating(false);
      handleSaveProject();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0c12]">
      {/* Mobile Top Navigation Sub-Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 border-b border-[#1c1f2e] bg-[#10121a]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMobilePane('sidebar')}
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              mobilePane === 'sidebar' ? 'bg-purple-600 text-white' : 'text-[#8e92a8]'
            }`}
          >
            Library
          </button>
          <button
            onClick={() => setMobilePane('editor')}
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              mobilePane === 'editor' ? 'bg-purple-600 text-white' : 'text-[#8e92a8]'
            }`}
          >
            Script
          </button>
          <button
            onClick={() => setMobilePane('inspector')}
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              mobilePane === 'inspector' ? 'bg-purple-600 text-white' : 'text-[#8e92a8]'
            }`}
          >
            Voice & Audio
          </button>
        </div>

        <button
          onClick={() => handleCreateNewProject(studioMode)}
          className="p-1 rounded bg-[#1c2030] text-purple-300"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Main 3-Column Studio Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Projects & Templates (Desktop always, mobile conditionally) */}
        <div
          className={`w-72 lg:w-80 bg-[#0e1017] border-r border-[#1c1f2e] flex flex-col shrink-0 ${
            mobilePane === 'sidebar' ? 'flex w-full absolute inset-0 z-20' : 'hidden md:flex'
          }`}
        >
          {/* Sidebar Top: New Project & Tab Switcher */}
          <div className="p-4 border-b border-[#1c1f2e] space-y-3">
            {/* Mode Switcher */}
            <div className="flex items-center bg-[#141622] p-1 rounded-xl border border-[#232738] text-xs">
              <button
                onClick={() => setStudioMode('solo')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition-all ${
                  studioMode === 'solo'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-[#8e92a8] hover:text-white'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Solo</span>
              </button>
              <button
                onClick={() => setStudioMode('dialogue')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition-all ${
                  studioMode === 'dialogue'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-[#8e92a8] hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Dialogue</span>
              </button>
            </div>

            <button
              onClick={() => handleCreateNewProject(studioMode)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{studioMode === 'solo' ? 'New Solo Script' : 'New Dialogue Scene'}</span>
            </button>

            {/* Sub-tabs */}
            <div className="grid grid-cols-2 gap-1 bg-[#141622] p-1 rounded-lg border border-[#232738] text-xs">
              <button
                onClick={() => setSidebarTab('projects')}
                className={`py-1 rounded font-medium transition-colors ${
                  sidebarTab === 'projects'
                    ? 'bg-[#1e2233] text-white shadow-xs font-semibold'
                    : 'text-[#8e92a8] hover:text-white'
                }`}
              >
                Projects ({projects.length})
              </button>
              <button
                onClick={() => setSidebarTab('templates')}
                className={`py-1 rounded font-medium transition-colors ${
                  sidebarTab === 'templates'
                    ? 'bg-[#1e2233] text-white shadow-xs font-semibold'
                    : 'text-[#8e92a8] hover:text-white'
                }`}
              >
                Templates ({TEMPLATES.length})
              </button>
            </div>
          </div>

          {/* Sidebar Content List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {sidebarTab === 'projects' ? (
              projects.map((proj) => {
                const isActive = proj.id === activeProjectId;
                return (
                  <div
                    key={proj.id}
                    onClick={() => {
                      setActiveProjectId(proj.id);
                      if (mobilePane === 'sidebar') setMobilePane('editor');
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all group ${
                      isActive
                        ? 'bg-[#191c2b] border-purple-500/60 shadow-sm'
                        : 'bg-[#11131c] border-[#1e2230] hover:border-[#2a2f42] hover:bg-[#141622]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white truncate max-w-[150px]">
                        {proj.title}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDuplicateProject(proj, e)}
                          title="Duplicate"
                          className="p-1 hover:text-purple-300 text-[#8e92a8]"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteProject(proj.id, e)}
                          title="Delete"
                          className="p-1 hover:text-red-400 text-[#8e92a8]"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#787e94] truncate font-mono">
                      {proj.script || 'Empty script'}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[#1a1d29] text-[10px] text-[#63687b]">
                      <span>{proj.voice}</span>
                      <span>{new Date(proj.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => {
                    loadTemplate(tpl);
                    if (mobilePane === 'sidebar') setMobilePane('editor');
                  }}
                  className="p-3 rounded-xl bg-[#11131c] border border-[#1e2230] hover:border-purple-500/40 hover:bg-[#141622] cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white truncate">
                      {tpl.title}
                    </span>
                    <span className="text-[10px] text-purple-400 font-mono">
                      {tpl.recommendedVoice}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8e92a8] line-clamp-2 mb-2">
                    {tpl.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {tpl.tagsUsed.map((t) => (
                      <span
                        key={t}
                        className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 font-mono"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Tag Palette Trigger in Sidebar Footer */}
          <div className="p-3 border-t border-[#1c1f2e] bg-[#0b0c10] flex items-center justify-between">
            <button
              onClick={() => setIsTagPaletteOpen(true)}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>13 Expression Tags</span>
            </button>
            <button
              onClick={onOpenDocs}
              className="text-xs text-[#8e92a8] hover:text-white"
            >
              Docs
            </button>
          </div>
        </div>

        {/* Center Workspace & Right Inspector */}
        {studioMode === 'dialogue' ? (
          <DialogueEditor
            onSceneAssembled={(assembledTake) => {
              setCurrentGeneration(assembledTake);
              setGenerationHistory([assembledTake, ...generationHistory]);
            }}
            isGeneratingMaster={isGenerating}
            onOpenMixer={() => setIsMixerOpen(true)}
            onOpenExport={() => setIsExportOpen(true)}
            hasAssembledTake={Boolean(currentGeneration)}
          />
        ) : (
          <>
            {/* Center: Script Editor */}
            <div className={`flex-1 flex flex-col min-w-0 ${mobilePane === 'editor' ? 'flex' : 'hidden md:flex'}`}>
              {/* Generation Error Alert Banner */}
              {generationError && (
                <div className="p-3 bg-red-950/40 border-b border-red-500/30 text-xs text-red-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{generationError}</span>
                  </div>
                  <button
                    onClick={() => setGenerationError(null)}
                    className="p-1 hover:bg-red-500/20 rounded text-red-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <ScriptEditor
                title={title}
                onTitleChange={setTitle}
                script={script}
                onScriptChange={setScript}
                onGenerate={handleGenerate}
                onSave={handleSaveProject}
                isGenerating={isGenerating}
                onOpenTagPalette={() => setIsTagPaletteOpen(true)}
                isStreamingMode={isStreamingMode}
                onToggleStreamingMode={setIsStreamingMode}
                streamingProgress={streamingProgress}
                onCancelStream={handleCancelStream}
                onOpenMixer={() => setIsMixerOpen(true)}
                onOpenExport={() => setIsExportOpen(true)}
                hasGeneration={Boolean(currentGeneration)}
                characters={characters}
                onOpenCharacterPanel={() => setIsCharacterPanelOpen(true)}
                onSwitchToMultitrack={() => setStudioMode('dialogue')}
              />
            </div>

            {/* Right: Inspector */}
            <div className={`${mobilePane === 'inspector' ? 'flex w-full absolute inset-0 z-20 bg-[#0e1017]' : 'hidden xl:flex'}`}>
              <Inspector
                selectedVoice={voice}
                onVoiceChange={setVoice}
                selectedLanguage={language}
                onLanguageChange={setLanguage}
                audioConfig={audioConfig}
                onAudioConfigChange={setAudioConfig}
                detectedTags={validation.detectedTags}
              />
            </div>
          </>
        )}
      </div>

      {/* Bottom: DAW Audio Player */}
      <AudioPlayer
        currentGeneration={currentGeneration}
        history={generationHistory}
        onSelectTake={setCurrentGeneration}
        onRegenerate={handleGenerate}
        isGenerating={isGenerating}
        onOpenMixer={() => setIsMixerOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        hasMixedAudio={Boolean(mixedAudioUrl)}
      />

      {/* Expression Tag Palette Modal */}
      <ExpressionPaletteModal
        isOpen={isTagPaletteOpen}
        onClose={() => setIsTagPaletteOpen(false)}
        onInsertTag={(tag) => {
          setScript((prev) => `${prev} ${tag} `);
        }}
      />

      {/* Background Audio Mixer Modal */}
      <AudioMixerPanel
        isOpen={isMixerOpen}
        onClose={() => setIsMixerOpen(false)}
        currentTake={currentGeneration}
        bgConfig={bgConfig}
        onUpdateBgConfig={(cfg) => {
          setBgConfig(cfg);
          if (activeProjectId) {
            setProjects((prev) =>
              prev.map((p) => (p.id === activeProjectId ? { ...p, backgroundTrack: cfg || undefined } : p))
            );
            fetch(`/api/projects/${activeProjectId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ backgroundTrack: cfg }),
            }).catch(console.error);
          }
        }}
        onMixedTakeCreated={(take) => {
          setCurrentGeneration(take);
          setGenerationHistory([take, ...generationHistory]);
          setMixedAudioUrl(take.audioUrl);
        }}
      />

      {/* Creator Export Package Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        currentTake={currentGeneration}
        mixedAudioUrl={mixedAudioUrl}
      />

      {/* Voice Direction & Character Management Panel */}
      <CharacterPanel
        isOpen={isCharacterPanelOpen}
        onClose={() => setIsCharacterPanelOpen(false)}
        characters={characters}
        onUpdateCharacters={(updated) => {
          setCharacters(updated);
          // If first character's voice changed, update active voice too
          if (updated[0] && updated[0].voice !== voice) {
            setVoice(updated[0].voice);
          }
        }}
      />
    </div>
  );
};

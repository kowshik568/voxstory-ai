/**
 * VoxStory AI - Root Application Component (v4.0)
 * Precision AI Voice Production Studio Architecture
 * Supporting Gnani Timbre v3.0 with verified endpoints,
 * multi-character dialogue scenes, procedural ambience mixer,
 * frame-accurate subtitle cues, and workstation navigation.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar, StudioView } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Studio } from './components/Studio';
import { DialogueView } from './components/DialogueView';
import { ProjectsView } from './components/ProjectsView';
import { MixerView } from './components/MixerView';
import { HistoryView } from './components/HistoryView';
import { VoicesView } from './components/VoicesView';
import { ExportsView } from './components/ExportsView';
import { LandingPage } from './components/LandingPage';
import { SettingsModal } from './components/SettingsModal';
import { DocsModal } from './components/DocsModal';
import {
  StudioProject,
  GenerationResult,
  ProviderHealth,
  ScriptTemplate,
  BackgroundTrackConfig,
  SupportedLanguage,
} from './types';
import { DEFAULT_AUDIO_CONFIG } from './lib/voices';
import { generateProceduralSpeechWav } from './lib/audioGenerator';
import { StreamingSpeechClient } from './lib/streamingClient';

const INITIAL_PROJECTS: StudioProject[] = [
  {
    id: 'proj-1',
    title: 'YouTube Tech Reveal Hook',
    script: `<excited> What if I told you that everything you knew about battery technology just became obsolete? <pauses> Last Tuesday, researchers quietly published a paper. <whispers> And the numbers they reported are almost impossible to believe.`,
    voice: 'Aarav',
    language: 'en-IN',
    mode: 'solo',
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
    mode: 'solo',
    audioConfig: { ...DEFAULT_AUDIO_CONFIG },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'proj-3',
    title: 'Operation Nightfall — Vault Infiltration',
    script: `<whispers> Status report. Have we bypassed their automated sentries yet? <pauses> Everyone fall back to extraction point Bravo!`,
    voice: 'Nalini',
    language: 'en-IN',
    mode: 'dialogue',
    audioConfig: { ...DEFAULT_AUDIO_CONFIG },
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function App() {
  const [currentView, setCurrentView] = useState<StudioView>('studio');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState<StudioProject[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>('proj-1');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Active Project
  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0];

  // Generation & Audio Master State
  const [currentGeneration, setCurrentGeneration] = useState<GenerationResult | null>(null);
  const [generationHistory, setGenerationHistory] = useState<GenerationResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreamingMode, setIsStreamingMode] = useState(false);

  // Background Ambience & Ducking
  const [bgConfig, setBgConfig] = useState<BackgroundTrackConfig | null>(null);
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null);

  // Provider Health & Modals
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [selectedTemplateForStudio, setSelectedTemplateForStudio] = useState<ScriptTemplate | null>(null);

  const streamingClientRef = useRef(new StreamingSpeechClient());

  // Check live provider health on load
  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const json = await res.json();
        setHealth(json.data);
      }
    } catch {
      setHealth({
        status: 'degraded',
        provider: 'Gnani AI Vachana / Timbre Platform',
        model: 'Timbre v3.0 (Demo Mode Active)',
        hasApiKey: false,
        version: '3.0.0',
        apiEndpoint: 'https://api.vachana.ai/api/v1/tts/inference',
        streamingSupported: true,
        streamingEndpoint: 'https://api.vachana.ai/api/v1/tts/sse',
      });
    }
  };

  useEffect(() => {
    checkHealth();

    // Initialize with a pre-rendered demo take so the audio player and waveforms are active
    try {
      const demoWav = generateProceduralSpeechWav(
        '<whispers> The clock in the vestibule struck three. <pauses> Eleanor stepped past the torn velvet curtain. <sigh> There was no turning back now.',
        'Female',
        24000
      );
      const initialTake: GenerationResult = {
        id: 'take-init-1',
        projectId: 'proj-2',
        title: 'The Midnight Archive Mystery - Nalini',
        script: `<whispers> The clock in the vestibule struck three. <pauses> Eleanor stepped past the torn velvet curtain. <sigh> There was no turning back now.`,
        voice: 'Nalini',
        language: 'en-IN',
        audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
        audioUrl: demoWav.dataUrl,
        durationSeconds: demoWav.duration,
        wordCount: 22,
        detectedTags: ['whispers', 'pauses', 'sigh'],
        createdAt: new Date().toISOString(),
        provider: 'studio-demo',
        generationMode: 'procedural-demo',
        isDemo: true,
        fileSizeBytes: 142000,
      };
      setCurrentGeneration(initialTake);
      setGenerationHistory([initialTake]);
    } catch (e) {
      console.warn('Initial demo audio setup:', e);
    }
  }, []);

  // Project Management Handlers
  const handleCreateNewProject = (mode: 'solo' | 'dialogue' = 'solo') => {
    const newProj: StudioProject = {
      id: `proj-${Date.now()}`,
      title: mode === 'solo' ? 'New Director Take' : 'New Dialogue Scene',
      script:
        mode === 'solo'
          ? `<excited> Direct your scene with real vocal emotion! <pauses> Insert tags to control tone and pacing.`
          : `<whispers> Are we ready? <pauses> The broadcast starts in ten seconds.`,
      voice: 'Nalini',
      language: 'en-IN',
      mode,
      audioConfig: { ...DEFAULT_AUDIO_CONFIG },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProjects([newProj, ...projects]);
    setActiveProjectId(newProj.id);
    setCurrentView(mode === 'solo' ? 'studio' : 'dialogue');
  };

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    const selected = projects.find((p) => p.id === projectId);
    if (selected?.mode === 'dialogue') {
      setCurrentView('dialogue');
    } else {
      setCurrentView('studio');
    }
  };

  const handleDuplicateProject = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    const duplicated: StudioProject = {
      ...proj,
      id: `proj-${Date.now()}`,
      title: `${proj.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProjects([duplicated, ...projects]);
    setActiveProjectId(duplicated.id);
  };

  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) return;
    const remaining = projects.filter((p) => p.id !== projectId);
    setProjects(remaining);
    if (activeProjectId === projectId) {
      setActiveProjectId(remaining[0].id);
    }
  };

  const handleRenameProject = (projectId: string, newTitle: string) => {
    setProjects(
      projects.map((p) =>
        p.id === projectId ? { ...p, title: newTitle, updatedAt: new Date().toISOString() } : p
      )
    );
  };

  const handleUpdateActiveTitle = (newTitle: string) => {
    handleRenameProject(activeProjectId, newTitle);
  };

  // Global Generation Workflow (callable from TopBar or keyboard shortcut)
  const handleGlobalGenerate = useCallback(async () => {
    if (!activeProject || isGenerating) return;

    setIsGenerating(true);
    setSaveStatus('saving');

    if (isStreamingMode) {
      await streamingClientRef.current.startStream(
        {
          script: activeProject.script,
          voice: activeProject.voice,
          language: activeProject.language,
          audioConfig: activeProject.audioConfig,
          title: `${activeProject.title} - ${activeProject.voice}`,
          projectId: activeProject.id,
        },
        {
          onStart: () => {},
          onProgress: () => {},
          onComplete: (result) => {
            setIsGenerating(false);
            setSaveStatus('saved');
            setCurrentGeneration(result);
            setGenerationHistory((prev) => [result, ...prev]);
          },
          onError: () => {
            setIsGenerating(false);
            setSaveStatus('saved');
          },
        }
      );
      return;
    }

    try {
      const response = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: activeProject.script,
          voice: activeProject.voice,
          language: activeProject.language,
          audioConfig: activeProject.audioConfig,
          title: `${activeProject.title} - ${activeProject.voice}`,
          projectId: activeProject.id,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const result: GenerationResult = json.data;
        setCurrentGeneration(result);
        setGenerationHistory((prev) => [result, ...prev]);
      }
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
      setSaveStatus('saved');
    }
  }, [activeProject, isGenerating, isStreamingMode]);

  // Global keyboard shortcut: Cmd+Enter / Ctrl+Enter to synthesize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGlobalGenerate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGlobalGenerate]);

  // Voice Assignment from Catalog
  const handleSelectVoiceFromCatalog = (voiceName: string) => {
    setProjects(
      projects.map((p) =>
        p.id === activeProjectId ? { ...p, voice: voiceName, updatedAt: new Date().toISOString() } : p
      )
    );
  };

  return (
    <div className="flex h-screen w-screen bg-[#0B0C10] text-[#F3F4F6] font-sans overflow-hidden select-none">
      {/* 1. Left Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => {
          if (view === 'dialogue') {
            const dialogueProj = projects.find((p) => p.mode === 'dialogue');
            if (dialogueProj) setActiveProjectId(dialogueProj.id);
          }
          setCurrentView(view);
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        health={health}
        projectCount={projects.length}
        historyCount={generationHistory.length}
        onNewProject={() => handleCreateNewProject('solo')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDocs={() => setIsDocsOpen(true)}
      />

      {/* 2. Main Studio Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Workspace Header Bar */}
        <TopBar
          currentView={currentView}
          projectTitle={activeProject?.title || 'Untitled Project'}
          onTitleChange={handleUpdateActiveTitle}
          saveStatus={saveStatus}
          health={health}
          activeVoice={activeProject?.voice || 'Nalini'}
          activeLanguage={activeProject?.language || 'en-IN'}
          isGenerating={isGenerating}
          onGenerate={handleGlobalGenerate}
          isStreamingMode={isStreamingMode}
          onToggleStreamingMode={setIsStreamingMode}
          onOpenExport={() => setCurrentView('exports')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          hasAudio={Boolean(currentGeneration)}
        />

        {/* Dynamic Workspace View Area */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {currentView === 'studio' && (
            <Studio
              initialTemplate={selectedTemplateForStudio}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenDocs={() => setIsDocsOpen(true)}
            />
          )}

          {currentView === 'dialogue' && (
            <DialogueView
              currentGeneration={currentGeneration}
              onSceneAssembled={(assembledTake) => {
                setCurrentGeneration(assembledTake);
                setGenerationHistory((prev) => [assembledTake, ...prev]);
              }}
              isGeneratingMaster={isGenerating}
              onOpenMixer={() => setCurrentView('mixer')}
              onOpenExport={() => setCurrentView('exports')}
              history={generationHistory}
              onSelectTake={setCurrentGeneration}
              mixedAudioUrl={mixedAudioUrl}
            />
          )}

          {currentView === 'projects' && (
            <ProjectsView
              projects={projects}
              activeProjectId={activeProjectId}
              onSelectProject={handleSelectProject}
              onCreateProject={handleCreateNewProject}
              onDuplicateProject={handleDuplicateProject}
              onDeleteProject={handleDeleteProject}
              onRenameProject={handleRenameProject}
            />
          )}

          {currentView === 'mixer' && (
            <MixerView
              currentTake={currentGeneration}
              bgConfig={bgConfig}
              onUpdateBgConfig={setBgConfig}
              onMixedTakeCreated={(mixedTake) => {
                setCurrentGeneration(mixedTake);
                setGenerationHistory((prev) => [mixedTake, ...prev]);
                setMixedAudioUrl(mixedTake.audioUrl);
              }}
              mixedAudioUrl={mixedAudioUrl}
              onOpenStudio={() => setCurrentView('studio')}
            />
          )}

          {currentView === 'history' && (
            <HistoryView
              history={generationHistory}
              activeTake={currentGeneration}
              onSelectTake={setCurrentGeneration}
              onClearHistory={() => setGenerationHistory([])}
            />
          )}

          {currentView === 'voices' && (
            <VoicesView
              activeVoice={activeProject?.voice || 'Nalini'}
              onSelectVoice={handleSelectVoiceFromCatalog}
              onOpenInStudio={(voiceName) => {
                handleSelectVoiceFromCatalog(voiceName);
                setCurrentView('studio');
              }}
            />
          )}

          {currentView === 'exports' && (
            <ExportsView
              currentTake={currentGeneration}
              mixedAudioUrl={mixedAudioUrl}
              onOpenStudio={() => setCurrentView('studio')}
            />
          )}

          {currentView === 'showcase' && (
            <LandingPage
              onOpenStudio={(template) => {
                if (template) {
                  setSelectedTemplateForStudio(template);
                }
                setCurrentView('studio');
              }}
              onOpenDocs={() => setIsDocsOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        health={health}
        onRefreshHealth={checkHealth}
      />

      <DocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />
    </div>
  );
}

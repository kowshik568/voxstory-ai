/**
 * VoxStory AI - Dialogue Studio & Multitrack DAW View (v7.0)
 * Standalone workspace view supporting both the Precision Multitrack DAW Timeline
 * and the Directorial Script Sequence Editor with seamless mode switching.
 */

import React, { useState } from 'react';
import { DialogueEditor } from './DialogueEditor';
import { MultitrackTimeline } from './MultitrackTimeline';
import { AudioPlayer } from './AudioPlayer';
import { GenerationResult } from '../types';
import { SlidersHorizontal, FileText, Layers, Users } from 'lucide-react';

interface DialogueViewProps {
  currentGeneration: GenerationResult | null;
  onSceneAssembled: (take: GenerationResult) => void;
  isGeneratingMaster: boolean;
  onOpenMixer: () => void;
  onOpenExport: () => void;
  history: GenerationResult[];
  onSelectTake: (take: GenerationResult) => void;
  mixedAudioUrl?: string | null;
}

export const DialogueView: React.FC<DialogueViewProps> = ({
  currentGeneration,
  onSceneAssembled,
  isGeneratingMaster,
  onOpenMixer,
  onOpenExport,
  history,
  onSelectTake,
  mixedAudioUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'multitrack' | 'script'>('multitrack');

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0C10] overflow-hidden">
      {/* Top Workspace Tab Selector */}
      <div className="px-6 py-2 bg-[#0d0f17] border-b border-[#1b1f2e] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#141622] border border-[#222638]">
          <button
            onClick={() => setActiveTab('multitrack')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'multitrack'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-[#8e92a8] hover:text-white hover:bg-[#1a1d2d]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Multitrack DAW Timeline</span>
          </button>

          <button
            onClick={() => setActiveTab('script')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'script'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-[#8e92a8] hover:text-white hover:bg-[#1a1d2d]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Script Sequence Editor</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#787e94]">
          <span className="hidden sm:inline">Active Mode:</span>
          <span className="text-purple-300 font-semibold uppercase">
            {activeTab === 'multitrack' ? 'DAW Multitrack Engine' : 'Directorial Line Cast'}
          </span>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {activeTab === 'multitrack' ? (
          <MultitrackTimeline
            onSceneAssembled={onSceneAssembled}
            isGeneratingMaster={isGeneratingMaster}
            onOpenMixer={onOpenMixer}
            onOpenExport={onOpenExport}
            hasAssembledTake={Boolean(currentGeneration)}
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <DialogueEditor
              onSceneAssembled={onSceneAssembled}
              isGeneratingMaster={isGeneratingMaster}
              onOpenMixer={onOpenMixer}
              onOpenExport={onOpenExport}
              hasAssembledTake={Boolean(currentGeneration)}
              onSwitchToMultitrack={() => setActiveTab('multitrack')}
            />
          </div>
        )}
      </div>

      {/* Master Audio Player at bottom */}
      <AudioPlayer
        currentGeneration={currentGeneration}
        history={history}
        onSelectTake={onSelectTake}
        onRegenerate={() => {}}
        isGenerating={isGeneratingMaster}
        onOpenMixer={onOpenMixer}
        onOpenExport={onOpenExport}
        hasMixedAudio={Boolean(mixedAudioUrl)}
      />
    </div>
  );
};

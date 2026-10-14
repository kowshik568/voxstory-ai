/**
 * VoxStory AI - Navigation Header
 */

import React from 'react';
import { Sparkles, Sliders, PlayCircle, BookOpen, Key, Plus } from 'lucide-react';
import { ProviderHealth } from '../types';

interface NavbarProps {
  currentView: 'studio' | 'showcase' | 'docs';
  onViewChange: (view: 'studio' | 'showcase' | 'docs') => void;
  health: ProviderHealth | null;
  onOpenSettings: () => void;
  onNewProject: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  health,
  onOpenSettings,
  onNewProject,
}) => {
  const isLive = health?.hasApiKey;

  return (
    <header className="h-16 border-b border-[#22242f] bg-[#0e1017]/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-6 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onViewChange('showcase')}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-violet-400 flex items-center justify-center shadow-lg shadow-purple-900/30 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white group-hover:text-purple-300 transition-colors">
                VoxStory<span className="text-purple-400">AI</span>
              </span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/25">
                Timbre v3.0
              </span>
            </div>
            <p className="text-[11px] text-[#8e92a8] hidden sm:block">
              Expressive AI Voice Studio
            </p>
          </div>
        </button>
      </div>

      {/* Navigation View Switcher */}
      <nav className="flex items-center gap-1 bg-[#141722] p-1 rounded-xl border border-[#232736]">
        <button
          onClick={() => onViewChange('studio')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            currentView === 'studio'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-[#9fa3b8] hover:text-white hover:bg-[#1c2030]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Voice Studio</span>
        </button>

        <button
          onClick={() => onViewChange('showcase')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            currentView === 'showcase'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-[#9fa3b8] hover:text-white hover:bg-[#1c2030]'
          }`}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          <span>Showcase & A/B</span>
        </button>

        <button
          onClick={() => onViewChange('docs')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            currentView === 'docs'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-[#9fa3b8] hover:text-white hover:bg-[#1c2030]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden md:inline">API Docs</span>
        </button>
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* Provider Status Indicator */}
        <button
          onClick={onOpenSettings}
          title={isLive ? 'Connected to live Gnani API' : 'Operating in Studio Demo Mode (Click to configure)'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
            isLive
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="hidden sm:inline">{isLive ? 'Live Gnani API' : 'Studio Demo Mode'}</span>
          <Key className="w-3 h-3 ml-0.5 opacity-70" />
        </button>

        {/* Quick New Project Button */}
        <button
          onClick={() => {
            onNewProject();
            if (currentView !== 'studio') onViewChange('studio');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#202434] hover:bg-[#2b3045] text-white text-xs font-medium border border-[#323850] transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">New Script</span>
        </button>
      </div>
    </header>
  );
};

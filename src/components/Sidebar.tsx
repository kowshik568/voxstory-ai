/**
 * VoxStory AI - Studio Left Sidebar Navigation (v13.0)
 * Precision audio workstation aesthetic with collapsible mode,
 * workspace selector, domain navigation, real provider status, and user profile.
 */

import React, { useState } from 'react';
import {
  Sliders,
  Users,
  Music,
  FolderOpen,
  History,
  Radio,
  Download,
  PlaySquare,
  BookOpen,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Key,
  Star,
  Layers,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import { ProviderHealth } from '../types';

export type StudioView =
  | 'studio'
  | 'dialogue'
  | 'projects'
  | 'mixer'
  | 'history'
  | 'voices'
  | 'favorites'
  | 'exports'
  | 'showcase';

interface SidebarProps {
  currentView: StudioView;
  onViewChange: (view: StudioView) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  health: ProviderHealth | null;
  projectCount: number;
  historyCount: number;
  favoritesCount?: number;
  onNewProject: () => void;
  onOpenSettings: () => void;
  onOpenDocs: () => void;
  userEmail?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const WORKSPACES = [
  { id: 'ws-personal', name: 'Personal Studio', tier: 'Pro Director' },
  { id: 'ws-creative', name: 'Creative Agency Team', tier: 'Enterprise Tier' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  isCollapsed,
  onToggleCollapse,
  health,
  projectCount,
  historyCount,
  favoritesCount = 5,
  onNewProject,
  onOpenSettings,
  onOpenDocs,
  userEmail = 'padmanabhameenadu82@gmail.com',
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [selectedWorkspace, setSelectedWorkspace] = useState(WORKSPACES[0]);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const isLive = health?.hasApiKey;

  const navItems = [
    {
      group: 'PRODUCTION',
      items: [
        {
          id: 'studio' as StudioView,
          label: 'Voice Studio',
          subtitle: 'Directorial Script Editor',
          icon: Sliders,
        },
        {
          id: 'voices' as StudioView,
          label: 'Voice Library',
          subtitle: '13 Timbre Actors & Audition',
          icon: Radio,
        },
        {
          id: 'favorites' as StudioView,
          label: 'Favorites',
          subtitle: 'Starred Voice Actors',
          icon: Star,
          badge: favoritesCount > 0 ? favoritesCount.toString() : undefined,
        },
        {
          id: 'dialogue' as StudioView,
          label: 'Dialogue Studio',
          subtitle: 'Multitrack DAW Timeline',
          icon: Users,
        },
        {
          id: 'mixer' as StudioView,
          label: 'Audio Mixer',
          subtitle: 'Soundscapes & Ducking',
          icon: Music,
        },
      ],
    },
    {
      group: 'ASSETS & LIBRARY',
      items: [
        {
          id: 'projects' as StudioView,
          label: 'My Projects',
          subtitle: 'Workstation Library',
          icon: FolderOpen,
          badge: projectCount.toString(),
        },
        {
          id: 'history' as StudioView,
          label: 'Generation History',
          subtitle: 'Master Takes & Audio',
          icon: History,
          badge: historyCount > 0 ? historyCount.toString() : undefined,
        },
        {
          id: 'exports' as StudioView,
          label: 'Export Center',
          subtitle: 'SRT, VTT & Master WAV',
          icon: Download,
        },
      ],
    },
    {
      group: 'RESOURCES',
      items: [
        {
          id: 'showcase' as StudioView,
          label: 'A/B Showcase',
          subtitle: 'Expressive vs Flat Audio',
          icon: PlaySquare,
        },
      ],
    },
  ];

  const handleNavClick = (view: StudioView) => {
    onViewChange(view);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`h-screen bg-[#0E0F16] border-r border-[#1B1D29] flex flex-col justify-between shrink-0 transition-all duration-200 z-50 select-none ${
          isCollapsed ? 'w-[72px]' : 'w-[260px]'
        } ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 w-[280px] shadow-2xl flex'
            : 'hidden lg:flex'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="flex flex-col">
          {/* Brand Row */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-[#181A25]">
            <button
              onClick={() => handleNavClick('studio')}
              className="flex items-center gap-3 text-left focus:outline-none group overflow-hidden"
            >
              {/* Custom Soundwave Brand Icon */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-[1px] shadow-md shadow-violet-950/40 shrink-0">
                <div className="w-full h-full bg-[#0E0F16] rounded-[11px] flex items-center justify-center group-hover:bg-violet-950/20 transition-colors">
                  <div className="flex items-center gap-[2px]">
                    <span className="w-[3px] h-3 bg-violet-400 rounded-full animate-pulse" />
                    <span className="w-[3px] h-5 bg-violet-300 rounded-full" />
                    <span className="w-[3px] h-4 bg-indigo-400 rounded-full" />
                    <span className="w-[3px] h-2 bg-violet-400 rounded-full" />
                  </div>
                </div>
              </div>

              {(!isCollapsed || isMobileOpen) && (
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap">
                      VoxStory
                    </span>
                    <span className="text-[10px] font-semibold tracking-wider text-violet-400 uppercase font-mono">
                      AI
                    </span>
                  </div>
                  <span className="text-[11px] text-[#7E8299] truncate font-medium">
                    Timbre v3.0 Studio
                  </span>
                </div>
              )}
            </button>

            {/* Mobile Close Button or Desktop Collapse Toggle */}
            <div className="flex items-center gap-1">
              {isMobileOpen && (
                <button
                  onClick={onCloseMobile}
                  className="lg:hidden w-8 h-8 rounded-lg text-[#8E92A8] hover:text-white hover:bg-[#181A25] flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onToggleCollapse}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="hidden lg:flex w-7 h-7 rounded-lg text-[#6A6E85] hover:text-white hover:bg-[#181A25] items-center justify-center transition-colors shrink-0"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Workspace Selector */}
          {(!isCollapsed || isMobileOpen) && (
            <div className="p-2 border-b border-[#181A25] relative">
              <button
                onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-[#12141F] hover:bg-[#171927] border border-[#1E2130] text-left transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded bg-violet-950/60 border border-violet-800/40 flex items-center justify-center text-violet-400 shrink-0">
                    <Layers className="w-3 h-3" />
                  </div>
                  <div className="truncate text-xs">
                    <div className="font-medium text-white truncate">{selectedWorkspace.name}</div>
                    <div className="text-[10px] text-[#71758C] truncate font-mono">{selectedWorkspace.tier}</div>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#6A6E85] shrink-0" />
              </button>

              {isWorkspaceMenuOpen && (
                <div className="absolute top-full left-2 right-2 mt-1 bg-[#141624] border border-[#222538] rounded-lg shadow-xl py-1 z-50">
                  <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#6A6E85] font-semibold">
                    Workspaces
                  </div>
                  {WORKSPACES.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setSelectedWorkspace(ws);
                        setIsWorkspaceMenuOpen(false);
                      }}
                      className="w-full px-3 py-1.5 flex items-center justify-between text-xs hover:bg-[#1C1F32] text-left"
                    >
                      <div className="truncate">
                        <div className="text-white font-medium">{ws.name}</div>
                        <div className="text-[10px] text-[#71758C]">{ws.tier}</div>
                      </div>
                      {selectedWorkspace.id === ws.id && (
                        <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Project CTA */}
          <div className="p-3 border-b border-[#181A25]">
            <button
              onClick={() => {
                onNewProject();
                if (onCloseMobile) onCloseMobile();
              }}
              title="Create New Project"
              className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm shadow-violet-900/30 active:scale-[0.99] whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              {(!isCollapsed || isMobileOpen) && <span>New Project</span>}
            </button>
          </div>

          {/* Navigation List */}
          <div className="p-2 space-y-4 overflow-y-auto max-h-[calc(100vh-320px)]">
            {navItems.map((group) => (
              <div key={group.group} className="space-y-1">
                {(!isCollapsed || isMobileOpen) && (
                  <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold tracking-wider text-[#52566F] uppercase font-mono">
                    {group.group}
                  </div>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      title={isCollapsed && !isMobileOpen ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all group ${
                        isActive
                          ? 'bg-violet-600/15 text-white border border-violet-500/25'
                          : 'text-[#8E92A8] hover:text-white hover:bg-[#161824]'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-violet-400'
                            : 'text-[#6A6E85] group-hover:text-violet-300'
                        }`}
                      />
                      {(!isCollapsed || isMobileOpen) && (
                        <div className="flex-1 flex items-center justify-between min-w-0 text-left">
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span className="text-[10px] font-mono font-medium text-[#7E8299] px-1.5 py-0.2 bg-[#1B1D2B] rounded text-right tabular-nums">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Quick API Docs Link */}
            <div className="pt-1">
              <button
                onClick={() => {
                  onOpenDocs();
                  if (onCloseMobile) onCloseMobile();
                }}
                title={isCollapsed && !isMobileOpen ? 'API Docs' : undefined}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium text-[#8E92A8] hover:text-white hover:bg-[#161824] transition-all"
              >
                <BookOpen className="w-4 h-4 shrink-0 text-[#6A6E85]" />
                {(!isCollapsed || isMobileOpen) && <span className="truncate">Timbre Docs</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Footer Section */}
        <div className="p-3 border-t border-[#181A25] space-y-2 bg-[#0B0C12]">
          {/* Live Provider Status Display */}
          <button
            onClick={() => {
              onOpenSettings();
              if (onCloseMobile) onCloseMobile();
            }}
            title={isLive ? 'Connected to live Gnani API' : 'Studio Demo Mode (Click to configure)'}
            className={`w-full flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${
              isLive
                ? 'bg-emerald-950/20 border-emerald-500/25 hover:bg-emerald-950/30'
                : 'bg-amber-950/20 border-amber-500/25 hover:bg-amber-950/30'
            }`}
          >
            <div className="shrink-0 flex items-center justify-center">
              {isLive ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <Cpu className="w-4 h-4 text-amber-400" />
              )}
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className={isLive ? 'text-emerald-300' : 'text-amber-300'}>
                    {isLive ? 'Live Gnani API' : 'Studio Demo Mode'}
                  </span>
                  <Key className="w-3 h-3 text-[#6A6E85]" />
                </div>
                <p className="text-[10px] text-[#71758C] truncate">
                  {isLive ? 'X-API-Key-ID Verified' : 'Procedural Audio Engine'}
                </p>
              </div>
            )}
          </button>

          {/* User Account / Workspace */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-700 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                {userEmail ? userEmail[0].toUpperCase() : 'P'}
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-white font-medium truncate">
                    Padmanabha M.
                  </span>
                  <span className="text-[10px] text-[#6A6E85] truncate font-mono">
                    Audio Director
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                onOpenSettings();
                if (onCloseMobile) onCloseMobile();
              }}
              title="Studio Settings & Diagnostics"
              className="w-7 h-7 rounded-lg text-[#6A6E85] hover:text-white hover:bg-[#181A25] flex items-center justify-center transition-colors shrink-0"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

/**
 * VoxStory AI - My Projects Library (v4.0)
 * Precision project management with search, mode filtering,
 * duplicate, rename, delete, and direct studio opening.
 */

import React, { useState } from 'react';
import {
  FolderOpen,
  Plus,
  Search,
  Sliders,
  Users,
  Copy,
  Trash2,
  Edit2,
  Calendar,
  Volume2,
  ArrowRight,
  MoreVertical,
  Check,
} from 'lucide-react';
import { StudioProject } from '../types';

interface ProjectsViewProps {
  projects: StudioProject[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (mode?: 'solo' | 'dialogue') => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newTitle: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDuplicateProject,
  onDeleteProject,
  onRenameProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'solo' | 'dialogue'>('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.script.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.voice.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode =
      filterMode === 'all'
        ? true
        : filterMode === 'dialogue'
        ? p.mode === 'dialogue'
        : p.mode !== 'dialogue';
    return matchesSearch && matchesMode;
  });

  const handleStartRename = (project: StudioProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(project.id);
    setNewTitle(project.title);
  };

  const handleSaveRename = (projectId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newTitle.trim()) {
      onRenameProject(projectId, newTitle.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="flex-1 bg-[#0B0C10] overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Top Banner & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1A1C29] pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Project Library</span>
            <span className="text-xs font-mono text-violet-400 font-normal px-2 py-0.5 rounded bg-violet-950/40 border border-violet-800/40">
              {projects.length} Saved
            </span>
          </h1>
          <p className="text-xs text-[#8E92A8] mt-1">
            Manage your audio dramas, narrative scripts, and multi-character dialogue scenes
          </p>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#6A6E85] absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search scripts or voices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 sm:w-64 h-9 bg-[#11131C] border border-[#202334] rounded-lg pl-9 pr-3 text-xs text-white placeholder-[#60647E] focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* New Project Button */}
          <button
            onClick={() => onCreateProject('solo')}
            className="h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-sm shadow-violet-900/30 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Filter Segmented Control */}
      <div className="flex items-center gap-2">
        <div className="flex items-center p-1 bg-[#12141F] rounded-lg border border-[#1E2130]">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterMode === 'all'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-[#8E92A8] hover:text-white'
            }`}
          >
            All Projects ({projects.length})
          </button>
          <button
            onClick={() => setFilterMode('solo')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterMode === 'solo'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-[#8E92A8] hover:text-white'
            }`}
          >
            Solo Narration ({projects.filter((p) => p.mode !== 'dialogue').length})
          </button>
          <button
            onClick={() => setFilterMode('dialogue')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterMode === 'dialogue'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-[#8E92A8] hover:text-white'
            }`}
          >
            Dialogue Scenes ({projects.filter((p) => p.mode === 'dialogue').length})
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-[#202334] rounded-xl bg-[#0E1017]">
          <FolderOpen className="w-10 h-10 text-[#4E5268] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No projects found</h3>
          <p className="text-xs text-[#71758C] mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No projects match "${searchQuery}". Try refining your search query.`
              : 'Create your first voice production project to get started.'}
          </p>
          <button
            onClick={() => onCreateProject('solo')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Script</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const isCurrent = p.id === activeProjectId;
            const isDialogue = p.mode === 'dialogue';
            const wordCount = p.script.split(/\s+/).filter(Boolean).length;
            const formattedDate = new Date(p.updatedAt || p.createdAt).toLocaleDateString(
              undefined,
              {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }
            );

            return (
              <div
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className={`group cursor-pointer rounded-xl border p-5 flex flex-col justify-between transition-all bg-[#10121B] hover:bg-[#141622] hover:border-violet-500/40 relative ${
                  isCurrent
                    ? 'border-violet-500/60 shadow-lg shadow-violet-950/20'
                    : 'border-[#1C1F2E]'
                }`}
              >
                {/* Header Row */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isDialogue
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                            : 'bg-violet-500/10 text-violet-400 border border-violet-500/25'
                        }`}
                      >
                        {isDialogue ? (
                          <Users className="w-3.5 h-3.5" />
                        ) : (
                          <Sliders className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-[#7A7E96]">
                        {isDialogue ? 'Dialogue Scene' : 'Solo Voice'}
                      </span>
                    </div>

                    {/* Context Action Menu */}
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => handleStartRename(p, e)}
                        title="Rename Project"
                        className="p-1.5 rounded hover:bg-[#1C2030] text-[#71758C] hover:text-white transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateProject(p.id);
                        }}
                        title="Duplicate Project"
                        className="p-1.5 rounded hover:bg-[#1C2030] text-[#71758C] hover:text-white transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {projects.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProject(p.id);
                          }}
                          title="Delete Project"
                          className="p-1.5 rounded hover:bg-rose-950/30 text-[#71758C] hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title / Inline Rename */}
                  {renamingId === p.id ? (
                    <form
                      onSubmit={(e) => handleSaveRename(p.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 my-1"
                    >
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="flex-1 bg-[#161824] border border-violet-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="p-1 rounded bg-violet-600 text-white hover:bg-violet-500"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <h3 className="font-semibold text-sm text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                      {p.title}
                    </h3>
                  )}

                  {/* Script Excerpt */}
                  <p className="text-xs text-[#8E92A8] line-clamp-2 mt-2 leading-relaxed font-normal">
                    {p.script}
                  </p>
                </div>

                {/* Footer Metadata */}
                <div className="pt-4 mt-4 border-t border-[#181B27] flex items-center justify-between text-[11px] text-[#6A6E85]">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{p.voice}</span>
                    <span>·</span>
                    <span className="font-mono">{p.language}</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">{wordCount} words</span>
                  </div>

                  <div className="flex items-center gap-1 text-[#71758C] group-hover:text-violet-400 transition-colors">
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

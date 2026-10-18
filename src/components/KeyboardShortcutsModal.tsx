/**
 * VoxStory AI - Keyboard Shortcuts Cheat Sheet Modal (v11.0)
 * Accessible reference modal showing all workstation shortcuts.
 */

import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcutGroups = [
    {
      title: 'Editor & Writing',
      shortcuts: [
        { keys: [`${modKey}`, 'S'], description: 'Save current project & script' },
        { keys: [`${modKey}`, 'Enter'], description: 'Synthesize / Generate speech' },
        { keys: [`${modKey}`, 'Z'], description: 'Undo last edit' },
        { keys: [`${modKey}`, 'Shift', 'Z'], description: 'Redo last edit' },
        { keys: ['<'], description: 'Trigger expression tag suggestions popup' },
        { keys: ['Alt', 'T'], description: 'Open Expression Tag Palette' },
      ],
    },
    {
      title: 'Playback & Multitrack DAW',
      shortcuts: [
        { keys: ['Space'], description: 'Play / Pause timeline or audio take' },
        { keys: ['0'], description: 'Rewind playhead to start (00:00)' },
        { keys: ['S'], description: 'Split selected clip at current playhead' },
        { keys: ['D'], description: 'Duplicate selected clip' },
        { keys: ['Delete'], description: 'Delete selected clip' },
        { keys: ['M'], description: 'Mute / Unmute active track' },
      ],
    },
    {
      title: 'General Navigation',
      shortcuts: [
        { keys: ['?'], description: 'Open this Keyboard Shortcuts guide' },
        { keys: ['Esc'], description: 'Close modals & popups' },
        { keys: ['Tab'], description: 'Jump to next input / dialogue line' },
      ],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#11131d] border border-[#232738] rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#1c1f2e]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 id="shortcuts-title" className="text-sm font-bold text-white uppercase tracking-wider">
                Workstation Keyboard Shortcuts
              </h3>
              <p className="text-[11px] text-[#8e92a8]">
                Professional rapid audio directorship & editing keys
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-1.5 rounded-lg hover:bg-[#1a1d2d] text-[#8e92a8] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                {group.title}
              </h4>
              <div className="space-y-1.5">
                {group.shortcuts.map((sc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#151724] border border-[#202436] text-xs"
                  >
                    <span className="text-[#c8cde0] font-medium">{sc.description}</span>
                    <div className="flex items-center gap-1">
                      {sc.keys.map((k, idx) => (
                        <kbd
                          key={idx}
                          className="px-2 py-0.5 rounded bg-[#1e2235] border border-[#2d334d] text-[11px] font-mono font-semibold text-purple-300 shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-[#1c1f2e] flex items-center justify-between text-[11px] text-[#6d7288]">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-[#1e2235] font-mono text-purple-300">Esc</kbd> anytime to dismiss overlays</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

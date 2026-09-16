import React from 'react';
import {
  PanelLeft,
  PanelRight,
  ShieldAlert,
  Layers,
  Wand2,
} from 'lucide-react';
import { Conversation } from '../../types/chat';

export interface HeaderProps {
  conversation?: Conversation | null;
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  onToggleLeftDrawer: () => void;
  onToggleRightDrawer: () => void;
  artifactCount: number;
  skillsCount?: number;
  onOpenSkillsModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  conversation,
  leftDrawerOpen,
  rightDrawerOpen,
  onToggleLeftDrawer,
  onToggleRightDrawer,
  artifactCount,
  skillsCount = 0,
  onOpenSkillsModal,
}) => {
  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#18181a]/80 backdrop-blur px-4 flex items-center justify-between flex-shrink-0 select-none z-10">
      {/* Left controls */}
      <div className="flex items-center gap-3">
        {/* Only show open sidebar button when left sidebar is closed */}
        {!leftDrawerOpen && (
          <button
            onClick={onToggleLeftDrawer}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Open Sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
            {conversation?.title || 'New Conversation'}
          </span>

          {conversation?.isEphemeral && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
              <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Incognito</span>
            </span>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {skillsCount > 0 && (
          <button
            onClick={onOpenSkillsModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
            title="Available Skills"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Skills</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
              {skillsCount}
            </span>
          </button>
        )}

        {/* Only show artifacts button when there are artifacts in the active conversation */}
        {artifactCount > 0 && (
          <button
            onClick={onToggleRightDrawer}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              rightDrawerOpen
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/50 text-amber-800 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Toggle Artifacts"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Artifacts</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-600 text-white">
              {artifactCount}
            </span>
            <PanelRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};

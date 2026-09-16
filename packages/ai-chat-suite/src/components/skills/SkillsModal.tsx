import React, { useState } from 'react';
import { X, Wand2, BookOpen, ChevronRight } from 'lucide-react';
import { SkillDefinition } from '../../types/skills';
import { MarkdownViewer } from '../../rendering/MarkdownViewer';

export interface SkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: SkillDefinition[];
}

export const SkillsModal: React.FC<SkillsModalProps> = ({ isOpen, onClose, skills }) => {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(
    skills.length > 0 ? skills[0].id : null
  );

  if (!isOpen) return null;

  const activeSkill = skills.find((s) => s.id === selectedSkillId) || skills[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-3xl lg:max-w-4xl bg-white dark:bg-[#1e1e20] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[560px]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Available AI Skills
              </h3>
              <p className="text-[11px] text-slate-500">
                The model dynamically consults these skills to answer specialized tasks.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Skills List Column */}
          <div className="w-64 border-r border-slate-200 dark:border-slate-800 p-2 overflow-y-auto space-y-1">
            {skills.map((s) => {
              const isSelected = s.id === activeSkill?.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSkillId(s.id)}
                  className={`w-full text-left p-2.5 rounded-xl transition-colors ${
                    isSelected
                      ? 'bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-medium'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold truncate">{s.name}</span>
                    <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-2">{s.description}</p>
                </button>
              );
            })}
            {skills.length === 0 && (
              <div className="text-center p-4 text-xs text-slate-400 italic">
                No skills configured.
              </div>
            )}
          </div>

          {/* Skill Details Column */}
          <div className="flex-1 p-5 overflow-y-auto select-text min-w-0">
            {activeSkill ? (
              <div className="min-w-0 max-w-full">
                <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-600" />
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {activeSkill.name}
                    </h4>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                      id: {activeSkill.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {activeSkill.description}
                  </p>
                </div>

                <div className="min-w-0 max-w-full">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Skill Markdown Instructions
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs overflow-x-auto max-w-full">
                    <MarkdownViewer content={activeSkill.content} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Select a skill from the left
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

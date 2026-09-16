import React, { useState } from 'react';
import {
  ChevronRight,
  FileText,
  Pencil,
  Terminal,
  CircleDot,
  FileCheck,
  Loader2,
  Wrench,
} from 'lucide-react';
import { ExecutionGroup, ExecutionStep } from '../../types/chat';

export interface ExecutionTimelineProps {
  group: ExecutionGroup;
  defaultExpanded?: boolean;
  onOpenArtifact?: (filenameOrId: string) => void;
}

/**
 * Computes a human-readable summary matching Claude's header format:
 * e.g., "1 file edited, read 1 file, executed 2 commands · 2 notes"
 */
export function formatExecutionSummary(steps: ExecutionStep[], locale: 'en' | 'es' = 'en'): string {
  const edits = steps.filter((s) => s.kind === 'edit').length;
  const reads = steps.filter((s) => s.kind === 'read').length;
  const commands = steps.filter((s) => s.kind === 'command').length;
  const presents = steps.filter((s) => s.kind === 'present').length;
  const notes = steps.filter((s) => s.kind === 'note').length;

  const parts: string[] = [];

  if (locale === 'es') {
    if (edits > 0) {
      parts.push(edits === 1 ? '1 archivo editado' : `${edits} archivos editados`);
    }
    if (reads > 0) {
      parts.push(reads === 1 ? 'leyó 1 archivo' : `leyó ${reads} archivos`);
    }
    if (commands > 0) {
      parts.push(commands === 1 ? 'ejecutó 1 comando' : `ejecutó ${commands} comandos`);
    }
    if (presents > 0) {
      parts.push(presents === 1 ? 'presentó 1 archivo' : `presentó ${presents} archivos`);
    }
    if (parts.length === 0) {
      parts.push(`${steps.length} acciones ejecutadas`);
    }
    const actionSummary = parts.join(', ');
    if (notes > 0) {
      return `${actionSummary} · ${notes} ${notes === 1 ? 'nota' : 'notas'}`;
    }
    return actionSummary;
  }

  // English default
  if (edits > 0) {
    parts.push(edits === 1 ? '1 file edited' : `${edits} files edited`);
  }
  if (reads > 0) {
    parts.push(reads === 1 ? 'read 1 file' : `read ${reads} files`);
  }
  if (commands > 0) {
    parts.push(commands === 1 ? 'executed 1 command' : `executed ${commands} commands`);
  }
  if (presents > 0) {
    parts.push(presents === 1 ? 'presented 1 file' : `presented ${presents} files`);
  }
  if (parts.length === 0) {
    parts.push(`${steps.length} actions executed`);
  }
  const actionSummary = parts.join(', ');
  if (notes > 0) {
    return `${actionSummary} · ${notes} ${notes === 1 ? 'note' : 'notes'}`;
  }
  return actionSummary;
}

export interface ExecutionTimelineProps {
  group: ExecutionGroup;
  defaultExpanded?: boolean;
  onOpenArtifact?: (filenameOrId: string) => void;
  locale?: 'en' | 'es';
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
  group,
  defaultExpanded = false,
  onOpenArtifact,
  locale = 'en',
}) => {
  const [userToggled, setUserToggled] = useState<boolean | null>(null);

  // Auto-expand while running, auto-collapse when completed (unless user manually interacted)
  const isExpanded = userToggled !== null ? userToggled : defaultExpanded || !group.isCompleted;
  const summaryText = group.summary || formatExecutionSummary(group.steps, locale);

  return (
    <div className="my-1.5 select-none">
      {/* Discreet Collapsible Header */}
      <button
        type="button"
        onClick={() => setUserToggled(!isExpanded)}
        className="inline-flex items-center gap-1.5 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors group cursor-pointer"
      >
        {!group.isCompleted && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 flex-shrink-0" />
        )}
        <span className="font-normal text-[12.5px]">{summaryText}</span>
        <ChevronRight
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-200 flex-shrink-0 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {/* Expanded Vertical Timeline Tree */}
      {isExpanded && (
        <div className="pt-1.5 pb-2 pl-0.5">
          <div className="relative space-y-2.5 pt-1 pl-4">
            {/* Continuous Vertical Branch Line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-[1.5px] bg-slate-200 dark:bg-zinc-800" />

            {group.steps.map((step) => {
              const isRunning = step.status === 'running';

              return (
                <div key={step.id} className="relative flex items-start gap-2.5 text-xs">
                  {/* Step Node Icon on the Branch Line */}
                  <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-4 h-4 -ml-[19px] bg-white dark:bg-[#131315] text-slate-400 dark:text-slate-500">
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    ) : step.kind === 'edit' ? (
                      <Pencil className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    ) : step.kind === 'read' ? (
                      <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    ) : step.kind === 'command' ? (
                      <Terminal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    ) : step.kind === 'present' ? (
                      <FileCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                    ) : step.kind === 'note' ? (
                      <CircleDot className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                    ) : (
                      <Wrench className="w-3 h-3 text-slate-400" />
                    )}
                  </div>

                  {/* Step Description & Badges */}
                  <div className="flex-1 flex items-center flex-wrap gap-2 text-slate-600 dark:text-slate-300 min-w-0 pt-0.5">
                    <span className={step.kind === 'note' ? 'text-slate-500 dark:text-slate-400' : ''}>
                      {step.title}
                    </span>

                    {/* Filename Pill */}
                    {step.filename && (
                      <button
                        type="button"
                        onClick={() => onOpenArtifact?.(step.filename!)}
                        className="inline-flex items-center px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 font-mono text-[10.5px] text-slate-700 dark:text-slate-300 transition-colors"
                        title={`View ${step.filename}`}
                      >
                        {step.filename}
                      </button>
                    )}

                    {/* Diff Counters (+added -removed) */}
                    {step.diff && (
                      <div className="inline-flex items-center gap-1 font-mono text-[10.5px] font-semibold">
                        {step.diff.added > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{step.diff.added}
                          </span>
                        )}
                        {step.diff.removed > 0 && (
                          <span className="text-rose-500 dark:text-rose-400">
                            -{step.diff.removed}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

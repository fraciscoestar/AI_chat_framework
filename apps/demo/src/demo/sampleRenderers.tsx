import React from 'react';
import { CustomRendererProps } from '@ai-chat-suite/core';
import { Cpu, Zap, Activity } from 'lucide-react';

/**
 * Example Custom Renderer: KiCad Schematic / Circuit Viewer
 * Demonstrates how parent projects register custom renderers
 * for languages like ````kicad or files with .kicad_sch extensions.
 */
export const KicadRenderer: React.FC<CustomRendererProps> = ({
  content,
  filename,
  isArtifact,
}) => {
  // Parse simple key-value lines or component definitions from content
  const lines = content.trim().split('\n');

  return (
    <div className="my-3 rounded-xl border border-sky-300 dark:border-sky-800/60 bg-sky-50/50 dark:bg-sky-950/20 p-4 text-xs">
      <div className="flex items-center justify-between border-b border-sky-200 dark:border-sky-800/50 pb-2 mb-3">
        <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300 font-bold">
          <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span>KiCad Schematic Preview</span>
          {filename && <span className="font-mono font-normal opacity-75">({filename})</span>}
        </div>
        <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
          <Zap className="w-3 h-3 fill-current" />
          <span>Custom Plugin Active</span>
        </span>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {lines.slice(0, 6).map((line, idx) => (
            <div
              key={idx}
              className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-sky-100 dark:border-sky-900/40 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 font-mono">
                <Activity className="w-3 h-3 text-sky-500" />
                <span className="text-slate-800 dark:text-slate-200">{line.trim() || `Node_${idx + 1}`}</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 font-mono">
                PIN_{idx}
              </span>
            </div>
          ))}
        </div>

        <div className="text-[11px] text-slate-500 mt-2 font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded max-h-28 overflow-y-auto">
          {content}
        </div>
      </div>
    </div>
  );
};

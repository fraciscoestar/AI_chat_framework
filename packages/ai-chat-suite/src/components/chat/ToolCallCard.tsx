import React, { useState } from 'react';
import {
  Wrench,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal,
  BookOpen,
  FileEdit,
  Search,
} from 'lucide-react';
import { ToolCall } from '../../types/chat';

export interface ToolCallCardProps {
  toolCall: ToolCall;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getToolIcon = (name: string) => {
    switch (name) {
      case 'python_eval':
        return <Terminal className="w-3.5 h-3.5 text-sky-500" />;
      case 'read_skill':
        return <BookOpen className="w-3.5 h-3.5 text-amber-500" />;
      case 'workspace_write_file':
      case 'workspace_read_file':
        return <FileEdit className="w-3.5 h-3.5 text-emerald-500" />;
      case 'web_search':
        return <Search className="w-3.5 h-3.5 text-indigo-500" />;
      default:
        return <Wrench className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const isRunning = toolCall.status === 'running' || toolCall.status === 'pending';
  const isError = toolCall.status === 'error' || Boolean(toolCall.error);

  return (
    <div className="my-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden text-xs shadow-sm">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 truncate">
          {getToolIcon(toolCall.name)}
          <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
            {toolCall.name}
          </span>
          <span className="text-slate-400 text-[11px] truncate">
            {JSON.stringify(toolCall.args)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isRunning && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Running...</span>
            </span>
          )}

          {!isRunning && !isError && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          )}

          {isError && (
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          )}

          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2 font-mono text-[11px]">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Arguments</div>
            <pre className="bg-slate-100 dark:bg-slate-900 p-2 rounded overflow-x-auto text-slate-800 dark:text-slate-200">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {(toolCall.result !== undefined || toolCall.error) && (
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Result</div>
              <pre
                className={`p-2 rounded overflow-x-auto ${
                  isError
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                }`}
              >
                {toolCall.error || (typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result, null, 2))}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

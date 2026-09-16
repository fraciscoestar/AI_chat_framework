import React from 'react';
import {
  FileText,
  FileCode,
  Download,
  ExternalLink,
} from 'lucide-react';
import { VirtualArtifact } from '../../types/workspace';

export interface ArtifactCardProps {
  artifact: VirtualArtifact;
  onOpen: (artifactId: string) => void;
}

export const ArtifactCard: React.FC<ArtifactCardProps> = ({ artifact, onOpen }) => {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const blob = new Blob([artifact.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = artifact.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ArtifactCard] Download error:', err);
    }
  };

  const ext = artifact.filename.split('.').pop()?.toUpperCase() || artifact.language.toUpperCase();
  const typeLabel = artifact.type === 'document' ? 'Document' : artifact.type === 'code' ? 'Code' : 'File';

  return (
    <div
      onClick={() => onOpen(artifact.id)}
      className="group my-2.5 flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181a] hover:border-slate-300 dark:hover:border-white/20 cursor-pointer transition-all shadow-xs"
    >
      <div className="flex items-center gap-3 truncate pr-2">
        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 flex-shrink-0">
          {artifact.language === 'markdown' ? (
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          ) : (
            <FileCode className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          )}
        </div>
        <div className="truncate">
          <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
            {artifact.title || artifact.filename}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
            {typeLabel} · {ext}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
          title="Download file"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Download</span>
        </button>

        <button
          type="button"
          onClick={() => onOpen(artifact.id)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          title="Open in drawer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

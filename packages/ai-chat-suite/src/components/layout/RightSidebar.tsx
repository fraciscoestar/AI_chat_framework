import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Eye,
  Code2,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  GripVertical,
} from 'lucide-react';
import { VirtualArtifact } from '../../types/workspace';
import { MarkdownViewer } from '../../rendering/MarkdownViewer';
import { ArtifactCodeViewer } from '../../rendering/ArtifactCodeViewer';
import { useRendererRegistry, resolveCustomRenderer } from '../../rendering/RendererRegistry';

export interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  artifacts: VirtualArtifact[];
  activeArtifactId?: string;
  onSelectArtifact: (id: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onClose,
  artifacts,
  activeArtifactId,
  onSelectArtifact,
}) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
  const [copied, setCopied] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [width, setWidth] = useState(540);
  const [isDragging, setIsDragging] = useState(false);

  const registry = useRendererRegistry();
  const sidebarRef = useRef<HTMLElement>(null);

  // Resize drag handlers with 0-lag direct tracking
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    let frameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const newWidth = window.innerWidth - e.clientX;
        const minWidth = 360;
        const maxWidth = Math.max(window.innerWidth * 0.92, 500);
        setWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      cancelAnimationFrame(frameId);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(frameId);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  // Selected artifact
  const activeArtifact = artifacts.find((a) => a.id === activeArtifactId) || artifacts[0];
  const currentContent = activeArtifact?.content || '';
  const currentLanguage = activeArtifact?.language || 'text';
  const currentTitle = activeArtifact?.title || activeArtifact?.filename || 'Untitled Artifact';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = activeArtifact?.filename || 'artifact.txt';
    const blob = new Blob([currentContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      ref={sidebarRef}
      style={{ width: isMaximized ? '100vw' : `${width}px` }}
      className={`relative h-full flex flex-col select-none border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#18181a] ${
        isDragging ? '' : 'transition-[width] duration-150'
      } ${
        isMaximized
          ? '!fixed !inset-0 !z-[100] !w-screen !h-screen'
          : 'flex-shrink-0'
      }`}
    >
      {/* Draggable Resize Border Handle */}
      {!isMaximized && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-500/50 active:bg-amber-600 transition-colors z-20 group flex items-center justify-center -ml-1"
          title="Drag to resize drawer"
        >
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-3 h-3 text-slate-400" />
          </div>
        </div>
      )}

      {/* Claude-Style Top Bar */}
      <div className="h-12 px-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#18181a] flex-shrink-0">
        {/* Left: View Mode Toggle & Title */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg mr-1 flex-shrink-0">
            <button
              onClick={() => setViewMode('rendered')}
              className={`p-1 rounded-md transition-colors ${
                viewMode === 'rendered'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Preview / Rendered View"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('source')}
              className={`p-1 rounded-md transition-colors ${
                viewMode === 'source'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Code / Source View"
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
              {currentTitle}
            </span>
            <span className="text-[10px] font-mono uppercase text-slate-400 px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 flex-shrink-0">
              {currentLanguage}
            </span>
          </div>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs transition-colors"
            title="Copy Content"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px]">Copy</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            title="Download File"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore Button */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            title={isMaximized ? 'Restore View' : 'Maximize to Full Screen'}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Artifacts Tabs Selector (when multiple artifacts exist) */}
      {artifacts.length > 1 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto bg-slate-50/50 dark:bg-slate-900/30 flex-shrink-0">
          {artifacts.map((art) => (
            <button
              key={art.id}
              onClick={() => onSelectArtifact(art.id)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] whitespace-nowrap transition-colors ${
                (activeArtifactId ? art.id === activeArtifactId : art.id === artifacts[0].id)
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold border border-amber-300 dark:border-amber-700/50'
                  : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3 h-3 text-amber-600" />
              <span>{art.filename || art.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content Viewer Body */}
      <div className={`flex-1 overflow-hidden select-text ${viewMode === 'source' ? 'p-0' : 'p-4 overflow-y-auto'}`}>
        {!currentContent ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center gap-2">
            <Sparkles className="w-8 h-8 text-amber-500/40" />
            <p className="text-xs">No artifact selected</p>
          </div>
        ) : viewMode === 'rendered' ? (
          renderActiveContent()
        ) : (
          <ArtifactCodeViewer content={currentContent} language={currentLanguage} filename={activeArtifact?.filename} />
        )}
      </div>
    </aside>
  );

  function renderActiveContent() {
    const CustomRenderer = resolveCustomRenderer(currentLanguage, registry);
    if (CustomRenderer) {
      return (
        <CustomRenderer
          content={currentContent}
          language={currentLanguage}
          filename={activeArtifact?.filename}
          isArtifact={true}
        />
      );
    }

    if (currentLanguage === 'markdown' || currentLanguage === 'md') {
      return (
        <MarkdownViewer
          content={currentContent}
          isArtifact={true}
          filename={activeArtifact?.filename}
        />
      );
    }

    if (currentLanguage === 'mermaid') {
      return <MarkdownViewer content={`\`\`\`mermaid\n${currentContent}\n\`\`\``} isArtifact={true} />;
    }

    // Default: full-bleed code view
    return <ArtifactCodeViewer content={currentContent} language={currentLanguage} filename={activeArtifact?.filename} />;
  }
};

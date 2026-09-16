import React from 'react';

export interface ArtifactCodeViewerProps {
  content: string;
  language?: string;
  filename?: string;
  className?: string;
}

/**
 * Full-bleed line-numbered code viewer matching Claude.ai's artifact code view.
 * Eliminates nested cards so the entire drawer body functions as the code editor/viewer.
 */
export const ArtifactCodeViewer: React.FC<ArtifactCodeViewerProps> = ({
  content,
  className = '',
}) => {
  const lines = content.split('\n');

  return (
    <div className={`h-full w-full flex bg-[#1e1e20] text-slate-100 font-mono text-xs select-text overflow-auto ${className}`}>
      {/* Line Numbers Gutter */}
      <div className="flex-shrink-0 select-none py-4 px-3 text-right text-slate-600 bg-[#18181a] border-r border-slate-800/80 min-w-[48px] text-[11px] leading-relaxed">
        {lines.map((_, i) => (
          <div key={i} className="leading-relaxed">
            {i + 1}
          </div>
        ))}
      </div>

      {/* Code Text Content */}
      <div className="flex-1 py-4 px-4 overflow-x-auto min-w-0">
        <pre className="font-mono text-xs leading-relaxed text-slate-200 tab-size-2">
          <code>
            {lines.map((line, idx) => (
              <div key={idx} className="leading-relaxed whitespace-pre hover:bg-slate-800/30 -mx-4 px-4">
                {line || ' '}
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

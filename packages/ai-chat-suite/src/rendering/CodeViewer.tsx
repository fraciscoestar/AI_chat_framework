import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export interface CodeViewerProps {
  content: string;
  language?: string;
  filename?: string;
  className?: string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  content,
  language = 'text',
  filename,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`my-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 overflow-hidden text-sm ${className}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-xs text-slate-400">
        <span className="font-mono font-medium">
          {filename || language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto">
        <pre className="font-mono text-xs leading-relaxed">
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
};

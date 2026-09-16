import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { MermaidViewer } from './MermaidViewer';
import { CodeViewer } from './CodeViewer';
import { useRendererRegistry, resolveCustomRenderer } from './RendererRegistry';

export interface MarkdownViewerProps {
  content: string;
  className?: string;
  isArtifact?: boolean;
  filename?: string;
}

/**
 * Normalizes common KaTeX / Markdown currency formatting discrepancies:
 * - Fixes typo like `$$100.00$` -> `$100.00`
 * - Fixes raw unescaped dollar amounts inside markdown tables that collide with math parsing
 */
function normalizeMathAndCurrency(raw: string): string {
  if (!raw) return '';
  // Fix $$100.00$ pattern (double dollar start, single dollar end for price)
  let normalized = raw.replace(/\$\$([0-9]+(?:\.[0-9]{1,2})?)\$/g, '$$$1$$');
  // Normalize unescaped dollar signs preceding numbers if isolated in markdown tables
  return normalized;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = React.memo(({
  content,
  className = '',
  isArtifact = false,
  filename,
}) => {
  const registry = useRendererRegistry();

  const preprocessed = useMemo(() => normalizeMathAndCurrency(content), [content]);

  const components = useMemo<React.ComponentProps<typeof ReactMarkdown>['components']>(() => ({
    code({ className: codeClassName, children, ...props }) {
      const match = /language-([a-zA-Z0-9_-]+)/.exec(codeClassName || '');
      const rawContent = String(children).replace(/\n$/, '');

      if (match) {
        const language = match[1].toLowerCase();

        // 1. Mermaid diagrams
        if (language === 'mermaid') {
          return <MermaidViewer content={rawContent} />;
        }

        // 2. Custom plugin renderers (e.g. kicad, csv, etc.)
        const CustomRenderer = resolveCustomRenderer(language, registry);
        if (CustomRenderer) {
          return (
            <CustomRenderer
              content={rawContent}
              language={language}
              filename={filename}
              isArtifact={isArtifact}
            />
          );
        }

        // 3. Default Syntax Code Block
        return (
          <CodeViewer
            content={rawContent}
            language={language}
            filename={filename}
          />
        );
      }

      // Inline code
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs"
          {...props}
        >
          {children}
        </code>
      );
    },
    table({ children }) {
      return (
        <div className="overflow-x-auto my-3 max-w-full">
          <table className="min-w-full border border-slate-300 dark:border-slate-700 divide-y divide-slate-300 dark:divide-slate-700 text-xs">
            {children}
          </table>
        </div>
      );
    },
    th({ children }) {
      return (
        <th className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
          {children}
        </td>
      );
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-600 dark:text-amber-400 hover:underline font-medium"
        >
          {children}
        </a>
      );
    },
    ul({ children }) {
      return <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-amber-500/50 pl-3 my-2 text-slate-600 dark:text-slate-400 italic">
          {children}
        </blockquote>
      );
    },
  }), [registry, filename, isArtifact]);

  return (
    <div className={`prose dark:prose-invert max-w-none text-sm leading-relaxed overflow-hidden ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, trust: true }]]}
        components={components}
      >
        {preprocessed}
      </ReactMarkdown>
    </div>
  );
});

MarkdownViewer.displayName = 'MarkdownViewer';

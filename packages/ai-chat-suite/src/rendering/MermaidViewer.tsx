import React, { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';
import { AlertCircle, Check, Copy, Loader2 } from 'lucide-react';

export interface MermaidViewerProps {
  content: string;
  className?: string;
}

function configureMermaid(isDark: boolean) {
  if (typeof window === 'undefined') return;

  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: isDark ? 'dark' : 'neutral',
    themeVariables: isDark
      ? {
          darkMode: true,
          background: '#18181b',
          mainBkg: '#27272a',
          nodeBorder: '#52525b',
          clusterBkg: '#1c1c1f',
          clusterBorder: '#3f3f46',
          lineColor: '#a1a1aa',
          textColor: '#f4f4f5',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '13px',
        }
      : {
          darkMode: false,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '13px',
        },
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
      padding: 16,
    },
  });
}

function reorderMermaidSvg(svgHtml: string): string {
  if (typeof window === 'undefined') return svgHtml;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgHtml, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return svgHtml;

    // In SVG painter's algorithm, later elements are rendered on top of earlier ones.
    // Move all edgeLabels and edgeLabel groups to the end of their parent container
    // so they are guaranteed to render above edgePaths (arrow lines).
    const edgeLabels = doc.querySelectorAll('g.edgeLabels, g.edgeLabel');
    edgeLabels.forEach((el) => {
      if (el.parentElement) {
        el.parentElement.appendChild(el);
      }
    });

    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  } catch {
    return svgHtml;
  }
}

// Persistent module-level cache for rendered Mermaid SVGs across re-renders/remounts
const mermaidSvgCache = new Map<string, string>();

export const MermaidViewer: React.FC<MermaidViewerProps> = React.memo(({ content, className = '' }) => {
  const trimmed = content.trim();
  const [svgContent, setSvgContent] = useState<string>(() => mermaidSvgCache.get(trimmed) || '');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const elementId = `mermaid_${rawId}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!trimmed) {
      setSvgContent('');
      setError(null);
      setIsRendering(false);
      return;
    }

    // If already in cache, restore immediately without re-rendering
    const cached = mermaidSvgCache.get(trimmed);
    if (cached) {
      setSvgContent(cached);
      setError(null);
      setIsRendering(false);
      return;
    }

    // Detect if dark mode is active in DOM
    const isDark =
      document.documentElement.classList.contains('dark') ||
      Boolean(document.querySelector('.ai-chat-suite-root.dark'));

    configureMermaid(isDark);

    let isCancelled = false;
    setIsRendering(true);

    const timeoutId = setTimeout(async () => {
      try {
        setError(null);

        // Remove any stray error DOM node created in body by mermaid
        const stray = document.getElementById('d' + elementId) || document.getElementById(elementId);
        if (stray && stray.parentElement === document.body) {
          stray.remove();
        }

        const { svg } = await mermaid.render(elementId, trimmed);
        if (!isCancelled) {
          const finalSvg = reorderMermaidSvg(svg);
          mermaidSvgCache.set(trimmed, finalSvg);
          setSvgContent(finalSvg);
          setError(null);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const stray = document.getElementById('d' + elementId) || document.getElementById(elementId);
          if (stray && stray.parentElement === document.body) {
            stray.remove();
          }
          const errMsg = err instanceof Error ? err.message : 'Invalid Mermaid diagram syntax';
          setError(errMsg.replace(/^Error:\s*/, ''));
        }
      } finally {
        if (!isCancelled) {
          setIsRendering(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      const stray = document.getElementById('d' + elementId) || document.getElementById(elementId);
      if (stray && stray.parentElement === document.body) {
        stray.remove();
      }
    };
  }, [trimmed, elementId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`my-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#18181a] p-4 overflow-x-auto ${className}`}>
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
        <div className="flex items-center gap-2 font-semibold uppercase tracking-wider">
          <span>Mermaid Diagram</span>
          {/* Persistent spinner element so CSS rotation keyframes do not reset */}
          <div
            className={`transition-opacity duration-300 ${
              isRendering ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          title="Copy Mermaid code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {error ? (
        <div className="text-xs text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-3 rounded flex flex-col gap-2">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="w-4 h-4" />
            <span>Mermaid Syntax Notice</span>
          </div>
          <p className="font-mono text-[11px] opacity-80 break-words">{error}</p>
          <pre className="mt-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 p-2 rounded text-[11px] overflow-x-auto font-mono">
            {content}
          </pre>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="mermaid-render-output flex justify-center items-center min-h-[100px] [&>svg]:max-w-full [&>svg]:h-auto transition-opacity duration-200"
          style={{ opacity: isRendering && !svgContent ? 0.6 : 1 }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      )}
    </div>
  );
});

MermaidViewer.displayName = 'MermaidViewer';

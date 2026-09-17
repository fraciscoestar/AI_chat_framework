import React, { useEffect, useRef, useState, useId, useCallback } from 'react';
import mermaid from 'mermaid';
import { AlertCircle, Check, Copy, Loader2, RotateCw } from 'lucide-react';

export interface MermaidViewerProps {
  content: string;
  className?: string;
}

let mermaidInitialized = false;

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
          background: '#ffffff',
          mainBkg: '#f8fafc',
          nodeBorder: '#cbd5e1',
          clusterBkg: '#f8fafc',
          clusterBorder: '#cbd5e1',
          lineColor: '#64748b',
          textColor: '#0f172a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '13px',
        },
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
      padding: 16,
    },
  });
  mermaidInitialized = true;
}

function isChunkLoadError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('loading chunk') ||
    lower.includes('chunkloaderror') ||
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('failed to load module script') ||
    lower.includes('error loading dynamically imported module')
  );
}

function reorderMermaidSvg(svgHtml: string): string {
  // Return the SVG string directly to let the browser's HTML5 engine parse it via innerHTML.
  // This completely prevents XML parser errors on unclosed HTML void tags (<br>, <img>) inside <foreignObject>.
  // Edge label layering is handled safely in the live DOM via a dedicated useEffect.
  return svgHtml;
}

// Persistent module-level cache for rendered Mermaid SVGs keyed by `${theme}:::${content}`
const mermaidSvgCache = new Map<string, string>();
const getCacheKey = (content: string, isDark: boolean) => `${isDark ? 'dark' : 'light'}:::${content}`;

function useThemeDetector(containerRef: React.RefObject<HTMLDivElement | null>): boolean {
  const getIsDark = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (document.documentElement.classList.contains('dark')) return true;
    if (document.body.classList.contains('dark')) return true;
    const suiteRoot = containerRef.current?.closest('.ai-chat-suite-root');
    if (suiteRoot && suiteRoot.classList.contains('dark')) return true;
    const darkAncestor = containerRef.current?.closest('.dark');
    if (darkAncestor) return true;
    return false;
  }, [containerRef]);

  const [isDark, setIsDark] = useState<boolean>(getIsDark);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsDark(getIsDark());

    const checkAndUpdate = () => {
      const current = getIsDark();
      setIsDark((prev) => (prev !== current ? current : prev));
    };

    const observer = new MutationObserver(checkAndUpdate);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const rootEl =
      containerRef.current?.closest('.ai-chat-suite-root') ||
      containerRef.current?.closest('.dark') ||
      containerRef.current?.parentElement;

    if (rootEl) {
      observer.observe(rootEl, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [getIsDark, containerRef]);

  return isDark;
}

export const MermaidViewer: React.FC<MermaidViewerProps> = React.memo(({ content, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = useThemeDetector(containerRef);
  const trimmed = content.trim();
  const cacheKey = getCacheKey(trimmed, isDark);

  const [svgContent, setSvgContent] = useState<string>(() => mermaidSvgCache.get(cacheKey) || '');
  const [error, setError] = useState<string | null>(null);
  const [isChunkError, setIsChunkError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderNonce, setRenderNonce] = useState(0);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const elementId = `mermaid_${rawId}_${isDark ? 'dark' : 'light'}_${renderNonce}`;

  const handleRetry = useCallback(() => {
    mermaidSvgCache.delete(cacheKey);
    setError(null);
    setIsChunkError(false);
    setRenderNonce((prev) => prev + 1);
  }, [cacheKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!trimmed) {
      setSvgContent('');
      setError(null);
      setIsChunkError(false);
      setIsRendering(false);
      return;
    }

    // Check if the content is just an initial header without nodes (e.g. "flowchart TB" during streaming)
    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      // Content is still being streamed or incomplete, wait for more lines
      setIsRendering(true);
      return;
    }

    // If already in cache for this theme, restore immediately without re-rendering
    const cached = mermaidSvgCache.get(cacheKey);
    if (cached) {
      setSvgContent(cached);
      setError(null);
      setIsChunkError(false);
      setIsRendering(false);
      return;
    }

    configureMermaid(isDark);

    let isCancelled = false;
    let retryAttempt = 0;
    const maxRetries = 2;
    setIsRendering(true);

    const tryRender = async () => {
      try {
        setError(null);
        setIsChunkError(false);

        // Remove any stray error DOM node created in body by mermaid
        const stray = document.getElementById('d' + elementId) || document.getElementById(elementId);
        if (stray && stray.parentElement === document.body) {
          stray.remove();
        }

        const { svg } = await mermaid.render(elementId, trimmed);
        if (!isCancelled) {
          const finalSvg = reorderMermaidSvg(svg);
          mermaidSvgCache.set(cacheKey, finalSvg);
          setSvgContent(finalSvg);
          setError(null);
          setIsChunkError(false);
          setIsRendering(false);
        }
      } catch (err: unknown) {
        if (isCancelled) return;

        const stray = document.getElementById('d' + elementId) || document.getElementById(elementId);
        if (stray && stray.parentElement === document.body) {
          stray.remove();
        }

        const errMsg = err instanceof Error ? err.message : 'Invalid Mermaid diagram syntax';
        const chunkFailed = isChunkLoadError(errMsg);

        // If chunk load failed, auto-retry after a brief backoff
        if (chunkFailed && retryAttempt < maxRetries) {
          retryAttempt++;
          setTimeout(() => {
            if (!isCancelled) {
              tryRender();
            }
          }, 400 * retryAttempt);
          return;
        }

        setIsChunkError(chunkFailed);
        setError(errMsg.replace(/^Error:\s*/, ''));
        setIsRendering(false);
      }
    };

    const timeoutId = setTimeout(tryRender, 100);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      const stray = document.getElementById('d' + elementId) || document.getElementById(elementId);
      if (stray && stray.parentElement === document.body) {
        stray.remove();
      }
    };
  }, [trimmed, elementId, renderNonce, isDark, cacheKey]);

  // Reorder edge labels in live DOM so they render above connector lines
  useEffect(() => {
    if (!containerRef.current) return;
    const edgeLabels = containerRef.current.querySelectorAll('g.edgeLabels, g.edgeLabel');
    edgeLabels.forEach((el) => {
      if (el.parentElement) {
        el.parentElement.appendChild(el);
      }
    });
  }, [svgContent]);

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

        <div className="flex items-center gap-2">
          {error && (
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors"
              title="Retry rendering diagram"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            title="Copy Mermaid code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {error ? (
        <div
          className={`text-xs p-3 rounded flex flex-col gap-2 ${
            isChunkError
              ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60'
              : 'text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30'
          }`}
        >
          <div className="flex items-center justify-between font-medium">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>{isChunkError ? 'Asset Loading Notice' : 'Mermaid Syntax Notice'}</span>
            </div>
            {isChunkError && (
              <button
                type="button"
                onClick={handleRetry}
                className="px-2 py-0.5 text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 rounded flex items-center gap-1 transition-colors"
              >
                <RotateCw className="w-3 h-3" />
                <span>Reload Diagram</span>
              </button>
            )}
          </div>
          <p className="font-mono text-[11px] opacity-80 break-words">
            {isChunkError
              ? 'A diagram chunk failed to load from the server (often happens when the dev server recompiles). Click "Reload Diagram" or refresh the page.'
              : error}
          </p>
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

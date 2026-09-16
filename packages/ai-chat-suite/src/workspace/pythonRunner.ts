import { ToolExecutionResult } from '../types/tools';
import { VirtualFileSystem } from './vfs';

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackagesFromImports: (code: string) => Promise<void>;
  FS: {
    writeFile: (path: string, data: string | Uint8Array) => void;
    readFile: (path: string, options: { encoding: 'utf8' }) => string;
    readdir: (path: string) => string[];
  };
  setStdout: (options: { batched: (output: string) => void }) => void;
  setStderr: (options: { batched: (output: string) => void }) => void;
}

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL?: string }) => Promise<PyodideInterface>;
    __pyodideInstance?: Promise<PyodideInterface>;
  }
}

export class PythonRunner {
  private static pyodidePromise: Promise<PyodideInterface> | null = null;
  private vfs?: VirtualFileSystem;

  constructor(vfs?: VirtualFileSystem) {
    this.vfs = vfs;
  }

  private async getPyodide(): Promise<PyodideInterface> {
    if (typeof window === 'undefined') {
      throw new Error('Pyodide execution is only available in browser environments.');
    }

    if (PythonRunner.pyodidePromise) {
      return PythonRunner.pyodidePromise;
    }

    PythonRunner.pyodidePromise = (async () => {
      // If loadPyodide is not yet on window, inject script tag
      if (!window.loadPyodide) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Pyodide script from CDN'));
          document.head.appendChild(script);
        });
      }

      if (!window.loadPyodide) {
        throw new Error('Pyodide script loaded but window.loadPyodide is undefined.');
      }

      const pyodide = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
      });

      return pyodide;
    })();

    return PythonRunner.pyodidePromise;
  }

  async run(code: string): Promise<ToolExecutionResult> {
    let stdoutBuffer = '';
    let stderrBuffer = '';

    try {
      const pyodide = await this.getPyodide();

      // Hook output capture
      pyodide.setStdout({
        batched: (text: string) => {
          stdoutBuffer += (stdoutBuffer ? '\n' : '') + text;
        },
      });

      pyodide.setStderr({
        batched: (text: string) => {
          stderrBuffer += (stderrBuffer ? '\n' : '') + text;
        },
      });

      // Sync files from VFS into Pyodide FS if available
      if (this.vfs) {
        try {
          const files = await this.vfs.listFiles();
          for (const file of files) {
            const cleanPath = file.path.replace(/^\//, '');
            // Only write standard files
            if (cleanPath && !file.isDirectory) {
              try {
                pyodide.FS.writeFile(cleanPath, file.content);
              } catch {
                // Ignore nested directory write issues
              }
            }
          }
        } catch (err) {
          console.warn('[PythonRunner] Could not pre-sync VFS files:', err);
        }
      }

      // Automatically load any required packages (e.g. numpy, pandas, etc. if available in Pyodide)
      try {
        await pyodide.loadPackagesFromImports(code);
      } catch (pkgErr) {
        console.warn('[PythonRunner] Failed to auto-load packages:', pkgErr);
      }

      // Execute code
      const rawResult = await pyodide.runPythonAsync(code);
      const resultStr = rawResult !== undefined ? String(rawResult) : '';

      return {
        id: 'python-eval',
        name: 'python_eval',
        result: resultStr || stdoutBuffer,
        output: [stdoutBuffer, stderrBuffer].filter(Boolean).join('\n') || resultStr,
        isError: false,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        id: 'python-eval',
        name: 'python_eval',
        error: errMsg,
        output: [stdoutBuffer, stderrBuffer, errMsg].filter(Boolean).join('\n'),
        isError: true,
      };
    }
  }
}

import { ChatStorageAdapter } from '../types/storage';
import { VirtualFile } from '../types/workspace';

export class SandboxSecurityError extends Error {
  constructor(message: string) {
    super(`[VFS Sandbox Violation] ${message}`);
    this.name = 'SandboxSecurityError';
  }
}

/**
 * Validates and normalizes paths strictly within the virtual workspace root.
 * Guarantees that no `..` traversal or root escaping can occur.
 */
export function normalizeVirtualPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new SandboxSecurityError('Path must be a non-empty string');
  }

  // Strip drive letters, e.g., "C:", "D:"
  let cleaned = rawPath.replace(/^[a-zA-Z]:/, '');
  // Normalize backslashes to slashes
  cleaned = cleaned.replace(/\\/g, '/');
  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  // Split into components
  const segments = cleaned.split('/').filter((s) => s.length > 0 && s !== '.');
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === '..') {
      if (resolved.length === 0) {
        throw new SandboxSecurityError(`Path traversal attempt detected: "${rawPath}" escapes workspace root`);
      }
      resolved.pop();
    } else {
      // Prevent hidden malicious characters or null bytes
      if (segment.includes('\0')) {
        throw new SandboxSecurityError('Null bytes are prohibited in paths');
      }
      resolved.push(segment);
    }
  }

  return '/' + resolved.join('/');
}

export class VirtualFileSystem {
  private userId: string;
  private storageAdapter: ChatStorageAdapter;

  constructor(userId: string, storageAdapter: ChatStorageAdapter) {
    this.userId = userId;
    this.storageAdapter = storageAdapter;
  }

  async writeFile(rawPath: string, content: string): Promise<VirtualFile> {
    const safePath = normalizeVirtualPath(rawPath);
    const pathParts = safePath.split('/');
    const name = pathParts[pathParts.length - 1] || 'unnamed';

    const file: VirtualFile = {
      path: safePath,
      name,
      content,
      size: new Blob([content]).size,
      updatedAt: Date.now(),
      isDirectory: false,
    };

    if (this.storageAdapter.saveWorkspaceFile) {
      await this.storageAdapter.saveWorkspaceFile(this.userId, file);
    }

    return file;
  }

  async readFile(rawPath: string): Promise<string> {
    const safePath = normalizeVirtualPath(rawPath);
    const files = await this.listFiles();
    const file = files.find((f) => f.path === safePath);
    if (!file) {
      throw new Error(`File not found in sandbox: ${safePath}`);
    }
    return file.content;
  }

  async exists(rawPath: string): Promise<boolean> {
    const safePath = normalizeVirtualPath(rawPath);
    const files = await this.listFiles();
    return files.some((f) => f.path === safePath);
  }

  async stat(rawPath: string): Promise<VirtualFile | undefined> {
    const safePath = normalizeVirtualPath(rawPath);
    const files = await this.listFiles();
    return files.find((f) => f.path === safePath);
  }

  async deleteFile(rawPath: string): Promise<void> {
    const safePath = normalizeVirtualPath(rawPath);
    if (this.storageAdapter.deleteWorkspaceFile) {
      await this.storageAdapter.deleteWorkspaceFile(this.userId, safePath);
    }
  }

  async listFiles(directory: string = '/'): Promise<VirtualFile[]> {
    const safeDir = normalizeVirtualPath(directory);
    if (!this.storageAdapter.getWorkspaceFiles) {
      return [];
    }
    const allFiles = await this.storageAdapter.getWorkspaceFiles(this.userId);
    if (safeDir === '/') {
      return allFiles;
    }
    const prefix = safeDir.endsWith('/') ? safeDir : `${safeDir}/`;
    return allFiles.filter((f) => f.path.startsWith(prefix));
  }
}

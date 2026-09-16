export type ArtifactType = 'document' | 'code' | 'diagram' | 'data' | 'application' | 'custom';

export interface VirtualArtifact {
  id: string;
  title: string;
  filename: string;
  language: string; // e.g., 'markdown', 'mermaid', 'python', 'json', 'kicad'
  content: string;
  type: ArtifactType;
  createdAt: number;
  updatedAt: number;
  conversationId?: string;
  isReadOnly?: boolean;
  metadata?: Record<string, unknown>;
}

export interface VirtualFile {
  path: string; // Absolute within sandbox, e.g., '/notes/todo.md'
  name: string;
  content: string;
  size: number;
  updatedAt: number;
  isDirectory: boolean;
  mimeType?: string;
}

export interface WorkspaceConfig {
  enabled: boolean;
  userId: string;
  maxFiles?: number;
  maxStorageBytes?: number;
}

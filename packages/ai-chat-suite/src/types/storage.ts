import { Conversation, Folder } from './chat';
import { VirtualFile } from './workspace';

export interface ChatStorageAdapter {
  // Conversations
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(userId: string, id: string): Promise<Conversation | null>;
  saveConversation(userId: string, conversation: Conversation): Promise<void>;
  deleteConversation(userId: string, id: string): Promise<void>;

  // Folders
  getFolders(userId: string): Promise<Folder[]>;
  saveFolder(userId: string, folder: Folder): Promise<void>;
  deleteFolder(userId: string, folderId: string): Promise<void>;

  // Workspace Files (Optional if workspace is enabled)
  getWorkspaceFiles?(userId: string): Promise<VirtualFile[]>;
  saveWorkspaceFile?(userId: string, file: VirtualFile): Promise<void>;
  deleteWorkspaceFile?(userId: string, path: string): Promise<void>;
}

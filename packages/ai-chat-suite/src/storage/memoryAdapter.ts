import { ChatStorageAdapter } from '../types/storage';
import { Conversation, Folder } from '../types/chat';
import { VirtualFile } from '../types/workspace';

export class MemoryStorageAdapter implements ChatStorageAdapter {
  private conversations: Map<string, Conversation[]> = new Map();
  private folders: Map<string, Folder[]> = new Map();
  private files: Map<string, VirtualFile[]> = new Map();

  async getConversations(userId: string): Promise<Conversation[]> {
    return this.conversations.get(userId) || [];
  }

  async getConversation(userId: string, id: string): Promise<Conversation | null> {
    const userConvs = this.conversations.get(userId) || [];
    return userConvs.find((c) => c.id === id) || null;
  }

  async saveConversation(userId: string, conversation: Conversation): Promise<void> {
    const userConvs = this.conversations.get(userId) || [];
    const index = userConvs.findIndex((c) => c.id === conversation.id);
    if (index >= 0) {
      userConvs[index] = conversation;
    } else {
      userConvs.unshift(conversation);
    }
    this.conversations.set(userId, userConvs);
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    const userConvs = this.conversations.get(userId) || [];
    this.conversations.set(
      userId,
      userConvs.filter((c) => c.id !== id)
    );
  }

  async getFolders(userId: string): Promise<Folder[]> {
    return this.folders.get(userId) || [];
  }

  async saveFolder(userId: string, folder: Folder): Promise<void> {
    const userFolders = this.folders.get(userId) || [];
    const index = userFolders.findIndex((f) => f.id === folder.id);
    if (index >= 0) {
      userFolders[index] = folder;
    } else {
      userFolders.push(folder);
    }
    this.folders.set(userId, userFolders);
  }

  async deleteFolder(userId: string, folderId: string): Promise<void> {
    const userFolders = this.folders.get(userId) || [];
    this.folders.set(
      userId,
      userFolders.filter((f) => f.id !== folderId)
    );

    // Unassign conversations that belonged to this folder
    const userConvs = this.conversations.get(userId) || [];
    for (const c of userConvs) {
      if (c.folderId === folderId) {
        c.folderId = null;
      }
    }
  }

  async getWorkspaceFiles(userId: string): Promise<VirtualFile[]> {
    return this.files.get(userId) || [];
  }

  async saveWorkspaceFile(userId: string, file: VirtualFile): Promise<void> {
    const userFiles = this.files.get(userId) || [];
    const index = userFiles.findIndex((f) => f.path === file.path);
    if (index >= 0) {
      userFiles[index] = file;
    } else {
      userFiles.push(file);
    }
    this.files.set(userId, userFiles);
  }

  async deleteWorkspaceFile(userId: string, path: string): Promise<void> {
    const userFiles = this.files.get(userId) || [];
    this.files.set(
      userId,
      userFiles.filter((f) => f.path !== path)
    );
  }
}

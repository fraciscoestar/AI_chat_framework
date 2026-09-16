import { openDB, IDBPDatabase } from 'idb';
import { ChatStorageAdapter } from '../types/storage';
import { Conversation, Folder } from '../types/chat';
import { VirtualFile } from '../types/workspace';

interface StoredConversation extends Conversation {
  userId: string;
}

interface StoredFolder extends Folder {
  userId: string;
}

interface StoredFile extends VirtualFile {
  userId: string;
}

const DB_NAME = 'ai_chat_suite_db';
const DB_VERSION = 1;

export class IndexedDBStorageAdapter implements ChatStorageAdapter {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDB(): Promise<IDBPDatabase> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('IndexedDB is only available in browser environments'));
    }

    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('conversations')) {
            const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
            convStore.createIndex('by-user', 'userId', { unique: false });
            convStore.createIndex('by-updated', 'updatedAt', { unique: false });
          }

          if (!db.objectStoreNames.contains('folders')) {
            const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
            folderStore.createIndex('by-user', 'userId', { unique: false });
          }

          if (!db.objectStoreNames.contains('workspace_files')) {
            const fileStore = db.createObjectStore('workspace_files', { keyPath: ['userId', 'path'] });
            fileStore.createIndex('by-user', 'userId', { unique: false });
          }
        },
      });
    }

    return this.dbPromise;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    if (typeof window === 'undefined') return [];
    const db = await this.getDB();
    const stored = await db.getAllFromIndex('conversations', 'by-user', userId);
    return stored.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getConversation(userId: string, id: string): Promise<Conversation | null> {
    if (typeof window === 'undefined') return null;
    const db = await this.getDB();
    const conv = (await db.get('conversations', id)) as StoredConversation | undefined;
    if (conv && conv.userId === userId) {
      return conv;
    }
    return null;
  }

  async saveConversation(userId: string, conversation: Conversation): Promise<void> {
    if (typeof window === 'undefined') return;
    // Don't persist ephemeral conversations
    if (conversation.isEphemeral) return;

    const db = await this.getDB();
    const stored: StoredConversation = {
      ...conversation,
      userId,
      updatedAt: Date.now(),
    };
    await db.put('conversations', stored);
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const db = await this.getDB();
    const conv = await this.getConversation(userId, id);
    if (conv) {
      await db.delete('conversations', id);
    }
  }

  async getFolders(userId: string): Promise<Folder[]> {
    if (typeof window === 'undefined') return [];
    const db = await this.getDB();
    const stored = await db.getAllFromIndex('folders', 'by-user', userId);
    return stored.sort((a, b) => a.name.localeCompare(b.name));
  }

  async saveFolder(userId: string, folder: Folder): Promise<void> {
    if (typeof window === 'undefined') return;
    const db = await this.getDB();
    const stored: StoredFolder = {
      ...folder,
      userId,
      updatedAt: Date.now(),
    };
    await db.put('folders', stored);
  }

  async deleteFolder(userId: string, folderId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const db = await this.getDB();
    await db.delete('folders', folderId);

    // Unassign conversations that belonged to this folder
    const userConvs = await this.getConversations(userId);
    for (const conv of userConvs) {
      if (conv.folderId === folderId) {
        await this.saveConversation(userId, { ...conv, folderId: null });
      }
    }
  }

  async getWorkspaceFiles(userId: string): Promise<VirtualFile[]> {
    if (typeof window === 'undefined') return [];
    const db = await this.getDB();
    const stored = await db.getAllFromIndex('workspace_files', 'by-user', userId);
    return stored.sort((a, b) => a.path.localeCompare(b.path));
  }

  async saveWorkspaceFile(userId: string, file: VirtualFile): Promise<void> {
    if (typeof window === 'undefined') return;
    const db = await this.getDB();
    const stored: StoredFile = {
      ...file,
      userId,
      updatedAt: Date.now(),
    };
    await db.put('workspace_files', stored);
  }

  async deleteWorkspaceFile(userId: string, path: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const db = await this.getDB();
    await db.delete('workspace_files', [userId, path]);
  }
}

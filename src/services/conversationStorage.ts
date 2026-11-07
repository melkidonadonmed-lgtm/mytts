/**
 * Persistência Dual de Histórico de Conversas (Firestore + Fallback Local .data/conversations.json).
 * Vinculado à conta Google do usuário (userId) com isolamento de escopo e sanitização.
 */
import fs from 'fs';
import path from 'path';
import { Firestore } from '@google-cloud/firestore';
import type { SavedConversation } from '../types/polyglot.ts';

export interface ConversationStorageAdapter {
  readonly mode: 'firestore' | 'local';
  listByUser(userId: string): Promise<SavedConversation[]>;
  upsert(userId: string, conversation: SavedConversation): Promise<SavedConversation>;
  remove(userId: string, conversationId: string): Promise<boolean>;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const LOCAL_CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const MAX_CONVERSATIONS_PER_USER = 50;

class LocalConversationAdapter implements ConversationStorageAdapter {
  readonly mode = 'local' as const;

  private ensureDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private readAll(): Record<string, SavedConversation[]> {
    try {
      this.ensureDir();
      if (!fs.existsSync(LOCAL_CONVERSATIONS_FILE)) {
        return {};
      }
      const raw = fs.readFileSync(LOCAL_CONVERSATIONS_FILE, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, SavedConversation[]>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private writeAll(store: Record<string, SavedConversation[]>): void {
    this.ensureDir();
    fs.writeFileSync(LOCAL_CONVERSATIONS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  }

  async listByUser(userId: string): Promise<SavedConversation[]> {
    const store = this.readAll();
    const list = Array.isArray(store[userId]) ? store[userId] : [];
    return [...list].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  async upsert(userId: string, conversation: SavedConversation): Promise<SavedConversation> {
    const store = this.readAll();
    const list = Array.isArray(store[userId]) ? [...store[userId]] : [];
    const existingIdx = list.findIndex((c) => c.id === conversation.id);

    const sanitized: SavedConversation = {
      ...conversation,
      userId,
      updatedAt: new Date().toISOString(),
      createdAt:
        existingIdx >= 0 ? list[existingIdx].createdAt : conversation.createdAt || new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      list[existingIdx] = sanitized;
    } else {
      list.unshift(sanitized);
    }

    store[userId] = list.slice(0, MAX_CONVERSATIONS_PER_USER);
    this.writeAll(store);
    return sanitized;
  }

  async remove(userId: string, conversationId: string): Promise<boolean> {
    const store = this.readAll();
    const list = Array.isArray(store[userId]) ? store[userId] : [];
    const filtered = list.filter((c) => c.id !== conversationId);
    if (filtered.length === list.length) {
      return false;
    }
    store[userId] = filtered;
    this.writeAll(store);
    return true;
  }
}

class FirestoreConversationAdapter implements ConversationStorageAdapter {
  readonly mode = 'firestore' as const;
  private db: Firestore;
  private collectionName = 'mytts_conversations';
  private fallback = new LocalConversationAdapter();

  constructor(db: Firestore) {
    this.db = db;
  }

  private docId(userId: string, conversationId: string): string {
    const safeUser = userId.replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 64);
    const safeConv = conversationId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    return `${safeUser}__${safeConv}`;
  }

  async listByUser(userId: string): Promise<SavedConversation[]> {
    try {
      const snap = await this.db
        .collection(this.collectionName)
        .where('userId', '==', userId)
        .limit(MAX_CONVERSATIONS_PER_USER)
        .get();

      const items: SavedConversation[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as SavedConversation;
        if (data && data.id) {
          items.push(data);
        }
      });

      return items.sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) {
          return a.pinned ? -1 : 1;
        }
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
    } catch {
      return this.fallback.listByUser(userId);
    }
  }

  async upsert(userId: string, conversation: SavedConversation): Promise<SavedConversation> {
    const sanitized: SavedConversation = {
      ...conversation,
      userId,
      updatedAt: new Date().toISOString(),
      createdAt: conversation.createdAt || new Date().toISOString(),
    };
    try {
      const ref = this.db.collection(this.collectionName).doc(this.docId(userId, conversation.id));
      await ref.set(sanitized, { merge: true });
      await this.fallback.upsert(userId, sanitized);
      return sanitized;
    } catch {
      return this.fallback.upsert(userId, sanitized);
    }
  }

  async remove(userId: string, conversationId: string): Promise<boolean> {
    try {
      await this.db.collection(this.collectionName).doc(this.docId(userId, conversationId)).delete();
      await this.fallback.remove(userId, conversationId);
      return true;
    } catch {
      return this.fallback.remove(userId, conversationId);
    }
  }
}

let cachedAdapter: ConversationStorageAdapter | null = null;

export function getConversationStorage(): ConversationStorageAdapter {
  if (cachedAdapter) return cachedAdapter;

  const isCloudRun = Boolean(process.env.K_SERVICE);
  const hasExplicitCreds = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

  if ((isCloudRun || hasExplicitCreds) && projectId) {
    try {
      const db = new Firestore({
        projectId,
        databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
      });
      cachedAdapter = new FirestoreConversationAdapter(db);
      return cachedAdapter;
    } catch {
      cachedAdapter = new LocalConversationAdapter();
      return cachedAdapter;
    }
  }

  cachedAdapter = new LocalConversationAdapter();
  return cachedAdapter;
}

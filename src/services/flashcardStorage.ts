/**
 * Persistência Dual de Flashcards (Firestore mytts_flashcards em southamerica-east1 + Fallback Local .data/flashcards.json).
 * Isolado por userId (X-User-Id sanitizado) com limite defensivo de até 500 cards por usuário.
 */
import fs from 'fs';
import path from 'path';
import { Firestore } from '@google-cloud/firestore';
import type { FlashcardItem } from '../types/polyglot.ts';

export interface FlashcardStorageAdapter {
  readonly mode: 'firestore' | 'local';
  listByUser(userId: string): Promise<FlashcardItem[]>;
  upsertMany(userId: string, cards: FlashcardItem[]): Promise<FlashcardItem[]>;
  remove(userId: string, cardId: string): Promise<boolean>;
  clearByUser(userId: string): Promise<number>;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const LOCAL_FLASHCARDS_FILE = path.join(DATA_DIR, 'flashcards.json');
const MAX_FLASHCARDS_PER_USER = 500;

function sanitizeFlashcardItem(raw: Partial<FlashcardItem>, fallbackIndex = 0): FlashcardItem | null {
  const front = String(raw.front || raw.chunkText || '').trim().slice(0, 600);
  const back = String(raw.back || '').trim().slice(0, 600);
  if (!front || !back) return null;

  const validStatuses = new Set(['new', 'learning', 'review', 'mastered']);
  const status =
    typeof raw.status === 'string' && validStatuses.has(raw.status)
      ? (raw.status as FlashcardItem['status'])
      : 'new';

  return {
    id: String(raw.id || `fc_${Date.now()}_${fallbackIndex}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80),
    chunkText: String(raw.chunkText || front).trim().slice(0, 600),
    language: String(raw.language || 'en-US').trim().slice(0, 16),
    front,
    back,
    nuance: String(raw.nuance || '').trim().slice(0, 600),
    pronunciation: raw.pronunciation ? String(raw.pronunciation).trim().slice(0, 300) : undefined,
    example: String(raw.example || '').trim().slice(0, 600),
    exampleTranslation: String(raw.exampleTranslation || '').trim().slice(0, 600),
    createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    deckName: raw.deckName ? String(raw.deckName).trim().slice(0, 80) : 'Baralho Principal',
    status,
    nextReviewAt: typeof raw.nextReviewAt === 'number' ? raw.nextReviewAt : undefined,
    intervalDays: typeof raw.intervalDays === 'number' ? raw.intervalDays : 0,
    repetitions: typeof raw.repetitions === 'number' ? raw.repetitions : 0,
    lastReviewedAt: typeof raw.lastReviewedAt === 'number' ? raw.lastReviewedAt : undefined,
    voiceId: raw.voiceId ? String(raw.voiceId).trim().slice(0, 32) : undefined,
  };
}

class LocalFlashcardAdapter implements FlashcardStorageAdapter {
  readonly mode = 'local' as const;

  private ensureDir(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch {
      // fallback silencioso
    }
  }

  private readAll(): Record<string, FlashcardItem[]> {
    try {
      this.ensureDir();
      if (!fs.existsSync(LOCAL_FLASHCARDS_FILE)) {
        return {};
      }
      const raw = fs.readFileSync(LOCAL_FLASHCARDS_FILE, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, FlashcardItem[]>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private writeAll(store: Record<string, FlashcardItem[]>): void {
    try {
      this.ensureDir();
      fs.writeFileSync(LOCAL_FLASHCARDS_FILE, JSON.stringify(store, null, 2), 'utf-8');
    } catch {
      // fallback silencioso
    }
  }

  async listByUser(userId: string): Promise<FlashcardItem[]> {
    const store = this.readAll();
    const list = Array.isArray(store[userId]) ? store[userId] : [];
    return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async upsertMany(userId: string, cards: FlashcardItem[]): Promise<FlashcardItem[]> {
    const store = this.readAll();
    const list = Array.isArray(store[userId]) ? [...store[userId]] : [];
    const byId = new Map<string, FlashcardItem>();
    for (const item of list) {
      byId.set(item.id, item);
    }

    cards.forEach((rawCard, idx) => {
      const clean = sanitizeFlashcardItem(rawCard, idx);
      if (!clean) return;
      byId.set(clean.id, clean);
    });

    const merged = Array.from(byId.values())
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, MAX_FLASHCARDS_PER_USER);

    store[userId] = merged;
    this.writeAll(store);
    return merged;
  }

  async remove(userId: string, cardId: string): Promise<boolean> {
    const store = this.readAll();
    const list = Array.isArray(store[userId]) ? store[userId] : [];
    const next = list.filter((c) => c.id !== cardId);
    if (next.length === list.length) return false;
    store[userId] = next;
    this.writeAll(store);
    return true;
  }

  async clearByUser(userId: string): Promise<number> {
    const store = this.readAll();
    const prevCount = Array.isArray(store[userId]) ? store[userId].length : 0;
    store[userId] = [];
    this.writeAll(store);
    return prevCount;
  }
}

class FirestoreFlashcardAdapter implements FlashcardStorageAdapter {
  readonly mode = 'firestore' as const;
  private db: Firestore;
  private collectionName = 'mytts_flashcards';
  private fallback = new LocalFlashcardAdapter();

  constructor(db: Firestore) {
    this.db = db;
  }

  private docId(userId: string): string {
    return userId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  }

  async listByUser(userId: string): Promise<FlashcardItem[]> {
    try {
      const snap = await this.db.collection(this.collectionName).doc(this.docId(userId)).get();
      if (!snap.exists) {
        return this.fallback.listByUser(userId);
      }
      const data = snap.data() as { cards?: FlashcardItem[] } | undefined;
      if (data && Array.isArray(data.cards)) {
        return [...data.cards].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
      return [];
    } catch {
      return this.fallback.listByUser(userId);
    }
  }

  async upsertMany(userId: string, cards: FlashcardItem[]): Promise<FlashcardItem[]> {
    const merged = await this.fallback.upsertMany(userId, cards);
    try {
      await this.db
        .collection(this.collectionName)
        .doc(this.docId(userId))
        .set({ userId, updatedAt: new Date().toISOString(), cards: merged }, { merge: true });
    } catch {
      // mantém fallback local sincronizado
    }
    return merged;
  }

  async remove(userId: string, cardId: string): Promise<boolean> {
    const current = await this.listByUser(userId);
    const next = current.filter((c) => c.id !== cardId);
    if (next.length === current.length) return false;
    await this.fallback.remove(userId, cardId);
    try {
      await this.db
        .collection(this.collectionName)
        .doc(this.docId(userId))
        .set({ userId, updatedAt: new Date().toISOString(), cards: next }, { merge: true });
    } catch {
      // ignore
    }
    return true;
  }

  async clearByUser(userId: string): Promise<number> {
    const count = await this.fallback.clearByUser(userId);
    try {
      await this.db
        .collection(this.collectionName)
        .doc(this.docId(userId))
        .set({ userId, updatedAt: new Date().toISOString(), cards: [] }, { merge: true });
    } catch {
      // ignore
    }
    return count;
  }
}

let cachedFlashcardAdapter: FlashcardStorageAdapter | null = null;

export function getFlashcardStorage(): FlashcardStorageAdapter {
  if (cachedFlashcardAdapter) return cachedFlashcardAdapter;

  const isCloudRun = Boolean(process.env.K_SERVICE);
  const hasExplicitCreds = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'agent-md-506215';

  if ((isCloudRun || hasExplicitCreds) && projectId) {
    try {
      const db = new Firestore({
        projectId,
        databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
      });
      cachedFlashcardAdapter = new FirestoreFlashcardAdapter(db);
      return cachedFlashcardAdapter;
    } catch {
      cachedFlashcardAdapter = new LocalFlashcardAdapter();
      return cachedFlashcardAdapter;
    }
  }

  cachedFlashcardAdapter = new LocalFlashcardAdapter();
  return cachedFlashcardAdapter;
}

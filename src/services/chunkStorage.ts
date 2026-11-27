import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { Firestore } from '@google-cloud/firestore';
import { ChunkItem, TargetLang } from '../types/chunks';
import { detectFlashcardLanguage } from '../utils/flashcardParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface IChunkStorage {
  listUserChunks(userId: string, lang?: TargetLang): Promise<ChunkItem[]>;
  saveUserChunks(userId: string, chunks: ChunkItem[]): Promise<void>;
  deleteUserChunk(userId: string, chunkId: string): Promise<boolean>;
}

function matchesChunkTargetLang(chunk: ChunkItem, lang?: TargetLang): boolean {
  if (!lang) return true;
  if (chunk.language) return chunk.language === lang;
  return detectFlashcardLanguage(chunk.chunk || '', undefined, 'en-US') === lang;
}

class LocalFsAdapter implements IChunkStorage {
  private dataDir: string;
  private filePath: string;

  constructor() {
    const defaultDir = process.env.K_SERVICE
      ? path.join(os.tmpdir(), 'mytts-data')
      : path.resolve(__dirname, '../../.data');
    this.dataDir = defaultDir;
    this.filePath = path.join(this.dataDir, 'chunks.json');
    this.ensureDir();
  }

  private ensureDir(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify({}), 'utf-8');
      }
    } catch {
      try {
        this.dataDir = path.join(os.tmpdir(), 'mytts-data');
        this.filePath = path.join(this.dataDir, 'chunks.json');
        if (!fs.existsSync(this.dataDir)) {
          fs.mkdirSync(this.dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.filePath)) {
          fs.writeFileSync(this.filePath, JSON.stringify({}), 'utf-8');
        }
      } catch (fallbackErr: unknown) {
        console.warn('[LocalFsAdapter] Aviso ao criar pasta de dados temporária:', fallbackErr);
      }
    }
  }

  private readAll(): Record<string, ChunkItem[]> {
    try {
      this.ensureDir();
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content || '{}');
    } catch {
      return {};
    }
  }

  private writeAll(data: Record<string, ChunkItem[]>): void {
    try {
      this.ensureDir();
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: unknown) {
      console.error('[LocalFsAdapter] Falha ao persistir chunks locais:', err);
    }
  }

  async listUserChunks(userId: string, lang?: TargetLang): Promise<ChunkItem[]> {
    const all = this.readAll();
    const list = all[userId] || [];
    return lang ? list.filter((c) => matchesChunkTargetLang(c, lang)) : list;
  }

  async saveUserChunks(userId: string, chunks: ChunkItem[]): Promise<void> {
    if (chunks.length === 0) return;
    const all = this.readAll();
    const list = all[userId] || [];
    for (const chunk of chunks) {
      const index = list.findIndex((c) => c.id === chunk.id);
      if (index >= 0) {
        list[index] = chunk;
      } else {
        list.unshift(chunk);
      }
    }
    all[userId] = list;
    this.writeAll(all);
  }

  async deleteUserChunk(userId: string, chunkId: string): Promise<boolean> {
    const all = this.readAll();
    const list = all[userId] || [];
    const initialLen = list.length;
    all[userId] = list.filter((c) => c.id !== chunkId);
    if (all[userId].length !== initialLen) {
      this.writeAll(all);
      return true;
    }
    return false;
  }
}

class FirestoreAdapter implements IChunkStorage {
  private db: Firestore;
  private collectionName = 'fastchunks_chunks';

  constructor(projectId?: string) {
    this.db = new Firestore({
      projectId: projectId || process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || undefined,
      databaseId: process.env.FIRESTORE_DATABASE_ID || undefined,
    });
  }

  async listUserChunks(userId: string, lang?: TargetLang): Promise<ChunkItem[]> {
    const query = this.db.collection(this.collectionName).where('userId', '==', userId);
    const snapshot = await query.get();
    const results: ChunkItem[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as ChunkItem;
      const item = { ...data, id: doc.id };
      if (matchesChunkTargetLang(item, lang)) {
        results.push(item);
      }
    });
    // Order by createdAt desc
    results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return results;
  }

  async saveUserChunks(userId: string, chunks: ChunkItem[]): Promise<void> {
    if (chunks.length === 0) return;
    const batch = this.db.batch();
    const now = Date.now();
    for (const chunk of chunks) {
      const docRef = this.db.collection(this.collectionName).doc(chunk.id);
      batch.set(
        docRef,
        {
          ...chunk,
          userId,
          updatedAt: now,
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  async deleteUserChunk(userId: string, chunkId: string): Promise<boolean> {
    const docRef = this.db.collection(this.collectionName).doc(chunkId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return false;
    }
    const data = doc.data();
    if (data?.userId !== userId) {
      return false;
    }
    await docRef.delete();
    return true;
  }
}

class ChunkStorageManager implements IChunkStorage {
  private activeStorage: IChunkStorage;
  private localFallback = new LocalFsAdapter();
  private isFirestoreActive = false;

  constructor() {
    const hasGcpCreds = Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE || // Cloud Run standard env var
      process.env.GCP_PROJECT_ID
    );

    if (hasGcpCreds) {
      try {
        this.activeStorage = new FirestoreAdapter();
        this.isFirestoreActive = true;
        console.log('[ChunkStorageManager] Inicializado com Firestore (Google Cloud).');
      } catch (err: unknown) {
        console.warn('[ChunkStorageManager] Falha ao iniciar Firestore, ativando fallback local:', err);
        this.activeStorage = this.localFallback;
      }
    } else {
      console.log('[ChunkStorageManager] Sem credenciais GCP detectadas. Operando com repositório local (.data/chunks.json).');
      this.activeStorage = this.localFallback;
    }
  }

  public getStorageMode(): 'firestore' | 'local-fallback' {
    return this.isFirestoreActive ? 'firestore' : 'local-fallback';
  }

  async listUserChunks(userId: string, lang?: TargetLang): Promise<ChunkItem[]> {
    try {
      return await this.activeStorage.listUserChunks(userId, lang);
    } catch (err: unknown) {
      if (this.isFirestoreActive) {
        console.warn('[ChunkStorageManager] Erro no Firestore, chaveando para fallback local:', err);
        return await this.localFallback.listUserChunks(userId, lang);
      }
      throw err;
    }
  }

  async saveUserChunks(userId: string, chunks: ChunkItem[]): Promise<void> {
    try {
      await this.activeStorage.saveUserChunks(userId, chunks);
    } catch (err: unknown) {
      if (this.isFirestoreActive) {
        console.warn('[ChunkStorageManager] Erro ao salvar lote no Firestore, salvando no fallback local:', err);
        await this.localFallback.saveUserChunks(userId, chunks);
        return;
      }
      throw err;
    }
  }

  async deleteUserChunk(userId: string, chunkId: string): Promise<boolean> {
    try {
      return await this.activeStorage.deleteUserChunk(userId, chunkId);
    } catch (err: unknown) {
      if (this.isFirestoreActive) {
        console.warn('[ChunkStorageManager] Erro ao deletar no Firestore, tentando no fallback local:', err);
        return await this.localFallback.deleteUserChunk(userId, chunkId);
      }
      throw err;
    }
  }
}

export const chunkStorage = new ChunkStorageManager();

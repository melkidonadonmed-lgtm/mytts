import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Firestore } from '@google-cloud/firestore';
import { ChunkItem, TargetLang } from '../types/chunks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface IChunkStorage {
  listUserChunks(userId: string, lang?: TargetLang): Promise<ChunkItem[]>;
  saveUserChunk(userId: string, chunk: ChunkItem): Promise<void>;
  deleteUserChunk(userId: string, chunkId: string): Promise<boolean>;
}

class LocalFsAdapter implements IChunkStorage {
  private dataDir: string;
  private filePath: string;

  constructor() {
    this.dataDir = path.resolve(__dirname, '../../.data');
    this.filePath = path.join(this.dataDir, 'chunks.json');
    this.ensureDir();
  }

  private ensureDir() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify({}), 'utf-8');
      }
    } catch (err) {
      console.warn('[LocalFsAdapter] Aviso ao criar pasta .data:', err);
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

  private writeAll(data: Record<string, ChunkItem[]>) {
    try {
      this.ensureDir();
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[LocalFsAdapter] Falha ao persistir chunks locais:', err);
    }
  }

  async listUserChunks(userId: string, _lang?: TargetLang): Promise<ChunkItem[]> {
    const all = this.readAll();
    return all[userId] || [];
  }

  async saveUserChunk(userId: string, chunk: ChunkItem): Promise<void> {
    const all = this.readAll();
    const list = all[userId] || [];
    const index = list.findIndex((c) => c.id === chunk.id);
    if (index >= 0) {
      list[index] = chunk;
    } else {
      list.unshift(chunk);
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

  async listUserChunks(userId: string, _lang?: TargetLang): Promise<ChunkItem[]> {
    let query = this.db.collection(this.collectionName).where('userId', '==', userId);
    const snapshot = await query.get();
    const results: ChunkItem[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as ChunkItem;
      results.push({ ...data, id: doc.id });
    });
    // Order by createdAt desc
    results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return results;
  }

  async saveUserChunk(userId: string, chunk: ChunkItem): Promise<void> {
    const docRef = this.db.collection(this.collectionName).doc(chunk.id);
    await docRef.set(
      {
        ...chunk,
        userId,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
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
      } catch (err) {
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
    } catch (err) {
      if (this.isFirestoreActive) {
        console.warn('[ChunkStorageManager] Erro no Firestore, chaveando para fallback local:', err);
        return await this.localFallback.listUserChunks(userId, lang);
      }
      throw err;
    }
  }

  async saveUserChunk(userId: string, chunk: ChunkItem): Promise<void> {
    try {
      await this.activeStorage.saveUserChunk(userId, chunk);
    } catch (err) {
      if (this.isFirestoreActive) {
        console.warn('[ChunkStorageManager] Erro ao salvar no Firestore, salvando no fallback local:', err);
        await this.localFallback.saveUserChunk(userId, chunk);
        return;
      }
      throw err;
    }
  }

  async deleteUserChunk(userId: string, chunkId: string): Promise<boolean> {
    try {
      return await this.activeStorage.deleteUserChunk(userId, chunkId);
    } catch (err) {
      if (this.isFirestoreActive) {
        console.warn('[ChunkStorageManager] Erro ao deletar no Firestore, tentando no fallback local:', err);
        return await this.localFallback.deleteUserChunk(userId, chunkId);
      }
      throw err;
    }
  }
}

export const chunkStorage = new ChunkStorageManager();

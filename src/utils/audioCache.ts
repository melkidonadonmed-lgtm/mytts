/**
 * Motor de Cache de Áudio do MyTTS Studio (L1 Memória + L2 IndexedDB)
 * 
 * Elimina latência de rede em reproduções repetidas de frases, chunks e cards
 * neurais sintetizados via Gemini 3.1 Flash TTS / Gemini 3.8.
 * 
 * Arquitetura:
 * - L1 Cache: Map em memória RAM para resolução síncrona/sub-milissegundo na sessão ativa.
 * - L2 Cache: IndexedDB persistente ('mytts_audio_cache') com suporte a Blob/Base64,
 *   política de despejo LRU (Least Recently Used) e fallback resiliente.
 */

export interface CachedAudioRecord {
  key: string;
  audioBase64: string;
  mimeType: string;
  durationSec?: number;
  language?: string;
  voiceId?: string;
  speed?: number;
  emotion?: string;
  createdAt: number;
  lastAccessedAt: number;
  hitCount: number;
  sizeBytes: number;
}

export interface CacheKeyOptions {
  type: 'chunk' | 'speech' | 'turn';
  text: string;
  language?: string;
  voiceId?: string;
  speed?: number;
  emotion?: string;
}

export interface SynthesizeWithCacheParams {
  endpoint: string;
  body: Record<string, unknown>;
  cacheKey: string;
  metadata?: {
    language?: string;
    voiceId?: string;
    speed?: number;
    emotion?: string;
  };
  signal?: AbortSignal;
}

export interface SynthesizeCacheResult {
  audioBase64: string;
  durationSec?: number;
  fromCache: boolean;
  key: string;
}

const DB_NAME = 'mytts_audio_cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio_records';
const MAX_CACHE_ENTRIES = 300;
const MAX_MEMORY_L1_ENTRIES = 60;

// L1: Cache em Memória RAM
const l1MemoryCache = new Map<string, CachedAudioRecord>();

// Singleton da Conexão com IndexedDB
let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Normaliza parâmetros e gera chave determinística para o cache.
 * Garante que variações triviais de espaços e caixa não gerem duplicatas.
 */
export function generateAudioCacheKey(options: CacheKeyOptions): string {
  const { type, text, language = '', voiceId = '', speed = 1.0, emotion = 'natural' } = options;
  
  // Normalização do texto (Unicode NFC, trim e redução de múltiplos espaços)
  const normalizedText = (text || '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ');

  const normalizedLang = (language || '').toLowerCase().trim();
  const normalizedVoice = (voiceId || '').trim();
  const normalizedSpeed = Number(speed).toFixed(2);
  const normalizedEmotion = (emotion || '').toLowerCase().trim();

  return `${type}:${normalizedLang}:${normalizedVoice}:${normalizedSpeed}:${normalizedEmotion}:${normalizedText}`;
}

/**
 * Estima o tamanho em bytes a partir da string base64.
 */
function estimateBase64SizeBytes(base64: string): number {
  if (!base64) return 0;
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  return Math.ceil((clean.length * 3) / 4);
}

/**
 * Inicializa a conexão com o IndexedDB com tratamento defensivo.
 * Se o ambiente não possuir IndexedDB (ex: Node.js, modo privado restrito), retorna null.
 */
function getDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
          store.createIndex('language', 'language', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.warn('MyTTS: Falha ao abrir IndexedDB, operando exclusivamente com L1 RAM Cache.', event);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('MyTTS: Abertura do IndexedDB bloqueada por outra aba.');
        resolve(null);
      };
    } catch (e) {
      console.warn('MyTTS: Exceção ao acessar window.indexedDB:', e);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Evicção LRU: se o número de registros ultrapassar MAX_CACHE_ENTRIES,
 * elimina os itens com acesso mais antigo.
 */
async function enforceLruEviction(db: IDBDatabase): Promise<void> {
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const countReq = store.count();

    countReq.onsuccess = () => {
      const count = countReq.result;
      if (count <= MAX_CACHE_ENTRIES) return;

      const itemsToRemove = count - MAX_CACHE_ENTRIES + 10; // Margem para evitar evicções a cada inserção
      const index = store.index('lastAccessedAt');
      const cursorReq = index.openCursor();
      let removed = 0;

      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && removed < itemsToRemove) {
          cursor.delete();
          removed++;
          cursor.continue();
        }
      };
    };
  } catch (e) {
    console.warn('MyTTS: Falha não bloqueante na política LRU do IndexedDB:', e);
  }
}

/**
 * Atualiza o item no cache L1 de memória, aplicando limite para evitar vazamentos de memória.
 */
function updateL1Cache(record: CachedAudioRecord): void {
  if (l1MemoryCache.size >= MAX_MEMORY_L1_ENTRIES) {
    const oldestKey = l1MemoryCache.keys().next().value;
    if (oldestKey) {
      l1MemoryCache.delete(oldestKey);
    }
  }
  l1MemoryCache.set(record.key, record);
}

/**
 * Recupera um áudio sintetizado do cache (L1 Memória -> L2 IndexedDB).
 */
export async function getCachedAudio(key: string): Promise<CachedAudioRecord | null> {
  // 1. Busca no L1 (0ms)
  const memRecord = l1MemoryCache.get(key);
  if (memRecord) {
    memRecord.lastAccessedAt = Date.now();
    memRecord.hitCount += 1;
    return memRecord;
  }

  // 2. Busca no L2 IndexedDB (~2ms)
  const db = await getDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        const record = req.result as CachedAudioRecord | undefined;
        if (record) {
          // Atualiza acesso de forma assíncrona
          record.lastAccessedAt = Date.now();
          record.hitCount = (record.hitCount || 0) + 1;
          updateL1Cache(record);

          // Atualiza lastAccessedAt no IndexedDB em background
          try {
            const updateTx = db.transaction(STORE_NAME, 'readwrite');
            updateTx.objectStore(STORE_NAME).put(record);
          } catch {
            // Não bloqueia leitura se atualização falhar
          }

          resolve(record);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Salva um áudio sintetizado no cache (L1 Memória + L2 IndexedDB).
 */
export async function setCachedAudio(
  entry: Omit<CachedAudioRecord, 'createdAt' | 'lastAccessedAt' | 'hitCount' | 'sizeBytes'>
): Promise<void> {
  const now = Date.now();
  const sizeBytes = estimateBase64SizeBytes(entry.audioBase64);

  const fullRecord: CachedAudioRecord = {
    ...entry,
    createdAt: now,
    lastAccessedAt: now,
    hitCount: 1,
    sizeBytes,
  };

  // 1. Salva no L1 Memória
  updateL1Cache(fullRecord);

  // 2. Salva no L2 IndexedDB
  const db = await getDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(fullRecord);

      req.onsuccess = () => {
        enforceLruEviction(db);
        resolve();
      };

      req.onerror = () => {
        console.warn('MyTTS: Falha ao gravar registro de áudio no IndexedDB.');
        resolve();
      };
    } catch (e) {
      console.warn('MyTTS: Exceção ao salvar no IndexedDB:', e);
      resolve();
    }
  });
}

/**
 * Verifica rapidamente se uma chave já existe no cache (sem carregar o payload base64).
 */
export async function isAudioCached(key: string): Promise<boolean> {
  if (l1MemoryCache.has(key)) return true;

  const db = await getDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getKey(key);

      req.onsuccess = () => {
        resolve(req.result !== undefined);
      };

      req.onerror = () => {
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

/**
 * Consulta em lote o status de cache para uma lista de chaves.
 * Útil para marcar badges visuais "⚡ Em cache" na interface sem overhead de memória.
 */
export async function getCachedKeySet(keys: string[]): Promise<Set<string>> {
  const cachedSet = new Set<string>();
  if (!keys.length) return cachedSet;

  // Checa L1 primeiro
  const remainingKeys: string[] = [];
  for (const k of keys) {
    if (l1MemoryCache.has(k)) {
      cachedSet.add(k);
    } else {
      remainingKeys.push(k);
    }
  }

  if (!remainingKeys.length) return cachedSet;

  const db = await getDatabase();
  if (!db) return cachedSet;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      let pending = remainingKeys.length;
      remainingKeys.forEach((k) => {
        const req = store.getKey(k);
        req.onsuccess = () => {
          if (req.result !== undefined) {
            cachedSet.add(k);
          }
          pending--;
          if (pending === 0) resolve(cachedSet);
        };
        req.onerror = () => {
          pending--;
          if (pending === 0) resolve(cachedSet);
        };
      });
    } catch {
      resolve(cachedSet);
    }
  });
}

/**
 * Wrapper de síntese de áudio com padrão Cache-Aside (Cache-Through).
 * Se o áudio estiver em cache, retorna instantaneamente (0ms de rede).
 * Caso contrário, executa o fetch HTTP, salva no cache local e retorna.
 */
export async function synthesizeWithCache(
  params: SynthesizeWithCacheParams
): Promise<SynthesizeCacheResult> {
  const { endpoint, body, cacheKey, metadata, signal } = params;

  // 1. Tentar Cache
  const cached = await getCachedAudio(cacheKey);
  if (cached && cached.audioBase64) {
    return {
      audioBase64: cached.audioBase64,
      durationSec: cached.durationSec,
      fromCache: true,
      key: cacheKey,
    };
  }

  // 2. Fetch de Rede
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  const data = await resp.json();
  if (!resp.ok || !data.success || !data.audioBase64) {
    throw new Error(data.error || 'Falha na síntese do áudio neural.');
  }

  // 3. Gravar no Cache Assincronamente
  setCachedAudio({
    key: cacheKey,
    audioBase64: data.audioBase64,
    mimeType: 'audio/wav',
    durationSec: data.durationSec,
    language: metadata?.language,
    voiceId: metadata?.voiceId,
    speed: metadata?.speed,
    emotion: metadata?.emotion,
  }).catch((err) => console.warn('MyTTS: Falha assíncrona ao persistir áudio no cache:', err));

  return {
    audioBase64: data.audioBase64,
    durationSec: data.durationSec,
    fromCache: false,
    key: cacheKey,
  };
}

/**
 * Retorna estatísticas de uso do cache local.
 */
export async function getAudioCacheStats(): Promise<{
  count: number;
  totalSizeBytes: number;
  l1Count: number;
}> {
  const l1Count = l1MemoryCache.size;
  const db = await getDatabase();

  if (!db) {
    let memoryTotalBytes = 0;
    l1MemoryCache.forEach((rec) => {
      memoryTotalBytes += rec.sizeBytes;
    });
    return { count: l1Count, totalSizeBytes: memoryTotalBytes, l1Count };
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const cursorReq = store.openCursor();
      let count = 0;
      let totalSizeBytes = 0;

      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          count++;
          const rec = cursor.value as CachedAudioRecord;
          totalSizeBytes += rec.sizeBytes || 0;
          cursor.continue();
        } else {
          resolve({ count, totalSizeBytes, l1Count });
        }
      };

      cursorReq.onerror = () => {
        resolve({ count: 0, totalSizeBytes: 0, l1Count });
      };
    } catch {
      resolve({ count: 0, totalSizeBytes: 0, l1Count });
    }
  });
}

/**
 * Limpa todo o cache de áudio (L1 Memória e L2 IndexedDB).
 */
export async function clearAudioCache(): Promise<void> {
  l1MemoryCache.clear();
  const db = await getDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Gerenciador Reativo e Isolado por Usuário do Baralho de Flashcards (Local + Cloud southamerica-east1).
 * Sincroniza em tempo real entre Chat Poliglota, FastChunks, Área de Estudo e HistorySidebar.
 */
import type { ChunkItem } from '../types/chunks';
import type { FlashcardItem, FlashcardRetentionStatus } from '../types/polyglot';
import { getActiveSession, subscribeAuthChanges } from './authService';
import {
  persistBrowserState,
  readBrowserState,
  requestClearUserFlashcards,
  requestDeleteUserFlashcard,
  requestListUserFlashcards,
  requestSaveUserFlashcards,
} from './polyglotClient';
import { detectFlashcardLanguage, normalizeLanguageBadge } from '../utils/flashcardParser';

export interface DeckSummary {
  deckName: string;
  total: number;
  newCount: number;
  dueCount: number;
  learningCount: number;
  masteredCount: number;
  masteryPercent: number;
  languages: string[];
}

export function computeDeckSummaries(cards: FlashcardItem[], now = Date.now()): DeckSummary[] {
  const byDeck = new Map<string, FlashcardItem[]>();
  for (const card of cards) {
    const deck = (card.deckName || 'Baralho Principal').trim() || 'Baralho Principal';
    const list = byDeck.get(deck);
    if (list) {
      list.push(card);
    } else {
      byDeck.set(deck, [card]);
    }
  }

  const summaries: DeckSummary[] = [];
  for (const [deckName, deckCards] of byDeck.entries()) {
    let newCount = 0;
    let learningCount = 0;
    let masteredCount = 0;
    let dueCount = 0;
    const langSet = new Set<string>();

    for (const card of deckCards) {
      const status = card.status || 'new';
      if (status === 'mastered') {
        masteredCount++;
      } else if (status === 'learning' || status === 'review') {
        learningCount++;
      } else {
        newCount++;
      }

      if (status === 'new' || !card.nextReviewAt || card.nextReviewAt <= now) {
        dueCount++;
      }

      const badge = normalizeLanguageBadge(card.language);
      langSet.add(badge);
    }

    const total = deckCards.length;
    const masteryPercent = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
    const languages = (['EN', 'IT', 'JA'] as const).filter((l) => langSet.has(l));

    summaries.push({
      deckName,
      total,
      newCount,
      dueCount,
      learningCount,
      masteredCount,
      masteryPercent,
      languages,
    });
  }

  return summaries.sort((a, b) => {
    if (a.deckName === 'Baralho Principal' && b.deckName !== 'Baralho Principal') return -1;
    if (b.deckName === 'Baralho Principal' && a.deckName !== 'Baralho Principal') return 1;
    return a.deckName.localeCompare(b.deckName, 'pt-BR');
  });
}

export function filterStudyQueue(
  cards: FlashcardItem[],
  options: { deckName: string; language: string; dueOnly: boolean; now?: number }
): FlashcardItem[] {
  const now = options.now ?? Date.now();
  const filterDeck = options.deckName.trim();
  const filterLang = options.language.trim();

  return cards.filter((card) => {
    const cardDeck = (card.deckName || 'Baralho Principal').trim() || 'Baralho Principal';
    if (filterDeck && filterDeck !== 'ALL' && cardDeck !== filterDeck) {
      return false;
    }

    if (filterLang && filterLang !== 'ALL') {
      const cardBadge = normalizeLanguageBadge(card.language);
      const queryBadge = normalizeLanguageBadge(filterLang);
      if (cardBadge !== queryBadge && card.language !== filterLang) {
        return false;
      }
    }

    if (options.dueOnly) {
      const isDue = card.status === 'new' || !card.nextReviewAt || card.nextReviewAt <= now;
      if (!isDue) return false;
    }

    return true;
  });
}

export function buildManualFlashcardItem(input: {
  id?: string;
  deckName: string;
  language?: string;
  front: string;
  back: string;
  pronunciation?: string;
  example?: string;
  exampleTranslation?: string;
  nuance?: string;
  createdAt?: number;
  existing?: Partial<FlashcardItem>;
}): FlashcardItem {
  const front = input.front.trim();
  const back = input.back.trim();
  const deckName =
    input.deckName.trim() || input.existing?.deckName?.trim() || 'Baralho Principal';

  const rawLang = input.language?.trim() || input.existing?.language?.trim() || '';
  const detectedLang = detectFlashcardLanguage(front, rawLang || undefined);

  const cleanPronunciation = input.pronunciation?.trim();
  const pronunciation =
    cleanPronunciation && cleanPronunciation.length > 0
      ? cleanPronunciation
      : input.existing?.pronunciation?.trim() || undefined;

  const example = input.example?.trim() || input.existing?.example?.trim() || front;
  const exampleTranslation =
    input.exampleTranslation?.trim() || input.existing?.exampleTranslation?.trim() || back;
  const nuance = input.nuance?.trim() || input.existing?.nuance?.trim() || 'Estudo Ativo';

  const id =
    input.id?.trim() ||
    input.existing?.id ||
    `fc_manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const now = Date.now();
  const createdAt =
    typeof input.createdAt === 'number'
      ? input.createdAt
      : typeof input.existing?.createdAt === 'number'
        ? input.existing.createdAt
        : now;

  const status = input.existing?.status || 'new';
  const intervalDays =
    typeof input.existing?.intervalDays === 'number' ? input.existing.intervalDays : 0;
  const repetitions =
    typeof input.existing?.repetitions === 'number' ? input.existing.repetitions : 0;

  return {
    id,
    chunkText: front,
    language: detectedLang,
    front,
    back,
    nuance,
    pronunciation,
    example,
    exampleTranslation,
    createdAt,
    deckName,
    status,
    intervalDays,
    repetitions,
    nextReviewAt: input.existing?.nextReviewAt,
    lastReviewedAt: input.existing?.lastReviewedAt,
    voiceId: input.existing?.voiceId,
  };
}

const LEGACY_DECK_KEY = 'mytts_polyglot_deck';
const LEGACY_MIGRATED_FLAG = 'mytts_polyglot_deck_migrated_v2';

type DeckListener = (cards: FlashcardItem[], userId: string) => void;
const deckListeners = new Set<DeckListener>();

function getDeckStorageKey(userId?: string): string {
  const uid = (userId || getActiveSession().uid || 'guest_local').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `mytts_polyglot_deck_${uid}`;
}

function normalizeFlashcard(card: FlashcardItem): FlashcardItem {
  return {
    ...card,
    language: detectFlashcardLanguage(card.front || card.chunkText, card.language),
    deckName: card.deckName || 'Baralho Principal',
    status: card.status || 'new',
    intervalDays: typeof card.intervalDays === 'number' ? card.intervalDays : 0,
    repetitions: typeof card.repetitions === 'number' ? card.repetitions : 0,
    createdAt: typeof card.createdAt === 'number' ? card.createdAt : Date.now(),
  };
}

export function readFlashcardDeck(userId?: string): FlashcardItem[] {
  const uid = userId || getActiveSession().uid;
  const scopedKey = getDeckStorageKey(uid);

  try {
    const rawScoped = readBrowserState(scopedKey);
    if (rawScoped) {
      const parsed: unknown = JSON.parse(rawScoped);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => normalizeFlashcard(c as FlashcardItem));
      }
    }

    // Migração única da chave legada global para o usuário ativo
    const alreadyMigrated = readBrowserState(LEGACY_MIGRATED_FLAG);
    const rawLegacy = readBrowserState(LEGACY_DECK_KEY);
    if (rawLegacy && !alreadyMigrated) {
      const parsedLegacy: unknown = JSON.parse(rawLegacy);
      if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
        const normalized = parsedLegacy.map((c) => normalizeFlashcard(c as FlashcardItem));
        persistBrowserState(scopedKey, JSON.stringify(normalized));
        persistBrowserState(LEGACY_MIGRATED_FLAG, '1');
        return normalized;
      }
    }
  } catch {
    // fallback vazio
  }

  return [];
}

function notifyDeckListeners(cards: FlashcardItem[], userId: string): void {
  deckListeners.forEach((fn) => fn(cards, userId));
}

export function saveFlashcardDeckLocal(cards: FlashcardItem[], userId?: string): FlashcardItem[] {
  const uid = userId || getActiveSession().uid;
  const normalized = cards.map(normalizeFlashcard).slice(0, 500);
  persistBrowserState(getDeckStorageKey(uid), JSON.stringify(normalized));
  // Mantém espelho na chave legada apenas para a sessão ativa
  persistBrowserState(LEGACY_DECK_KEY, JSON.stringify(normalized));
  notifyDeckListeners(normalized, uid);
  return normalized;
}

export async function syncFlashcardDeckFromServer(userId?: string): Promise<FlashcardItem[]> {
  const uid = userId || getActiveSession().uid;
  const localCards = readFlashcardDeck(uid);
  try {
    const remoteCards = await requestListUserFlashcards();
    if (remoteCards.length === 0 && localCards.length > 0) {
      const uploaded = await requestSaveUserFlashcards(localCards);
      return saveFlashcardDeckLocal(uploaded, uid);
    }
    if (remoteCards.length > 0) {
      const byId = new Map<string, FlashcardItem>();
      for (const c of remoteCards) {
        byId.set(c.id, normalizeFlashcard(c));
      }
      for (const local of localCards) {
        if (!byId.has(local.id)) {
          byId.set(local.id, normalizeFlashcard(local));
        }
      }
      const merged = Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const saved = saveFlashcardDeckLocal(merged, uid);
      if (merged.length > remoteCards.length) {
        void requestSaveUserFlashcards(merged);
      }
      return saved;
    }
  } catch {
    // mantém estado local
  }
  return localCards;
}

export function addFlashcardsToDeck(
  incoming: FlashcardItem | FlashcardItem[],
  userId?: string
): FlashcardItem[] {
  const uid = userId || getActiveSession().uid;
  const current = readFlashcardDeck(uid);
  const incomingList = Array.isArray(incoming) ? incoming : [incoming];

  const byId = new Map<string, FlashcardItem>();
  for (const card of incomingList) {
    const clean = normalizeFlashcard(card);
    byId.set(clean.id, clean);
  }
  for (const existing of current) {
    if (!byId.has(existing.id)) {
      byId.set(existing.id, existing);
    }
  }

  const next = Array.from(byId.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 500);

  const saved = saveFlashcardDeckLocal(next, uid);
  void requestSaveUserFlashcards(saved);
  return saved;
}

export function deleteFlashcardFromDeck(cardId: string, userId?: string): FlashcardItem[] {
  const uid = userId || getActiveSession().uid;
  const current = readFlashcardDeck(uid);
  const next = current.filter((c) => c.id !== cardId);
  const saved = saveFlashcardDeckLocal(next, uid);
  void requestDeleteUserFlashcard(cardId);
  return saved;
}

export function clearFlashcardDeck(userId?: string): FlashcardItem[] {
  const uid = userId || getActiveSession().uid;
  const saved = saveFlashcardDeckLocal([], uid);
  void requestClearUserFlashcards();
  return saved;
}

/**
 * Calcula repetição espaçada (SRS) para os botões 1 (Revisar), 2 (Bom) e 3 (Fácil/Dominado).
 */
export function rateFlashcardRetention(
  cardId: string,
  rating: 1 | 2 | 3,
  userId?: string
): FlashcardItem[] {
  const uid = userId || getActiveSession().uid;
  const current = readFlashcardDeck(uid);
  const now = Date.now();
  const DAY_MS = 86_400_000;

  const next = current.map((card) => {
    if (card.id !== cardId) return card;

    const prevReps = card.repetitions || 0;
    const prevInterval = card.intervalDays || 0;

    let status: FlashcardRetentionStatus = 'learning';
    let intervalDays = 0;
    let nextReviewAt = now + 10 * 60_000; // 10 minutos para Revisar (1)
    let repetitions = prevReps;

    if (rating === 1) {
      status = 'learning';
      intervalDays = 0;
      repetitions = 0;
      nextReviewAt = now + 10 * 60_000;
    } else if (rating === 2) {
      status = 'review';
      repetitions = prevReps + 1;
      intervalDays = prevInterval <= 0 ? 1 : Math.min(30, Math.round(prevInterval * 1.8));
      nextReviewAt = now + intervalDays * DAY_MS;
    } else {
      status = 'mastered';
      repetitions = prevReps + 1;
      intervalDays = prevInterval <= 1 ? 4 : Math.min(90, Math.round(prevInterval * 2.5));
      nextReviewAt = now + intervalDays * DAY_MS;
    }

    return {
      ...card,
      status,
      intervalDays,
      repetitions,
      lastReviewedAt: now,
      nextReviewAt,
    };
  });

  const saved = saveFlashcardDeckLocal(next, uid);
  const updatedCard = saved.find((c) => c.id === cardId);
  if (updatedCard) {
    void requestSaveUserFlashcards([updatedCard]);
  }
  return saved;
}

export function chunkItemToFlashcard(
  chunk: ChunkItem,
  language: string,
  voiceId?: string
): FlashcardItem {
  return normalizeFlashcard({
    id: `fc_chunk_${chunk.id}_${Date.now()}`,
    chunkText: chunk.chunk,
    language: detectFlashcardLanguage(chunk.chunk, language),
    front: chunk.chunk,
    back: chunk.literalOrNuance,
    nuance: `${chunk.meaning} (${chunk.context})`,
    pronunciation: chunk.pronunciationHint,
    example: chunk.chunk,
    exampleTranslation: chunk.literalOrNuance,
    createdAt: Date.now(),
    deckName: 'FastChunks',
    status: 'new',
    intervalDays: 0,
    repetitions: 0,
    voiceId,
  });
}

export function subscribeFlashcardDeck(listener: DeckListener): () => void {
  deckListeners.add(listener);
  return () => {
    deckListeners.delete(listener);
  };
}

// Migração segura exclusivamente de Visitante (!prev.isGoogleAuthenticated) -> Conta Google (next.isGoogleAuthenticated)
let lastKnownSession = getActiveSession();
subscribeAuthChanges((nextSession) => {
  const prevSession = lastKnownSession;
  lastKnownSession = nextSession;

  if (prevSession.uid === nextSession.uid) return;

  if (!prevSession.isGoogleAuthenticated && nextSession.isGoogleAuthenticated) {
    const guestCards = readFlashcardDeck(prevSession.uid);
    const targetCards = readFlashcardDeck(nextSession.uid);
    if (guestCards.length > 0) {
      const merged = addFlashcardsToDeck([...guestCards, ...targetCards], nextSession.uid);
      notifyDeckListeners(merged, nextSession.uid);
      return;
    }
  }

  void syncFlashcardDeckFromServer(nextSession.uid);
});

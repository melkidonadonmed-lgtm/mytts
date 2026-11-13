import type { ChunkItem, TargetLang } from '../types/chunks';
import type {
  FlashcardItem,
  AlignedChunk,
  AgentPersona,
  AgentExploreSource,
  LiveAgentToolCallResult,
  SavedConversation,
  MessageOriginMode,
  YoutubePostLinkAction,
  YoutubeClipRange,
  YoutubeVideoMetadata,
} from '../types/polyglot';
import {
  FAVORITE_VOICES_STORAGE_KEY,
  DEFAULT_FAVORITE_VOICES_BY_LANG,
  sanitizeFavoriteVoices,
} from '../types/voices';
import {
  detectYoutubeUrl,
  normalizeYoutubeVideo,
  isBareYoutubeLinkOnly,
  inferYoutubeActionFromPrompt,
  hasYoutubeOrWebSearchIntent,
} from '../utils/youtubeHelper';
import { parseApiJson } from './apiClient';
import { getAuthHeaders } from './authService';

export {
  FAVORITE_VOICES_STORAGE_KEY,
  DEFAULT_FAVORITE_VOICES_BY_LANG,
  sanitizeFavoriteVoices,
  detectYoutubeUrl,
  normalizeYoutubeVideo,
  isBareYoutubeLinkOnly,
  inferYoutubeActionFromPrompt,
  hasYoutubeOrWebSearchIntent,
};

export const readFavoriteVoicesByLanguage = (): Record<'en' | 'it' | 'ja', string> => {
  try {
    const raw = readBrowserState(FAVORITE_VOICES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FAVORITE_VOICES_BY_LANG };
    return sanitizeFavoriteVoices(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_FAVORITE_VOICES_BY_LANG };
  }
};

export const saveFavoriteVoicesByLanguage = (
  favorites: Record<'en' | 'it' | 'ja', string>
): Record<'en' | 'it' | 'ja', string> => {
  const clean = sanitizeFavoriteVoices(favorites);
  persistBrowserState(FAVORITE_VOICES_STORAGE_KEY, JSON.stringify(clean));
  return clean;
};

export async function requestYoutubeMetadata(url: string): Promise<YoutubeVideoMetadata | null> {
  try {
    const resp = await fetch(`/api/youtube/metadata?url=${encodeURIComponent(url)}`, {
      headers: { ...getAuthHeaders() },
    });
    if (!resp.ok) return null;
    const data = await parseApiJson<{ metadata?: YoutubeVideoMetadata }>(resp);
    return data.metadata || null;
  } catch {
    return null;
  }
}

export async function requestTranslateParallelChunks(text: string): Promise<{
  ok: boolean;
  success?: boolean;
  chunks?: AlignedChunk[];
  fullText?: { en: string; it: string; ja: string };
  error?: string;
}> {
  const resp = await fetch('/api/translate-parallel-chunks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ text }),
  });
  return parseApiJson(resp);
}

export async function requestLiveAgentTurn(params: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  persona: AgentPersona;
  history?: Array<{ role: string; text: string }>;
}): Promise<{
  ok: boolean;
  success?: boolean;
  persona?: AgentPersona;
  userTranscript?: string;
  agentReplyPtBr?: string;
  chunks?: AlignedChunk[];
  fullText?: { en: string; it: string; ja: string };
  toolCallsExecuted?: LiveAgentToolCallResult[];
  fallback?: boolean;
  warning?: string;
  error?: string;
}> {
  const resp = await fetch('/api/live-agent-turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(params),
  });
  return parseApiJson(resp);
}

export async function requestAgentExplore(params: {
  prompt: string;
  youtubeUrl?: string;
  youtubeAction?: YoutubePostLinkAction;
  clipRange?: YoutubeClipRange;
  enableSearch?: boolean;
}): Promise<{
  ok: boolean;
  success?: boolean;
  originMode?: MessageOriginMode;
  youtubeUrl?: string;
  youtubeMeta?: YoutubeVideoMetadata;
  youtubeSearchResults?: YoutubeVideoMetadata[];
  youtubeAction?: YoutubePostLinkAction;
  awaitingYoutubeIntent?: boolean;
  agentReplyPtBr?: string;
  sources?: AgentExploreSource[];
  chunks?: AlignedChunk[];
  fullText?: { en: string; it: string; ja: string };
  toolCallsExecuted?: LiveAgentToolCallResult[];
  fallback?: boolean;
  warning?: string;
  error?: string;
}> {
  const resp = await fetch('/api/agent-explore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(params),
  });
  return parseApiJson(resp);
}

export async function requestListUserConversations(): Promise<SavedConversation[]> {
  try {
    const resp = await fetch('/api/conversations', {
      headers: { ...getAuthHeaders() },
    });
    if (!resp.ok) return [];
    const data = await parseApiJson<{ conversations?: SavedConversation[] }>(resp);
    return Array.isArray(data.conversations) ? data.conversations : [];
  } catch {
    return [];
  }
}

export async function requestSaveUserConversation(
  conversation: SavedConversation
): Promise<SavedConversation | null> {
  try {
    const resp = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(conversation),
    });
    if (!resp.ok) return null;
    const data = await parseApiJson<{ conversation?: SavedConversation }>(resp);
    return data.conversation || null;
  } catch {
    return null;
  }
}

export async function requestDeleteUserConversation(conversationId: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function requestClearUnpinnedConversations(): Promise<number> {
  try {
    const resp = await fetch('/api/conversations', {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!resp.ok) return 0;
    const data = await parseApiJson<{ removedCount?: number }>(resp);
    return typeof data.removedCount === 'number' ? data.removedCount : 0;
  } catch {
    return 0;
  }
}

export async function requestListUserFlashcards(): Promise<FlashcardItem[]> {
  try {
    const resp = await fetch('/api/flashcards', {
      headers: { ...getAuthHeaders() },
    });
    if (!resp.ok) return [];
    const data = await parseApiJson<{ cards?: FlashcardItem[] }>(resp);
    return Array.isArray(data.cards) ? data.cards : [];
  } catch {
    return [];
  }
}

export async function requestSaveUserFlashcards(cards: FlashcardItem[]): Promise<FlashcardItem[]> {
  try {
    const resp = await fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ cards }),
    });
    if (!resp.ok) return cards;
    const data = await parseApiJson<{ cards?: FlashcardItem[] }>(resp);
    return Array.isArray(data.cards) ? data.cards : cards;
  } catch {
    return cards;
  }
}

export async function requestDeleteUserFlashcard(cardId: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/flashcards/${encodeURIComponent(cardId)}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function requestClearUserFlashcards(): Promise<boolean> {
  try {
    const resp = await fetch('/api/flashcards', {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function requestGenerateFlashcard(
  chunkText: string,
  language: string
): Promise<{ ok: boolean; success?: boolean; card?: FlashcardItem; error?: string }> {
  const resp = await fetch('/api/generate-flashcard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ chunkText, language }),
  });
  return parseApiJson(resp);
}

export async function requestFetchUserChunks(
  lang: TargetLang,
  userId: string
): Promise<ChunkItem[]> {
  const res = await fetch(`/api/chunks?lang=${lang}`, {
    headers: { ...getAuthHeaders(), 'X-User-Id': userId },
  });
  if (!res.ok) return [];
  const data = await parseApiJson<{ chunks?: ChunkItem[] }>(res);
  return data.chunks || [];
}

export async function requestDeleteUserChunk(id: string, userId: string): Promise<boolean> {
  const res = await fetch(`/api/chunks/${id}`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders(), 'X-User-Id': userId },
  });
  return res.ok;
}

export async function requestGenerateChunks(payload: {
  textOrPrompt: string;
  language: TargetLang;
  count: number;
  userId: string;
}): Promise<{ ok: boolean; success?: boolean; chunks?: ChunkItem[]; error?: string }> {
  const res = await fetch('/api/generate-chunks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      'X-User-Id': payload.userId,
    },
    body: JSON.stringify({
      textOrPrompt: payload.textOrPrompt,
      language: payload.language,
      count: payload.count,
    }),
  });
  return parseApiJson(res);
}

export function persistBrowserState(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Fallback silencioso em modo privado/quota excedida
  }
}

export function readBrowserState(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  } catch {
    return null;
  }
}

import type { ChunkItem, TargetLang } from '../types/chunks';
import type { FlashcardItem, AlignedChunk } from '../types/polyglot';
import { parseApiJson } from './apiClient';

export async function requestTranslateParallelChunks(text: string): Promise<{
  ok: boolean;
  success?: boolean;
  chunks?: AlignedChunk[];
  fullText?: { en: string; it: string; ja: string };
  error?: string;
}> {
  const resp = await fetch('/api/translate-parallel-chunks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return parseApiJson(resp);
}

export async function requestGenerateFlashcard(
  chunkText: string,
  language: string
): Promise<{ ok: boolean; success?: boolean; card?: FlashcardItem; error?: string }> {
  const resp = await fetch('/api/generate-flashcard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chunkText, language }),
  });
  return parseApiJson(resp);
}

export async function requestFetchUserChunks(
  lang: TargetLang,
  userId: string
): Promise<ChunkItem[]> {
  const res = await fetch(`/api/chunks?lang=${lang}`, {
    headers: { 'X-User-Id': userId },
  });
  if (!res.ok) return [];
  const data = await parseApiJson<{ chunks?: ChunkItem[] }>(res);
  return data.chunks || [];
}

export async function requestDeleteUserChunk(id: string, userId: string): Promise<boolean> {
  const res = await fetch(`/api/chunks/${id}`, {
    method: 'DELETE',
    headers: { 'X-User-Id': userId },
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
    localStorage.setItem(key, value);
  } catch {
    // Fallback silencioso em modo privado/quota excedida
  }
}

export function readBrowserState(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}


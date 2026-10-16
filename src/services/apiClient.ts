import type { DebateScript, LanguageCode, SpeakerProfile } from '../types/debate';

export interface GenerateScriptPayload {
  documentText: string;
  language: LanguageCode;
  audienceLevel: string;
  tensionIntensity: string;
  speakers: [SpeakerProfile, SpeakerProfile];
  maxTurns: number;
}

export async function parseApiJson<T extends Record<string, unknown>>(
  resp: Response
): Promise<T & { ok: boolean; error?: string }> {
  try {
    const data = (await resp.json()) as T;
    return { ...data, ok: resp.ok };
  } catch {
    return {
      ok: false,
      error: `Erro HTTP ${resp.status}: resposta inválida do servidor.`,
    } as T & { ok: boolean; error?: string };
  }
}

export async function requestDebateScript(
  payload: GenerateScriptPayload
): Promise<{ ok: boolean; success?: boolean; script?: DebateScript; error?: string }> {
  const resp = await fetch('/api/generate-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiJson(resp);
}

export async function requestSynthesizeTurn(payload: {
  turn: unknown;
  speakerName: string;
  voiceId: string;
  language: string;
}): Promise<{ ok: boolean; success?: boolean; audioBase64?: string; durationSec?: number; error?: string }> {
  const resp = await fetch('/api/synthesize-turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiJson(resp);
}

export async function requestSynthesizeSpeech(payload: {
  text: string;
  voiceId: string;
  emotion: string;
  speed: number;
  language: string;
  autoProsody: boolean;
}): Promise<{ ok: boolean; success?: boolean; audioBase64?: string; durationSec?: number; error?: string }> {
  const resp = await fetch('/api/synthesize-speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiJson(resp);
}

export async function requestPreviewVoice(payload: {
  voiceId: string;
  speakerName: string;
  language: string;
}): Promise<{ ok: boolean; success?: boolean; audioBase64?: string; error?: string }> {
  const resp = await fetch('/api/preview-voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiJson(resp);
}

export async function requestTranscribeAudio(payload: {
  audioData: string;
  mimeType: string;
}): Promise<{ ok: boolean; success?: boolean; transcript?: string; error?: string }> {
  const resp = await fetch('/api/transcribe-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiJson(resp);
}

export async function requestExtractTextJson(payload: {
  fileData: string;
  mimeType: string;
  fileName: string;
}): Promise<{ ok: boolean; success?: boolean; text?: string; error?: string }> {
  const resp = await fetch('/api/extract-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiJson(resp);
}


import type { ConversationFormat, DebateScript, LanguageCode, SpeakerProfile } from '../types/debate';

export interface GenerateScriptPayload {
  documentText: string;
  language: LanguageCode;
  audienceLevel: string;
  tensionIntensity: string;
  format?: ConversationFormat;
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

const postJson = async <T extends Record<string, unknown>>(
  endpoint: string,
  payload: unknown
): Promise<T & { ok: boolean; error?: string }> => {
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiJson<T>(resp);
};

export async function requestDebateScript(
  payload: GenerateScriptPayload
): Promise<{ ok: boolean; success?: boolean; script?: DebateScript; error?: string }> {
  return postJson('/api/generate-script', payload);
}

export async function requestSynthesizeSpeech(payload: {
  text: string;
  voiceId: string;
  emotion: string;
  speed: number;
  language: string;
  autoProsody: boolean;
}): Promise<{ ok: boolean; success?: boolean; audioBase64?: string; durationSec?: number; error?: string }> {
  return postJson('/api/synthesize-speech', payload);
}

export async function requestPreviewVoice(payload: {
  voiceId: string;
  speakerName: string;
  language: string;
}): Promise<{ ok: boolean; success?: boolean; audioBase64?: string; error?: string }> {
  return postJson('/api/preview-voice', payload);
}

export async function requestTranscribeAudio(payload: {
  audioData: string;
  mimeType: string;
}): Promise<{ ok: boolean; success?: boolean; transcript?: string; error?: string }> {
  return postJson('/api/transcribe-audio', payload);
}

export async function requestExtractTextJson(payload: {
  fileData: string;
  mimeType: string;
  fileName: string;
}): Promise<{ ok: boolean; success?: boolean; text?: string; error?: string }> {
  return postJson('/api/extract-text', payload);
}

export async function requestMixAudio(payload: {
  voiceAudioBase64: string;
  soundtrackPreset?: string;
  musicVolume?: number;
  duckingDepthDb?: number;
  voiceBoostDb?: number;
  customMusicBase64?: string;
}): Promise<{
  ok: boolean;
  success?: boolean;
  audioBase64?: string;
  mimeType?: string;
  warning?: string;
  error?: string;
}> {
  return postJson('/api/mix-audio', payload);
}

export interface ApiHealthSummary {
  status: string;
  modelTts: string;
  storage: string;
  geminiKeyConfigured: boolean;
}

export async function fetchHealthSummary(): Promise<Partial<ApiHealthSummary> | null> {
  try {
    const resp = await fetch('/api/health');
    if (!resp.ok) return null;
    return (await resp.json()) as Partial<ApiHealthSummary>;
  } catch (err: unknown) {
    console.debug(
      '[ApiClient] Falha ao consultar /api/health:',
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}


/**
 * Validadores estritos de fronteira para payloads JSON das rotas REST do MyTTS Studio.
 * Rejeita tipos inválidos, objetos malformados e propriedades não declaradas (anti-mass-assignment).
 */

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function rejectUnknownKeys(
  obj: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>
): string | null {
  const unknown = Object.keys(obj).filter((key) => !allowedKeys.has(key));
  if (unknown.length > 0) {
    return `Campos não permitidos no payload: ${unknown.slice(0, 5).join(', ')}.`;
  }
  return null;
}

export function validateStrictPayload<T extends Record<string, unknown>>(
  body: unknown,
  allowedKeys: ReadonlySet<string>,
  checkFields?: (obj: Record<string, unknown>) => string | null
): ValidationResult<T> {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'Payload JSON deve ser um objeto válido.' };
  }
  const unknownError = rejectUnknownKeys(body, allowedKeys);
  if (unknownError) {
    return { ok: false, error: unknownError };
  }
  if (checkFields) {
    const fieldError = checkFields(body);
    if (fieldError) {
      return { ok: false, error: fieldError };
    }
  }
  return { ok: true, data: body as T };
}

export const ROUTE_ALLOWED_KEYS = {
  extractText: new Set(['text', 'fileData', 'fileName', 'mimeType']),
  generateScript: new Set([
    'documentText',
    'language',
    'audienceLevel',
    'tensionIntensity',
    'format',
    'speakers',
    'maxTurns',
  ]),
  synthesizeTurn: new Set(['turn', 'speakerName', 'voiceId', 'language']),
  mixAudio: new Set([
    'voiceAudioBase64',
    'soundtrackPreset',
    'musicVolume',
    'duckingDepthDb',
    'voiceBoostDb',
    'customMusicBase64',
  ]),
  previewVoice: new Set(['voiceId', 'language', 'speakerName']),
  synthesizeChunk: new Set(['text', 'language', 'voiceId']),
  synthesizeSpeech: new Set(['text', 'voiceId', 'emotion', 'speed', 'autoProsody', 'language']),
  transcribeAudio: new Set(['audioData', 'mimeType']),
  generateChunks: new Set(['textOrPrompt', 'language', 'count']),
  createChunk: new Set(['id', 'chunk', 'literalOrNuance', 'meaning', 'context', 'pronunciationHint']),
  translateParallelChunks: new Set(['text', 'sourceLanguage']),
  generateFlashcard: new Set(['chunkText', 'language', 'contextSentence']),
  authGoogle: new Set(['credential', 'email', 'name']),
  conversationUpsert: new Set([
    'id',
    'userId',
    'userName',
    'userEmail',
    'title',
    'customTitle',
    'createdAt',
    'updatedAt',
    'pinned',
    'originMode',
    'messages',
  ]),
  flashcardsUpsert: new Set(['card', 'cards']),
  liveAgentTurn: new Set(['text', 'audioBase64', 'mimeType', 'persona', 'history']),
  agentExplore: new Set(['prompt', 'youtubeUrl', 'youtubeAction', 'clipRange', 'enableSearch']),
} as const;

export function safeUnlinkTempFile(filePath: string | null): Promise<void> {
  if (!filePath) return Promise.resolve();
  return import('fs/promises').then(({ unlink }) =>
    unlink(filePath).catch((err: unknown) => {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code !== 'ENOENT') {
        console.warn('[MixAudio] Falha ao remover arquivo temporário:', filePath, err);
      }
    })
  );
}

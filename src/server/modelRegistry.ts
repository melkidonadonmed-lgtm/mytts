/**
 * Single Source of Truth (SSOT) for Gemini & Vertex AI model identifiers,
 * fallback cascades, and profile-based routing in MyTTS Studio.
 */

export const MODEL_REGISTRY = {
  TEXT_FAST_MODEL: 'gemini-3.5-flash-lite',
  TEXT_REASONING_MODEL: 'gemini-4-hydrogen',
  TRANSCRIBE_BATCH_MODEL: 'gemini-3.5-transcribe',
  TTS_FLAGSHIP_MODEL: 'gemini-3.8-flash-tts',
  TTS_FAST_MODEL: 'gemini-3.8-flash-lite-tts',
  LIVE_AGENT_MODEL: 'gemini-3.8-live',
  LIVE_TRANSCRIBE_MODEL: 'gemini-3.5-transcribe-live',
} as const;

export const TEXT_FAST_CASCADE: ReadonlyArray<string> = [
  MODEL_REGISTRY.TEXT_FAST_MODEL,
  MODEL_REGISTRY.TEXT_REASONING_MODEL,
];

export const TEXT_REASONING_CASCADE: ReadonlyArray<string> = [
  MODEL_REGISTRY.TEXT_REASONING_MODEL,
  MODEL_REGISTRY.TEXT_FAST_MODEL,
];

export const TRANSCRIBE_CASCADE: ReadonlyArray<string> = [
  MODEL_REGISTRY.TRANSCRIBE_BATCH_MODEL,
  MODEL_REGISTRY.TEXT_REASONING_MODEL,
];

export const TTS_FLAGSHIP_CASCADE: ReadonlyArray<string> = [
  MODEL_REGISTRY.TTS_FLAGSHIP_MODEL,
  MODEL_REGISTRY.TTS_FAST_MODEL,
];

export const TTS_FAST_CASCADE: ReadonlyArray<string> = [
  MODEL_REGISTRY.TTS_FAST_MODEL,
  MODEL_REGISTRY.TTS_FLAGSHIP_MODEL,
];

export type TtsRouteKind = 'chunk' | 'speech' | 'turn' | 'preview';

const SHORT_SPEECH_TTS_CHAR_THRESHOLD = 220;

/**
 * Hybrid TTS routing:
 * - Short chunks, flashcards, and brief phrases (<= 220 chars) route to gemini-3.8-flash-lite-tts
 *   for minimum latency & cost.
 * - Studio solo long narration, dialectics/debates, and previews route to gemini-3.8-flash-tts
 *   for flagship acoustic fidelity.
 */
export function resolveTtsModelForRoute(kind: TtsRouteKind, textLength: number = 0): string {
  if (kind === 'chunk') {
    return MODEL_REGISTRY.TTS_FAST_MODEL;
  }
  if (kind === 'speech' && textLength > 0 && textLength <= SHORT_SPEECH_TTS_CHAR_THRESHOLD) {
    return MODEL_REGISTRY.TTS_FAST_MODEL;
  }
  return MODEL_REGISTRY.TTS_FLAGSHIP_MODEL;
}

/**
 * Checks whether a model belongs to the Gemini 4 family, which rejects
 * temperature/topP/topK sampling overrides and 'minimal' thinkingLevel.
 */
export function isGemini4Model(model: string): boolean {
  return model.startsWith('gemini-4-');
}

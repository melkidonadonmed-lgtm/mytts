/**
 * Constantes globais e endpoints externos centralizados do MyTTS Studio.
 * Mantém zero URLs ou portas mágicas hardcoded nos componentes de UI.
 */

export const EXTERNAL_LINKS = {
  GITHUB_REPO: 'https://github.com/melkidonadonmed-lgtm/mytts',
  JSON_SCHEMA_DRAFT: 'https://json-schema.org/draft/2020-12/schema',
  SAMPLE_AUDIT_URL: 'https://example.com/api?id=123',
} as const;

export const AUDIO_CONSTANTS = {
  PREVIEW_DURATION_SEC: 3,
  PREVIEW_FADE_START_SEC: 2.7,
  DEFAULT_DURATION_SEC: 10,
  LOFI_CHORD_SUSTAIN_SEC: 5,
  LOFI_CHORD_RELEASE_SEC: 5.95,
  LOFI_CHORD_DURATION_SEC: 6,
} as const;

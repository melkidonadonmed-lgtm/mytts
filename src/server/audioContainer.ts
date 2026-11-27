/**
 * Utilitários de sanitização, formatação prosódica e encapsulamento WAV RIFF canônico (44 bytes)
 * para o servidor Express do MyTTS Studio.
 */

export const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_TTS_CHARS = 20000;
export const ALLOWED_STUDIO_VOICES = new Set(['Puck', 'Kore', 'Aoede', 'Fenrir', 'Enceladus']);
export const ALLOWED_PREVIEW_VOICES = ALLOWED_STUDIO_VOICES;
export const ALLOWED_PREVIEW_LANGS = new Set(['pt-BR', 'en-US', 'it-IT', 'ja-JP']);
export const ALLOWED_CHUNK_TARGET_LANGS = new Set(['en-US', 'it-IT', 'ja-JP']);

export function resolveAllowedVoice(raw: unknown, fallback: string = 'Kore'): string {
  if (typeof raw === 'string' && ALLOWED_STUDIO_VOICES.has(raw.trim())) {
    return raw.trim();
  }
  return ALLOWED_STUDIO_VOICES.has(fallback) ? fallback : 'Kore';
}

export function clampSpeechSpeed(raw: unknown, fallback: number = 1.0): number {
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0.5, Math.min(2.0, Number(numeric.toFixed(2))));
}

export interface WavPcmInfo {
  isRiff: boolean;
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  byteRate: number;
  dataOffset: number;
  dataByteLength: number;
}

/**
 * Dynamically walks RIFF/WAVE sub-chunks to locate 'fmt ' and 'data',
 * safely handling headers larger than 44 bytes (e.g., LIST/INFO/JUNK chunks).
 */
export function extractWavPcmInfo(buffer: Buffer): WavPcmInfo {
  const defaultByteRate = 24000 * 2;
  if (
    buffer.length < 12 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    return {
      isRiff: false,
      sampleRate: 24000,
      numChannels: 1,
      bitsPerSample: 16,
      byteRate: defaultByteRate,
      dataOffset: 0,
      dataByteLength: buffer.length,
    };
  }

  let sampleRate = 24000;
  let numChannels = 1;
  let bitsPerSample = 16;
  let byteRate = defaultByteRate;
  let dataOffset = Math.min(44, buffer.length);
  let dataByteLength = Math.max(0, buffer.length - dataOffset);
  let foundData = false;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;

    if (chunkId === 'fmt ' && payloadOffset + 16 <= buffer.length) {
      numChannels = buffer.readUInt16LE(payloadOffset + 2) || 1;
      sampleRate = buffer.readUInt32LE(payloadOffset + 4) || 24000;
      byteRate = buffer.readUInt32LE(payloadOffset + 8) || sampleRate * numChannels * 2;
      bitsPerSample = buffer.readUInt16LE(payloadOffset + 14) || 16;
    } else if (chunkId === 'data') {
      dataOffset = payloadOffset;
      dataByteLength = Math.min(chunkSize, Math.max(0, buffer.length - payloadOffset));
      foundData = true;
      break;
    }

    const paddedSize = chunkSize + (chunkSize % 2);
    const nextOffset = payloadOffset + paddedSize;
    if (nextOffset <= offset) break;
    offset = nextOffset;
  }

  if (!foundData) {
    dataOffset = Math.min(44, buffer.length);
    dataByteLength = Math.max(0, buffer.length - dataOffset);
  }

  return {
    isRiff: true,
    sampleRate,
    numChannels,
    bitsPerSample,
    byteRate: byteRate > 0 ? byteRate : sampleRate * numChannels * (bitsPerSample / 8),
    dataOffset,
    dataByteLength,
  };
}

export function detectAudioMagicFormat(
  buffer: Buffer
): { ext: string; mime: string } | null {
  if (buffer.length < 4) return null;
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    return { ext: 'wav', mime: 'audio/wav' };
  }
  if (buffer.toString('ascii', 0, 3) === 'ID3') {
    return { ext: 'mp3', mime: 'audio/mpeg' };
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return { ext: 'mp3', mime: 'audio/mpeg' };
  }
  if (buffer.toString('ascii', 0, 4) === 'OggS') {
    return { ext: 'ogg', mime: 'audio/ogg' };
  }
  if (buffer.toString('ascii', 0, 4) === 'fLaC') {
    return { ext: 'flac', mime: 'audio/flac' };
  }
  return null;
}

export function sanitizeUserId(raw: unknown): string {
  return typeof raw === 'string' && USER_ID_PATTERN.test(raw) ? raw : 'anonymous-user';
}

export function capText(text: string, max: number = MAX_TTS_CHARS): string {
  return text.length > max ? text.slice(0, max) : text;
}

export function formatForTts(text: string): string {
  return text
    .replace(/<breath>/gi, '[deep breath]')
    .replace(/<sigh>/gi, '[sighs]')
    .replace(/<laugh>/gi, '[laughs]')
    .replace(/<gasp>/gi, '[gasp]')
    .replace(/<whisper>/gi, '[whispers]')
    .replace(/<pause>/gi, '[pause]')
    .replace(/\|mhm\|/gi, 'mhm...')
    .replace(/\|yeah\|/gi, 'yeah...')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Converte PCM Raw (24kHz 16-bit Mono) para arquivo WAV com cabeçalho RIFF canônico de 44 bytes.
 * Necessário pois a API Gemini Flash TTS Preview retorna áudio raw PCM sem container WAV.
 */
export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;
  const header = Buffer.alloc(44);

  // RIFF container descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8);

  // "fmt " sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(byteRate, 28); // ByteRate
  header.writeUInt16LE(blockAlign, 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample

  // "data" sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export function ensureWavContainer(base64Audio: string, sampleRate: number = 24000): string {
  const rawPcm = Buffer.from(base64Audio, 'base64');
  if (rawPcm.length >= 4 && rawPcm.toString('ascii', 0, 4) === 'RIFF') {
    return base64Audio;
  }
  return pcmToWav(rawPcm, sampleRate).toString('base64');
}

/**
 * Formata erros da API Gemini em mensagens diagnósticas claras em pt-BR.
 */
export function formatGeminiError(error: unknown, fallbackMessage: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (
    raw.includes('ACCOUNT_STATE_INVALID') ||
    raw.includes('bound service account is deleted or disabled')
  ) {
    return 'Chave GEMINI_API_KEY inválida: a Service Account vinculada a esta chave está desativada ou foi excluída no GCP (401). Defina uma chave ativa no arquivo .env.';
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
    return 'Chave GEMINI_API_KEY inválida (400/401). Verifique o arquivo .env na raiz do projeto.';
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return 'Cota da API Gemini excedida (429). Aguarde alguns instantes ou verifique o faturamento da chave.';
  }
  return raw || fallbackMessage;
}

/**
 * Constrói o grafo `filter_complex` do FFmpeg para mixagem broadcast com sidechain ducking:
 * - Normaliza ambas as entradas para 44.1 kHz (`aresample=44100`)
 * - Divide o canal de voz via `asplit=2[voice_sc][voice_mix]` (impedindo erro `Invalid stream specifier: voice`)
 * - Aplica `[bg][voice_sc]sidechaincompress` (comprimindo a trilha `[bg]` quando `[voice_sc]` fala)
 * - Mixa `[voice_mix][ducked]amix=inputs=2:duration=first`
 */
export function buildFfmpegMixFilterComplex(
  voiceVol: string,
  bgVol: string,
  ratio: number
): string {
  return `[0:a]aresample=44100,volume=${voiceVol},asplit=2[voice_sc][voice_mix];[1:a]aresample=44100,volume=${bgVol}[bg];[bg][voice_sc]sidechaincompress=threshold=0.08:ratio=${ratio}:attack=100:release=500[ducked];[voice_mix][ducked]amix=inputs=2:duration=first:dropout_transition=2[out]`;
}

/**
 * Utilitários de sanitização, formatação prosódica e encapsulamento WAV RIFF canônico (44 bytes)
 * para o servidor Express do MyTTS Studio.
 */

export const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
export const MAX_TTS_CHARS = 20000;
export const ALLOWED_PREVIEW_VOICES = new Set(['Puck', 'Kore', 'Aoede', 'Fenrir', 'Enceladus']);
export const ALLOWED_PREVIEW_LANGS = new Set(['pt-BR', 'en-US', 'it-IT', 'ja-JP']);

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

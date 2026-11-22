/**
 * Low-level Web Audio & RIFF WAV encoding/decoding utilities.
 */

export type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  };

let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(autoResume = false): AudioContext {
  if (!sharedAudioContext) {
    const win = window as WindowWithWebkitAudio;
    const AudioContextClass = win.AudioContext || win.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API não suportada neste ambiente.');
    }
    sharedAudioContext = new AudioContextClass();
  }
  if (autoResume && sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume().catch((err: unknown) => {
      console.debug(
        '[AudioContext] Resume aguardando gesto do usuário:',
        err instanceof Error ? err.message : String(err)
      );
    });
  }
  return sharedAudioContext;
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function decodeBase64ToAudioBuffer(base64: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = base64ToArrayBuffer(base64);
  return await ctx.decodeAudioData(arrayBuffer.slice(0));
}

/**
 * Converts attenuation or gain in decibels (dB) to a linear multiplier.
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Builds the canonical 44-byte WAV RIFF header (16-bit PCM).
 */
export function buildWavHeader(params: {
  sampleRate: number;
  numChannels: number;
  bitsPerSample?: number;
  dataByteLength: number;
}): ArrayBuffer {
  const { sampleRate, numChannels, bitsPerSample = 16, dataByteLength } = params;
  const format = 1; // PCM
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const headerByteLength = 44;
  const totalLength = headerByteLength + dataByteLength;

  const headerBuffer = new ArrayBuffer(headerByteLength);
  const view = new DataView(headerBuffer);

  const asciiTags: Array<[number, string]> = [
    [0, 'RIFF'],
    [8, 'WAVE'],
    [12, 'fmt '],
    [36, 'data'],
  ];
  for (const [offset, tag] of asciiTags) {
    for (let i = 0; i < tag.length; i++) {
      view.setUint8(offset + i, tag.charCodeAt(i));
    }
  }

  // RIFF Chunk Descriptor
  view.setUint32(4, totalLength - 8, true);

  // "fmt " Subchunk
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // "data" Subchunk
  view.setUint32(40, dataByteLength, true);

  return headerBuffer;
}

/**
 * Converts a mono or stereo AudioBuffer into a canonical 16-bit PCM WAV Blob.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length;
  const dataByteLength = length * blockAlign;
  const headerByteLength = 44;
  const totalLength = headerByteLength + dataByteLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const headerBytes = new Uint8Array(
    buildWavHeader({ sampleRate, numChannels, bitsPerSample: bitDepth, dataByteLength })
  );
  new Uint8Array(arrayBuffer).set(headerBytes, 0);
  const view = new DataView(arrayBuffer);

  // Interleaved PCM samples with strict anti-clipping clamp
  let offset = 44;
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channelData[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Combines multiple WAV base64 buffers into a single continuous WAV Blob.
 */
export function concatenateWavBuffers(wavBase64List: string[]): Blob {
  if (wavBase64List.length === 0) {
    return new Blob([], { type: 'audio/wav' });
  }

  const buffers: Uint8Array[] = wavBase64List.map(
    (b64) => new Uint8Array(base64ToArrayBuffer(b64))
  );

  let totalDataLength = buffers[0].length - 44;
  for (let i = 1; i < buffers.length; i++) {
    if (buffers[i].length > 44) {
      totalDataLength += buffers[i].length - 44;
    }
  }

  const combined = new Uint8Array(44 + totalDataLength);
  combined.set(buffers[0].subarray(0, 44), 0);

  const chunkSize = combined.length - 8;
  combined[4] = chunkSize & 0xff;
  combined[5] = (chunkSize >> 8) & 0xff;
  combined[6] = (chunkSize >> 16) & 0xff;
  combined[7] = (chunkSize >> 24) & 0xff;

  combined[40] = totalDataLength & 0xff;
  combined[41] = (totalDataLength >> 8) & 0xff;
  combined[42] = (totalDataLength >> 16) & 0xff;
  combined[43] = (totalDataLength >> 24) & 0xff;

  let offset = 44;
  combined.set(buffers[0].subarray(44), offset);
  offset += buffers[0].length - 44;

  for (let i = 1; i < buffers.length; i++) {
    if (buffers[i].length > 44) {
      combined.set(buffers[i].subarray(44), offset);
      offset += buffers[i].length - 44;
    }
  }

  return new Blob([combined], { type: 'audio/wav' });
}

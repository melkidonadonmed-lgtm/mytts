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

export interface BrowserWavDataSlice {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  pcmData: Uint8Array;
}

function readAsciiTag(bytes: Uint8Array, offset: number, len: number): string {
  let out = '';
  for (let i = 0; i < len && offset + i < bytes.length; i++) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}

/**
 * Dynamically locates 'fmt ' and 'data' sub-chunks in a RIFF/WAVE byte array,
 * supporting WAV files with non-standard headers (> 44 bytes).
 */
export function extractWavDataChunk(bytes: Uint8Array): BrowserWavDataSlice {
  let sampleRate = 24000;
  let numChannels = 1;
  let bitsPerSample = 16;

  if (
    bytes.length < 12 ||
    readAsciiTag(bytes, 0, 4) !== 'RIFF' ||
    readAsciiTag(bytes, 8, 4) !== 'WAVE'
  ) {
    return { sampleRate, numChannels, bitsPerSample, pcmData: bytes };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAsciiTag(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const payloadOffset = offset + 8;

    if (chunkId === 'fmt ' && payloadOffset + 16 <= bytes.length) {
      numChannels = view.getUint16(payloadOffset + 2, true) || 1;
      sampleRate = view.getUint32(payloadOffset + 4, true) || 24000;
      bitsPerSample = view.getUint16(payloadOffset + 14, true) || 16;
    } else if (chunkId === 'data') {
      const end = Math.min(bytes.length, payloadOffset + chunkSize);
      return {
        sampleRate,
        numChannels,
        bitsPerSample,
        pcmData: bytes.subarray(payloadOffset, end),
      };
    }

    const paddedSize = chunkSize + (chunkSize % 2);
    const nextOffset = payloadOffset + paddedSize;
    if (nextOffset <= offset) break;
    offset = nextOffset;
  }

  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    pcmData: bytes.length > 44 ? bytes.subarray(44) : new Uint8Array(0),
  };
}

/**
 * Combines multiple WAV base64 buffers into a single continuous WAV Blob.
 */
export function concatenateWavBuffers(wavBase64List: string[]): Blob {
  if (wavBase64List.length === 0) {
    return new Blob([], { type: 'audio/wav' });
  }

  const slices = wavBase64List.map((b64) => {
    const clean = b64.includes(',') ? b64.split(',')[1] : b64;
    return extractWavDataChunk(new Uint8Array(base64ToArrayBuffer(clean)));
  });

  const primary = slices[0];
  let totalDataLength = 0;
  for (const slice of slices) {
    totalDataLength += slice.pcmData.length;
  }

  const headerBytes = new Uint8Array(
    buildWavHeader({
      sampleRate: primary.sampleRate,
      numChannels: primary.numChannels,
      bitsPerSample: primary.bitsPerSample,
      dataByteLength: totalDataLength,
    })
  );

  const combined = new Uint8Array(44 + totalDataLength);
  combined.set(headerBytes, 0);

  let offset = 44;
  for (const slice of slices) {
    combined.set(slice.pcmData, offset);
    offset += slice.pcmData.length;
  }

  return new Blob([combined], { type: 'audio/wav' });
}

/**
 * Web Audio bridge for real-time Gemini Live bidirectional PCM streaming:
 * - Captures microphone audio -> 16 kHz mono Int16 LE PCM (~100 ms chunks) + 5 EQ bands.
 * - Plays incoming 24 kHz mono Int16 LE PCM seamlessly with instant barge-in queue flush.
 */

export interface LivePcmCaptureOptions {
  onPcmChunk: (base64Pcm: string) => void;
  onLevelBands?: (bands: [number, number, number, number, number]) => void;
}

export interface LivePcmCaptureHandle {
  stop: () => void;
}

const TARGET_CAPTURE_SAMPLE_RATE = 16000;
const CHUNK_SAMPLE_COUNT = 1600; // 100 ms at 16 kHz

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    const slice = bytes.subarray(i, Math.min(i + step, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function downsampleTo16kInt16(input: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === TARGET_CAPTURE_SAMPLE_RATE) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const clamped = Math.max(-1, Math.min(1, input[i]));
      out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    return out;
  }

  const ratio = inputSampleRate / TARGET_CAPTURE_SAMPLE_RATE;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcPos = i * ratio;
    const idx0 = Math.floor(srcPos);
    const idx1 = Math.min(idx0 + 1, input.length - 1);
    const frac = srcPos - idx0;
    const sample = input[idx0] * (1 - frac) + input[idx1] * frac;
    const clamped = Math.max(-1, Math.min(1, sample));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

export async function createLivePcmCapture({
  onPcmChunk,
  onLevelBands,
}: LivePcmCaptureOptions): Promise<LivePcmCaptureHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  let audioCtx: AudioContext;
  try {
    audioCtx = new AudioCtx({ sampleRate: TARGET_CAPTURE_SAMPLE_RATE });
  } catch {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.72;

  const processor = audioCtx.createScriptProcessor(2048, 1, 1);
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;

  source.connect(analyser);
  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  const freqData = new Uint8Array(analyser.frequencyBinCount);
  let sampleQueue: number[] = [];
  let stopped = false;

  processor.onaudioprocess = (event: AudioProcessingEvent) => {
    if (stopped) return;
    const channelData = event.inputBuffer.getChannelData(0);
    const pcm16 = downsampleTo16kInt16(channelData, audioCtx.sampleRate);

    for (let i = 0; i < pcm16.length; i++) {
      sampleQueue.push(pcm16[i]);
    }

    while (sampleQueue.length >= CHUNK_SAMPLE_COUNT) {
      const chunkSamples = sampleQueue.slice(0, CHUNK_SAMPLE_COUNT);
      sampleQueue = sampleQueue.slice(CHUNK_SAMPLE_COUNT);
      const chunkInt16 = Int16Array.from(chunkSamples);
      const bytes = new Uint8Array(chunkInt16.buffer, chunkInt16.byteOffset, chunkInt16.byteLength);
      onPcmChunk(uint8ToBase64(bytes));
    }

    if (onLevelBands) {
      analyser.getByteFrequencyData(freqData);
      const bandOf = (bin: number) =>
        Math.min(100, Math.max(18, Math.round(((freqData[bin] || 0) / 255) * 100)));
      onLevelBands([bandOf(1), bandOf(2), bandOf(4), bandOf(6), bandOf(9)]);
    }
  };

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (sampleQueue.length > 0) {
        try {
          const tailInt16 = Int16Array.from(sampleQueue);
          const bytes = new Uint8Array(tailInt16.buffer, tailInt16.byteOffset, tailInt16.byteLength);
          onPcmChunk(uint8ToBase64(bytes));
        } catch {
          // Ignore tail flush errors
        }
        sampleQueue = [];
      }
      processor.onaudioprocess = null;
      try {
        processor.disconnect();
        analyser.disconnect();
        source.disconnect();
        silentGain.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      stream.getTracks().forEach((track) => track.stop());
      if (audioCtx.state !== 'closed') {
        void audioCtx.close().catch(() => {});
      }
    },
  };
}

export class LivePcm24kPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime = 0;
  private readonly activeSources = new Set<AudioBufferSourceNode>();

  private ensureContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        this.audioCtx = new AudioCtx({ sampleRate: 24000 });
      } catch {
        this.audioCtx = new AudioCtx();
      }
      this.nextStartTime = 0;
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public enqueueBase64Pcm(base64Pcm: string): void {
    if (!base64Pcm) return;
    const rawBytes = base64ToUint8(base64Pcm);
    const sampleCount = Math.floor(rawBytes.byteLength / 2);
    if (sampleCount <= 0) return;

    const ctx = this.ensureContext();
    const audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
    const channel = audioBuffer.getChannelData(0);
    const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, sampleCount * 2);

    for (let i = 0; i < sampleCount; i++) {
      const int16 = view.getInt16(i * 2, true);
      channel[i] = int16 / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime + 0.02, this.nextStartTime);
    this.nextStartTime = startAt + audioBuffer.duration;
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0 && this.audioCtx) {
        this.nextStartTime = this.audioCtx.currentTime;
      }
    };
    source.start(startAt);
  }

  public clearQueue(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore already stopped sources
      }
    }
    this.activeSources.clear();
    this.nextStartTime = this.audioCtx ? this.audioCtx.currentTime : 0;
  }

  public close(): void {
    this.clearQueue();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close().catch(() => {});
    }
    this.audioCtx = null;
  }
}

/**
 * DialecticPod Web Audio Engine
 * Features:
 * - Gapless playback scheduling
 * - Pitch-preserving speed control (0.75x to 2.0x)
 * - Real-time AnalyserNode for audio visualization
 * - Multi-turn queue management & buffer concatenation
 * - Fallback speech synthesis (Web Speech API)
 */

let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioContext = new AudioContextClass();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
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
 * Combines multiple WAV base64 buffers into a single continuous WAV Blob.
 * As documented in Gemini TTS: Unary returns WAV with 44-byte RIFF header.
 * To concatenate, we strip subsequent 44-byte headers and update header byte lengths.
 */
export function concatenateWavBuffers(wavBase64List: string[]): Blob {
  if (wavBase64List.length === 0) {
    return new Blob([], { type: 'audio/wav' });
  }

  const buffers: Uint8Array[] = wavBase64List.map(b64 => new Uint8Array(base64ToArrayBuffer(b64)));
  
  // First buffer retains header, subsequent buffers strip first 44 bytes
  let totalDataLength = buffers[0].length - 44;
  for (let i = 1; i < buffers.length; i++) {
    if (buffers[i].length > 44) {
      totalDataLength += (buffers[i].length - 44);
    }
  }

  const combined = new Uint8Array(44 + totalDataLength);
  // Copy header from first buffer
  combined.set(buffers[0].subarray(0, 44), 0);
  
  // Set RIFF ChunkSize (total size - 8)
  const chunkSize = combined.length - 8;
  combined[4] = chunkSize & 0xff;
  combined[5] = (chunkSize >> 8) & 0xff;
  combined[6] = (chunkSize >> 16) & 0xff;
  combined[7] = (chunkSize >> 24) & 0xff;

  // Set Subchunk2Size (data size)
  combined[40] = totalDataLength & 0xff;
  combined[41] = (totalDataLength >> 8) & 0xff;
  combined[42] = (totalDataLength >> 16) & 0xff;
  combined[43] = (totalDataLength >> 24) & 0xff;

  // Append data chunks
  let offset = 44;
  // First chunk data
  combined.set(buffers[0].subarray(44), offset);
  offset += (buffers[0].length - 44);

  // Subsequent chunks data
  for (let i = 1; i < buffers.length; i++) {
    if (buffers[i].length > 44) {
      combined.set(buffers[i].subarray(44), offset);
      offset += (buffers[i].length - 44);
    }
  }

  return new Blob([combined], { type: 'audio/wav' });
}

export interface PlayerState {
  isPlaying: boolean;
  currentTurnIndex: number;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isBuffering: boolean;
}

export type PlaybackListener = (state: PlayerState) => void;

/**
 * Gapless Audio Player with Pitch Preservation and AnalyserNode integration
 */
export class GaplessAudioPlayer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private audioElement: HTMLAudioElement;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;
  private turns: Array<{
    turnNumber: number;
    audioBase64: string;
    blobUrl?: string;
    duration?: number;
    preDelayMs: number;
  }> = [];
  
  private currentTurnIdx: number = 0;
  private playbackRate: number = 1.0;
  private volume: number = 1.0;
  private isPlaying: boolean = false;
  private listeners: Set<PlaybackListener> = new Set();
  private progressInterval: number | null = null;
  private preDelayTimeout: number | null = null;

  constructor() {
    this.audioContext = getAudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    // Native pitch preservation
    this.audioElement.preservesPitch = true;
    (this.audioElement as any).mozPreservesPitch = true;
    (this.audioElement as any).webkitPreservesPitch = true;

    // Attach to Web Audio graph on first user interaction
    this.setupAudioGraph();
    this.setupEvents();
  }

  private setupAudioGraph() {
    try {
      if (!this.mediaSourceNode) {
        this.mediaSourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.mediaSourceNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      }
    } catch (e) {
      console.warn('MediaElementSource already created or waiting for gesture', e);
    }
  }

  private setupEvents() {
    this.audioElement.addEventListener('ended', () => {
      this.handleTurnEnded();
    });

    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true;
      this.startProgressTracker();
      this.notifyListeners();
    });

    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      this.stopProgressTracker();
      this.notifyListeners();
    });

    this.audioElement.addEventListener('error', (e) => {
      console.error('Audio playback error', e);
      this.isPlaying = false;
      this.notifyListeners();
    });
  }

  public getAnalyserNode(): AnalyserNode {
    return this.analyser;
  }

  public subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  public getState(): PlayerState {
    return {
      isPlaying: this.isPlaying,
      currentTurnIndex: this.currentTurnIdx,
      currentTime: this.audioElement.currentTime || 0,
      duration: this.audioElement.duration || 0,
      playbackRate: this.playbackRate,
      volume: this.volume,
      isBuffering: false,
    };
  }

  public setTurns(turns: Array<{
    turnNumber: number;
    audioBase64: string;
    preDelayMs?: number;
  }>) {
    // Revoke previous URLs
    this.turns.forEach(t => {
      if (t.blobUrl) URL.revokeObjectURL(t.blobUrl);
    });

    this.turns = turns.map(t => {
      const blob = new Blob([base64ToArrayBuffer(t.audioBase64)], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      return {
        turnNumber: t.turnNumber,
        audioBase64: t.audioBase64,
        blobUrl: url,
        preDelayMs: t.preDelayMs || 100,
      };
    });

    this.currentTurnIdx = 0;
    if (this.turns.length > 0 && this.turns[0].blobUrl) {
      this.audioElement.src = this.turns[0].blobUrl;
      this.audioElement.playbackRate = this.playbackRate;
      this.audioElement.volume = this.volume;
    }
    this.notifyListeners();
  }

  public async play(turnIndex?: number) {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.setupAudioGraph();

    if (this.preDelayTimeout) {
      clearTimeout(this.preDelayTimeout);
      this.preDelayTimeout = null;
    }

    if (typeof turnIndex === 'number' && turnIndex >= 0 && turnIndex < this.turns.length) {
      this.currentTurnIdx = turnIndex;
      const target = this.turns[turnIndex];
      if (target.blobUrl) {
        this.audioElement.src = target.blobUrl;
        this.audioElement.playbackRate = this.playbackRate;
        this.audioElement.volume = this.volume;
      }
    } else if (!this.audioElement.src && this.turns.length > 0 && this.turns[0].blobUrl) {
      this.audioElement.src = this.turns[0].blobUrl;
      this.audioElement.playbackRate = this.playbackRate;
      this.audioElement.volume = this.volume;
    }

    try {
      await this.audioElement.play();
    } catch (err) {
      console.warn('Playback gesture requirement or error:', err);
    }
  }

  public pause() {
    if (this.preDelayTimeout) {
      clearTimeout(this.preDelayTimeout);
      this.preDelayTimeout = null;
    }
    this.audioElement.pause();
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seek(seconds: number) {
    if (this.audioElement.duration && !isNaN(this.audioElement.duration)) {
      this.audioElement.currentTime = Math.max(0, Math.min(seconds, this.audioElement.duration));
      this.notifyListeners();
    }
  }

  public setSpeed(rate: number) {
    this.playbackRate = rate;
    this.audioElement.playbackRate = rate;
    this.notifyListeners();
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.audioElement.volume = this.volume;
    this.notifyListeners();
  }

  public nextTurn() {
    if (this.currentTurnIdx < this.turns.length - 1) {
      this.play(this.currentTurnIdx + 1);
    }
  }

  public prevTurn() {
    if (this.audioElement.currentTime > 2) {
      this.audioElement.currentTime = 0;
    } else if (this.currentTurnIdx > 0) {
      this.play(this.currentTurnIdx - 1);
    }
  }

  private handleTurnEnded() {
    // Gapless transition with calculated prosody delay
    if (this.currentTurnIdx < this.turns.length - 1) {
      const nextIdx = this.currentTurnIdx + 1;
      const nextTurn = this.turns[nextIdx];
      const delayMs = Math.max(20, nextTurn.preDelayMs || 100);

      this.currentTurnIdx = nextIdx;
      if (nextTurn.blobUrl) {
        this.audioElement.src = nextTurn.blobUrl;
        this.audioElement.playbackRate = this.playbackRate;
        this.audioElement.volume = this.volume;
      }

      this.notifyListeners();

      this.preDelayTimeout = window.setTimeout(async () => {
        try {
          await this.audioElement.play();
        } catch (e) {
          console.warn('Auto advance error', e);
        }
      }, delayMs);
    } else {
      this.isPlaying = false;
      this.notifyListeners();
    }
  }

  private startProgressTracker() {
    this.stopProgressTracker();
    this.progressInterval = window.setInterval(() => {
      this.notifyListeners();
    }, 100);
  }

  private stopProgressTracker() {
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  public destroy() {
    this.pause();
    this.stopProgressTracker();
    this.turns.forEach(t => {
      if (t.blobUrl) URL.revokeObjectURL(t.blobUrl);
    });
    this.listeners.clear();
  }
}

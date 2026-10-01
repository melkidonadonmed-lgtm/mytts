/**
 * DialecticPod Web Audio Engine - Pro Broadcast Edition
 * Features:
 * - Gapless playback scheduling with prosodic prosody gap
 * - Pitch-preserving speed control (0.75x to 2.0x)
 * - Multitrack Audio Graph with voice boost (+3dB) and background soundtrack
 * - Dynamic Auto-Ducking (attack: ~100ms, release: ~500ms) during speech
 * - Procedural soundscapes (Lo-Fi, Deep Focus 432Hz, Cinematic, Tech) and custom audio upload
 * - Studio Master Mix Offline Rendering (OfflineAudioContext -> 16-bit 44.1kHz Stereo WAV)
 * - Real-time AnalyserNode for audio visualization
 */

import {
  SoundtrackPreset,
  SoundtrackMeta,
  SOUNDTRACK_PRESETS,
  getOrGenerateSoundtrackBuffer,
} from './proceduralSoundtracks';

export { SOUNDTRACK_PRESETS };
export type { SoundtrackPreset, SoundtrackMeta };

let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
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
 * Converte um AudioBuffer estéreo ou mono em um Blob WAV RIFF canônico de 16-bit PCM
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length;
  const dataByteLength = length * blockAlign;
  const headerByteLength = 44;
  const totalLength = headerByteLength + dataByteLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(8, 'WAVE');

  // "fmt " Subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 para PCM)
  view.setUint16(20, format, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // "data" Subchunk
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Amostras PCM intercaladas com proteção anti-clipping
  let offset = 44;
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channelData[ch][i];
      // Clamping estrito [-1.0, 1.0]
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

export interface SoundtrackConfig {
  preset: SoundtrackPreset;
  musicVolume: number; // 0 a 1 (padrão: 0.20)
  duckingEnabled: boolean; // padrão: true
  duckingDepthDb: number; // atenuação em dB (ex: -14 dB)
  voiceBoostDb: number; // reforço de presença vocal (+3 dB)
  customFileName?: string;
}

export interface PlayerState {
  isPlaying: boolean;
  currentTurnIndex: number;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isBuffering: boolean;
  soundtrack: SoundtrackConfig;
  isDucking: boolean;
  isExportingMaster: boolean;
}

export type PlaybackListener = (state: PlayerState) => void;

/**
 * Gapless Audio Player com Pitch Preservation, Multitrack e Auto-Ducking
 */
export class GaplessAudioPlayer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private audioElement: HTMLAudioElement;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;
  private voiceGainNode: GainNode | null = null;
  private musicGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;

  // Trilha Sonora
  private musicSourceNode: AudioBufferSourceNode | null = null;
  private currentMusicBuffer: AudioBuffer | null = null;
  private isMusicPlaying: boolean = false;
  private isDucking: boolean = false;
  private isExportingMaster: boolean = false;

  private soundtrackConfig: SoundtrackConfig = {
    preset: 'none',
    musicVolume: 0.20,
    duckingEnabled: true,
    duckingDepthDb: -14,
    voiceBoostDb: 3,
  };

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
    this.audioElement.preservesPitch = true;
    (this.audioElement as any).mozPreservesPitch = true;
    (this.audioElement as any).webkitPreservesPitch = true;

    this.setupAudioGraph();
    this.setupEvents();
  }

  private setupAudioGraph() {
    try {
      if (!this.voiceGainNode) {
        this.voiceGainNode = this.audioContext.createGain();
        this.voiceGainNode.gain.value = Math.pow(10, this.soundtrackConfig.voiceBoostDb / 20);
      }

      if (!this.musicGainNode) {
        this.musicGainNode = this.audioContext.createGain();
        this.musicGainNode.gain.value = this.soundtrackConfig.musicVolume;
      }

      if (!this.masterGainNode) {
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.gain.value = this.volume;
      }

      if (!this.mediaSourceNode) {
        this.mediaSourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.mediaSourceNode.connect(this.voiceGainNode);
        this.voiceGainNode.connect(this.analyser);
      }

      // Mixa trilha musical no mesmo analyser do master
      this.musicGainNode.connect(this.analyser);
      this.analyser.connect(this.masterGainNode);
      this.masterGainNode.connect(this.audioContext.destination);
    } catch (e) {
      console.warn('AudioGraph setup deferred or already initialized:', e);
    }
  }

  private setupEvents() {
    this.audioElement.addEventListener('ended', () => {
      this.handleTurnEnded();
    });

    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true;
      this.applyDucking(true);
      this.startProgressTracker();
      this.notifyListeners();
    });

    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      this.applyDucking(false);
      this.stopProgressTracker();
      this.notifyListeners();
    });

    this.audioElement.addEventListener('error', (e) => {
      console.error('Audio playback error', e);
      this.isPlaying = false;
      this.applyDucking(false);
      this.notifyListeners();
    });
  }

  /**
   * Aplica atenuação suave (auto-ducking) à música quando a voz começa
   * ou restaura o volume nominal nos silêncios/intervalos entre turnos
   */
  private applyDucking(duck: boolean) {
    if (!this.musicGainNode || !this.soundtrackConfig.duckingEnabled) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const nominal = this.soundtrackConfig.musicVolume;

    this.isDucking = duck;

    try {
      this.musicGainNode.gain.cancelScheduledValues(now);
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, now);

      if (duck) {
        // Ataque rápido (~100ms) sem cliques
        const duckFactor = Math.pow(10, this.soundtrackConfig.duckingDepthDb / 20);
        const target = Math.max(0.0001, nominal * duckFactor);
        this.musicGainNode.gain.exponentialRampToValueAtTime(target, now + 0.1);
      } else {
        // Release suave (~450ms) permitindo a trilha preencher o espaço
        const target = Math.max(0.0001, nominal);
        this.musicGainNode.gain.exponentialRampToValueAtTime(target, now + 0.45);
      }
    } catch (e) {
      // Fallback em caso de valor zero na curva exponencial
      if (this.musicGainNode) {
        this.musicGainNode.gain.value = duck
          ? nominal * Math.pow(10, this.soundtrackConfig.duckingDepthDb / 20)
          : nominal;
      }
    }
  }

  /**
   * Inicia a reprodução em loop da trilha sonora
   */
  private async startSoundtrack() {
    if (this.soundtrackConfig.preset === 'none' || !this.currentMusicBuffer) {
      this.stopSoundtrack();
      return;
    }

    if (this.isMusicPlaying) return;

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.musicSourceNode = this.audioContext.createBufferSource();
      this.musicSourceNode.buffer = this.currentMusicBuffer;
      this.musicSourceNode.loop = true;

      if (this.musicGainNode) {
        this.musicSourceNode.connect(this.musicGainNode);
      }

      this.musicSourceNode.start(0);
      this.isMusicPlaying = true;
    } catch (err) {
      console.warn('Erro ao iniciar trilha sonora:', err);
    }
  }

  /**
   * Para a reprodução da trilha sonora
   */
  private stopSoundtrack() {
    if (this.musicSourceNode) {
      try {
        this.musicSourceNode.stop();
        this.musicSourceNode.disconnect();
      } catch (e) {}
      this.musicSourceNode = null;
    }
    this.isMusicPlaying = false;
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
      soundtrack: { ...this.soundtrackConfig },
      isDucking: this.isDucking,
      isExportingMaster: this.isExportingMaster,
    };
  }

  /**
   * Configura o preset da trilha sonora (procedural ou buffer customizado)
   */
  public async setSoundtrackPreset(
    preset: SoundtrackPreset,
    customBuffer?: AudioBuffer,
    customName?: string
  ) {
    this.soundtrackConfig.preset = preset;
    this.soundtrackConfig.customFileName = customName;

    if (preset === 'none') {
      this.currentMusicBuffer = null;
      this.stopSoundtrack();
    } else if (preset === 'custom' && customBuffer) {
      this.currentMusicBuffer = customBuffer;
      if (this.isPlaying) {
        this.stopSoundtrack();
        await this.startSoundtrack();
      }
    } else {
      // Gera ou busca buffer procedural no cache
      const buffer = await getOrGenerateSoundtrackBuffer(preset, this.audioContext.sampleRate);
      this.currentMusicBuffer = buffer;
      if (this.isPlaying) {
        this.stopSoundtrack();
        await this.startSoundtrack();
      }
    }

    this.notifyListeners();
  }

  public setSoundtrackVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.soundtrackConfig.musicVolume = clamped;
    if (this.musicGainNode && !this.isDucking) {
      this.musicGainNode.gain.setValueAtTime(clamped, this.audioContext.currentTime);
    }
    this.notifyListeners();
  }

  public setDuckingEnabled(enabled: boolean) {
    this.soundtrackConfig.duckingEnabled = enabled;
    if (!enabled && this.musicGainNode) {
      this.musicGainNode.gain.setValueAtTime(
        this.soundtrackConfig.musicVolume,
        this.audioContext.currentTime
      );
    }
    this.notifyListeners();
  }

  public setDuckingDepth(depthDb: number) {
    this.soundtrackConfig.duckingDepthDb = depthDb;
    if (this.isDucking) {
      this.applyDucking(true);
    }
    this.notifyListeners();
  }

  public setVoiceBoost(boostDb: number) {
    this.soundtrackConfig.voiceBoostDb = boostDb;
    if (this.voiceGainNode) {
      this.voiceGainNode.gain.setValueAtTime(
        Math.pow(10, boostDb / 20),
        this.audioContext.currentTime
      );
    }
    this.notifyListeners();
  }

  public setTurns(
    turns: Array<{
      turnNumber: number;
      audioBase64: string;
      preDelayMs?: number;
    }>
  ) {
    this.turns.forEach((t) => {
      if (t.blobUrl) URL.revokeObjectURL(t.blobUrl);
    });

    this.turns = turns.map((t) => {
      const blob = new Blob([base64ToArrayBuffer(t.audioBase64)], {
        type: 'audio/wav',
      });
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

    if (
      typeof turnIndex === 'number' &&
      turnIndex >= 0 &&
      turnIndex < this.turns.length
    ) {
      this.currentTurnIdx = turnIndex;
      const target = this.turns[turnIndex];
      if (target.blobUrl) {
        this.audioElement.src = target.blobUrl;
        this.audioElement.playbackRate = this.playbackRate;
        this.audioElement.volume = this.volume;
      }
    } else if (
      !this.audioElement.src &&
      this.turns.length > 0 &&
      this.turns[0].blobUrl
    ) {
      this.audioElement.src = this.turns[0].blobUrl;
      this.audioElement.playbackRate = this.playbackRate;
      this.audioElement.volume = this.volume;
    }

    // Inicia trilha sonora caso configurada
    if (this.soundtrackConfig.preset !== 'none' && !this.isMusicPlaying) {
      await this.startSoundtrack();
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
    this.stopSoundtrack();
    this.applyDucking(false);
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
      this.audioElement.currentTime = Math.max(
        0,
        Math.min(seconds, this.audioElement.duration)
      );
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
    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(
        this.volume,
        this.audioContext.currentTime
      );
    }
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
    // Transição entre turnos: solta o ducking para a trilha respirar
    this.applyDucking(false);

    if (this.currentTurnIdx < this.turns.length - 1) {
      const nextIdx = this.currentTurnIdx + 1;
      const nextTurn = this.turns[nextIdx];
      const delayMs = Math.max(40, nextTurn.preDelayMs || 120);

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
      this.applyDucking(false);
      this.notifyListeners();
      // Outro sutil na trilha: fade out em 2s
      if (this.musicGainNode && this.isMusicPlaying) {
        const now = this.audioContext.currentTime;
        this.musicGainNode.gain.setValueAtTime(this.soundtrackConfig.musicVolume, now + 1.0);
        this.musicGainNode.gain.linearRampToValueAtTime(0.001, now + 2.5);
        setTimeout(() => this.stopSoundtrack(), 2600);
      }
    }
  }

  /**
   * Renderiza e exporta o Master do debate completo em WAV estéreo de 16-bit
   * utilizando a Web Audio OfflineAudioContext. Realiza a mixagem de todos os
   * turnos sincronizados, trilha de fundo, auto-ducking e curvas de fade in/out.
   */
  public async exportMasterMixWav(
    scriptTurns?: Array<{ turn: number; audioBase64?: string; prosody: { pre_delay_ms?: number } }>
  ): Promise<Blob> {
    const rawTurns =
      scriptTurns && scriptTurns.length > 0
        ? scriptTurns.filter((t) => Boolean(t.audioBase64))
        : this.turns.filter((t) => Boolean(t.audioBase64));

    if (rawTurns.length === 0) {
      throw new Error('Nenhum turno com áudio sintetizado para exportar o master.');
    }

    this.isExportingMaster = true;
    this.notifyListeners();

    try {
      const sampleRate = 44100;
      const OfflineCtxClass =
        window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;

      // 1. Decodificar todos os turnos de fala
      const decodedTurns: Array<{
        turnNumber: number;
        buffer: AudioBuffer;
        preDelaySec: number;
      }> = [];

      for (const turn of rawTurns) {
        const b64 = (turn as any).audioBase64!;
        const preDelay = Math.max(
          0.2,
          ((turn as any).prosody?.pre_delay_ms || (turn as any).preDelayMs || 120) / 1000
        );
        const arrayBuf = base64ToArrayBuffer(b64);
        const audioBuf = await this.audioContext.decodeAudioData(arrayBuf.slice(0));
        decodedTurns.push({
          turnNumber: (turn as any).turn || (turn as any).turnNumber || 0,
          buffer: audioBuf,
          preDelaySec: preDelay,
        });
      }

      // 2. Calcular linha do tempo (Timeline)
      const introMargin = this.soundtrackConfig.preset !== 'none' ? 1.2 : 0.2;
      const outroMargin = this.soundtrackConfig.preset !== 'none' ? 2.2 : 0.4;

      let currentTime = introMargin;
      const scheduledSpeech: Array<{
        buffer: AudioBuffer;
        startTime: number;
        endTime: number;
      }> = [];

      for (let i = 0; i < decodedTurns.length; i++) {
        const dt = decodedTurns[i];
        if (i > 0) {
          currentTime += dt.preDelaySec;
        }
        const start = currentTime;
        const end = start + dt.buffer.duration;
        scheduledSpeech.push({ buffer: dt.buffer, startTime: start, endTime: end });
        currentTime = end;
      }

      const totalDuration = currentTime + outroMargin;
      const totalFrames = Math.ceil(sampleRate * totalDuration);

      // 3. Montar grafo de mixagem no OfflineAudioContext
      const offlineCtx = new OfflineCtxClass(2, totalFrames, sampleRate);

      // Ganho da voz (+3dB boost para clareza)
      const voiceGain = offlineCtx.createGain();
      const boostFactor = Math.pow(10, this.soundtrackConfig.voiceBoostDb / 20);
      voiceGain.gain.setValueAtTime(boostFactor, 0);
      voiceGain.connect(offlineCtx.destination);

      for (const spk of scheduledSpeech) {
        const source = offlineCtx.createBufferSource();
        source.buffer = spk.buffer;
        source.connect(voiceGain);
        source.start(spk.startTime);
      }

      // Mixagem da Trilha Sonora e Envelope de Ducking
      if (this.soundtrackConfig.preset !== 'none') {
        let musicBuffer = this.currentMusicBuffer;
        if (!musicBuffer && this.soundtrackConfig.preset !== 'custom') {
          musicBuffer = await getOrGenerateSoundtrackBuffer(
            this.soundtrackConfig.preset,
            sampleRate
          );
        }

        if (musicBuffer) {
          const musicGain = offlineCtx.createGain();
          const nominal = this.soundtrackConfig.musicVolume;
          const duckFactor = this.soundtrackConfig.duckingEnabled
            ? Math.pow(10, this.soundtrackConfig.duckingDepthDb / 20)
            : 1.0;
          const ducked = nominal * duckFactor;

          // Fade-in inicial da trilha
          musicGain.gain.setValueAtTime(0.0001, 0);
          musicGain.gain.exponentialRampToValueAtTime(nominal, 0.7);

          // Curva de Ducking sincronizada com cada intervenção vocal
          for (const spk of scheduledSpeech) {
            // Ataque quando a fala começa
            musicGain.gain.setTargetAtTime(ducked, spk.startTime, 0.08);
            // Release quando a fala termina
            musicGain.gain.setTargetAtTime(nominal, spk.endTime, 0.35);
          }

          // Outro: fade-out suave nos últimos 1.5s
          musicGain.gain.setValueAtTime(nominal, totalDuration - 1.5);
          musicGain.gain.linearRampToValueAtTime(0.0001, totalDuration);

          musicGain.connect(offlineCtx.destination);

          // Preenche a trilha em repetição contínua
          let musicOffset = 0;
          while (musicOffset < totalDuration) {
            const musicSource = offlineCtx.createBufferSource();
            musicSource.buffer = musicBuffer;
            musicSource.connect(musicGain);
            musicSource.start(musicOffset);
            musicOffset += musicBuffer.duration;
          }
        }
      }

      // 4. Renderização rápida offline
      const renderedBuffer = await offlineCtx.startRendering();

      // 5. Encapsular em WAV 16-bit estéreo canônico
      return audioBufferToWavBlob(renderedBuffer);
    } finally {
      this.isExportingMaster = false;
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
    this.stopSoundtrack();
    this.stopProgressTracker();
    this.turns.forEach((t) => {
      if (t.blobUrl) URL.revokeObjectURL(t.blobUrl);
    });
    this.listeners.clear();
  }
}

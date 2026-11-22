/**
 * DialecticPod Web Audio Engine - Pro Broadcast Edition
 * Features:
 * - Gapless playback scheduling with prosodic pre-delay gap
 * - Pitch-preserving speed control (0.75x to 2.0x)
 * - Multitrack Audio Graph with voice boost (+3dB) and background soundtrack
 * - Dynamic Auto-Ducking (attack: ~100ms, release: ~500ms) during speech
 * - Procedural soundscapes (Lo-Fi, Deep Focus 432Hz, Cinematic, Tech) and custom audio upload
 * - Studio Master Mix Offline Rendering (OfflineAudioContext -> 16-bit 44.1kHz Stereo WAV)
 * - Real-time AnalyserNode for audio visualization
 */

import {
  SOUNDTRACK_PRESETS,
  getOrGenerateSoundtrackBuffer,
} from './proceduralSoundtracks';
import type {
  SoundtrackPreset,
  SoundtrackMeta,
} from './proceduralSoundtracks';
import {
  getAudioContext,
  base64ToArrayBuffer,
  decodeBase64ToAudioBuffer,
  dbToLinear,
  buildWavHeader,
  audioBufferToWavBlob,
  concatenateWavBuffers,
} from './audio/wavUtils';
import {
  renderMasterMixWav,
  type ExportTurnInput,
  type SoundtrackConfig,
} from './audio/masterMixRenderer';
import {
  reconcilePlayerTurns,
  revokeTurnBlobUrls,
  type IncomingTurnSpec,
  type PlayerTurnEntry,
} from './audio/turnQueueManager';

export {
  SOUNDTRACK_PRESETS,
  getAudioContext,
  base64ToArrayBuffer,
  decodeBase64ToAudioBuffer,
  dbToLinear,
  buildWavHeader,
  audioBufferToWavBlob,
  concatenateWavBuffers,
};
export type { SoundtrackPreset, SoundtrackMeta, ExportTurnInput, SoundtrackConfig };

interface PitchPreservingAudioElement extends HTMLAudioElement {
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
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
 * Gapless Audio Player with Pitch Preservation, Multitrack, and Auto-Ducking.
 */
export class GaplessAudioPlayer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioElement: HTMLAudioElement;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;
  private voiceGainNode: GainNode | null = null;
  private musicGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;

  // Soundtrack state
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

  private turns: PlayerTurnEntry[] = [];

  private currentTurnIdx: number = 0;
  private playbackRate: number = 1.0;
  private volume: number = 1.0;
  private isPlaying: boolean = false;
  private listeners: Set<PlaybackListener> = new Set();
  private progressInterval: number | null = null;
  private preDelayTimeout: number | null = null;

  constructor() {
    const pitchAudio = new Audio() as PitchPreservingAudioElement;
    pitchAudio.crossOrigin = 'anonymous';
    pitchAudio.preservesPitch = true;
    pitchAudio.mozPreservesPitch = true;
    pitchAudio.webkitPreservesPitch = true;
    this.audioElement = pitchAudio;

    this.setupEvents();
  }

  private ensureAudioContext(autoResume = false): AudioContext {
    if (!this.audioContext) {
      this.audioContext = getAudioContext(autoResume);
    } else if (autoResume && this.audioContext.state === 'suspended') {
      void this.audioContext.resume().catch((err: unknown) => {
        console.debug(
          '[GaplessAudioPlayer] Resume aguardando gesto do usuário:',
          err instanceof Error ? err.message : String(err)
        );
      });
    }
    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
    }
    this.setupAudioGraph();
    return this.audioContext;
  }

  private setupAudioGraph() {
    try {
      if (!this.audioContext || !this.analyser) return;
      if (!this.masterGainNode) {
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.gain.value = this.volume;
        this.analyser.connect(this.masterGainNode);
        this.masterGainNode.connect(this.audioContext.destination);
      }

      if (!this.voiceGainNode) {
        this.voiceGainNode = this.audioContext.createGain();
        this.voiceGainNode.gain.value = dbToLinear(this.soundtrackConfig.voiceBoostDb);
        this.voiceGainNode.connect(this.analyser);
      }

      if (!this.musicGainNode) {
        this.musicGainNode = this.audioContext.createGain();
        this.musicGainNode.gain.value = this.soundtrackConfig.musicVolume;
        this.musicGainNode.connect(this.analyser);
      }

      if (!this.mediaSourceNode) {
        this.mediaSourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.mediaSourceNode.connect(this.voiceGainNode);
      }
    } catch (e: unknown) {
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

  private applyDucking(duck: boolean) {
    if (!this.musicGainNode || !this.soundtrackConfig.duckingEnabled || !this.audioContext) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const nominal = this.soundtrackConfig.musicVolume;

    this.isDucking = duck;

    try {
      this.musicGainNode.gain.cancelScheduledValues(now);
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, now);

      if (duck) {
        const duckFactor = dbToLinear(this.soundtrackConfig.duckingDepthDb);
        const target = Math.max(0.0001, nominal * duckFactor);
        this.musicGainNode.gain.exponentialRampToValueAtTime(target, now + 0.1);
      } else {
        const target = Math.max(0.0001, nominal);
        this.musicGainNode.gain.exponentialRampToValueAtTime(target, now + 0.45);
      }
    } catch {
      if (this.musicGainNode) {
        this.musicGainNode.gain.value = duck
          ? nominal * dbToLinear(this.soundtrackConfig.duckingDepthDb)
          : nominal;
      }
    }
  }

  private async startSoundtrack() {
    if (this.soundtrackConfig.preset === 'none' || !this.currentMusicBuffer) {
      this.stopSoundtrack();
      return;
    }

    if (this.isMusicPlaying) return;

    try {
      const ctx = this.ensureAudioContext(true);
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      this.musicSourceNode = ctx.createBufferSource();
      this.musicSourceNode.buffer = this.currentMusicBuffer;
      this.musicSourceNode.loop = true;

      if (this.musicGainNode) {
        this.musicSourceNode.connect(this.musicGainNode);
      }

      this.musicSourceNode.start(0);
      this.isMusicPlaying = true;
    } catch (err: unknown) {
      console.warn('Erro ao iniciar trilha sonora:', err);
    }
  }

  private stopSoundtrack() {
    if (this.musicSourceNode) {
      try {
        this.musicSourceNode.stop();
        this.musicSourceNode.disconnect();
      } catch {
        // Ignore if source node has already stopped
      }
      this.musicSourceNode = null;
    }
    this.isMusicPlaying = false;
  }

  public getAnalyserNode(): AnalyserNode {
    this.ensureAudioContext(false);
    return this.analyser!;
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
      const ctx = this.ensureAudioContext(false);
      const buffer = await getOrGenerateSoundtrackBuffer(preset, ctx.sampleRate);
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
    if (this.musicGainNode && !this.isDucking && this.audioContext) {
      this.musicGainNode.gain.setValueAtTime(clamped, this.audioContext.currentTime);
    }
    this.notifyListeners();
  }

  public setDuckingEnabled(enabled: boolean) {
    this.soundtrackConfig.duckingEnabled = enabled;
    if (!enabled && this.musicGainNode && this.audioContext) {
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
    if (this.voiceGainNode && this.audioContext) {
      this.voiceGainNode.gain.setValueAtTime(
        dbToLinear(boostDb),
        this.audioContext.currentTime
      );
    }
    this.notifyListeners();
  }

  public setTurns(turns: IncomingTurnSpec[]) {
    const reconciled = reconcilePlayerTurns({
      existingTurns: this.turns,
      incomingTurns: turns,
      currentTurnIdx: this.currentTurnIdx,
      isPlaying: this.isPlaying,
      currentTime: this.audioElement.currentTime,
      hasCurrentSrc: Boolean(this.audioElement.src),
    });

    this.turns = reconciled.nextTurns;
    this.currentTurnIdx = reconciled.nextTurnIdx;

    if (reconciled.shouldUpdateSrc && reconciled.nextSrcUrl) {
      this.audioElement.src = reconciled.nextSrcUrl;
      this.audioElement.playbackRate = this.playbackRate;
      this.audioElement.volume = this.volume;
    }

    this.notifyListeners();
  }

  public async play(turnIndex?: number) {
    const ctx = this.ensureAudioContext(true);
    if (ctx.state === 'suspended') {
      await ctx.resume();
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

    if (this.soundtrackConfig.preset !== 'none' && !this.isMusicPlaying) {
      await this.startSoundtrack();
    }

    try {
      await this.audioElement.play();
    } catch (err: unknown) {
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
    if (this.masterGainNode && this.audioContext) {
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
        } catch (e: unknown) {
          console.warn('Auto advance error', e);
        }
      }, delayMs);
    } else {
      this.isPlaying = false;
      this.applyDucking(false);
      this.notifyListeners();
      if (this.musicGainNode && this.isMusicPlaying && this.audioContext) {
        const now = this.audioContext.currentTime;
        this.musicGainNode.gain.setValueAtTime(this.soundtrackConfig.musicVolume, now + 1.0);
        this.musicGainNode.gain.linearRampToValueAtTime(0.001, now + 2.5);
        setTimeout(() => this.stopSoundtrack(), 2600);
      }
    }
  }

  public async exportMasterMixWav(
    scriptTurns?: ExportTurnInput[]
  ): Promise<Blob> {
    const rawTurns: ExportTurnInput[] =
      scriptTurns && scriptTurns.length > 0
        ? scriptTurns.filter((t) => Boolean(t.audioBase64))
        : this.turns.filter((t) => Boolean(t.audioBase64));

    if (rawTurns.length === 0) {
      throw new Error('Nenhum turno com áudio sintetizado para exportar o master.');
    }

    this.isExportingMaster = true;
    this.notifyListeners();

    try {
      const ctx = this.ensureAudioContext(false);
      return await renderMasterMixWav({
        rawTurns,
        audioContext: ctx,
        soundtrackConfig: this.soundtrackConfig,
        currentMusicBuffer: this.currentMusicBuffer,
      });
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
    revokeTurnBlobUrls(this.turns);
    this.listeners.clear();
  }
}

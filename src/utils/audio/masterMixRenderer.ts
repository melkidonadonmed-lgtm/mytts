/**
 * Offline Studio Master Mix renderer (OfflineAudioContext -> 16-bit 44.1kHz Stereo WAV).
 */

import { getOrGenerateSoundtrackBuffer, type SoundtrackPreset } from '../proceduralSoundtracks';
import {
  audioBufferToWavBlob,
  base64ToArrayBuffer,
  type WindowWithWebkitAudio,
} from './wavUtils';

export interface ExportTurnInput {
  turn?: number;
  turnNumber?: number;
  audioBase64?: string;
  preDelayMs?: number;
  prosody?: {
    pre_delay_ms?: number;
  };
}

export interface SoundtrackConfig {
  preset: SoundtrackPreset;
  musicVolume: number; // 0 to 1 (default: 0.20)
  duckingEnabled: boolean; // default: true
  duckingDepthDb: number; // attenuation in dB (e.g. -14 dB)
  voiceBoostDb: number; // vocal presence boost (+3 dB)
  customFileName?: string;
}

export interface MasterMixRenderParams {
  rawTurns: ExportTurnInput[];
  audioContext: AudioContext;
  soundtrackConfig: SoundtrackConfig;
  currentMusicBuffer: AudioBuffer | null;
}

/**
 * Renders the full debate master mix in 16-bit 44.1kHz stereo WAV using OfflineAudioContext,
 * combining synchronized turns, looping soundtrack, auto-ducking envelopes, and fade-in/out.
 */
export async function renderMasterMixWav({
  rawTurns,
  audioContext,
  soundtrackConfig,
  currentMusicBuffer,
}: MasterMixRenderParams): Promise<Blob> {
  const sampleRate = 44100;
  const win = window as WindowWithWebkitAudio;
  const OfflineCtxClass = win.OfflineAudioContext || win.webkitOfflineAudioContext;
  if (!OfflineCtxClass) {
    throw new Error('OfflineAudioContext não suportado neste navegador.');
  }

  // 1. Decode all speech turns
  const decodedTurns: Array<{
    turnNumber: number;
    buffer: AudioBuffer;
    preDelaySec: number;
  }> = [];

  for (const turn of rawTurns) {
    const b64 = turn.audioBase64 || '';
    const preDelay = Math.max(
      0.2,
      (turn.prosody?.pre_delay_ms || turn.preDelayMs || 120) / 1000
    );
    const arrayBuf = base64ToArrayBuffer(b64);
    const audioBuf = await audioContext.decodeAudioData(arrayBuf.slice(0));
    decodedTurns.push({
      turnNumber: turn.turn || turn.turnNumber || 0,
      buffer: audioBuf,
      preDelaySec: preDelay,
    });
  }

  // 2. Compute timeline
  const introMargin = soundtrackConfig.preset !== 'none' ? 1.2 : 0.2;
  const outroMargin = soundtrackConfig.preset !== 'none' ? 2.2 : 0.4;

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

  // 3. Build mixing graph in OfflineAudioContext
  const offlineCtx = new OfflineCtxClass(2, totalFrames, sampleRate);

  const voiceGain = offlineCtx.createGain();
  const boostFactor = Math.pow(10, soundtrackConfig.voiceBoostDb / 20);
  voiceGain.gain.setValueAtTime(boostFactor, 0);
  voiceGain.connect(offlineCtx.destination);

  for (const spk of scheduledSpeech) {
    const source = offlineCtx.createBufferSource();
    source.buffer = spk.buffer;
    source.connect(voiceGain);
    source.start(spk.startTime);
  }

  // Mix soundtrack with dynamic ducking envelope
  if (soundtrackConfig.preset !== 'none') {
    let musicBuffer = currentMusicBuffer;
    if (!musicBuffer && soundtrackConfig.preset !== 'custom') {
      musicBuffer = await getOrGenerateSoundtrackBuffer(soundtrackConfig.preset, sampleRate);
    }

    if (musicBuffer) {
      const musicGain = offlineCtx.createGain();
      const nominal = soundtrackConfig.musicVolume;
      const duckFactor = soundtrackConfig.duckingEnabled
        ? Math.pow(10, soundtrackConfig.duckingDepthDb / 20)
        : 1.0;
      const ducked = nominal * duckFactor;

      // Initial fade-in
      musicGain.gain.setValueAtTime(0.0001, 0);
      musicGain.gain.exponentialRampToValueAtTime(nominal, 0.7);

      // Ducking envelope synchronized with each vocal intervention
      for (const spk of scheduledSpeech) {
        musicGain.gain.setTargetAtTime(ducked, spk.startTime, 0.08);
        musicGain.gain.setTargetAtTime(nominal, spk.endTime, 0.35);
      }

      // Outro: smooth fade-out in the final 1.5s
      musicGain.gain.setValueAtTime(nominal, totalDuration - 1.5);
      musicGain.gain.linearRampToValueAtTime(0.0001, totalDuration);

      musicGain.connect(offlineCtx.destination);

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

  // 4. Offline render & canonical 16-bit stereo WAV packaging
  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWavBlob(renderedBuffer);
}

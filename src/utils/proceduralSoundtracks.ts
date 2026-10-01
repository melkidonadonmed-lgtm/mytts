/**
 * Gerador Procedural de Trilhas Sonoras e Ambientações Acústicas
 * Utiliza a Web Audio API (OfflineAudioContext) para sintetizar soundscapes
 * musicais de estúdio sem dependências externas e com 0 bytes de download.
 */

export type SoundtrackPreset =
  | 'none'
  | 'lofi-warmth'
  | 'deep-focus'
  | 'cinematic-pulse'
  | 'tech-ambient'
  | 'custom';

export interface SoundtrackMeta {
  id: SoundtrackPreset;
  name: string;
  ptName: string;
  description: string;
  icon: string;
  color: string;
  defaultVolume: number;
}

export const SOUNDTRACK_PRESETS: SoundtrackMeta[] = [
  {
    id: 'none',
    name: 'None (Voice Only)',
    ptName: 'Silêncio (Apenas Voz)',
    description: 'Sem trilha de fundo, isolamento vocal de alta fidelidade.',
    icon: '🔇',
    color: '#64748b',
    defaultVolume: 0,
  },
  {
    id: 'lofi-warmth',
    name: 'Lo-Fi Chill & Warmth',
    ptName: 'Lo-Fi Study & Calor Analógico',
    description: 'Acordes de piano elétrico Rhodes, filtro suave e textura de fita vintage.',
    icon: '☕',
    color: '#f59e0b',
    defaultVolume: 0.22,
  },
  {
    id: 'deep-focus',
    name: 'Deep Focus (432Hz Drone)',
    ptName: 'Foco Profundo (Drone 432Hz)',
    description: 'Pad harmônico com afinação 432Hz e ressonância binaural relaxante.',
    icon: '🧘',
    color: '#6366f1',
    defaultVolume: 0.20,
  },
  {
    id: 'cinematic-pulse',
    name: 'Cinematic Tension',
    ptName: 'Tensão Cinemática (Pulso & Gravitas)',
    description: 'Sub-grave profundo, pulso rítmico cadenciado e atmosfera de suspense.',
    icon: '🎬',
    color: '#f43f5e',
    defaultVolume: 0.18,
  },
  {
    id: 'tech-ambient',
    name: 'Tech Minimalism',
    ptName: 'Tecnologia Minimalista',
    description: 'Arpejos digitais limpos, ambiência moderna e espacialização estéreo.',
    icon: '💡',
    color: '#0ea5e9',
    defaultVolume: 0.18,
  },
  {
    id: 'custom',
    name: 'Custom Audio File',
    ptName: 'Arquivo Personalizado (MP3/WAV)',
    description: 'Faixa de áudio carregada localmente para fundo do debate.',
    icon: '📁',
    color: '#10b981',
    defaultVolume: 0.25,
  },
];

// Cache em memória de buffers procedurais sintetizados
const proceduralBufferCache = new Map<string, AudioBuffer>();

/**
 * Converte notas musicais em frequência Hertz
 */
function noteToFreq(note: string): number {
  const notes: Record<string, number> = {
    C: 0, 'C#': 1, Db: 1,
    D: 2, 'D#': 3, Eb: 3,
    E: 4,
    F: 5, 'F#': 6, Gb: 6,
    G: 7, 'G#': 8, Ab: 8,
    A: 9, 'A#': 10, Bb: 10,
    B: 11,
  };
  const match = note.match(/^([A-G][b#]?)(-?\d+)$/);
  if (!match) return 440;
  const name = match[1];
  const octave = parseInt(match[2], 10);
  const semitonesFromA4 = notes[name] - 9 + (octave - 4) * 12;
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

/**
 * Sintetiza proceduralmente um buffer estéreo contínuo de 24 segundos com loop perfeito (crossfade nos extremos)
 */
export async function getOrGenerateSoundtrackBuffer(
  preset: SoundtrackPreset,
  sampleRate: number = 44100
): Promise<AudioBuffer | null> {
  if (preset === 'none' || preset === 'custom') {
    return null;
  }

  const cacheKey = `${preset}_${sampleRate}`;
  if (proceduralBufferCache.has(cacheKey)) {
    return proceduralBufferCache.get(cacheKey)!;
  }

  const loopDuration = 24; // 24 segundos de loop
  const totalFrames = sampleRate * loopDuration;
  const OfflineContextClass =
    window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const ctx = new OfflineContextClass(2, totalFrames, sampleRate);

  if (preset === 'lofi-warmth') {
    generateLofiTrack(ctx, loopDuration);
  } else if (preset === 'deep-focus') {
    generateDeepFocusTrack(ctx, loopDuration);
  } else if (preset === 'cinematic-pulse') {
    generateCinematicPulseTrack(ctx, loopDuration);
  } else if (preset === 'tech-ambient') {
    generateTechAmbientTrack(ctx, loopDuration);
  }

  const rawBuffer = await ctx.startRendering();
  // Aplica crossfade suave de 1.5s entre final e início para eliminar qualquer descontinuidade
  const seamlessBuffer = applyLoopCrossfade(rawBuffer, sampleRate, 1.5);

  proceduralBufferCache.set(cacheKey, seamlessBuffer);
  return seamlessBuffer;
}

/**
 * 1. Lo-Fi Chill: Acordes suaves de Rhodes (Fmaj9, Em7, Dm9, Cmaj9) com filtro lowpass
 */
function generateLofiTrack(ctx: OfflineAudioContext, duration: number) {
  // Progressão de 4 acordes (6s cada = 24s total)
  const progressions = [
    { start: 0, notes: ['F3', 'A3', 'C4', 'E4', 'G4'] },
    { start: 6, notes: ['E3', 'G3', 'B3', 'D4', 'G4'] },
    { start: 12, notes: ['D3', 'F3', 'A3', 'C4', 'E4'] },
    { start: 18, notes: ['C3', 'E3', 'G3', 'B3', 'D4'] },
  ];

  progressions.forEach((chord) => {
    chord.notes.forEach((noteName, idx) => {
      const freq = noteToFreq(noteName);

      // Oscilador 1: Senoidal fundamental
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, chord.start);

      // Oscilador 2: Triângulo harmônico para calor estilo Rhodes
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, chord.start);

      // Filtro passa-baixa analógico para suavizar agudos
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(580 + idx * 30, chord.start);
      filter.Q.setValueAtTime(1.2, chord.start);

      // LFO sutil para vibrato / wow & flutter analógico
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(4.2, chord.start);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(1.5, chord.start);
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      // Envelope de ganho do acorde
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, chord.start);
      gain.gain.linearRampToValueAtTime(0.07 / chord.notes.length, chord.start + 0.8);
      gain.gain.setValueAtTime(0.06 / chord.notes.length, chord.start + 5.0);
      gain.gain.linearRampToValueAtTime(0.001, chord.start + 5.95);

      // Espacializador estéreo sutil
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) {
        pan.pan.setValueAtTime((idx % 2 === 0 ? -0.3 : 0.3), chord.start);
      }

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);

      if (pan) {
        gain.connect(pan);
        pan.connect(ctx.destination);
      } else {
        gain.connect(ctx.destination);
      }

      osc1.start(chord.start);
      osc1.stop(chord.start + 6.0);
      osc2.start(chord.start);
      osc2.stop(chord.start + 6.0);
      lfo.start(chord.start);
      lfo.stop(chord.start + 6.0);
    });
  });

  // Textura sutil de ruído rosa (calor de fita analógica)
  createAnalogTapeHiss(ctx, duration, 0.008);
}

/**
 * 2. Deep Focus: Drone afinação 432Hz com batimento binaural theta (432Hz e 436Hz)
 */
function generateDeepFocusTrack(ctx: OfflineAudioContext, duration: number) {
  const frequencies = [108, 216, 324, 432];

  frequencies.forEach((freq, idx) => {
    // Canal Esquerdo (432 Hz base)
    const oscL = ctx.createOscillator();
    oscL.type = 'sine';
    oscL.frequency.setValueAtTime(freq, 0);

    // Canal Direito (com ligeiro desvio para batimento binaural 4Hz theta)
    const oscR = ctx.createOscillator();
    oscR.type = 'sine';
    oscR.frequency.setValueAtTime(freq + (idx === 3 ? 4 : 2), 0);

    // Filtro modulado
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, 0);
    filter.frequency.linearRampToValueAtTime(550, duration / 2);
    filter.frequency.linearRampToValueAtTime(350, duration);
    filter.Q.setValueAtTime(1.5, 0);

    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    const baseGain = 0.08 / frequencies.length;
    gainL.gain.setValueAtTime(baseGain, 0);
    gainR.gain.setValueAtTime(baseGain, 0);

    const merger = ctx.createChannelMerger(2);
    oscL.connect(filter);
    oscR.connect(filter);
    filter.connect(gainL);
    filter.connect(gainR);
    gainL.connect(merger, 0, 0); // Left
    gainR.connect(merger, 0, 1); // Right
    merger.connect(ctx.destination);

    oscL.start(0);
    oscL.stop(duration);
    oscR.start(0);
    oscR.stop(duration);
  });
}

/**
 * 3. Cinematic Tension: Sub-bass profundo pulsante a 68 BPM + pad de suspense
 */
function generateCinematicPulseTrack(ctx: OfflineAudioContext, duration: number) {
  // Sub-bass contínuo em 55Hz (Lá grave / A1)
  const subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(55, 0);

  const subFilter = ctx.createBiquadFilter();
  subFilter.type = 'lowpass';
  subFilter.frequency.setValueAtTime(110, 0);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.12, 0);

  subOsc.connect(subFilter);
  subFilter.connect(subGain);
  subGain.connect(ctx.destination);

  subOsc.start(0);
  subOsc.stop(duration);

  // Pulso rítmico cadenciado a 68 BPM (~0.88s por batida)
  const beatInterval = 60 / 68;
  const numBeats = Math.floor(duration / beatInterval);

  for (let b = 0; b < numBeats; b++) {
    const time = b * beatInterval;
    const pulseOsc = ctx.createOscillator();
    pulseOsc.type = 'triangle';
    pulseOsc.frequency.setValueAtTime(82.4, time); // Mi / E2

    const pulseGain = ctx.createGain();
    pulseGain.gain.setValueAtTime(0.001, time);
    pulseGain.gain.linearRampToValueAtTime(0.09, time + 0.05);
    pulseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.45);

    const pFilter = ctx.createBiquadFilter();
    pFilter.type = 'lowpass';
    pFilter.frequency.setValueAtTime(220, time);

    pulseOsc.connect(pFilter);
    pFilter.connect(pulseGain);
    pulseGain.connect(ctx.destination);

    pulseOsc.start(time);
    pulseOsc.stop(time + 0.5);
  }

  // Atmosfera superior de suspense (Dó e Ré sustenido)
  const padOsc = ctx.createOscillator();
  padOsc.type = 'sine';
  padOsc.frequency.setValueAtTime(220, 0); // A3

  const padGain = ctx.createGain();
  padGain.gain.setValueAtTime(0.03, 0);

  padOsc.connect(padGain);
  padGain.connect(ctx.destination);
  padOsc.start(0);
  padOsc.stop(duration);
}

/**
 * 4. Tech Ambient: Arpejos sutis e modernos com harmônicos limpos
 */
function generateTechAmbientTrack(ctx: OfflineAudioContext, duration: number) {
  const notes = ['A3', 'C#4', 'E4', 'G#4', 'B4'];
  const stepTime = 0.5; // Batidas a cada 500ms
  const steps = Math.floor(duration / stepTime);

  for (let s = 0; s < steps; s++) {
    const time = s * stepTime;
    const note = notes[s % notes.length];
    const freq = noteToFreq(note);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.045, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.48);

    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      const panPos = Math.sin(s * 0.7) * 0.6; // Movimento estéreo ping-pong
      pan.pan.setValueAtTime(panPos, time);
    }

    if (pan) {
      osc.connect(gain);
      gain.connect(pan);
      pan.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start(time);
    osc.stop(time + 0.5);
  }

  // Fundo com pad contínuo em Lá
  const baseOsc = ctx.createOscillator();
  baseOsc.type = 'triangle';
  baseOsc.frequency.setValueAtTime(110, 0);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(280, 0);

  const baseGain = ctx.createGain();
  baseGain.gain.setValueAtTime(0.04, 0);

  baseOsc.connect(filter);
  filter.connect(baseGain);
  baseGain.connect(ctx.destination);
  baseOsc.start(0);
  baseOsc.stop(duration);
}

/**
 * Cria ruído rosa analógico filtrado para calor de fita
 */
function createAnalogTapeHiss(ctx: OfflineAudioContext, duration: number, gainLevel: number) {
  const bufferSize = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    output[i] = (b0 + b1 + b2) * 0.08;
  }

  const whiteNoise = ctx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;
  whiteNoise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200, 0);
  filter.Q.setValueAtTime(1.0, 0);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainLevel, 0);

  whiteNoise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  whiteNoise.start(0);
  whiteNoise.stop(duration);
}

/**
 * Aplica crossfade suave entre o final e o início do buffer para garantir loop estéreo 100% contínuo
 */
function applyLoopCrossfade(
  sourceBuffer: AudioBuffer,
  sampleRate: number,
  crossfadeSec: number = 1.5
): AudioBuffer {
  const crossfadeFrames = Math.floor(sampleRate * crossfadeSec);
  const totalFrames = sourceBuffer.length;
  const resultFrames = totalFrames - crossfadeFrames;

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const seamlessBuffer = audioCtx.createBuffer(
    sourceBuffer.numberOfChannels,
    resultFrames,
    sampleRate
  );

  for (let ch = 0; ch < sourceBuffer.numberOfChannels; ch++) {
    const src = sourceBuffer.getChannelData(ch);
    const dest = seamlessBuffer.getChannelData(ch);

    // Copia o corpo principal
    for (let i = 0; i < resultFrames; i++) {
      dest[i] = src[i];
    }

    // Mistura o final (últimos crossfadeFrames) com o início (primeiros crossfadeFrames)
    const tailOffset = totalFrames - crossfadeFrames;
    for (let i = 0; i < crossfadeFrames; i++) {
      const progress = i / crossfadeFrames;
      // Curva equal-power crossfade
      const gainOut = Math.cos(progress * 0.5 * Math.PI);
      const gainIn = Math.sin(progress * 0.5 * Math.PI);

      dest[i] = dest[i] * gainIn + src[tailOffset + i] * gainOut;
    }
  }

  return seamlessBuffer;
}

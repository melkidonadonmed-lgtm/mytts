/**
 * Monitor de Voz em Tempo Real (Web Audio API AnalyserNode + VAD / Detecção Automática de Silêncio).
 * Permite que o usuário fale naturalmente no modo Live e o turno seja enviado automaticamente
 * quando terminar de falar (~1.6s de silêncio após fala detectada), além de fornecer barras de onda.
 */

export interface LiveVoiceMonitorOptions {
  stream: MediaStream;
  /** Limiar RMS (0..1) considerado fala ativa. Padrão: 0.022 */
  speechThreshold?: number;
  /** Milissegundos de silêncio após fala ativa para encerrar turno automaticamente. Padrão: 1650ms */
  silenceDurationMs?: number;
  /** Callback de nível de áudio normalizado (0..100) e 5 bandas de frequência (0..100) */
  onLevelChange?: (level: number, bands: [number, number, number, number, number]) => void;
  /** Disparado automaticamente quando o usuário falou e fez uma pausa natural */
  onSilenceAfterSpeech?: () => void;
}

export interface LiveVoiceMonitorHandle {
  stop: () => void;
}

export function startLiveVoiceMonitor(options: LiveVoiceMonitorOptions): LiveVoiceMonitorHandle {
  const {
    stream,
    speechThreshold = 0.022,
    silenceDurationMs = 1650,
    onLevelChange,
    onSilenceAfterSpeech,
  } = options;

  let audioCtx: AudioContext | null = null;
  let rafId: number | null = null;
  let stopped = false;

  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    const timeData = new Float32Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    let hasSpoken = false;
    let speechFrames = 0;
    let lastSpeechTimestamp = performance.now();

    const tick = () => {
      if (stopped || !analyser) return;

      analyser.getFloatTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      let sumSquares = 0;
      for (let i = 0; i < timeData.length; i++) {
        sumSquares += timeData[i] * timeData[i];
      }
      const rms = Math.sqrt(sumSquares / timeData.length);
      const normalizedLevel = Math.min(100, Math.round(rms * 380));

      const binStep = Math.max(1, Math.floor(freqData.length / 8));
      const bands: [number, number, number, number, number] = [
        Math.min(100, Math.round((freqData[binStep * 1] / 255) * 100)),
        Math.min(100, Math.round((freqData[binStep * 2] / 255) * 100)),
        Math.min(100, Math.round((freqData[binStep * 3] / 255) * 100)),
        Math.min(100, Math.round((freqData[binStep * 4] / 255) * 100)),
        Math.min(100, Math.round((freqData[binStep * 5] / 255) * 100)),
      ];

      onLevelChange?.(normalizedLevel, bands);

      const now = performance.now();
      if (rms >= speechThreshold) {
        speechFrames += 1;
        lastSpeechTimestamp = now;
        if (speechFrames >= 6) {
          hasSpoken = true;
        }
      } else if (hasSpoken && now - lastSpeechTimestamp >= silenceDurationMs) {
        stopped = true;
        onSilenceAfterSpeech?.();
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  } catch {
    // Caso Web Audio API não esteja disponível no ambiente de teste, opera sem VAD automático
  }

  return {
    stop: () => {
      stopped = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    },
  };
}

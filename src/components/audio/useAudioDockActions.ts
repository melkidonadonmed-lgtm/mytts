import { useState, useRef, useEffect } from 'react';
import type { DebateScript, DebateTurn, LanguageCode, SpeakerProfile } from '../../types/debate';
import {
  getAudioContext,
  base64ToArrayBuffer,
  concatenateWavBuffers,
  type GaplessAudioPlayer,
  type SoundtrackConfig,
  type SoundtrackPreset,
} from '../../utils/audioEngine';
import { requestMixAudio, requestPreviewVoice } from '../../services/apiClient';
import { AUDIO_CONSTANTS } from '../../config/constants';
import { blobToBase64 } from './audioDockShared';

interface UseAudioDockActionsParams {
  player?: GaplessAudioPlayer;
  script?: DebateScript | null;
  currentSpeaker?: SpeakerProfile;
  currentTurn?: DebateTurn;
  voiceId: string;
  language: LanguageCode;
  soundtrackConfig: SoundtrackConfig;
  setIsExportingMaster: (val: boolean) => void;
}

export function useAudioDockActions({
  player,
  script,
  currentSpeaker,
  currentTurn,
  voiceId,
  language,
  soundtrackConfig,
  setIsExportingMaster,
}: UseAudioDockActionsParams) {
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSecondsLeft, setPreviewSecondsLeft] = useState(3);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPreview = (): void => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch {
        // Source already stopped
      }
      previewSourceRef.current = null;
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingPreview(false);
  };

  useEffect(() => () => stopPreview(), []);

  const handleSelectSoundtrack = async (presetId: SoundtrackPreset): Promise<void> => {
    if (presetId === 'custom') {
      fileInputRef.current?.click();
      return;
    }
    if (player) {
      await player.setSoundtrackPreset(presetId);
    }
  };

  const handleCustomAudioUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file || !player) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      await player.setSoundtrackPreset('custom', audioBuffer, file.name);
    } catch (err: unknown) {
      console.error('Falha ao decodificar arquivo customizado:', err);
    }
  };

  const handleExportMasterMix = async (): Promise<void> => {
    if (!player) return;
    try {
      setIsExportingMaster(true);
      const cleanTitle = (script?.title || 'debate').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const readyTurns = (script?.turns || []).filter((t) => Boolean(t.audioBase64));

      if (
        readyTurns.length > 0 &&
        soundtrackConfig.preset !== 'none' &&
        soundtrackConfig.preset !== 'custom'
      ) {
        try {
          setExportFeedback('Mixando Master Broadcast via FFmpeg Sidechain...');
          const concatenatedVoiceBlob = concatenateWavBuffers(
            readyTurns.map((t) => t.audioBase64!)
          );
          const voiceAudioBase64 = await blobToBase64(concatenatedVoiceBlob);
          const mixResp = await requestMixAudio({
            voiceAudioBase64,
            soundtrackPreset: soundtrackConfig.preset,
            musicVolume: soundtrackConfig.musicVolume,
            duckingDepthDb: soundtrackConfig.duckingEnabled ? soundtrackConfig.duckingDepthDb : 0,
            voiceBoostDb: soundtrackConfig.voiceBoostDb,
          });

          if (mixResp.ok && mixResp.success && mixResp.audioBase64 && !mixResp.warning) {
            const binary = window.atob(mixResp.audioBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const serverBlob = new Blob([bytes], { type: 'audio/wav' });
            const url = URL.createObjectURL(serverBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dialecticpod-${cleanTitle}-broadcast-${Date.now()}.wav`;
            a.click();
            URL.revokeObjectURL(url);
            setExportFeedback('Master Broadcast FFmpeg exportado com sucesso!');
            setTimeout(() => setExportFeedback(null), 3500);
            return;
          }
        } catch (serverErr: unknown) {
          console.warn('Fallback para OfflineAudioContext local:', serverErr);
        }
      }

      setExportFeedback('Renderizando Master com Web Audio Offline...');
      const blob = await player.exportMasterMixWav(script?.turns);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dialecticpod-${cleanTitle}-master-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      setExportFeedback('Master WAV exportado com sucesso!');
      setTimeout(() => setExportFeedback(null), 3500);
    } catch (err: unknown) {
      console.error('Erro na exportação:', err);
      setExportFeedback(err instanceof Error ? err.message : 'Erro ao exportar o master.');
      setTimeout(() => setExportFeedback(null), 4000);
    } finally {
      setIsExportingMaster(false);
    }
  };

  const handleTogglePreviewAudio = async (): Promise<void> => {
    if (isPlayingPreview) {
      stopPreview();
      return;
    }

    setPreviewLoading(true);
    setIsConfirmed(false);

    try {
      let audioBase64 = currentTurn?.audioBase64;
      if (!audioBase64) {
        const data = await requestPreviewVoice({
          voiceId,
          speakerName: currentSpeaker?.name || 'Orador',
          language: language || 'pt-BR',
        });
        if (data.ok && data.audioBase64) {
          audioBase64 = data.audioBase64;
        }
      }

      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (audioBase64) {
        const arrayBuf = base64ToArrayBuffer(audioBase64);
        const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
        stopPreview();

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(1.0, ctx.currentTime);
        gainNode.gain.setValueAtTime(1.0, ctx.currentTime + AUDIO_CONSTANTS.PREVIEW_FADE_START_SEC);
        gainNode.gain.linearRampToValueAtTime(
          0.001,
          ctx.currentTime + AUDIO_CONSTANTS.PREVIEW_DURATION_SEC
        );

        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        source.stop(ctx.currentTime + AUDIO_CONSTANTS.PREVIEW_DURATION_SEC);
        previewSourceRef.current = source;

        setIsPlayingPreview(true);
        setPreviewSecondsLeft(3);
        countdownIntervalRef.current = setInterval(() => {
          setPreviewSecondsLeft((prev) => {
            if (prev <= 1) {
              if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        previewTimerRef.current = setTimeout(() => {
          stopPreview();
          setIsConfirmed(true);
          setTimeout(() => setIsConfirmed(false), 2500);
        }, 3000);
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const sampleText = `${currentSpeaker?.name || 'Orador'}. Voz neural confirmada no estúdio.`;
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.lang = language || 'pt-BR';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);

        setIsPlayingPreview(true);
        setPreviewSecondsLeft(3);
        countdownIntervalRef.current = setInterval(() => {
          setPreviewSecondsLeft((prev) => Math.max(0, prev - 1));
        }, 1000);
        previewTimerRef.current = setTimeout(() => {
          stopPreview();
          setIsConfirmed(true);
          setTimeout(() => setIsConfirmed(false), 2500);
        }, 3000);
      }
    } catch (err: unknown) {
      console.warn('Erro na reprodução da amostra:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  return {
    fileInputRef,
    exportFeedback,
    isPlayingPreview,
    previewLoading,
    previewSecondsLeft,
    isConfirmed,
    handleSelectSoundtrack,
    handleCustomAudioUpload,
    handleExportMasterMix,
    handleTogglePreviewAudio,
  };
}

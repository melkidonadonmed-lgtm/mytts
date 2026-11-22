import { useState, useEffect, useMemo } from 'react';
import {
  ConversationFormat,
  DebateConfig,
  DebateScript,
  LanguageCode,
  SpeakerProfile,
} from '../types/debate';
import { LANGUAGE_OPTIONS, SAMPLE_DOCUMENTS, INITIAL_PRESET_SCRIPTS } from '../data/sampleDebates';
import { GaplessAudioPlayer } from '../utils/audioEngine';
import { speakBrowserFallback, stopBrowserSpeech } from '../utils/audio';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { requestDebateScript } from '../services/apiClient';
import { generateAudioCacheKey, synthesizeWithCache } from '../utils/audioCache';
import { saveDebateSessionFromScript } from '../services/sessionHistoryStorage';

interface UseDebateStudioParams {
  userId: string;
  selectedVoice: VoiceProfile;
  onSelectVoice: (voice: VoiceProfile) => void;
}

export function useDebateStudio({
  userId,
  selectedVoice,
  onSelectVoice,
}: UseDebateStudioParams) {
  const [documentText, setDocumentText] = useState<string>(SAMPLE_DOCUMENTS[0].content);
  const [config, setConfig] = useState<DebateConfig>({
    language: 'pt-BR',
    audienceLevel: 'intermediate',
    tensionIntensity: 'provocative',
    speakers: LANGUAGE_OPTIONS[0].defaultSpeakers,
    maxTurns: 6,
  });

  const [script, setScript] = useState<DebateScript>(INITIAL_PRESET_SCRIPTS['pt-BR']);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const player = useMemo(() => new GaplessAudioPlayer(), []);
  const [playerCurrentTurn, setPlayerCurrentTurn] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  useEffect(() => {
    const unsub = player.subscribe((state) => {
      setPlayerCurrentTurn(state.currentTurnIndex);
      setIsPlaying(state.isPlaying);
      setCurrentTime(state.currentTime);
      setDuration(state.duration);
      setPlaybackRate(state.playbackRate);
    });
    return () => unsub();
  }, [player]);

  useEffect(() => {
    if (!isPlaying) return;
    const turnVoiceId = script?.turns?.[playerCurrentTurn]?.voice_id;
    if (!turnVoiceId) return;
    const matched = GEMINI_VOICES.find((v) => v.id === turnVoiceId);
    if (matched && matched.id !== selectedVoice.id) {
      onSelectVoice(matched);
    }
  }, [playerCurrentTurn, isPlaying, script, selectedVoice.id, onSelectVoice]);

  const syncTurnsToPlayer = (updatedScript: DebateScript): void => {
    const readyTurns = updatedScript.turns
      .filter((t) => Boolean(t.audioBase64))
      .map((t) => ({
        turnNumber: t.turn,
        audioBase64: t.audioBase64!,
        preDelayMs: t.prosody.pre_delay_ms,
      }));

    if (readyTurns.length > 0) {
      player.setTurns(readyTurns);
    }
  };

  const synthesizeTurns = async (targetScript: DebateScript): Promise<void> => {
    setIsSynthesizing(true);
    setGlobalError(null);

    const updatedTurns = [...targetScript.turns];
    const CONCURRENCY = 2;

    for (let batchStart = 0; batchStart < targetScript.turns.length; batchStart += CONCURRENCY) {
      const batchIndices = Array.from(
        { length: Math.min(CONCURRENCY, targetScript.turns.length - batchStart) },
        (_, offset) => batchStart + offset
      );

      await Promise.all(
        batchIndices.map(async (i) => {
          const turn = targetScript.turns[i];
          try {
            const cacheKey = generateAudioCacheKey({
              type: 'turn',
              text: turn.text || turn.clean_text || '',
              language: targetScript.language,
              voiceId: turn.voice_id,
              speed: turn.prosody?.speech_rate || 1.0,
              emotion: turn.emotion || 'thoughtful',
            });

            const cachedOrFresh = await synthesizeWithCache({
              endpoint: '/api/synthesize-turn',
              body: {
                turn,
                speakerName: turn.speaker,
                voiceId: turn.voice_id,
                language: targetScript.language,
              },
              cacheKey,
              metadata: {
                language: targetScript.language,
                voiceId: turn.voice_id,
                speed: turn.prosody?.speech_rate || 1.0,
                emotion: turn.emotion || 'thoughtful',
              },
            });

            updatedTurns[i] = {
              ...turn,
              audioBase64: cachedOrFresh.audioBase64,
              audioDurationSec: cachedOrFresh.durationSec,
              audioStatus: 'ready',
            };
          } catch (e: unknown) {
            console.warn(`Turn ${turn.turn} synthesis error:`, e);
            updatedTurns[i] = {
              ...turn,
              audioStatus: 'error',
              errorMessage: e instanceof Error ? e.message : 'Erro na síntese do turno.',
            };
          }
        })
      );

      const intermediateScript = { ...targetScript, turns: [...updatedTurns] };
      setScript(intermediateScript);
      syncTurnsToPlayer(intermediateScript);
    }

    setIsSynthesizing(false);
  };

  const handleGenerateDebateWithCustomSpeakers = async (
    customSpeakers: [SpeakerProfile, SpeakerProfile] = config.speakers,
    tensionIntensity: 'friendly' | 'balanced' | 'provocative' | 'reflective' = config.tensionIntensity,
    format: ConversationFormat = config.format || 'debate',
    language: LanguageCode = config.language
  ): Promise<void> => {
    setIsGenerating(true);
    setGlobalError(null);
    try {
      const data = await requestDebateScript({
        documentText,
        language,
        audienceLevel: config.audienceLevel,
        tensionIntensity,
        format,
        speakers: customSpeakers,
        maxTurns: config.maxTurns,
      });

      if (!data.ok || !data.success || !data.script) {
        throw new Error(data.error || 'Falha na geração do roteiro.');
      }

      setScript(data.script);
      saveDebateSessionFromScript(data.script, { format, documentText, userId });
      await synthesizeTurns(data.script);
    } catch (err: unknown) {
      console.error(err);
      setGlobalError(err instanceof Error ? err.message : 'Erro ao gerar o debate dialético.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSynthesizeSingleTurn = async (turnIndex: number): Promise<void> => {
    const turn = script.turns[turnIndex];
    try {
      const cacheKey = generateAudioCacheKey({
        type: 'turn',
        text: turn.text || turn.clean_text || '',
        language: script.language,
        voiceId: turn.voice_id,
        speed: turn.prosody?.speech_rate || 1.0,
        emotion: turn.emotion || 'thoughtful',
      });

      const cachedOrFresh = await synthesizeWithCache({
        endpoint: '/api/synthesize-turn',
        body: {
          turn,
          speakerName: turn.speaker,
          voiceId: turn.voice_id,
          language: script.language,
        },
        cacheKey,
        bypassCache: true,
        metadata: {
          language: script.language,
          voiceId: turn.voice_id,
          speed: turn.prosody?.speech_rate || 1.0,
          emotion: turn.emotion || 'thoughtful',
        },
      });

      const updatedTurns = [...script.turns];
      updatedTurns[turnIndex] = {
        ...turn,
        audioBase64: cachedOrFresh.audioBase64,
        audioDurationSec: cachedOrFresh.durationSec,
        audioStatus: 'ready',
      };
      const updatedScript = { ...script, turns: updatedTurns };
      setScript(updatedScript);
      syncTurnsToPlayer(updatedScript);
    } catch (e: unknown) {
      setGlobalError(e instanceof Error ? e.message : 'Erro ao sintetizar áudio do turno.');
      speakBrowserFallback(turn.clean_text || turn.text, {
        lang: script.language || 'pt-BR',
        rate: turn.prosody?.speech_rate || 1.0,
        voiceId: turn.voice_id,
      });
    }
  };

  const handlePlayDebateTurn = async (
    turnIndex: number,
    overrideVoiceId?: string
  ): Promise<void> => {
    const rawTurn = script.turns[turnIndex];
    if (!rawTurn) return;
    const turn = overrideVoiceId
      ? { ...rawTurn, voice_id: overrideVoiceId, audioBase64: undefined }
      : rawTurn;
    stopBrowserSpeech();
    setPlayerCurrentTurn(turnIndex);

    if (turn.audioBase64) {
      const readyTurns = script.turns.filter((t) => Boolean(t.audioBase64));
      const readyIdx = readyTurns.findIndex((t) => t.turn === turn.turn);
      await player.play(readyIdx >= 0 ? readyIdx : 0);
      return;
    }

    try {
      const cacheKey = generateAudioCacheKey({
        type: 'turn',
        text: turn.text || turn.clean_text || '',
        language: script.language,
        voiceId: turn.voice_id,
        speed: turn.prosody?.speech_rate || 1.0,
        emotion: turn.emotion || 'thoughtful',
      });

      const cachedOrFresh = await synthesizeWithCache({
        endpoint: '/api/synthesize-turn',
        body: {
          turn,
          speakerName: turn.speaker,
          voiceId: turn.voice_id,
          language: script.language,
        },
        cacheKey,
        metadata: {
          language: script.language,
          voiceId: turn.voice_id,
          speed: turn.prosody?.speech_rate || 1.0,
          emotion: turn.emotion || 'thoughtful',
        },
      });

      const updatedTurns = [...script.turns];
      updatedTurns[turnIndex] = {
        ...turn,
        audioBase64: cachedOrFresh.audioBase64,
        audioDurationSec: cachedOrFresh.durationSec,
        audioStatus: 'ready',
      };
      const updatedScript = { ...script, turns: updatedTurns };
      setScript(updatedScript);
      syncTurnsToPlayer(updatedScript);

      const readyTurns = updatedTurns.filter((t) => Boolean(t.audioBase64));
      const readyIdx = readyTurns.findIndex((t) => t.turn === turn.turn);
      await player.play(readyIdx >= 0 ? readyIdx : 0);
    } catch (e: unknown) {
      setGlobalError(
        e instanceof Error
          ? e.message
          : 'Erro ao sintetizar turno (usando voz local do navegador).'
      );
      speakBrowserFallback(turn.clean_text || turn.text, {
        lang: script.language || 'pt-BR',
        rate: turn.prosody?.speech_rate || 1.0,
        voiceId: turn.voice_id,
      });
    }
  };

  const handleUpdateTurnText = (turnIndex: number, newText: string): void => {
    const updatedTurns = [...script.turns];
    updatedTurns[turnIndex] = {
      ...updatedTurns[turnIndex],
      text: newText,
      clean_text: newText.replace(/<[^>]+>/g, '').replace(/\|[^|]+\|/g, '').trim(),
      audioBase64: undefined,
      audioStatus: 'idle',
    };
    setScript({ ...script, turns: updatedTurns });
  };

  const handleUpdateTurnVoice = (turnIndex: number, newVoiceId: string): void => {
    const updatedTurns = [...script.turns];
    updatedTurns[turnIndex] = {
      ...updatedTurns[turnIndex],
      voice_id: newVoiceId,
      audioBase64: undefined,
      audioStatus: 'idle',
    };
    setScript({ ...script, turns: updatedTurns });

    const matchedVoice = GEMINI_VOICES.find((v) => v.id === newVoiceId);
    if (matchedVoice) {
      onSelectVoice(matchedVoice);
    }
    void handlePlayDebateTurn(turnIndex, newVoiceId);
  };

  const handleUpdateDebateConfig = (nextConfig: DebateConfig): void => {
    setConfig(nextConfig);
    setScript((prev) => {
      if (!prev || !prev.turns) return prev;
      const oldSpk0Name = prev.speakers[0]?.name;
      const oldSpk1Name = prev.speakers[1]?.name;
      const nextSpeakers: [SpeakerProfile, SpeakerProfile] = [
        {
          ...(prev.speakers[0] || nextConfig.speakers[0]),
          name: nextConfig.speakers[0].name,
          voiceId: nextConfig.speakers[0].voiceId,
          roleTitle: nextConfig.speakers[0].roleTitle,
        },
        {
          ...(prev.speakers[1] || nextConfig.speakers[1]),
          name: nextConfig.speakers[1].name,
          voiceId: nextConfig.speakers[1].voiceId,
          roleTitle: nextConfig.speakers[1].roleTitle,
        },
      ];
      const updatedTurns = prev.turns.map((t, idx) => {
        const isSpeaker0 =
          t.speaker === oldSpk0Name || (t.speaker !== oldSpk1Name && idx % 2 === 0);
        const targetSpk = isSpeaker0 ? nextSpeakers[0] : nextSpeakers[1];
        const voiceChanged = t.voice_id !== targetSpk.voiceId;
        return {
          ...t,
          speaker: targetSpk.name,
          voice_id: targetSpk.voiceId,
          audioBase64: voiceChanged ? undefined : t.audioBase64,
          audioStatus: voiceChanged ? ('idle' as const) : t.audioStatus,
        };
      });
      return {
        ...prev,
        language: nextConfig.language,
        speakers: nextSpeakers,
        turns: updatedTurns,
      };
    });
  };

  const activeTurn = script?.turns[playerCurrentTurn];
  const activeSpeaker = activeTurn
    ? script?.speakers.find((s) => s.name === activeTurn.speaker) || script?.speakers[0]
    : script?.speakers[0];

  return {
    documentText,
    setDocumentText,
    config,
    setConfig,
    script,
    setScript,
    isGenerating,
    isSynthesizing,
    globalError,
    setGlobalError,
    player,
    playerCurrentTurn,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    activeTurn,
    activeSpeaker,
    handleGenerateDebateWithCustomSpeakers,
    handleSynthesizeSingleTurn,
    handlePlayDebateTurn,
    handleUpdateTurnText,
    handleUpdateTurnVoice,
    handleUpdateDebateConfig,
  };
}

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PolyglotMessage } from '../../types/polyglot';
import type { VoiceProfile } from '../../types/voices';
import {
  base64ToBlobUrl,
  revokeAudioUrl,
  speakBrowserFallback,
  stopBrowserSpeech,
} from '../../utils/audio';
import { concatenateWavBuffers } from '../../utils/audioEngine';
import {
  generateAudioCacheKey,
  synthesizeWithCache,
  getCachedKeySet,
} from '../../utils/audioCache';
import { getLanguageTag, LangKey } from './polyglotConstants';

const CANONICAL_TTS_SYNTHESIS_SPEED = 1.0;

export interface UsePolyglotAudioOptions {
  messages: PolyglotMessage[];
  focusedMessageId: string;
  globalVoice?: VoiceProfile;
  setFocusedMessageId: React.Dispatch<React.SetStateAction<string>>;
  setSelectedLanguageByMsg: React.Dispatch<React.SetStateAction<Record<string, LangKey>>>;
  getCardVoicesForMessage: (messageId: string) => Record<LangKey, string>;
  syncVoiceToGlobal: (voiceId: string) => void;
  showToast: (msg: string) => void;
}

export function usePolyglotAudio({
  messages,
  focusedMessageId,
  globalVoice,
  setFocusedMessageId,
  setSelectedLanguageByMsg,
  getCardVoicesForMessage,
  syncVoiceToGlobal,
  showToast,
}: UsePolyglotAudioOptions) {
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [playingBlockInfo, setPlayingBlockInfo] = useState<{
    messageId: string;
    lang: LangKey;
  } | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [sequenceStep, setSequenceStep] = useState<string | null>(null);
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [cachedKeysSet, setCachedKeysSet] = useState<Set<string>>(new Set());

  const sequenceAbortRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const playRequestIdRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const activeAudioRef = useRef<{
    audio: HTMLAudioElement;
    blobUrl: string;
    messageId: string;
    lang: LangKey;
  } | null>(null);

  const stopCurrentAudio = useCallback((): void => {
    playRequestIdRef.current += 1;
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.audio.pause();
      revokeAudioUrl(activeAudioRef.current.blobUrl);
      activeAudioRef.current = null;
    }
    stopBrowserSpeech();
    setIsPlayingAudio(false);
    setIsLoadingAudio(false);
    setPlayingBlockInfo(null);
    setPlayingAudioKey(null);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      sequenceAbortRef.current = true;
      stopCurrentAudio();
    };
  }, [stopCurrentAudio]);

  const getMessageAudioCacheKey = useCallback(
    (messageId: string, lang: LangKey) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || !msg.fullText[lang]) return '';
      const voices = getCardVoicesForMessage(messageId);
      return generateAudioCacheKey({
        type: 'speech',
        text: msg.fullText[lang],
        voiceId: voices[lang],
        language: getLanguageTag(lang),
        speed: CANONICAL_TTS_SYNTHESIS_SPEED,
        emotion: 'natural',
      });
    },
    [messages, getCardVoicesForMessage]
  );

  useEffect(() => {
    let isSubscribed = true;
    const allKeys: string[] = [];
    messages.forEach((msg) => {
      const voices = getCardVoicesForMessage(msg.id);
      (['en', 'it', 'ja'] as const).forEach((lang) => {
        if (msg.fullText[lang]) {
          allKeys.push(
            generateAudioCacheKey({
              type: 'speech',
              text: msg.fullText[lang],
              voiceId: voices[lang],
              language: getLanguageTag(lang),
              speed: CANONICAL_TTS_SYNTHESIS_SPEED,
              emotion: 'natural',
            })
          );
        }
      });
    });

    if (allKeys.length > 0) {
      getCachedKeySet(allKeys).then((cached) => {
        if (isSubscribed) setCachedKeysSet(cached);
      });
    }

    return () => {
      isSubscribed = false;
    };
  }, [messages, getCardVoicesForMessage]);

  const handleSelectLanguage = (messageId: string, lang: LangKey): void => {
    setFocusedMessageId(messageId);
    setSelectedLanguageByMsg((prev) => ({ ...prev, [messageId]: lang }));
    const voices = getCardVoicesForMessage(messageId);
    syncVoiceToGlobal(voices[lang]);

    if (
      activeAudioRef.current &&
      activeAudioRef.current.messageId === messageId &&
      activeAudioRef.current.lang !== lang
    ) {
      stopCurrentAudio();
    }
  };

  const handleTogglePlay = async (
    messageId: string,
    lang: LangKey,
    overrideMsg?: PolyglotMessage,
    overrideVoiceId?: string
  ): Promise<void> => {
    setFocusedMessageId(messageId);
    setSelectedLanguageByMsg((prev) => ({ ...prev, [messageId]: lang }));
    const voices = getCardVoicesForMessage(messageId);
    const cardVoiceId = overrideVoiceId || voices[lang];
    syncVoiceToGlobal(cardVoiceId);

    if (
      !overrideVoiceId &&
      activeAudioRef.current &&
      activeAudioRef.current.messageId === messageId &&
      activeAudioRef.current.lang === lang
    ) {
      if (isPlayingAudio) {
        activeAudioRef.current.audio.pause();
        setIsPlayingAudio(false);
      } else {
        await activeAudioRef.current.audio.play();
        setIsPlayingAudio(true);
      }
      return;
    }

    if (
      !overrideVoiceId &&
      isPlayingAudio &&
      playingBlockInfo?.messageId === messageId &&
      playingBlockInfo?.lang === lang
    ) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    const targetMsg = overrideMsg || messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.fullText[lang]) return;

    const cacheKey = generateAudioCacheKey({
      type: 'speech',
      text: targetMsg.fullText[lang],
      voiceId: cardVoiceId,
      language: getLanguageTag(lang),
      speed: CANONICAL_TTS_SYNTHESIS_SPEED,
      emotion: 'natural',
    });

    const requestId = ++playRequestIdRef.current;
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    if (!cachedKeysSet.has(cacheKey)) {
      setIsLoadingAudio(true);
    }
    setPlayingBlockInfo({ messageId, lang });

    try {
      const data = await synthesizeWithCache({
        endpoint: '/api/synthesize-speech',
        body: {
          text: targetMsg.fullText[lang],
          voiceId: cardVoiceId,
          language: getLanguageTag(lang),
          speed: CANONICAL_TTS_SYNTHESIS_SPEED,
          emotion: 'natural',
        },
        cacheKey,
        signal: controller.signal,
        metadata: {
          language: getLanguageTag(lang),
          voiceId: cardVoiceId,
          speed: CANONICAL_TTS_SYNTHESIS_SPEED,
          emotion: 'natural',
        },
      });

      if (!isMountedRef.current || requestId !== playRequestIdRef.current) {
        return;
      }

      setCachedKeysSet((prev) => new Set(prev).add(cacheKey));
      const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');

      if (!isMountedRef.current || requestId !== playRequestIdRef.current) {
        revokeAudioUrl(blobUrl);
        return;
      }

      const audio = new Audio(blobUrl);
      audio.preservesPitch = true;
      audio.playbackRate = playbackSpeed;

      audio.onloadedmetadata = () => setDuration(audio.duration || data.durationSec || 0);
      audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
      audio.onended = () => {
        setIsPlayingAudio(false);
        setCurrentTime(0);
      };
      audio.onerror = () => stopCurrentAudio();

      activeAudioRef.current = { audio, blobUrl, messageId, lang };
      await audio.play();
      if (isMountedRef.current && requestId === playRequestIdRef.current) {
        setIsPlayingAudio(true);
      }
    } catch (e: unknown) {
      if (
        (e instanceof Error && e.name === 'AbortError') ||
        requestId !== playRequestIdRef.current
      ) {
        return;
      }
      console.warn('Erro na síntese neural do card (acionando fallback Web Speech):', e);
      const fallbackStarted = speakBrowserFallback(targetMsg.fullText[lang], {
        lang: getLanguageTag(lang),
        rate: playbackSpeed,
        voiceId: cardVoiceId,
        onStart: () => setIsPlayingAudio(true),
        onEnd: () => {
          setIsPlayingAudio(false);
          setPlayingBlockInfo(null);
          setCurrentTime(0);
        },
        onError: () => stopCurrentAudio(),
      });
      if (fallbackStarted) {
        setIsPlayingAudio(true);
        showToast(`Reproduzindo com a voz ${cardVoiceId} (${lang.toUpperCase()}).`);
      } else {
        stopCurrentAudio();
        showToast(e instanceof Error ? e.message : 'Falha ao sintetizar áudio do card.');
      }
    } finally {
      if (activeAbortControllerRef.current === controller) {
        activeAbortControllerRef.current = null;
      }
      if (isMountedRef.current && requestId === playRequestIdRef.current) {
        setIsLoadingAudio(false);
      }
    }
  };

  const handleDownloadCardWav = async (messageId: string, lang: LangKey): Promise<void> => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.fullText[lang]) return;
    const cardVoiceId = getCardVoicesForMessage(messageId)[lang];

    const cacheKey = generateAudioCacheKey({
      type: 'speech',
      text: targetMsg.fullText[lang],
      voiceId: cardVoiceId,
      language: getLanguageTag(lang),
      speed: CANONICAL_TTS_SYNTHESIS_SPEED,
      emotion: 'natural',
    });

    try {
      showToast(`Preparando WAV 24kHz (${lang.toUpperCase()} · ${cardVoiceId})...`);
      const data = await synthesizeWithCache({
        endpoint: '/api/synthesize-speech',
        body: {
          text: targetMsg.fullText[lang],
          voiceId: cardVoiceId,
          language: getLanguageTag(lang),
          speed: CANONICAL_TTS_SYNTHESIS_SPEED,
          emotion: 'natural',
        },
        cacheKey,
        metadata: {
          language: getLanguageTag(lang),
          voiceId: cardVoiceId,
          speed: CANONICAL_TTS_SYNTHESIS_SPEED,
          emotion: 'natural',
        },
      });

      setCachedKeysSet((prev) => new Set(prev).add(cacheKey));
      const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `mytts-card-${lang}-${cardVoiceId.toLowerCase()}-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => revokeAudioUrl(blobUrl), 2000);
      showToast(`Áudio WAV (${lang.toUpperCase()} · ${cardVoiceId}) baixado com sucesso!`);
    } catch (e: unknown) {
      console.warn('Falha ao baixar WAV do card:', e);
      showToast('Erro ao gerar WAV do card.');
    }
  };

  const handleExportTrilogyWav = async (message: PolyglotMessage): Promise<void> => {
    const voices = getCardVoicesForMessage(message.id);
    const langs: Array<LangKey> = ['en', 'it', 'ja'];
    const base64List: string[] = [];

    for (const lang of langs) {
      const text = message.fullText[lang];
      if (!text) continue;
      const voiceId = voices[lang];
      const cacheKey = generateAudioCacheKey({
        type: 'speech',
        text,
        voiceId,
        language: getLanguageTag(lang),
        speed: CANONICAL_TTS_SYNTHESIS_SPEED,
        emotion: 'natural',
      });

      const data = await synthesizeWithCache({
        endpoint: '/api/synthesize-speech',
        body: {
          text,
          voiceId,
          language: getLanguageTag(lang),
          speed: CANONICAL_TTS_SYNTHESIS_SPEED,
          emotion: 'natural',
        },
        cacheKey,
        metadata: {
          language: getLanguageTag(lang),
          voiceId,
          speed: CANONICAL_TTS_SYNTHESIS_SPEED,
          emotion: 'natural',
        },
      });
      base64List.push(data.audioBase64);
    }

    if (base64List.length === 0) return;
    const combinedWavBlob = concatenateWavBuffers(base64List);
    const url = URL.createObjectURL(combinedWavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mytts-trilogia-en-it-ja-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(`Master WAV da Trilogia (${voices.en} → ${voices.it} → ${voices.ja}) exportado!`);
  };

  const handleReplay = (messageId: string, lang: LangKey): void => {
    if (
      activeAudioRef.current &&
      activeAudioRef.current.messageId === messageId &&
      activeAudioRef.current.lang === lang
    ) {
      activeAudioRef.current.audio.currentTime = 0;
      setCurrentTime(0);
      void activeAudioRef.current.audio.play();
      setIsPlayingAudio(true);
    } else {
      void handleTogglePlay(messageId, lang);
    }
  };

  const handleSeek = (time: number): void => {
    if (activeAudioRef.current) {
      activeAudioRef.current.audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleChangeSpeed = (newSpeed: number): void => {
    setPlaybackSpeed(newSpeed);
    if (activeAudioRef.current) {
      activeAudioRef.current.audio.playbackRate = newSpeed;
    }
  };

  const waitForAudioEnd = useCallback((isStopped: () => boolean): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      let pollId: ReturnType<typeof setInterval> | null = null;
      let gapTimeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = (): void => {
        if (pollId !== null) {
          clearInterval(pollId);
          pollId = null;
        }
        if (gapTimeoutId !== null) {
          clearTimeout(gapTimeoutId);
          gapTimeoutId = null;
        }
      };

      const settle = (error?: unknown): void => {
        cleanup();
        if (error === undefined) resolve();
        else reject(error);
      };

      pollId = setInterval(() => {
        try {
          if (isStopped()) {
            settle();
            return;
          }
          const isBrowserSpeaking =
            typeof window !== 'undefined' &&
            'speechSynthesis' in window &&
            window.speechSynthesis.speaking;
          if (!activeAudioRef.current && !isBrowserSpeaking) {
            cleanup();
            gapTimeoutId = setTimeout(() => {
              gapTimeoutId = null;
              settle();
            }, 600);
            return;
          }
          if (activeAudioRef.current && activeAudioRef.current.audio.ended) {
            cleanup();
            gapTimeoutId = setTimeout(() => {
              gapTimeoutId = null;
              settle();
            }, 800);
          }
        } catch (e: unknown) {
          settle(e);
        }
      }, 100);
    });
  }, []);

  const handlePlaySequence = async (messageId: string): Promise<void> => {
    if (isPlayingSequence) {
      sequenceAbortRef.current = true;
      setIsPlayingSequence(false);
      setSequenceStep(null);
      stopCurrentAudio();
      return;
    }

    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg) return;

    sequenceAbortRef.current = false;
    setIsPlayingSequence(true);

    const languages: Array<LangKey> = ['en', 'it', 'ja'];
    const stepNames: Record<LangKey, string> = {
      en: 'EN · Inglês',
      it: 'IT · Italiano',
      ja: 'JA · Japonês',
    };
    const isStopped = (): boolean => sequenceAbortRef.current || !isMountedRef.current;

    try {
      for (const lang of languages) {
        if (isStopped()) break;
        setSelectedLanguageByMsg((prev) => ({ ...prev, [messageId]: lang }));
        setSequenceStep(stepNames[lang]);
        try {
          await handleTogglePlay(messageId, lang);
          await waitForAudioEnd(isStopped);
        } catch (e: unknown) {
          console.warn('Erro em uma etapa da trilogia sequencial:', e);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsPlayingSequence(false);
        setSequenceStep(null);
      }
    }
  };

  const handlePlayChunkAudio = async (
    text: string,
    language: string,
    voiceId?: string
  ): Promise<void> => {
    stopCurrentAudio();
    setPlayingAudioKey(text);

    const langKey: LangKey = language.startsWith('it')
      ? 'it'
      : language.startsWith('ja')
      ? 'ja'
      : 'en';
    const resolvedVoiceId =
      voiceId || getCardVoicesForMessage(focusedMessageId)[langKey] || globalVoice?.id || 'Puck';

    const cacheKey = generateAudioCacheKey({
      type: 'chunk',
      text,
      language,
      voiceId: resolvedVoiceId,
    });

    const requestId = ++playRequestIdRef.current;
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    try {
      const data = await synthesizeWithCache({
        endpoint: '/api/synthesize-chunk',
        body: { text, language, voiceId: resolvedVoiceId },
        cacheKey,
        signal: controller.signal,
        metadata: { language, voiceId: resolvedVoiceId },
      });

      if (!isMountedRef.current || requestId !== playRequestIdRef.current) {
        return;
      }

      if (data.audioBase64) {
        const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
        if (!isMountedRef.current || requestId !== playRequestIdRef.current) {
          revokeAudioUrl(blobUrl);
          return;
        }
        const audio = new Audio(blobUrl);
        audio.preservesPitch = true;
        audio.playbackRate = playbackSpeed;
        activeAudioRef.current = { audio, blobUrl, messageId: 'chunk', lang: langKey };
        audio.onended = () => stopCurrentAudio();
        audio.onerror = () => stopCurrentAudio();
        await audio.play();
      } else {
        throw new Error('Falha ao reproduzir áudio do chunk.');
      }
    } catch (e: unknown) {
      if (
        (e instanceof Error && e.name === 'AbortError') ||
        requestId !== playRequestIdRef.current
      ) {
        return;
      }
      console.warn('Erro ao tocar áudio do chunk (acionando fallback Web Speech):', e);
      const fallbackStarted = speakBrowserFallback(text, {
        lang: language,
        rate: playbackSpeed,
        voiceId: resolvedVoiceId,
        onEnd: () => stopCurrentAudio(),
        onError: () => stopCurrentAudio(),
      });
      if (!fallbackStarted) {
        stopCurrentAudio();
        showToast(e instanceof Error ? e.message : 'Falha ao reproduzir pronúncia do chunk.');
      }
    } finally {
      if (activeAbortControllerRef.current === controller) {
        activeAbortControllerRef.current = null;
      }
    }
  };

  return {
    playbackSpeed,
    playingBlockInfo,
    isPlayingAudio,
    isLoadingAudio,
    currentTime,
    duration,
    isPlayingSequence,
    sequenceStep,
    playingAudioKey,
    cachedKeysSet,
    getMessageAudioCacheKey,
    stopCurrentAudio,
    handleSelectLanguage,
    handleTogglePlay,
    handleDownloadCardWav,
    handleExportTrilogyWav,
    handleReplay,
    handleSeek,
    handleChangeSpeed,
    handlePlaySequence,
    handlePlayChunkAudio,
  };
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PolyglotMessage, FlashcardItem } from '../types/polyglot';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { ParallelMessageBlock } from './ParallelMessageBlock';
import { AgentInputDock } from './AgentInputDock';
import { FlashcardDeckDrawer } from './FlashcardDeckDrawer';
import { ExportInteractionModal } from './ExportInteractionModal';
import { GoogleIcon } from './GoogleIcon';
import { base64ToBlobUrl, revokeAudioUrl } from '../utils/audio';
import { concatenateWavBuffers } from '../utils/audioEngine';
import {
  generateAudioCacheKey,
  synthesizeWithCache,
  getCachedAudio,
  getCachedKeySet,
} from '../utils/audioCache';
import {
  requestTranslateParallelChunks,
  requestGenerateFlashcard,
  persistBrowserState,
  readBrowserState,
  readFavoriteVoicesByLanguage,
  saveFavoriteVoicesByLanguage,
} from '../services/polyglotClient';

const INITIAL_DEMO_MESSAGE: PolyglotMessage = {
  id: 'msg-demo-1',
  userPrompt: 'Gostaria de pedir um café expresso e a conta com gentileza.',
  timestamp: Date.now() - 60000,
  chunks: [
    {
      id: 0,
      en: 'Could I please get an espresso,',
      it: 'Potrei avere un caffè espresso, per favore,',
      ja: 'エスプレッソを一杯お願いします、',
      jaPronunciation: 'Esupuresso o ippai onegai shimasu,',
    },
    {
      id: 1,
      en: 'and the check whenever you are ready?',
      it: 'e il conto quando è pronto?',
      ja: 'そしてお会計もお願いできますか？',
      jaPronunciation: 'soshite okaikei mo onegai dekimasu ka?',
    },
  ],
  fullText: {
    en: 'Could I please get an espresso, and the check whenever you are ready?',
    it: 'Potrei avere un caffè espresso, per favore, e il conto quando è pronto?',
    ja: 'エスプレッソを一杯お願いします、そしてお会計もお願いできますか？',
  },
  cardVoices: {
    en: 'Puck',
    it: 'Kore',
    ja: 'Aoede',
  },
  status: 'ready',
};

export interface PolyglotChatStudioProps {
  globalVoice?: VoiceProfile;
  onSyncGlobalVoice?: (voice: VoiceProfile) => void;
}

export const PolyglotChatStudio: React.FC<PolyglotChatStudioProps> = ({
  globalVoice,
  onSyncGlobalVoice,
}) => {
  const [messages, setMessages] = useState<PolyglotMessage[]>([INITIAL_DEMO_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [deck, setDeck] = useState<FlashcardItem[]>(() => {
    try {
      const saved = readBrowserState('mytts_polyglot_deck');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isDeckDrawerOpen, setIsDeckDrawerOpen] = useState(false);
  const [exportingMessage, setExportingMessage] = useState<PolyglotMessage | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mensagem ativa e idioma focado por mensagem
  const [focusedMessageId, setFocusedMessageId] = useState<string>('msg-demo-1');
  const [selectedLanguageByMsg, setSelectedLanguageByMsg] = useState<Record<string, 'en' | 'it' | 'ja'>>({
    'msg-demo-1': 'en',
  });

  // Perfis favoritos de vozes por idioma salvos no navegador + Voz individual por Card (messageId -> { en, it, ja })
  const [defaultVoiceByLang, setDefaultVoiceByLang] = useState<Record<'en' | 'it' | 'ja', string>>(
    () => readFavoriteVoicesByLanguage()
  );
  const [cardVoicesByMsg, setCardVoicesByMsg] = useState<
    Record<string, Record<'en' | 'it' | 'ja', string>>
  >(() => ({
    'msg-demo-1': readFavoriteVoicesByLanguage(),
  }));

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  const [playingBlockInfo, setPlayingBlockInfo] = useState<{
    messageId: string;
    lang: 'en' | 'it' | 'ja';
  } | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [sequenceStep, setSequenceStep] = useState<string | null>(null);
  const sequenceAbortRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [generatingCardKey, setGeneratingCardKey] = useState<string | null>(null);

  const activeAudioRef = useRef<{
    audio: HTMLAudioElement;
    blobUrl: string;
    messageId: string;
    lang: 'en' | 'it' | 'ja';
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastSyncedVoiceIdRef = useRef<string>(globalVoice?.id || 'Puck');

  const syncVoiceToGlobal = useCallback(
    (voiceId: string) => {
      lastSyncedVoiceIdRef.current = voiceId;
      if (onSyncGlobalVoice) {
        const found = GEMINI_VOICES.find((v) => v.id === voiceId || v.name === voiceId);
        if (found) {
          onSyncGlobalVoice(found);
        }
      }
    },
    [onSyncGlobalVoice]
  );

  // Se a voz global mudar externamente (ex: Ctrl+K ou Biblioteca de Vozes), atualiza o card focado atual
  useEffect(() => {
    if (!globalVoice || globalVoice.id === lastSyncedVoiceIdRef.current) return;
    lastSyncedVoiceIdRef.current = globalVoice.id;
    const activeLang = selectedLanguageByMsg[focusedMessageId] || 'en';
    setCardVoicesByMsg((prev) => ({
      ...prev,
      [focusedMessageId]: {
        ...(prev[focusedMessageId] || defaultVoiceByLang),
        [activeLang]: globalVoice.id,
      },
    }));
    setDefaultVoiceByLang((prev) => ({ ...prev, [activeLang]: globalVoice.id }));
  }, [globalVoice, focusedMessageId, selectedLanguageByMsg, defaultVoiceByLang]);

  useEffect(() => {
    persistBrowserState('mytts_polyglot_deck', JSON.stringify(deck));
  }, [deck]);

  // Persiste automaticamente os perfis favoritos de vozes por idioma no navegador
  useEffect(() => {
    saveFavoriteVoicesByLanguage(defaultVoiceByLang);
  }, [defaultVoiceByLang]);

  const getLanguageTag = (code: string): string => {
    if (code === 'it') return 'it-IT';
    if (code === 'ja') return 'ja-JP';
    return 'en-US';
  };

  const getCardVoicesForMessage = useCallback(
    (messageId: string): Record<'en' | 'it' | 'ja', string> => {
      return cardVoicesByMsg[messageId] || defaultVoiceByLang;
    },
    [cardVoicesByMsg, defaultVoiceByLang]
  );

  const [cachedKeysSet, setCachedKeysSet] = useState<Set<string>>(new Set());

  const getMessageAudioCacheKey = useCallback(
    (messageId: string, lang: 'en' | 'it' | 'ja') => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || !msg.fullText[lang]) return '';
      const voices = getCardVoicesForMessage(messageId);
      return generateAudioCacheKey({
        type: 'speech',
        text: msg.fullText[lang],
        voiceId: voices[lang],
        language: getLanguageTag(lang),
        speed: playbackSpeed,
        emotion: 'natural',
      });
    },
    [messages, getCardVoicesForMessage, playbackSpeed]
  );

  useEffect(() => {
    let isSubscribed = true;
    const allKeys: string[] = [];
    messages.forEach((msg) => {
      const voices = getCardVoicesForMessage(msg.id);
      (['en', 'it', 'ja'] as const).forEach((lang) => {
        if (msg.fullText[lang]) {
          const k = generateAudioCacheKey({
            type: 'speech',
            text: msg.fullText[lang],
            voiceId: voices[lang],
            language: getLanguageTag(lang),
            speed: playbackSpeed,
            emotion: 'natural',
          });
          allKeys.push(k);
        }
      });
    });

    if (allKeys.length > 0) {
      getCachedKeySet(allKeys).then((cached) => {
        if (isSubscribed) {
          setCachedKeysSet(cached);
        }
      });
    }

    return () => {
      isSubscribed = false;
    };
  }, [messages, getCardVoicesForMessage, playbackSpeed]);

  const prevMessagesLengthRef = useRef<number>(messages.length);

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      sequenceAbortRef.current = true;
    };
  }, []);

  const showToast = (msg: string): void => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const stopCurrentAudio = useCallback((): void => {
    if (activeAudioRef.current) {
      activeAudioRef.current.audio.pause();
      revokeAudioUrl(activeAudioRef.current.blobUrl);
      activeAudioRef.current = null;
    }
    setIsPlayingAudio(false);
    setIsLoadingAudio(false);
    setPlayingBlockInfo(null);
    setPlayingAudioKey(null);
  }, []);

  // Quando seleciona/foca um card, a voz global muda junto para refletir a voz do card focado!
  const handleSelectLanguage = (messageId: string, lang: 'en' | 'it' | 'ja'): void => {
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

  // Alteração de voz diretamente no próprio Card (independente por card + sincroniza voz global + salva perfil favorito do idioma)
  const handleChangeCardVoice = (
    messageId: string,
    lang: 'en' | 'it' | 'ja',
    voiceId: string
  ): void => {
    setFocusedMessageId(messageId);
    setSelectedLanguageByMsg((prev) => ({ ...prev, [messageId]: lang }));
    setCardVoicesByMsg((prev) => ({
      ...prev,
      [messageId]: {
        ...(prev[messageId] || defaultVoiceByLang),
        [lang]: voiceId,
      },
    }));
    setDefaultVoiceByLang((prev) => ({ ...prev, [lang]: voiceId }));
    syncVoiceToGlobal(voiceId);

    if (
      activeAudioRef.current &&
      activeAudioRef.current.messageId === messageId &&
      activeAudioRef.current.lang === lang
    ) {
      stopCurrentAudio();
    }
  };

  // Alteração do perfil favorito de voz para um idioma na barra superior
  const handleChangeFavoriteLanguageVoice = (
    lang: 'en' | 'it' | 'ja',
    voiceId: string
  ): void => {
    setDefaultVoiceByLang((prev) => ({ ...prev, [lang]: voiceId }));
    setCardVoicesByMsg((prev) => ({
      ...prev,
      [focusedMessageId]: {
        ...(prev[focusedMessageId] || defaultVoiceByLang),
        [lang]: voiceId,
      },
    }));
    setSelectedLanguageByMsg((prev) => ({ ...prev, [focusedMessageId]: lang }));
    syncVoiceToGlobal(voiceId);
    const langLabels: Record<'en' | 'it' | 'ja', string> = {
      en: 'Inglês (EN)',
      it: 'Italiano (IT)',
      ja: 'Japonês (JA)',
    };
    showToast(`Voz favorita de ${langLabels[lang]} salva como ${voiceId}`);
  };

  // Aplica o perfil favorito de vozes (EN, IT, JA) a todos os cards do chat atual
  const handleApplyFavoritesToAllCards = (): void => {
    setCardVoicesByMsg(() => {
      const next: Record<string, Record<'en' | 'it' | 'ja', string>> = {};
      messages.forEach((m) => {
        next[m.id] = { ...defaultVoiceByLang };
      });
      return next;
    });
    const currentLang = selectedLanguageByMsg[focusedMessageId] || 'en';
    syncVoiceToGlobal(defaultVoiceByLang[currentLang]);
    showToast(
      `Perfis favoritos (${defaultVoiceByLang.en} / ${defaultVoiceByLang.it} / ${defaultVoiceByLang.ja}) aplicados a todos os cards!`
    );
  };

  // Reprodução ou Pausa do Áudio do Card usando a voz exclusiva do card
  const handleTogglePlay = async (
    messageId: string,
    lang: 'en' | 'it' | 'ja',
    overrideMsg?: PolyglotMessage
  ): Promise<void> => {
    setFocusedMessageId(messageId);
    setSelectedLanguageByMsg((prev) => ({ ...prev, [messageId]: lang }));
    const voices = getCardVoicesForMessage(messageId);
    const cardVoiceId = voices[lang];
    syncVoiceToGlobal(cardVoiceId);

    if (
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

    stopCurrentAudio();
    const targetMsg = overrideMsg || messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.fullText[lang]) return;

    const cacheKey = generateAudioCacheKey({
      type: 'speech',
      text: targetMsg.fullText[lang],
      voiceId: cardVoiceId,
      language: getLanguageTag(lang),
      speed: playbackSpeed,
      emotion: 'natural',
    });

    const cached = await getCachedAudio(cacheKey);
    if (!cached) {
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
          speed: playbackSpeed,
          emotion: 'natural',
        },
        cacheKey,
        metadata: {
          language: getLanguageTag(lang),
          voiceId: cardVoiceId,
          speed: playbackSpeed,
          emotion: 'natural',
        },
      });

      setCachedKeysSet((prev) => new Set(prev).add(cacheKey));
      const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');

      if (!isMountedRef.current) {
        revokeAudioUrl(blobUrl);
        return;
      }

      const audio = new Audio(blobUrl);
      audio.playbackRate = playbackSpeed;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration || data.durationSec || 0);
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlayingAudio(false);
        setCurrentTime(0);
      };

      audio.onerror = () => {
        stopCurrentAudio();
      };

      activeAudioRef.current = { audio, blobUrl, messageId, lang };
      await audio.play();
      setIsPlayingAudio(true);
    } catch (e: unknown) {
      console.warn('Erro na síntese neural do card:', e);
      stopCurrentAudio();
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Download WAV 24kHz de um Card Individual
  const handleDownloadCardWav = async (messageId: string, lang: 'en' | 'it' | 'ja'): Promise<void> => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.fullText[lang]) return;
    const voices = getCardVoicesForMessage(messageId);
    const cardVoiceId = voices[lang];

    const cacheKey = generateAudioCacheKey({
      type: 'speech',
      text: targetMsg.fullText[lang],
      voiceId: cardVoiceId,
      language: getLanguageTag(lang),
      speed: playbackSpeed,
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
          speed: playbackSpeed,
          emotion: 'natural',
        },
        cacheKey,
        metadata: {
          language: getLanguageTag(lang),
          voiceId: cardVoiceId,
          speed: playbackSpeed,
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

  // Exportação WAV Concatenada da Trilogia Completa (EN + IT + JA respeitando a voz de cada card)
  const handleExportTrilogyWav = async (message: PolyglotMessage): Promise<void> => {
    const voices = getCardVoicesForMessage(message.id);
    const langs: Array<'en' | 'it' | 'ja'> = ['en', 'it', 'ja'];
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
        speed: playbackSpeed,
        emotion: 'natural',
      });

      const data = await synthesizeWithCache({
        endpoint: '/api/synthesize-speech',
        body: {
          text,
          voiceId,
          language: getLanguageTag(lang),
          speed: playbackSpeed,
          emotion: 'natural',
        },
        cacheKey,
        metadata: {
          language: getLanguageTag(lang),
          voiceId,
          speed: playbackSpeed,
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

  const handleReplay = (messageId: string, lang: 'en' | 'it' | 'ja'): void => {
    if (
      activeAudioRef.current &&
      activeAudioRef.current.messageId === messageId &&
      activeAudioRef.current.lang === lang
    ) {
      activeAudioRef.current.audio.currentTime = 0;
      setCurrentTime(0);
      activeAudioRef.current.audio.play();
      setIsPlayingAudio(true);
    } else {
      handleTogglePlay(messageId, lang);
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
        if (error === undefined) {
          resolve();
        } else {
          reject(error);
        }
      };

      pollId = setInterval(() => {
        try {
          if (isStopped() || !activeAudioRef.current) {
            settle();
            return;
          }
          if (activeAudioRef.current.audio.ended) {
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

    const languages: Array<'en' | 'it' | 'ja'> = ['en', 'it', 'ja'];
    const stepNames: Record<string, string> = {
      en: '🇺🇸 Inglês',
      it: '🇮🇹 Italiano',
      ja: '🇯🇵 Japonês',
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

  const handleSendMessage = async (text: string, autoPlayAfter = false): Promise<void> => {
    const newMessageId = `msg-${Date.now()}`;
    const initialCardVoices = { ...defaultVoiceByLang };
    const placeholderMessage: PolyglotMessage = {
      id: newMessageId,
      userPrompt: text,
      timestamp: Date.now(),
      chunks: [],
      fullText: { en: '', it: '', ja: '' },
      cardVoices: initialCardVoices,
      status: 'loading',
    };

    setMessages((prev) => [...prev, placeholderMessage]);
    setFocusedMessageId(newMessageId);
    setSelectedLanguageByMsg((prev) => ({ ...prev, [newMessageId]: 'en' }));
    setCardVoicesByMsg((prev) => ({ ...prev, [newMessageId]: initialCardVoices }));
    syncVoiceToGlobal(initialCardVoices.en);
    setIsLoading(true);

    try {
      const data = await requestTranslateParallelChunks(text);
      if (!data.ok || !data.success || !data.chunks || !data.fullText) {
        throw new Error(data.error || 'Falha ao processar os chunks paralelos.');
      }

      const readyMessage: PolyglotMessage = {
        ...placeholderMessage,
        chunks: data.chunks,
        fullText: data.fullText,
        status: 'ready',
      };

      setMessages((prev) => prev.map((msg) => (msg.id === newMessageId ? readyMessage : msg)));

      if (autoPlayAfter) {
        await handleTogglePlay(newMessageId, 'en', readyMessage);
      }
    } catch (err: unknown) {
      console.error(err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessageId
            ? {
                ...msg,
                status: 'error',
                error: err instanceof Error ? err.message : 'Erro de conexão com o Gemini.',
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayChunkAudio = async (text: string, language: string): Promise<void> => {
    stopCurrentAudio();
    setPlayingAudioKey(text);

    const cacheKey = generateAudioCacheKey({
      type: 'chunk',
      text,
      language,
    });

    try {
      const data = await synthesizeWithCache({
        endpoint: '/api/synthesize-chunk',
        body: { text, language },
        cacheKey,
        metadata: { language },
      });

      if (data.audioBase64) {
        const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
        const audio = new Audio(blobUrl);
        activeAudioRef.current = { audio, blobUrl, messageId: 'chunk', lang: 'en' };

        audio.onended = () => stopCurrentAudio();
        audio.onerror = () => stopCurrentAudio();
        await audio.play();
      } else {
        throw new Error('Falha ao reproduzir áudio do chunk.');
      }
    } catch (e: unknown) {
      console.warn('Erro ao tocar áudio do chunk:', e);
      stopCurrentAudio();
    }
  };

  const handleCreateFlashcard = async (chunkText: string, language: string): Promise<void> => {
    setGeneratingCardKey(chunkText);

    try {
      const data = await requestGenerateFlashcard(chunkText, language);
      if (data.ok && data.success && data.card) {
        setDeck((prev) => [data.card!, ...prev]);
        showToast(`Flashcard "${chunkText}" adicionado ao seu Deck!`);
      } else {
        throw new Error(data.error || 'Falha ao criar flashcard.');
      }
    } catch (e: unknown) {
      console.error(e);
      showToast('Erro ao criar flashcard: ' + (e instanceof Error ? e.message : 'erro desconhecido'));
    } finally {
      setGeneratingCardKey(null);
    }
  };

  const currentFocusedLang = selectedLanguageByMsg[focusedMessageId] || 'en';
  const currentFocusedVoice = getCardVoicesForMessage(focusedMessageId)[currentFocusedLang];

  return (
    <div className="flex-1 flex flex-col min-h-screen font-sans">
      
      {/* 1. Header Minimalista do Estúdio Poliglota + Perfis Favoritos de Voz por Idioma */}
      <header className="lg:sticky lg:top-0 z-20 dock-matte mx-3 sm:mx-6 lg:mx-0 mt-1 lg:mt-0 px-3.5 sm:px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              <GoogleIcon name="translate" size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-bold text-primary font-display">
                  Chat Poliglota Multimodal
                </h1>
                <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                  EN • IT • JA
                </span>
              </div>
              <p className="text-[11px] text-secondary leading-snug mt-0.5">
                Escolha a voz diretamente em cada card · A voz global acompanha o card focado ({currentFocusedVoice})
              </p>
            </div>
          </div>

          {/* Botão Mobile de Acesso ao Deck */}
          <button
            type="button"
            onClick={() => setIsDeckDrawerOpen(true)}
            className="xl:hidden btn-matte btn-matte-dark px-2.5 py-1.5 text-xs text-primary font-medium cursor-pointer shrink-0"
            title="Ver Flashcards salvos"
          >
            <GoogleIcon name="style" size={16} className="text-amber-400" />
            <span>Deck</span>
            <span className="bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums">
              {deck.length}
            </span>
          </button>
        </div>

        {/* Barra de Perfis Favoritos de Vozes por Idioma (Salvos no Navegador) + Botão de Deck */}
        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2 w-full xl:w-auto">
          <div
            className="pill-nav-shell !rounded-2xl sm:!rounded-full flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 w-full sm:w-auto"
            aria-label="Perfis favoritos de vozes por idioma"
          >
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1 flex items-center gap-1 opacity-85 shrink-0">
                <GoogleIcon name="bookmark" size={13} />
                <span>Vozes Favoritas:</span>
              </span>

              <button
                type="button"
                onClick={handleApplyFavoritesToAllCards}
                className="sm:hidden px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 hover:bg-amber-300 text-[10px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm shrink-0"
                title="Aplicar estas vozes favoritas a todos os cards da conversa atual"
              >
                <GoogleIcon name="sync" size={12} />
                <span>Aplicar aos Cards</span>
              </button>
            </div>

            <div className="grid grid-cols-3 sm:flex items-center gap-1.5">
              {(
                [
                  { code: 'en', flag: 'EN', label: 'EN' },
                  { code: 'it', flag: 'IT', label: 'IT' },
                  { code: 'ja', flag: 'JA', label: 'JA' },
                ] as const
              ).map((item) => (
                <label
                  key={item.code}
                  className="inline-flex items-center justify-center sm:justify-start gap-1 px-2 py-1 rounded-xl sm:rounded-full bg-black/15 hover:bg-black/25 text-[11px] font-bold cursor-pointer transition-colors min-w-0"
                  title={`Voz favorita padrão para novos cards em ${item.label}`}
                >
                  <span className="font-mono text-[10px] opacity-80 shrink-0">{item.label}:</span>
                  <select
                    aria-label={`Voz favorita para ${item.label}`}
                    value={defaultVoiceByLang[item.code]}
                    onChange={(e) => handleChangeFavoriteLanguageVoice(item.code, e.target.value)}
                    className="bg-transparent font-mono font-bold text-[11px] focus:outline-none cursor-pointer min-w-0 truncate"
                  >
                    {GEMINI_VOICES.map((v) => (
                      <option key={v.id} value={v.id} className="bg-slate-900 text-slate-100">
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleApplyFavoritesToAllCards}
              className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 hover:bg-amber-300 text-[10px] font-extrabold transition-all cursor-pointer items-center gap-1 shadow-sm shrink-0"
              title="Aplicar estas vozes favoritas a todos os cards da conversa atual"
            >
              <GoogleIcon name="sync" size={12} />
              <span>Aplicar aos Cards</span>
            </button>
          </div>

          {/* Botão Desktop de Acesso ao Deck de Flashcards */}
          <button
            type="button"
            onClick={() => setIsDeckDrawerOpen(true)}
            className="hidden xl:inline-flex btn-matte btn-matte-dark px-3 py-1.5 text-xs text-primary font-medium cursor-pointer"
            title="Ver Flashcards salvos"
          >
            <GoogleIcon name="style" size={16} className="text-amber-400" />
            <span>Meu Deck</span>
            <span className="bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums">
              {deck.length}
            </span>
          </button>
        </div>
      </header>

      {/* 2. Toast de Feedback Suave */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-40 card-matte border border-emerald-500/40 text-primary px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
          <GoogleIcon name="check_circle" size={16} filled className="text-emerald-400" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* 3. Feed de Mensagens do Chat (Canvas Multi-Pane com espaçamento seguro para o Dock) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 pb-6 sm:pb-10 flex flex-col gap-5">
        {messages.map((message) => {
          const selectedLang = selectedLanguageByMsg[message.id] || 'en';
          const cardVoices = getCardVoicesForMessage(message.id);
          const isThisBlockPlaying =
            playingBlockInfo?.messageId === message.id && isPlayingAudio;
          const isThisBlockLoading =
            playingBlockInfo?.messageId === message.id && isLoadingAudio;
          const playingLangForThisMsg =
            playingBlockInfo?.messageId === message.id ? playingBlockInfo.lang : null;

          const isCachedByLang = {
            en: cachedKeysSet.has(getMessageAudioCacheKey(message.id, 'en')),
            it: cachedKeysSet.has(getMessageAudioCacheKey(message.id, 'it')),
            ja: cachedKeysSet.has(getMessageAudioCacheKey(message.id, 'ja')),
          };

          return (
            <ParallelMessageBlock
              key={message.id}
              message={{ ...message, cardVoices }}
              onPlayChunkAudio={handlePlayChunkAudio}
              onCreateFlashcard={handleCreateFlashcard}
              playingAudioKey={playingAudioKey}
              generatingCardKey={generatingCardKey}
              selectedLanguage={selectedLang}
              onSelectLanguage={(lang) => handleSelectLanguage(message.id, lang)}
              isPlaying={isThisBlockPlaying}
              isLoading={isThisBlockLoading}
              playingLangForThisMsg={playingLangForThisMsg}
              isCachedByLang={isCachedByLang}
              onTogglePlay={(lang) => handleTogglePlay(message.id, lang)}
              onReplay={(lang) => handleReplay(message.id, lang)}
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              speed={playbackSpeed}
              onChangeSpeed={handleChangeSpeed}
              cardVoices={cardVoices}
              onChangeCardVoice={(lang, voice) => handleChangeCardVoice(message.id, lang, voice)}
              onDownloadCardWav={(lang) => handleDownloadCardWav(message.id, lang)}
              onPlaySequence={() => handlePlaySequence(message.id)}
              isPlayingSequence={isPlayingSequence}
              sequenceStep={sequenceStep}
              onOpenExport={(msg) => setExportingMessage({ ...msg, cardVoices })}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* 4. Dock Inferior Multimodal com Atalho de Mic e Live API */}
      <AgentInputDock
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        activeVoiceName={currentFocusedVoice}
      />

      {/* 5. Gaveta Lateral Retrátil de Flashcards */}
      <FlashcardDeckDrawer
        isOpen={isDeckDrawerOpen}
        onClose={() => setIsDeckDrawerOpen(false)}
        cards={deck}
        onDeleteCard={(id) => setDeck((prev) => prev.filter((c) => c.id !== id))}
        onClearDeck={() => setDeck([])}
        onPlayCardAudio={handlePlayChunkAudio}
      />

      {/* 6. Modal de Exportação com Prévia do Formato e Download WAV da Trilogia */}
      <ExportInteractionModal
        isOpen={Boolean(exportingMessage)}
        onClose={() => setExportingMessage(null)}
        message={exportingMessage}
        cardVoices={exportingMessage ? getCardVoicesForMessage(exportingMessage.id) : undefined}
        onAddCardsToDeck={(newCards) => {
          setDeck((prev) => [...newCards, ...prev]);
        }}
        onExportTrilogyWav={handleExportTrilogyWav}
        onShowToast={showToast}
      />
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PolyglotMessage,
  FlashcardItem,
  SavedConversation,
  GoogleUserSession,
  YoutubePostLinkAction,
  YoutubeClipRange,
} from '../types/polyglot';
import type { StudioRenderMode } from '../types/debate';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { ParallelMessageBlock } from './ParallelMessageBlock';
import { AgentInputDock, AgentInputDockSubmitPayload } from './AgentInputDock';
import { FlashcardDeckDrawer } from './FlashcardDeckDrawer';
import { ExportInteractionModal } from './ExportInteractionModal';
import { GoogleIcon } from './GoogleIcon';
import {
  readFlashcardDeck,
  subscribeFlashcardDeck,
  addFlashcardsToDeck,
  deleteFlashcardFromDeck,
  clearFlashcardDeck,
} from '../services/flashcardDeckStorage';
import { base64ToBlobUrl, revokeAudioUrl, speakBrowserFallback, stopBrowserSpeech } from '../utils/audio';
import { concatenateWavBuffers } from '../utils/audioEngine';
import {
  generateAudioCacheKey,
  synthesizeWithCache,
  getCachedAudio,
  getCachedKeySet,
} from '../utils/audioCache';
import {
  requestTranslateParallelChunks,
  requestLiveAgentTurn,
  requestAgentExplore,
  requestListUserConversations,
  requestSaveUserConversation,
  requestGenerateFlashcard,
  readFavoriteVoicesByLanguage,
  saveFavoriteVoicesByLanguage,
} from '../services/polyglotClient';
import {
  readActiveConversationTarget,
  persistActiveConversationTarget,
  resolveInitialConversationTarget,
} from '../services/conversationSessionState';
import { getActiveSession, subscribeAuthChanges } from '../services/authService';

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
  onSendToCreationStudio?: (text: string, mode: StudioRenderMode) => void;
  selectedConversationId?: string | null;
  newConversationSignal?: number;
  onConversationsChanged?: (conversations: SavedConversation[], activeId: string) => void;
  onOpenStudyTab?: () => void;
}

export const PolyglotChatStudio: React.FC<PolyglotChatStudioProps> = ({
  globalVoice,
  onSyncGlobalVoice,
  onSendToCreationStudio,
  selectedConversationId,
  newConversationSignal,
  onConversationsChanged,
  onOpenStudyTab,
}) => {
  const [userSession, setUserSession] = useState<GoogleUserSession>(() => getActiveSession());
  const [isExplicitNewChat, setIsExplicitNewChat] = useState<boolean>(() => {
    if (selectedConversationId === '__NEW__') return true;
    return readActiveConversationTarget(getActiveSession().uid)?.mode === 'new';
  });
  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    const saved = readActiveConversationTarget(getActiveSession().uid);
    if (saved?.mode === 'new') return saved.draftId;
    if (saved?.mode === 'saved') return saved.conversationId;
    return `conv_${Date.now()}`;
  });
  const [conversations, setConversations] = useState<SavedConversation[]>([]);

  const [messages, setMessages] = useState<PolyglotMessage[]>([INITIAL_DEMO_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [deck, setDeck] = useState<FlashcardItem[]>(() => readFlashcardDeck());

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
  const cardVoicesByMsgRef = useRef<Record<string, Record<'en' | 'it' | 'ja', string>>>(
    cardVoicesByMsg
  );
  cardVoicesByMsgRef.current = cardVoicesByMsg;

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

  // Se a voz global mudar externamente (ex: Sidebar, Ctrl+K ou Biblioteca de Vozes), atualiza o card focado atual
  useEffect(() => {
    if (!globalVoice || globalVoice.id === lastSyncedVoiceIdRef.current) return;
    lastSyncedVoiceIdRef.current = globalVoice.id;
    const activeLang = selectedLanguageByMsg[focusedMessageId] || 'en';
    const nextForMsg = {
      ...(cardVoicesByMsgRef.current[focusedMessageId] || defaultVoiceByLang),
      [activeLang]: globalVoice.id,
    };
    cardVoicesByMsgRef.current = {
      ...cardVoicesByMsgRef.current,
      [focusedMessageId]: nextForMsg,
    };
    setCardVoicesByMsg((prev) => ({
      ...prev,
      [focusedMessageId]: nextForMsg,
    }));
    setMessages((prev) =>
      prev.map((m) => (m.id === focusedMessageId ? { ...m, cardVoices: nextForMsg } : m))
    );
    setDefaultVoiceByLang((prev) => ({ ...prev, [activeLang]: globalVoice.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalVoice?.id]);

  useEffect(() => {
    setDeck(readFlashcardDeck());
    return subscribeFlashcardDeck((updated) => {
      setDeck(updated);
    });
  }, []);

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
      return (
        cardVoicesByMsgRef.current[messageId] ||
        cardVoicesByMsg[messageId] ||
        defaultVoiceByLang
      );
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
    stopBrowserSpeech();
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
    const currentForMsg =
      cardVoicesByMsgRef.current[messageId] ||
      cardVoicesByMsg[messageId] ||
      defaultVoiceByLang;
    const updatedVoices = {
      ...currentForMsg,
      [lang]: voiceId,
    };

    cardVoicesByMsgRef.current = {
      ...cardVoicesByMsgRef.current,
      [messageId]: updatedVoices,
    };

    setFocusedMessageId(messageId);
    setSelectedLanguageByMsg((prev) => ({ ...prev, [messageId]: lang }));
    setCardVoicesByMsg((prev) => ({
      ...prev,
      [messageId]: updatedVoices,
    }));
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, cardVoices: updatedVoices } : m))
    );
    setDefaultVoiceByLang((prev) => ({ ...prev, [lang]: voiceId }));
    syncVoiceToGlobal(voiceId);

    stopCurrentAudio();
    void handleTogglePlay(messageId, lang, undefined, voiceId);
  };

  // Alteração do perfil favorito de voz para um idioma na barra superior
  const handleChangeFavoriteLanguageVoice = (
    lang: 'en' | 'it' | 'ja',
    voiceId: string
  ): void => {
    const currentForMsg =
      cardVoicesByMsgRef.current[focusedMessageId] ||
      cardVoicesByMsg[focusedMessageId] ||
      defaultVoiceByLang;
    const updatedVoices = {
      ...currentForMsg,
      [lang]: voiceId,
    };
    cardVoicesByMsgRef.current = {
      ...cardVoicesByMsgRef.current,
      [focusedMessageId]: updatedVoices,
    };

    setDefaultVoiceByLang((prev) => ({ ...prev, [lang]: voiceId }));
    setCardVoicesByMsg((prev) => ({
      ...prev,
      [focusedMessageId]: updatedVoices,
    }));
    setMessages((prev) =>
      prev.map((m) => (m.id === focusedMessageId ? { ...m, cardVoices: updatedVoices } : m))
    );
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
    const next: Record<string, Record<'en' | 'it' | 'ja', string>> = {};
    messages.forEach((m) => {
      next[m.id] = { ...defaultVoiceByLang };
    });
    cardVoicesByMsgRef.current = next;
    setCardVoicesByMsg(next);
    setMessages((prev) => prev.map((m) => ({ ...m, cardVoices: { ...defaultVoiceByLang } })));
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
      audio.preservesPitch = true;
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
        showToast(
          `Reproduzindo com a voz ${cardVoiceId} (${lang.toUpperCase()}).`
        );
      } else {
        stopCurrentAudio();
        showToast(e instanceof Error ? e.message : 'Falha ao sintetizar áudio do card.');
      }
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

    const languages: Array<'en' | 'it' | 'ja'> = ['en', 'it', 'ja'];
    const stepNames: Record<string, string> = {
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

  const messagesRef = useRef<PolyglotMessage[]>(messages);
  messagesRef.current = messages;
  const activeConversationIdRef = useRef<string>(activeConversationId);
  activeConversationIdRef.current = activeConversationId;
  const isExplicitNewChatRef = useRef<boolean>(isExplicitNewChat);
  isExplicitNewChatRef.current = isExplicitNewChat;
  const prevSessionRef = useRef<GoogleUserSession>(userSession);

  const handleNewConversation = useCallback((): void => {
    stopCurrentAudio();
    const nextId = `conv_${Date.now()}`;
    setIsExplicitNewChat(true);
    isExplicitNewChatRef.current = true;
    setActiveConversationId(nextId);
    activeConversationIdRef.current = nextId;
    setMessages([INITIAL_DEMO_MESSAGE]);
    setFocusedMessageId('msg-demo-1');
    persistActiveConversationTarget(userSession.uid, { mode: 'new', draftId: nextId });
    onConversationsChanged?.(conversations, nextId);
    showToast('Nova conversa iniciada! Suas conversas anteriores estão salvas no histórico.');
  }, [conversations, onConversationsChanged, stopCurrentAudio, userSession.uid]);

  const handleSelectConversation = useCallback((conv: SavedConversation): void => {
    stopCurrentAudio();
    setIsExplicitNewChat(false);
    isExplicitNewChatRef.current = false;
    setActiveConversationId(conv.id);
    activeConversationIdRef.current = conv.id;
    const nextMsgs = conv.messages.length > 0 ? conv.messages : [INITIAL_DEMO_MESSAGE];
    setMessages(nextMsgs);
    const lastId = nextMsgs[nextMsgs.length - 1].id;
    setFocusedMessageId(lastId);
    persistActiveConversationTarget(userSession.uid, { mode: 'saved', conversationId: conv.id });
    showToast(`Conversa "${conv.title}" restaurada.`);
  }, [stopCurrentAudio, userSession.uid]);

  // Sincronização de Sessão Google e Carregamento do Histórico de Conversas
  const loadConversationsForActiveUser = useCallback(async () => {
    const list = await requestListUserConversations();
    setConversations(list);

    // Se o usuário está explicitamente em um rascunho de novo chat, preserva e nunca sobrescreve
    if (isExplicitNewChatRef.current) {
      return;
    }

    const savedTarget = readActiveConversationTarget(userSession.uid);
    const targetDecision = resolveInitialConversationTarget({
      explicitSelection: selectedConversationId || null,
      savedTarget,
      conversations: list,
    });

    if (targetDecision.action === 'keep_new_draft') {
      setIsExplicitNewChat(true);
      isExplicitNewChatRef.current = true;
      setActiveConversationId(targetDecision.draftId);
      activeConversationIdRef.current = targetDecision.draftId;
      setMessages([INITIAL_DEMO_MESSAGE]);
      persistActiveConversationTarget(userSession.uid, {
        mode: 'new',
        draftId: targetDecision.draftId,
      });
      return;
    }

    if (targetDecision.action === 'load_saved') {
      const conv = targetDecision.conversation;
      // Se a conversa já é a ativa e temos mensagens além do demo padrão, preserva estado atual
      if (
        conv.id === activeConversationIdRef.current &&
        messagesRef.current.length > 0 &&
        messagesRef.current[0].id !== 'msg-demo-1'
      ) {
        return;
      }
      setIsExplicitNewChat(false);
      isExplicitNewChatRef.current = false;
      setActiveConversationId(conv.id);
      activeConversationIdRef.current = conv.id;
      setMessages(conv.messages.length > 0 ? conv.messages : [INITIAL_DEMO_MESSAGE]);
      persistActiveConversationTarget(userSession.uid, {
        mode: 'saved',
        conversationId: conv.id,
      });
    }
  }, [selectedConversationId, userSession.uid]);

  useEffect(() => {
    loadConversationsForActiveUser();
    const unsub = subscribeAuthChanges(async (nextSession) => {
      const wasGuest = !prevSessionRef.current.isGoogleAuthenticated;
      prevSessionRef.current = nextSession;
      setUserSession(nextSession);

      // Só migra turnos ativos da tela se a transição for de Visitante Local -> Conta Google autenticada
      const currentReadyTurns = messagesRef.current.filter(
        (m) => m.status === 'ready' && m.id !== 'msg-demo-1'
      );
      if (wasGuest && nextSession.isGoogleAuthenticated && currentReadyTurns.length > 0) {
        const firstPrompt = currentReadyTurns[0].userPrompt || 'Conversa Poliglota';
        const migratedConv: SavedConversation = {
          id: activeConversationIdRef.current,
          userId: nextSession.uid,
          userName: nextSession.name,
          userEmail: nextSession.email || undefined,
          title: firstPrompt.length > 62 ? `${firstPrompt.slice(0, 62)}...` : firstPrompt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pinned: false,
          originMode: currentReadyTurns[currentReadyTurns.length - 1].originMode || 'polyglot',
          messages: messagesRef.current.filter((m) => m.status === 'ready'),
        };
        await requestSaveUserConversation(migratedConv);
      }

      const list = await requestListUserConversations();
      setConversations(list);
      const nextSavedTarget = readActiveConversationTarget(nextSession.uid);
      const decision = resolveInitialConversationTarget({
        explicitSelection: null,
        savedTarget: nextSavedTarget,
        conversations: list,
      });

      if (decision.action === 'keep_new_draft') {
        setIsExplicitNewChat(true);
        isExplicitNewChatRef.current = true;
        setActiveConversationId(decision.draftId);
        activeConversationIdRef.current = decision.draftId;
        setMessages([INITIAL_DEMO_MESSAGE]);
      } else if (decision.action === 'load_saved') {
        setIsExplicitNewChat(false);
        isExplicitNewChatRef.current = false;
        setActiveConversationId(decision.conversation.id);
        activeConversationIdRef.current = decision.conversation.id;
        setMessages(
          decision.conversation.messages.length > 0
            ? decision.conversation.messages
            : [INITIAL_DEMO_MESSAGE]
        );
      } else {
        setIsExplicitNewChat(true);
        isExplicitNewChatRef.current = true;
        const draftId = `conv_${Date.now()}`;
        setActiveConversationId(draftId);
        activeConversationIdRef.current = draftId;
        setMessages([INITIAL_DEMO_MESSAGE]);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notifica o container pai (App.tsx / HistorySidebar) sobre mudanças nas conversas
  useEffect(() => {
    onConversationsChanged?.(conversations, activeConversationId);
  }, [conversations, activeConversationId, onConversationsChanged]);

  // Responde ao sinal de nova conversa vindo de App.tsx (sem setTimeout hack)
  const isFirstSignalRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstSignalRenderRef.current) {
      isFirstSignalRenderRef.current = false;
      return;
    }
    if (newConversationSignal) {
      handleNewConversation();
    }
  }, [newConversationSignal, handleNewConversation]);

  // Responde à seleção externa de uma conversa ou comando "+ Nova Conversa" vindo da HistorySidebar
  useEffect(() => {
    if (!selectedConversationId) return;
    if (selectedConversationId === '__NEW__') {
      handleNewConversation();
      return;
    }
    if (selectedConversationId === activeConversationIdRef.current) return;
    const found = conversations.find((c) => c.id === selectedConversationId);
    if (found) {
      handleSelectConversation(found);
    }
  }, [selectedConversationId, conversations, handleNewConversation, handleSelectConversation]);

  const persistConversationSnapshot = useCallback(
    async (updatedMessages: PolyglotMessage[], convId = activeConversationId) => {
      const readyOnly = updatedMessages.filter((m) => m.status === 'ready');
      if (readyOnly.length === 0) return;

      const userTurns = readyOnly.filter((m) => m.id !== 'msg-demo-1');
      if (userTurns.length === 0) return;

      const lastTurn = userTurns[userTurns.length - 1];
      const existing = conversations.find((c) => c.id === convId);
      const titleSource = userTurns[0].userPrompt || 'Conversa Poliglota';
      const cleanTitle =
        titleSource.length > 62 ? `${titleSource.slice(0, 62)}...` : titleSource;

      const payload: SavedConversation = {
        id: convId,
        userId: userSession.uid,
        userName: userSession.name,
        userEmail: userSession.email || undefined,
        title: existing?.customTitle && existing.title ? existing.title : existing?.title || cleanTitle,
        customTitle: existing?.customTitle,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pinned: existing?.pinned || false,
        originMode: lastTurn.originMode || existing?.originMode || 'polyglot',
        messages: readyOnly,
      };

      const saved = await requestSaveUserConversation(payload);
      if (saved) {
        setIsExplicitNewChat(false);
        isExplicitNewChatRef.current = false;
        persistActiveConversationTarget(userSession.uid, { mode: 'saved', conversationId: convId });
        setConversations((prev) => {
          const rest = prev.filter((c) => c.id !== saved.id);
          return [saved, ...rest].sort((a, b) => {
            if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
            return b.updatedAt.localeCompare(a.updatedAt);
          });
        });
      }
    },
    [activeConversationId, conversations, userSession]
  );

  const handleSendMessage = async (
    text: string,
    autoPlayAfter = false,
    payload?: AgentInputDockSubmitPayload
  ): Promise<void> => {
    const newMessageId = `msg-${Date.now()}`;
    const initialCardVoices = { ...defaultVoiceByLang };
    const originMode = payload?.youtubeUrl
      ? 'youtube'
      : payload?.dockMode === 'search_youtube' || payload?.enableSearch
      ? 'web_search'
      : payload?.dockMode === 'live_tutor' || payload?.dockMode === 'practice' || payload?.audioBase64
      ? 'live_agent'
      : 'polyglot';

    const placeholderMessage: PolyglotMessage = {
      id: newMessageId,
      userPrompt: text,
      timestamp: Date.now(),
      chunks: [],
      fullText: { en: '', it: '', ja: '' },
      cardVoices: initialCardVoices,
      status: 'loading',
      originMode,
      youtubeUrl: payload?.youtubeUrl,
    };

    setMessages((prev) => [...prev, placeholderMessage]);
    setFocusedMessageId(newMessageId);
    setSelectedLanguageByMsg((prev) => ({ ...prev, [newMessageId]: 'en' }));
    setCardVoicesByMsg((prev) => ({ ...prev, [newMessageId]: initialCardVoices }));
    syncVoiceToGlobal(initialCardVoices.en);
    setIsLoading(true);

    try {
      let readyMessage: PolyglotMessage;

      if (originMode === 'youtube' || originMode === 'web_search') {
        const exploreData = await requestAgentExplore({
          prompt: text,
          youtubeUrl: payload?.youtubeUrl,
          youtubeAction: payload?.youtubeAction,
          clipRange: payload?.clipRange,
          enableSearch: true,
        });
        if (!exploreData.ok || !exploreData.success || !exploreData.chunks || !exploreData.fullText) {
          throw new Error(exploreData.error || 'Falha ao consultar Agente com Busca/YouTube.');
        }

        readyMessage = {
          ...placeholderMessage,
          originMode: exploreData.originMode || originMode,
          youtubeUrl: exploreData.youtubeUrl || payload?.youtubeUrl,
          youtubeMeta: exploreData.youtubeMeta,
          youtubeSearchResults: exploreData.youtubeSearchResults,
          youtubeAction: exploreData.youtubeAction || payload?.youtubeAction,
          youtubeClipRange: payload?.clipRange,
          awaitingYoutubeIntent: Boolean(exploreData.awaitingYoutubeIntent),
          agentReplyPtBr: exploreData.agentReplyPtBr,
          sources: exploreData.sources,
          chunks: exploreData.chunks,
          fullText: exploreData.fullText,
          status: 'ready',
        };

        if (exploreData.toolCallsExecuted && exploreData.toolCallsExecuted.length > 0) {
          for (const tool of exploreData.toolCallsExecuted) {
            if (tool.name === 'create_study_flashcard') {
              const firstChunk = exploreData.chunks[0];
              const newCard: FlashcardItem = {
                id: tool.id,
                chunkText: tool.args.frontPhrase || firstChunk?.en || text,
                language: 'en-US',
                front: tool.args.frontPhrase || firstChunk?.en || text,
                back: tool.args.backTranslation || firstChunk?.it || '',
                nuance: 'Expressão extraída do vídeo do YouTube.',
                pronunciation: firstChunk?.jaPronunciation,
                example: firstChunk?.en || '',
                exampleTranslation: firstChunk?.ja || '',
                createdAt: Date.now(),
              };
              setDeck((prev) => [newCard, ...prev]);
            }
          }
          showToast(
            `${exploreData.toolCallsExecuted.length} expressões do vídeo salvas no seu Deck!`
          );
        }
      } else if (originMode === 'live_agent') {
        const recentHistory = messages
          .filter((m) => m.status === 'ready')
          .slice(-4)
          .map((m) => ({
            role: 'user',
            text: `${m.userPrompt} -> ${m.fullText.en}`,
          }));

        const liveData = await requestLiveAgentTurn({
          text: payload?.text ?? text,
          audioBase64: payload?.audioBase64,
          mimeType: payload?.mimeType,
          persona: payload?.persona || 'tutor_conversational',
          history: recentHistory,
        });

        if (!liveData.ok || !liveData.success || !liveData.chunks || !liveData.fullText) {
          throw new Error(liveData.error || 'Falha ao processar turno do Agente Live.');
        }

        readyMessage = {
          ...placeholderMessage,
          userPrompt: liveData.userTranscript || text,
          originMode: 'live_agent',
          agentPersona: liveData.persona,
          agentReplyPtBr: liveData.agentReplyPtBr,
          chunks: liveData.chunks,
          fullText: liveData.fullText,
          status: 'ready',
        };

        if (liveData.toolCallsExecuted && liveData.toolCallsExecuted.length > 0) {
          for (const tool of liveData.toolCallsExecuted) {
            if (tool.name === 'create_study_flashcard') {
              const firstChunk = liveData.chunks[0];
              const newCard: FlashcardItem = {
                id: tool.id,
                chunkText: tool.args.frontPhrase || firstChunk?.en || text,
                language: 'en-US',
                front: tool.args.frontPhrase || firstChunk?.en || text,
                back: tool.args.backTranslation || firstChunk?.it || '',
                nuance: 'Gerado automaticamente via Function Calling do Agente Live.',
                pronunciation: firstChunk?.jaPronunciation,
                example: firstChunk?.en || '',
                exampleTranslation: firstChunk?.ja || '',
                createdAt: Date.now(),
              };
              setDeck((prev) => [newCard, ...prev]);
              showToast(tool.summaryPtBr);
            } else if (tool.name === 'switch_studio_voice' && tool.args.targetVoice) {
              const vId = tool.args.targetVoice;
              const targetLang = tool.args.language || 'all';
              if (targetLang === 'all') {
                const updated = { en: vId, it: vId, ja: vId };
                readyMessage.cardVoices = updated;
                setCardVoicesByMsg((prev) => ({ ...prev, [newMessageId]: updated }));
              } else {
                handleChangeFavoriteLanguageVoice(targetLang, vId);
              }
              syncVoiceToGlobal(vId);
              showToast(tool.summaryPtBr);
            }
          }
        }
      } else {
        const data = await requestTranslateParallelChunks(text);
        if (!data.ok || !data.success || !data.chunks || !data.fullText) {
          throw new Error(data.error || 'Falha ao processar os chunks paralelos.');
        }

        readyMessage = {
          ...placeholderMessage,
          chunks: data.chunks,
          fullText: data.fullText,
          status: 'ready',
        };
      }

      setMessages((prev) => {
        const nextList = prev.map((msg) => (msg.id === newMessageId ? readyMessage : msg));
        void persistConversationSnapshot(nextList);
        return nextList;
      });

      if (autoPlayAfter || payload?.autoSpeakReply) {
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

  const handlePlayChunkAudio = async (
    text: string,
    language: string,
    voiceId?: string
  ): Promise<void> => {
    stopCurrentAudio();
    setPlayingAudioKey(text);

    const langKey: 'en' | 'it' | 'ja' = language.startsWith('it')
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

    try {
      const data = await synthesizeWithCache({
        endpoint: '/api/synthesize-chunk',
        body: { text, language, voiceId: resolvedVoiceId },
        cacheKey,
        metadata: { language, voiceId: resolvedVoiceId },
      });

      if (data.audioBase64) {
        const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
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
    }
  };

  const handleExecuteYoutubePostLinkAction = async (
    targetMessageId: string,
    youtubeUrl: string,
    action: YoutubePostLinkAction,
    clipRange?: YoutubeClipRange
  ): Promise<void> => {
    const actionPromptMap: Record<YoutubePostLinkAction, string> = {
      ask_intent: youtubeUrl,
      translate_video: `Traduza e transcreva a fala do vídeo do YouTube ${youtubeUrl} nos 3 idiomas.`,
      summary_dialogue: `Faça um resumo completo em português e crie um diálogo prático sobre o vídeo ${youtubeUrl}.`,
      extract_expressions: `Extraia as melhores expressões nativas e flashcards do vídeo ${youtubeUrl}.`,
      custom_prompt: `Analise o vídeo do YouTube ${youtubeUrl}.`,
    };

    setMessages((prev) =>
      prev.map((m) =>
        m.id === targetMessageId
          ? {
              ...m,
              status: 'loading',
              youtubeUrl,
              youtubeAction: action,
              youtubeClipRange: clipRange,
              awaitingYoutubeIntent: false,
            }
          : m
      )
    );
    setFocusedMessageId(targetMessageId);
    setIsLoading(true);

    try {
      const exploreData = await requestAgentExplore({
        prompt: actionPromptMap[action] || youtubeUrl,
        youtubeUrl,
        youtubeAction: action,
        clipRange,
        enableSearch: true,
      });

      if (!exploreData.ok || !exploreData.success || !exploreData.chunks || !exploreData.fullText) {
        throw new Error(exploreData.error || 'Falha ao processar o vídeo do YouTube.');
      }

      if (exploreData.toolCallsExecuted && exploreData.toolCallsExecuted.length > 0) {
        const addedCards: FlashcardItem[] = exploreData.toolCallsExecuted
          .filter((t) => t.name === 'create_study_flashcard')
          .map((tool, idx) => {
            const chunk = exploreData.chunks?.[idx] || exploreData.chunks?.[0];
            return {
              id: tool.id,
              chunkText: tool.args.frontPhrase || chunk?.en || youtubeUrl,
              language: 'en-US',
              front: tool.args.frontPhrase || chunk?.en || youtubeUrl,
              back: tool.args.backTranslation || chunk?.it || '',
              nuance: 'Expressão extraída do vídeo do YouTube.',
              pronunciation: chunk?.jaPronunciation,
              example: chunk?.en || '',
              exampleTranslation: chunk?.ja || '',
              createdAt: Date.now(),
            };
          });
        if (addedCards.length > 0) {
          addFlashcardsToDeck(addedCards);
          showToast(`${addedCards.length} flashcards extraídos do vídeo e salvos no Deck!`);
        }
      }

      setMessages((prev) => {
        const nextList = prev.map((m) =>
          m.id === targetMessageId
            ? {
                ...m,
                originMode: 'youtube' as const,
                youtubeUrl: exploreData.youtubeUrl || youtubeUrl,
                youtubeMeta: exploreData.youtubeMeta || m.youtubeMeta,
                youtubeAction: action,
                youtubeClipRange: clipRange,
                awaitingYoutubeIntent: false,
                agentReplyPtBr: exploreData.agentReplyPtBr,
                sources: exploreData.sources,
                chunks: exploreData.chunks!,
                fullText: exploreData.fullText!,
                status: 'ready' as const,
              }
            : m
        );
        void persistConversationSnapshot(nextList);
        return nextList;
      });
    } catch (err: unknown) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === targetMessageId
            ? {
                ...m,
                status: 'error',
                error: err instanceof Error ? err.message : 'Erro ao analisar vídeo do YouTube.',
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFlashcard = async (chunkText: string, language: string): Promise<void> => {
    setGeneratingCardKey(chunkText);

    try {
      const data = await requestGenerateFlashcard(chunkText, language);
      if (data.ok && data.success && data.card) {
        addFlashcardsToDeck([data.card]);
        showToast(`Flashcard "${chunkText}" enviado para a Área de Estudo!`);
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
      {/* 1. Header Minimalista do Estúdio Poliglota (Alinhado à Régua Canônica max-w-[1440px]) */}
      <div className="lg:sticky lg:top-0 z-20 w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 pt-2">
        <header className="dock-matte rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <GoogleIcon name="translate" size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h1 className="text-sm sm:text-base font-bold text-primary font-display truncate">
                    Chat Poliglota Multimodal
                  </h1>
                  <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                    EN • IT • JA
                  </span>
                </div>
                <p className="text-[11px] text-secondary leading-snug mt-0.5 line-clamp-1 sm:line-clamp-none">
                  Voz por card · Sincronizado com o card focado ({currentFocusedVoice})
                </p>
              </div>
            </div>

            {/* Botões Mobile de Nova Conversa e Deck */}
            <div className="xl:hidden flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleNewConversation}
                className="btn-matte btn-matte-dark btn-compact-touch h-8 px-2.5 py-1 text-xs text-primary font-medium cursor-pointer"
                title="Iniciar nova conversa limpa"
              >
                <GoogleIcon name="add" size={15} className="text-amber-400" />
                <span>Nova</span>
              </button>
              <button
                type="button"
                onClick={() => (onOpenStudyTab ? onOpenStudyTab() : setIsDeckDrawerOpen(true))}
                className="btn-matte btn-matte-dark btn-compact-touch h-8 px-2.5 py-1 text-xs text-primary font-medium cursor-pointer"
                title="Abrir Área de Estudo (Flashcards)"
              >
                <GoogleIcon name="school" size={15} className="text-amber-400" />
                <span>Deck</span>
                <span className="bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums">
                  {deck.length}
                </span>
              </button>
            </div>
          </div>

          {/* Barra de Perfis Favoritos de Vozes por Idioma + Nova Conversa + Área de Estudo */}
          <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2 w-full xl:w-auto">
            <div
              className="card-matte rounded-xl sm:rounded-full flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 w-full sm:w-auto"
              aria-label="Perfis favoritos de vozes por idioma"
            >
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-1 flex items-center gap-1 text-secondary shrink-0">
                  <GoogleIcon name="bookmark" size={13} className="text-amber-400" />
                  <span>Vozes Favoritas:</span>
                </span>

                <button
                  type="button"
                  onClick={handleApplyFavoritesToAllCards}
                  className="sm:hidden btn-compact-touch h-7 px-2.5 py-0.5 rounded-full btn-matte-amber text-white text-[10px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm shrink-0"
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
                    className="inline-flex items-center justify-center sm:justify-start gap-1 px-2 py-1 rounded-lg sm:rounded-full surface-inset text-[11px] font-bold cursor-pointer transition-colors min-w-0"
                    title={`Voz favorita padrão para novos cards em ${item.label}`}
                  >
                    <span className="font-mono text-[10px] text-amber-400 shrink-0">{item.label}:</span>
                    <select
                      id={`fav-voice-${item.code}`}
                      name={`favVoice_${item.code}`}
                      aria-label={`Voz favorita para ${item.label}`}
                      value={defaultVoiceByLang[item.code]}
                      onChange={(e) => handleChangeFavoriteLanguageVoice(item.code, e.target.value)}
                      className="bg-transparent font-mono font-bold text-[11px] text-primary focus:outline-none cursor-pointer min-w-0 truncate"
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
                className="hidden sm:inline-flex btn-compact-touch h-7 px-2.5 py-0.5 rounded-full btn-matte-amber text-white text-[10px] font-extrabold transition-all cursor-pointer items-center gap-1 shadow-sm shrink-0"
                title="Aplicar estas vozes favoritas a todos os cards da conversa atual"
              >
                <GoogleIcon name="sync" size={12} />
                <span>Aplicar aos Cards</span>
              </button>
            </div>

            <div className="hidden xl:flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleNewConversation}
                className="btn-matte btn-matte-dark px-3 py-1.5 text-xs text-primary font-medium cursor-pointer flex items-center gap-1"
                title="Iniciar Nova Conversa Limpa"
              >
                <GoogleIcon name="add" size={16} className="text-amber-400" />
                <span>Nova Conversa</span>
              </button>

              <button
                type="button"
                onClick={() => (onOpenStudyTab ? onOpenStudyTab() : setIsDeckDrawerOpen(true))}
                className="btn-matte btn-matte-dark px-3 py-1.5 text-xs text-primary font-medium cursor-pointer flex items-center gap-1.5"
                title="Abrir Área de Estudo (Flashcards Deck)"
              >
                <GoogleIcon name="school" size={16} className="text-amber-400" />
                <span>Área de Estudo</span>
                <span className="bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums">
                  {deck.length}
                </span>
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* 2. Toast de Feedback Suave */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-40 card-matte border border-emerald-500/40 text-primary px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
          <GoogleIcon name="check_circle" size={16} filled className="text-emerald-400" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* 3. Feed de Mensagens do Chat (Canvas Multi-Pane com Enquadramento Amplo max-w-[1440px]) */}
      <div
        role="region"
        aria-label="Feed de conversas poliglotas"
        className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 pb-6 sm:pb-12 flex flex-col gap-4 sm:gap-6"
      >
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
              onSendToCreationStudio={onSendToCreationStudio}
              onExecuteYoutubePostLinkAction={handleExecuteYoutubePostLinkAction}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Pílula de Chat Fixa Multimodal (Botão +, Serviços, Gemini Live e Linha Animada) */}
      <AgentInputDock
        onSendMessage={handleSendMessage}
        onSendToCreationStudio={(typedText, renderMode) => {
          if (!onSendToCreationStudio) return;
          if (typedText) {
            onSendToCreationStudio(typedText, renderMode);
            return;
          }
          const focusedMsg = messages.find((m) => m.id === focusedMessageId) || messages[messages.length - 1];
          const fallbackText = focusedMsg
            ? [focusedMsg.userPrompt, focusedMsg.agentReplyPtBr, focusedMsg.fullText.en]
                .filter(Boolean)
                .join('\n\n')
            : '';
          onSendToCreationStudio(fallbackText, renderMode);
        }}
        isLoading={isLoading}
        activeVoiceName={currentFocusedVoice}
      />

      {/* 5. Gaveta Lateral Retrátil de Flashcards */}
      <FlashcardDeckDrawer
        isOpen={isDeckDrawerOpen}
        onClose={() => setIsDeckDrawerOpen(false)}
        cards={deck}
        onDeleteCard={(id) => deleteFlashcardFromDeck(id)}
        onClearDeck={() => clearFlashcardDeck()}
        onPlayCardAudio={handlePlayChunkAudio}
      />

      {/* 6. Modal de Exportação com Prévia do Formato e Download WAV da Trilogia */}
      <ExportInteractionModal
        isOpen={Boolean(exportingMessage)}
        onClose={() => setExportingMessage(null)}
        message={exportingMessage}
        cardVoices={exportingMessage ? getCardVoicesForMessage(exportingMessage.id) : undefined}
        onAddCardsToDeck={(newCards) => {
          addFlashcardsToDeck(newCards);
        }}
        onExportTrilogyWav={handleExportTrilogyWav}
        onShowToast={showToast}
      />
    </div>
  );
};

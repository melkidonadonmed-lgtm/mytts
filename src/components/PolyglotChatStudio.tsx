import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PolyglotMessage, FlashcardItem } from '../types/polyglot';
import { ParallelMessageBlock } from './ParallelMessageBlock';
import { AgentInputDock } from './AgentInputDock';
import { FlashcardDeckDrawer } from './FlashcardDeckDrawer';
import { GoogleIcon } from './GoogleIcon';
import { base64ToBlobUrl, revokeAudioUrl } from '../utils/audio';
import {
  generateAudioCacheKey,
  synthesizeWithCache,
  getCachedAudio,
  getCachedKeySet,
} from '../utils/audioCache';

// Mensagem inicial de exemplo de alta fluência
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
  status: 'ready',
};

export const PolyglotChatStudio: React.FC = () => {
  const [messages, setMessages] = useState<PolyglotMessage[]>([INITIAL_DEMO_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [deck, setDeck] = useState<FlashcardItem[]>(() => {
    try {
      const saved = localStorage.getItem('mytts_polyglot_deck');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isDeckDrawerOpen, setIsDeckDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Idioma selecionado por mensagem (padrão 'en')
  const [selectedLanguageByMsg, setSelectedLanguageByMsg] = useState<Record<string, 'en' | 'it' | 'ja'>>({
    'msg-demo-1': 'en',
  });

  // Configurações de voz por idioma
  const [voiceByLang, setVoiceByLang] = useState<Record<'en' | 'it' | 'ja', string>>({
    en: 'Puck',
    it: 'Kore',
    ja: 'Aoede',
  });

  // Velocidade de reprodução
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Estados do Player de Áudio Flutuante
  const [playingBlockInfo, setPlayingBlockInfo] = useState<{
    messageId: string;
    lang: 'en' | 'it' | 'ja';
  } | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Modo Sequencial (Trilogia EN -> IT -> JA)
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [sequenceStep, setSequenceStep] = useState<string | null>(null);
  const sequenceAbortRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // Estado de chunk avulso e flashcard
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [generatingCardKey, setGeneratingCardKey] = useState<string | null>(null);

  const activeAudioRef = useRef<{
    audio: HTMLAudioElement;
    blobUrl: string;
    messageId: string;
    lang: 'en' | 'it' | 'ja';
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Salvar deck no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mytts_polyglot_deck', JSON.stringify(deck));
    } catch (e) {
      console.warn('Erro ao salvar deck no localStorage:', e);
    }
  }, [deck]);

  // Conjunto de chaves de áudio já persistidas no cache local
  const [cachedKeysSet, setCachedKeysSet] = useState<Set<string>>(new Set());

  const getMessageAudioCacheKey = useCallback(
    (messageId: string, lang: 'en' | 'it' | 'ja') => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || !msg.fullText[lang]) return '';
      return generateAudioCacheKey({
        type: 'speech',
        text: msg.fullText[lang],
        voiceId: voiceByLang[lang],
        language: getLanguageTag(lang),
        speed: playbackSpeed,
        emotion: 'natural',
      });
    },
    [messages, voiceByLang, playbackSpeed]
  );

  // Sincroniza em lote as chaves de mensagens já em cache local (IndexedDB/L1)
  useEffect(() => {
    let isSubscribed = true;
    const allKeys: string[] = [];
    messages.forEach((msg) => {
      (['en', 'it', 'ja'] as const).forEach((lang) => {
        if (msg.fullText[lang]) {
          const k = generateAudioCacheKey({
            type: 'speech',
            text: msg.fullText[lang],
            voiceId: voiceByLang[lang],
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
  }, [messages, voiceByLang, playbackSpeed]);

  // Rolar para a última mensagem ao adicionar conteúdo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sinaliza desmontagem e aborta qualquer trilogia sequencial em andamento
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      sequenceAbortRef.current = true;
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getLanguageTag = (code: string) => {
    if (code === 'it') return 'it-IT';
    if (code === 'ja') return 'ja-JP';
    return 'en-US';
  };

  // Parar qualquer áudio em execução com limpeza de memória
  const stopCurrentAudio = useCallback(() => {
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

  // Seleção de card / idioma para uma mensagem
  const handleSelectLanguage = (messageId: string, lang: 'en' | 'it' | 'ja') => {
    setSelectedLanguageByMsg((prev) => ({ ...prev, [messageId]: lang }));
    if (
      activeAudioRef.current &&
      activeAudioRef.current.messageId === messageId &&
      activeAudioRef.current.lang !== lang
    ) {
      stopCurrentAudio();
    }
  };

  // Reprodução ou Pausa do Áudio do Card Selecionado
  const handleTogglePlay = async (messageId: string, lang: 'en' | 'it' | 'ja') => {
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
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.fullText[lang]) return;

    const cacheKey = generateAudioCacheKey({
      type: 'speech',
      text: targetMsg.fullText[lang],
      voiceId: voiceByLang[lang],
      language: getLanguageTag(lang),
      speed: playbackSpeed,
      emotion: 'natural',
    });

    // Se o áudio não estiver no cache local (0ms), exibe o spinner de síntese
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
          voiceId: voiceByLang[lang],
          language: getLanguageTag(lang),
          speed: playbackSpeed,
          emotion: 'natural',
        },
        cacheKey,
        metadata: {
          language: getLanguageTag(lang),
          voiceId: voiceByLang[lang],
          speed: playbackSpeed,
          emotion: 'natural',
        },
      });

      setCachedKeysSet((prev) => new Set(prev).add(cacheKey));
      const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');

      // Componente desmontado durante a síntese: não criar áudio órfão nem setState
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

  // Replay do áudio do card
  const handleReplay = (messageId: string, lang: 'en' | 'it' | 'ja') => {
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

  // Seek na barra de progresso (scrubber)
  const handleSeek = (time: number) => {
    if (activeAudioRef.current) {
      activeAudioRef.current.audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Alteração de velocidade
  const handleChangeSpeed = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    if (activeAudioRef.current) {
      activeAudioRef.current.audio.playbackRate = newSpeed;
    }
  };

  // Alteração de voz
  const handleChangeVoice = (lang: 'en' | 'it' | 'ja', voice: string) => {
    setVoiceByLang((prev) => ({ ...prev, [lang]: voice }));
    if (activeAudioRef.current && activeAudioRef.current.lang === lang) {
      stopCurrentAudio();
    }
  };

  // Aguarda o fim do áudio em reprodução (polling com cleanup garantido em todos os caminhos)
  const waitForAudioEnd = useCallback((isStopped: () => boolean) => {
    return new Promise<void>((resolve, reject) => {
      let pollId: ReturnType<typeof setInterval> | null = null;
      let gapTimeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (pollId !== null) {
          clearInterval(pollId);
          pollId = null;
        }
        if (gapTimeoutId !== null) {
          clearTimeout(gapTimeoutId);
          gapTimeoutId = null;
        }
      };

      const settle = (error?: unknown) => {
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
        } catch (e) {
          settle(e);
        }
      }, 100);
    });
  }, []);

  // Modo Trilogia Sequencial (EN -> IT -> JA)
  const handlePlaySequence = async (messageId: string) => {
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
    const isStopped = () => sequenceAbortRef.current || !isMountedRef.current;

    try {
      for (const lang of languages) {
        if (isStopped()) break;

        setSelectedLanguageByMsg((prev) => ({ ...prev, [messageId]: lang }));
        setSequenceStep(stepNames[lang]);

        try {
          await handleTogglePlay(messageId, lang);
          await waitForAudioEnd(isStopped);
        } catch (e) {
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

  // Envio de nova mensagem para alinhamento em 3 línguas
  const handleSendMessage = async (text: string) => {
    const newMessageId = `msg-${Date.now()}`;
    const placeholderMessage: PolyglotMessage = {
      id: newMessageId,
      userPrompt: text,
      timestamp: Date.now(),
      chunks: [],
      fullText: { en: '', it: '', ja: '' },
      status: 'loading',
    };

    setMessages((prev) => [...prev, placeholderMessage]);
    setSelectedLanguageByMsg((prev) => ({ ...prev, [newMessageId]: 'en' }));
    setIsLoading(true);

    try {
      const resp = await fetch('/api/translate-parallel-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar os chunks paralelos.');
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessageId
            ? {
                ...msg,
                chunks: data.chunks,
                fullText: data.fullText,
                status: 'ready',
              }
            : msg
        )
      );
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

  // Reprodução de chunk individual com sotaque nativo e cache local
  const handlePlayChunkAudio = async (text: string, language: string) => {
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

  // Geração de Flashcard via Gemini 3.8 Flash
  const handleCreateFlashcard = async (chunkText: string, language: string) => {
    setGeneratingCardKey(chunkText);

    try {
      const resp = await fetch('/api/generate-flashcard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkText, language }),
      });

      const data = await resp.json();
      if (data.success && data.card) {
        setDeck((prev) => [data.card, ...prev]);
        showToast(`Flashcard "${chunkText}" adicionado ao seu Deck!`);
      } else {
        throw new Error(data.error || 'Falha ao criar flashcard.');
      }
    } catch (e: unknown) {
      console.error(e);
      alert('Erro ao criar flashcard: ' + (e instanceof Error ? e.message : 'erro desconhecido'));
    } finally {
      setGeneratingCardKey(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* 1. Header Minimalista do Estúdio Poliglota */}
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400">
            <GoogleIcon name="translate" size={20} />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 font-display">
              <span>Chat Poliglota Multimodal</span>
              <span className="text-[10px] font-mono bg-emerald-400/10 text-emerald-300 border border-emerald-400/20 px-2 py-0.5 rounded-full font-medium">
                🇺🇸 EN • 🇮🇹 IT • 🇯🇵 JA
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Tradução paralela em 3 línguas com controle de áudio individual e foco tátil
            </p>
          </div>
        </div>

        {/* Botão de Acesso ao Deck de Flashcards */}
        <button
          type="button"
          onClick={() => setIsDeckDrawerOpen(true)}
          className="btn-matte btn-matte-dark px-3 py-1.5 text-xs text-slate-200"
          title="Ver Flashcards salvos"
        >
          <GoogleIcon name="style" size={16} className="text-amber-400" />
          <span>Meu Deck</span>
          <span className="bg-amber-400 text-slate-950 font-bold px-1.5 py-0.2 rounded-full text-[10px] font-mono">
            {deck.length}
          </span>
        </button>
      </header>

      {/* 2. Toast de Feedback Suave */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-40 bg-slate-900 border border-emerald-500/40 text-emerald-200 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
          <GoogleIcon name="check_circle" size={16} filled className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3. Feed de Mensagens do Chat (Canvas Multi-Pane) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-32 flex flex-col gap-6">
        {messages.map((message) => {
          const selectedLang = selectedLanguageByMsg[message.id] || 'en';
          const isThisBlockPlaying =
            playingBlockInfo?.messageId === message.id && isPlayingAudio;
          const isThisBlockLoading =
            playingBlockInfo?.messageId === message.id && isLoadingAudio;

          const isCachedByLang = {
            en: cachedKeysSet.has(getMessageAudioCacheKey(message.id, 'en')),
            it: cachedKeysSet.has(getMessageAudioCacheKey(message.id, 'it')),
            ja: cachedKeysSet.has(getMessageAudioCacheKey(message.id, 'ja')),
          };

          return (
            <ParallelMessageBlock
              key={message.id}
              message={message}
              onPlayChunkAudio={handlePlayChunkAudio}
              onCreateFlashcard={handleCreateFlashcard}
              playingAudioKey={playingAudioKey}
              generatingCardKey={generatingCardKey}
              selectedLanguage={selectedLang}
              onSelectLanguage={(lang) => handleSelectLanguage(message.id, lang)}
              isPlaying={isThisBlockPlaying}
              isLoading={isThisBlockLoading}
              isCachedByLang={isCachedByLang}
              onTogglePlay={(lang) => handleTogglePlay(message.id, lang)}
              onReplay={(lang) => handleReplay(message.id, lang)}
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              speed={playbackSpeed}
              onChangeSpeed={handleChangeSpeed}
              voiceByLang={voiceByLang}
              onChangeVoice={handleChangeVoice}
              onPlaySequence={() => handlePlaySequence(message.id)}
              isPlayingSequence={isPlayingSequence}
              sequenceStep={sequenceStep}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* 4. Dock Inferior Multimodal (Agent Input Dock) */}
      <AgentInputDock
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
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
    </div>
  );
};

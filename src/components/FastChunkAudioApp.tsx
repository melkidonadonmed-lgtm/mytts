import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sparkles, Search, BookOpen, Loader2 } from 'lucide-react';
import { ChunkItem, TargetLang } from '../types/chunks';
import { base64ToBlobUrl, revokeAudioUrl } from '../utils/audio';
import {
  generateAudioCacheKey,
  synthesizeWithCache,
  getCachedAudio,
  getCachedKeySet,
} from '../utils/audioCache';
import {
  readPreferredTargetLanguage,
  requestFetchUserChunks,
  requestDeleteUserChunk,
  requestGenerateChunks,
} from '../services/polyglotClient';
import { getActiveSession, subscribeAuthChanges } from '../services/authService';
import { addFlashcardsToDeck, chunkItemToFlashcard } from '../services/flashcardDeckStorage';
import { GoogleIcon } from './GoogleIcon';
import { CHUNK_LANGUAGES, CHUNK_PRESETS } from './chunks/chunkPresets';
import { ChunkCard } from './chunks/ChunkCard';
import { ChunkGeneratorModal } from './chunks/ChunkGeneratorModal';

export interface FastChunkAudioAppProps {
  onOpenStudyTab?: () => void;
  onOpenPolyglotTab?: () => void;
  flashcardCount?: number;
}

function shortLangToTargetLang(shortLang: 'en' | 'it' | 'ja'): TargetLang {
  if (shortLang === 'it') return 'it-IT';
  if (shortLang === 'ja') return 'ja-JP';
  return 'en-US';
}

export const FastChunkAudioApp: React.FC<FastChunkAudioAppProps> = ({
  onOpenStudyTab,
  onOpenPolyglotTab,
  flashcardCount = 0,
}) => {
  const [selectedLang, setSelectedLang] = useState<TargetLang>(() =>
    shortLangToTargetLang(readPreferredTargetLanguage())
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loopDrillId, setLoopDrillId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addedFlashcardId, setAddedFlashcardId] = useState<string | null>(null);

  const [customChunks, setCustomChunks] = useState<ChunkItem[]>([]);
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);

  const [cachedChunkIds, setCachedChunkIds] = useState<Set<string>>(new Set());
  const [loadingNeuralId, setLoadingNeuralId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [userId, setUserId] = useState<string>(() => getActiveSession().uid);

  useEffect(() => {
    const onPrefChanged = () => {
      setSelectedLang(shortLangToTargetLang(readPreferredTargetLanguage()));
    };
    window.addEventListener('mytts-preferred-lang-changed', onPrefChanged);
    return () => window.removeEventListener('mytts-preferred-lang-changed', onPrefChanged);
  }, []);

  useEffect(() => {
    return subscribeAuthChanges((nextSession) => setUserId(nextSession.uid));
  }, []);

  const stopAndRevokeChunkAudio = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if (activeBlobUrlRef.current) {
      revokeAudioUrl(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
      stopAndRevokeChunkAudio();
    };
  }, [selectedLang, stopAndRevokeChunkAudio]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.speechSynthesis?.cancel();
        if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
        setLoopDrillId(null);
        setSpeakingId(null);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const fetchUserChunks = useCallback(async () => {
    try {
      setIsLoadingBackend(true);
      const chunks = await requestFetchUserChunks(selectedLang, userId);
      setCustomChunks(chunks);
    } catch (err: unknown) {
      console.warn('Falha ao carregar chunks da nuvem:', err);
    } finally {
      setIsLoadingBackend(false);
    }
  }, [selectedLang, userId]);

  useEffect(() => {
    void fetchUserChunks();
  }, [fetchUserChunks]);

  const handleSendChunkToFlashcard = (item: ChunkItem) => {
    const card = chunkItemToFlashcard(item, selectedLang);
    addFlashcardsToDeck([card]);
    setAddedFlashcardId(item.id);
    window.setTimeout(() => {
      setAddedFlashcardId((prev) => (prev === item.id ? null : prev));
    }, 2000);
  };

  const speakChunk = (text: string, id: string, onEndCallback?: () => void): void => {
    if (!('speechSynthesis' in window)) {
      setGenerateError('Seu navegador não suporta síntese de voz nativa.');
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/\(.*?\)/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = selectedLang;
    utterance.rate = playbackRate;
    utterance.pitch = 1.0;

    setSpeakingId(id);

    utterance.onend = () => {
      setSpeakingId(null);
      if (onEndCallback) onEndCallback();
    };
    utterance.onerror = () => {
      setSpeakingId(null);
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
      setLoopDrillId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const playAudioBase64 = useCallback(
    async (base64Audio: string, id: string): Promise<void> => {
      stopAndRevokeChunkAudio();
      const blobUrl = base64ToBlobUrl(base64Audio, 'audio/wav');
      activeBlobUrlRef.current = blobUrl;
      const audio = new Audio(blobUrl);
      audio.preservesPitch = true;
      audio.playbackRate = playbackRate;
      audioPlayerRef.current = audio;
      setSpeakingId(id);

      const releaseCurrentBlob = () => {
        setSpeakingId(null);
        revokeAudioUrl(blobUrl);
        if (activeBlobUrlRef.current === blobUrl) activeBlobUrlRef.current = null;
        if (audioPlayerRef.current === audio) audioPlayerRef.current = null;
      };

      audio.onended = releaseCurrentBlob;
      audio.onerror = releaseCurrentBlob;
      await audio.play();
    },
    [playbackRate, stopAndRevokeChunkAudio]
  );

  const speakNeuralChunk = async (text: string, id: string): Promise<void> => {
    window.speechSynthesis?.cancel();
    stopAndRevokeChunkAudio();

    const cacheKey = generateAudioCacheKey({ type: 'chunk', text, language: selectedLang });

    try {
      const cached = await getCachedAudio(cacheKey);
      if (cached && cached.audioBase64) {
        setCachedChunkIds((prev) => new Set(prev).add(id));
        await playAudioBase64(cached.audioBase64, id);
        return;
      }

      setLoadingNeuralId(id);
      const res = await synthesizeWithCache({
        endpoint: '/api/synthesize-chunk',
        body: { text, language: selectedLang },
        cacheKey,
        metadata: { language: selectedLang },
      });

      if (res.audioBase64) {
        setCachedChunkIds((prev) => new Set(prev).add(id));
        await playAudioBase64(res.audioBase64, id);
      } else {
        speakChunk(text, id);
      }
    } catch (err: unknown) {
      console.warn('Fallback para Web Speech nativo:', err);
      speakChunk(text, id);
    } finally {
      setLoadingNeuralId(null);
    }
  };

  const toggleLoopDrill = (chunkText: string, id: string): void => {
    if (loopDrillId === id) {
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
      window.speechSynthesis.cancel();
      setLoopDrillId(null);
      setSpeakingId(null);
      return;
    }

    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    setLoopDrillId(id);

    const runLoop = (): void => {
      speakChunk(chunkText, id, () => {
        loopTimerRef.current = setTimeout(() => runLoop(), 1800);
      });
    };

    runLoop();
  };

  const handleCopy = (text: string, id: string): void => {
    navigator.clipboard.writeText(text).catch((e) => console.warn('Clipboard indisponível:', e));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDeleteCustomChunk = async (id: string): Promise<void> => {
    try {
      const ok = await requestDeleteUserChunk(id, userId);
      if (ok) setCustomChunks((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      console.error('Erro ao deletar chunk:', err);
    }
  };

  const handleGenerateChunks = async (): Promise<void> => {
    if (!inputText.trim()) return;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const data = await requestGenerateChunks({
        textOrPrompt: inputText.trim(),
        language: selectedLang,
        count: 3,
        userId,
      });
      if (!data.ok || !data.success) {
        throw new Error(data.error || 'Falha ao gerar blocos coloquiais.');
      }

      const newChunks: ChunkItem[] = data.chunks || [];
      setCustomChunks((prev) => [...newChunks, ...prev]);
      setInputText('');
      setIsModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      setGenerateError(err instanceof Error ? err.message : 'Erro ao consultar o Gemini.');
    } finally {
      setIsGenerating(false);
    }
  };

  const allCurrentChunks = useMemo(() => {
    const presets = CHUNK_PRESETS[selectedLang]?.geral || [];
    return [...customChunks, ...presets];
  }, [selectedLang, customChunks]);

  const filteredChunks = useMemo(
    () =>
      allCurrentChunks.filter(
        (item) =>
          item.chunk.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.literalOrNuance.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.pronunciationHint &&
            item.pronunciationHint.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    [allCurrentChunks, searchTerm]
  );

  useEffect(() => {
    let isSubscribed = true;
    const keys = filteredChunks.map((c) =>
      generateAudioCacheKey({ type: 'chunk', text: c.chunk, language: selectedLang })
    );

    getCachedKeySet(keys).then((cachedKeys) => {
      if (!isSubscribed) return;
      const ids = new Set<string>();
      filteredChunks.forEach((c) => {
        const k = generateAudioCacheKey({ type: 'chunk', text: c.chunk, language: selectedLang });
        if (cachedKeys.has(k)) ids.add(c.id);
      });
      setCachedChunkIds(ids);
    });

    return () => {
      isSubscribed = false;
    };
  }, [selectedLang, filteredChunks]);

  return (
    <div className="flex-1 flex flex-col font-sans pb-24 selection:bg-amber-500/20">
      {/* 1. Header Focado e Rápido */}
      <header className="lg:sticky lg:top-0 z-20 dock-matte border-b border-[var(--border-subtle)] px-3 sm:px-6 lg:px-8 py-3">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-primary flex items-center gap-1.5 font-display">
                FastChunks
                <span className="text-[10px] font-mono bg-amber-400/10 text-amber-300 border border-amber-400/20 rounded-full px-2 py-0.5">
                  Áudio Direto
                </span>
              </h1>
              <p className="text-[11px] text-secondary">Blocos de fala natural e treino auditivo</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenPolyglotTab && (
              <button
                type="button"
                onClick={onOpenPolyglotTab}
                className="min-h-11 px-3 py-1.5 rounded-xl btn-matte-dark border border-[var(--border-subtle)] text-xs font-semibold text-secondary hover:text-primary flex items-center gap-1.5 cursor-pointer"
              >
                <GoogleIcon name="translate" size={15} className="text-amber-400" />
                <span className="hidden sm:inline">Chat Poliglota</span>
              </button>
            )}
            {onOpenStudyTab && (
              <button
                type="button"
                onClick={onOpenStudyTab}
                className="min-h-11 px-3 py-1.5 rounded-xl btn-matte-dark border border-[var(--border-subtle)] text-xs font-semibold text-primary flex items-center gap-1.5 cursor-pointer"
              >
                <GoogleIcon name="school" size={15} className="text-amber-400" />
                <span>Área de Estudo</span>
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px] font-extrabold tabular-nums">
                  {flashcardCount}
                </span>
              </button>
            )}

            <div className="flex items-center bg-slate-900 border border-[var(--border-subtle)] rounded-xl p-0.5">
              {[0.8, 1.0, 1.25].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                  className={`min-h-11 px-2.5 rounded-lg text-xs font-mono tabular-nums font-semibold transition-all cursor-pointer ${
                    playbackRate === rate
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`Velocidade de reprodução: ${rate}x`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Conteúdo Central em Régua Canônica 1440px */}
      <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 flex-1 flex flex-col gap-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-4 grid grid-cols-3 gap-2">
            {CHUNK_LANGUAGES.map((lang) => {
              const isSelected = selectedLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setSelectedLang(lang.code);
                    setLoopDrillId(null);
                    window.speechSynthesis?.cancel();
                  }}
                  className={`min-h-11 flex items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition-all active:translate-y-px cursor-pointer ${
                    isSelected
                      ? 'border-amber-400/60 bg-amber-400/10 text-amber-200 shadow-sm shadow-amber-500/10'
                      : 'border-[var(--border-subtle)] bg-slate-900/60 text-slate-400 hover:border-[var(--border-control)] hover:text-slate-200'
                  }`}
                >
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950/60 border border-[var(--border-subtle)]">
                    {lang.flag}
                  </span>
                  <span>{lang.label}</span>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-5 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por situação (ex: topo, relaxa, resumindo)..."
              aria-label="Buscar chunk por situação ou expressão"
              className="min-h-11 w-full rounded-xl border border-[var(--border-control)] bg-slate-900/80 px-4 pl-10 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400/70 focus:outline-none transition-colors"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="lg:col-span-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="min-h-11 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs px-4 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 active:translate-y-px transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Extrair ou Criar Chunks IA</span>
            </button>
          </div>
        </div>

        {isLoadingBackend && (
          <div className="flex items-center justify-center gap-2 text-xs text-amber-400/80 py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Sincronizando chunks na nuvem...</span>
          </div>
        )}

        {generateError && !isModalOpen && (
          <div className="flex items-center justify-between gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 rounded-xl">
            <span>{generateError}</span>
            <button
              type="button"
              onClick={() => setGenerateError(null)}
              className="min-h-11 px-2 text-rose-400 hover:text-white font-mono text-[11px] cursor-pointer"
            >
              dispensar
            </button>
          </div>
        )}

        <div
          className={
            filteredChunks.length === 0
              ? 'flex flex-col'
              : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch'
          }
        >
          {filteredChunks.length === 0 ? (
            <div className="card-outlined border border-[var(--border-subtle)] text-center py-12 rounded-2xl p-6 max-w-xl mx-auto w-full">
              <BookOpen className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-secondary">Nenhum chunk encontrado para essa busca.</p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="mt-3 min-h-11 px-4 py-1.5 rounded-xl btn-matte-amber text-white text-xs font-bold cursor-pointer"
              >
                Criar novo chunk com IA agora
              </button>
            </div>
          ) : (
            filteredChunks.map((item) => (
              <ChunkCard
                key={item.id}
                item={item}
                isSpeaking={speakingId === item.id}
                isDrilling={loopDrillId === item.id}
                isCached={cachedChunkIds.has(item.id)}
                isLoadingNeural={loadingNeuralId === item.id}
                isCopied={copiedId === item.id}
                isAddedFlashcard={addedFlashcardId === item.id}
                onSendToFlashcard={handleSendChunkToFlashcard}
                onDeleteCustomChunk={(id) => void handleDeleteCustomChunk(id)}
                onCopy={handleCopy}
                onSpeakNeural={(text, id) => void speakNeuralChunk(text, id)}
                onSpeakNative={speakChunk}
                onToggleLoopDrill={toggleLoopDrill}
              />
            ))
          )}
        </div>
      </div>

      <ChunkGeneratorModal
        isOpen={isModalOpen}
        inputText={inputText}
        isGenerating={isGenerating}
        generateError={generateError}
        onChangeInputText={setInputText}
        onClose={() => setIsModalOpen(false)}
        onGenerate={() => void handleGenerateChunks()}
      />
    </div>
  );
};

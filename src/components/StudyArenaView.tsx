import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { FlashcardImporterModal } from './FlashcardImporterModal';
import { normalizeLanguageBadge } from '../utils/flashcardParser';
import {
  readFlashcardDeck,
  subscribeFlashcardDeck,
  addFlashcardsToDeck,
  deleteFlashcardFromDeck,
  clearFlashcardDeck,
  rateFlashcardRetention,
} from '../services/flashcardDeckStorage';
import { downloadFlashcardsCsv } from '../utils/csvExporter';
import { generateAudioCacheKey, synthesizeWithCache } from '../utils/audioCache';
import {
  base64ToBlobUrl,
  revokeAudioUrl,
  speakBrowserFallback,
  stopBrowserSpeech,
} from '../utils/audio';
import type { FlashcardItem } from '../types/polyglot';
import type { VoiceProfile } from '../types/voices';

interface StudyArenaViewProps {
  selectedVoice: VoiceProfile;
  initialCardId?: string | null;
}

function mapLanguageBadgeToBcp47(lang: string): string {
  const upper = (lang || '').toUpperCase();
  if (upper.includes('IT')) return 'it-IT';
  if (upper.includes('JA') || upper.includes('JP')) return 'ja-JP';
  return 'en-US';
}

export const StudyArenaView: React.FC<StudyArenaViewProps> = ({
  selectedVoice,
  initialCardId,
}) => {
  const [cards, setCards] = useState<FlashcardItem[]>(() => readFlashcardDeck());
  const [selectedDeck, setSelectedDeck] = useState<string>('ALL');
  const [selectedLang, setSelectedLang] = useState<'ALL' | 'EN' | 'IT' | 'JA'>('ALL');
  const [viewMode, setViewMode] = useState<'arena' | 'grid'>('arena');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [autoPlayTts, setAutoPlayTts] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setCards(readFlashcardDeck());
    return subscribeFlashcardDeck((updated) => {
      setCards(updated);
    });
  }, []);

  // Lista de baralhos disponíveis
  const deckNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of cards) {
      if (c.deckName) names.add(c.deckName);
    }
    return Array.from(names);
  }, [cards]);

  // Filtragem por baralho e idioma
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (selectedDeck !== 'ALL' && (card.deckName || 'Baralho Poliglota') !== selectedDeck) {
        return false;
      }
      if (selectedLang !== 'ALL') {
        const badge = normalizeLanguageBadge(card.language);
        if (badge !== selectedLang) return false;
      }
      return true;
    });
  }, [cards, selectedDeck, selectedLang]);

  // Se initialCardId foi passado (ex.: clicado na HistorySidebar), posiciona nele
  useEffect(() => {
    if (!initialCardId) return;
    const idx = filteredCards.findIndex((c) => c.id === initialCardId);
    if (idx >= 0) {
      setCurrentIndex(idx);
      setIsFlipped(false);
      setViewMode('arena');
    }
  }, [initialCardId, filteredCards]);

  // Mantém índice válido quando a lista filtrada muda
  useEffect(() => {
    if (currentIndex >= filteredCards.length && filteredCards.length > 0) {
      setCurrentIndex(0);
    }
  }, [filteredCards.length, currentIndex]);

  const currentCard = filteredCards[currentIndex] || null;

  // Métricas de retenção (tabular-nums)
  const stats = useMemo(() => {
    let newCount = 0;
    let learningCount = 0;
    let masteredCount = 0;
    for (const c of filteredCards) {
      if (c.status === 'mastered') masteredCount++;
      else if (c.status === 'learning' || c.status === 'review') learningCount++;
      else newCount++;
    }
    return { newCount, learningCount, masteredCount, total: filteredCards.length };
  }, [filteredCards]);

  const stopAudio = useCallback(() => {
    stopBrowserSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (currentBlobUrlRef.current) {
      revokeAudioUrl(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const playCardTts = useCallback(
    async (card: FlashcardItem, speakExample = false) => {
      const textToSpeak = speakExample && card.example ? card.example : card.front;
      if (!textToSpeak.trim()) return;

      stopAudio();
      setIsSpeaking(true);

      const bcp47 = mapLanguageBadgeToBcp47(card.language);
      const voiceId = selectedVoice.id;
      const cacheKey = generateAudioCacheKey({
        type: 'speech',
        text: textToSpeak,
        language: bcp47,
        voiceId,
        speed: 1.0,
        emotion: 'natural',
      });

      try {
        const result = await synthesizeWithCache({
          endpoint: '/api/synthesize-speech',
          body: {
            text: textToSpeak,
            voiceName: voiceId,
            languageCode: bcp47,
            speed: 1.0,
          },
          cacheKey,
          metadata: {
            language: bcp47,
            voiceId,
            speed: 1.0,
            emotion: 'natural',
          },
        });

        if (result.audioBase64) {
          const blobUrl = base64ToBlobUrl(result.audioBase64, 'audio/wav');
          currentBlobUrlRef.current = blobUrl;
          const audio = new Audio(blobUrl);
          audio.preservesPitch = true;
          audioRef.current = audio;
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => {
            setIsSpeaking(false);
          };
          await audio.play();
          return;
        }
      } catch {
        // Fallback automático para síntese nativa diferenciada por voz
      }

      speakBrowserFallback(textToSpeak, {
        lang: bcp47,
        voiceId,
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [selectedVoice.id, stopAudio]
  );

  // Auto-play ao trocar de card se ativado
  useEffect(() => {
    if (autoPlayTts && currentCard && viewMode === 'arena') {
      void playCardTts(currentCard, false);
    }
  }, [currentIndex, autoPlayTts, currentCard, playCardTts, viewMode]);

  const handleRateCard = useCallback(
    (rating: 1 | 2 | 3) => {
      if (!currentCard) return;
      rateFlashcardRetention(currentCard.id, rating);
      setIsFlipped(false);
      if (filteredCards.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % filteredCards.length);
      }
    },
    [currentCard, filteredCards.length]
  );

  // Atalhos de teclado da Arena de Estudo (Espaço = Virar, R = Ouvir TTS, 1/2/3 = Avaliar)
  useEffect(() => {
    if (viewMode !== 'arena' || isImporterOpen || !currentCard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        void playCardTts(currentCard, false);
      } else if (e.key === '1') {
        e.preventDefault();
        handleRateCard(1);
      } else if (e.key === '2') {
        e.preventDefault();
        handleRateCard(2);
      } else if (e.key === '3') {
        e.preventDefault();
        handleRateCard(3);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex((prev) => (prev + 1) % Math.max(1, filteredCards.length));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex(
          (prev) => (prev - 1 + filteredCards.length) % Math.max(1, filteredCards.length)
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isImporterOpen, currentCard, playCardTts, handleRateCard, filteredCards.length]);

  return (
    <section
      aria-label="Área de Estudo e Revisão Espaçada"
      className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6"
    >
      {/* Cabeçalho da Área de Estudo */}
      <header className="p-4 sm:p-5 rounded-3xl card-matte border border-slate-800/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl btn-matte-amber flex items-center justify-center text-white shadow-lg shadow-amber-500/20 shrink-0">
            <GoogleIcon name="school" size={22} filled />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-primary font-display tracking-tight">
                Área de Estudo & Flashcards Deck
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                EN · IT · JA
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                Voz: {selectedVoice.name}
              </span>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              Repetição espaçada sincronizada com síntese vocal · Atalhos: <kbd className="font-mono">Espaço</kbd> virar,{' '}
              <kbd className="font-mono">R</kbd> ouvir TTS, <kbd className="font-mono">1-3</kbd> avaliar retenção
            </p>
          </div>
        </div>

        {/* Ações Principais */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImporterOpen(true)}
            className="px-3.5 py-2 rounded-xl btn-matte-amber text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <GoogleIcon name="upload_file" size={16} />
            <span>Importar Flashcards</span>
          </button>

          {cards.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => downloadFlashcardsCsv(filteredCards)}
                className="px-3 py-2 rounded-xl btn-matte-dark text-xs font-bold text-secondary hover:text-primary flex items-center gap-1.5 cursor-pointer"
                title="Exportar baralho filtrado para CSV compatível com Anki/Notion"
              >
                <GoogleIcon name="download" size={15} className="text-amber-400" />
                <span>Exportar Anki CSV</span>
              </button>

              <div className="flex items-center rounded-xl p-0.5 bg-slate-900 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('arena')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    viewMode === 'arena'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  Arena 3D
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  Grade ({filteredCards.length})
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Barra de Filtros e Contadores Tabulares */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        <div className="lg:col-span-5 grid grid-cols-4 gap-2">
          {[
            { label: 'Total', val: stats.total, lblCls: 'text-secondary', valCls: 'text-primary' },
            { label: 'Novos', val: stats.newCount, lblCls: 'text-cyan-400', valCls: 'text-cyan-300' },
            { label: 'Revisar', val: stats.learningCount, lblCls: 'text-amber-400', valCls: 'text-amber-300' },
            { label: 'Dominados', val: stats.masteredCount, lblCls: 'text-emerald-400', valCls: 'text-emerald-300' },
          ].map((stat) => (
            <div key={stat.label} className="p-2.5 rounded-2xl card-matte text-center">
              <span className={`block text-[10px] font-mono uppercase ${stat.lblCls}`}>{stat.label}</span>
              <span className={`text-sm font-extrabold font-mono tabular-nums ${stat.valCls}`}>{stat.val}</span>
            </div>
          ))}
        </div>

        <div className="lg:col-span-7 flex flex-wrap items-center justify-between lg:justify-end gap-2">
          <select
            aria-label="Filtrar por Baralho"
            value={selectedDeck}
            onChange={(e) => { setSelectedDeck(e.target.value); setCurrentIndex(0); setIsFlipped(false); }}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-primary focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Baralhos ({cards.length})</option>
            {deckNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            {(['ALL', 'EN', 'IT', 'JA'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => { setSelectedLang(lang); setCurrentIndex(0); setIsFlipped(false); }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  selectedLang === lang ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-secondary hover:text-primary'
                }`}
              >
                {lang === 'ALL' ? 'TODOS' : lang}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAutoPlayTts((prev) => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
              autoPlayTts ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-slate-900 text-secondary border-slate-800 hover:text-primary'
            }`}
          >
            <GoogleIcon name="volume_up" size={15} />
            <span>Auto-TTS {autoPlayTts ? 'Ativo' : 'Off'}</span>
          </button>
        </div>
      </div>

      {/* Estado Vazio */}
      {filteredCards.length === 0 ? (
        <div className="p-10 rounded-3xl card-matte border border-slate-800/80 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <GoogleIcon name="school" size={28} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-primary font-display">Seu Baralho de Estudo está vazio</h2>
            <p className="text-xs text-secondary leading-relaxed">
              Importe flashcards em segundos via JSON, CSV Anki, tabelas Markdown ou adicione cards diretamente do{' '}
              <strong className="text-primary">Chat Poliglota</strong> e do <strong className="text-primary">FastChunks</strong>.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsImporterOpen(true)}
              className="px-4 py-2.5 rounded-xl btn-matte-amber text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <GoogleIcon name="upload_file" size={17} />
              <span>Importar Agora (JSON / CSV / MD)</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'arena' && currentCard ? (
        /* Arena 3D Interativa */
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="flex items-center justify-between text-xs text-secondary font-mono tabular-nums px-1">
            <span>
              Card <strong className="text-primary">{currentIndex + 1}</strong> de{' '}
              <strong className="text-primary">{filteredCards.length}</strong> · {currentCard.deckName || 'Baralho Poliglota'}
            </span>
            <span className="uppercase text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
              Status: {currentCard.status || 'new'}
            </span>
          </div>

          <div className="rounded-3xl card-matte border border-slate-700/80 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-xs font-extrabold">
                  {normalizeLanguageBadge(currentCard.language)}
                </span>
                <span className="text-xs font-semibold text-secondary">
                  {isFlipped ? 'Verso · Significado & Contexto' : 'Frente · Expressão Alvo'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void playCardTts(currentCard, false)}
                className="px-3.5 py-2 rounded-xl btn-matte-amber text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                title={`Ouvir pronúncia com a voz ${selectedVoice.name} (Atalho: R)`}
              >
                <GoogleIcon name={isSpeaking ? 'Graphic_eq' : 'volume_up'} size={16} />
                <span>{isSpeaking ? 'Sintetizando...' : `Ouvir (${selectedVoice.name})`}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsFlipped((prev) => !prev)}
              className="w-full min-h-[190px] py-6 px-4 rounded-2xl surface-inset border border-slate-800/80 flex flex-col items-center justify-center text-center gap-3 hover:border-amber-500/40 transition-all cursor-pointer"
            >
              {!isFlipped ? (
                <>
                  <p className="text-xl sm:text-2xl font-extrabold text-primary font-display leading-snug">{currentCard.front}</p>
                  {currentCard.pronunciation && (
                    <p className="text-xs font-mono text-amber-300/90 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                      /{currentCard.pronunciation}/
                    </p>
                  )}
                  <span className="text-[11px] text-secondary flex items-center gap-1 pt-2">
                    <GoogleIcon name="flip" size={14} className="text-amber-400" />
                    <span>Clique ou pressione Espaço para revelar a tradução</span>
                  </span>
                </>
              ) : (
                <>
                  <p className="text-lg sm:text-xl font-extrabold text-emerald-300 font-display leading-snug">{currentCard.back}</p>
                  {currentCard.nuance && <p className="text-xs text-secondary max-w-lg leading-relaxed">{currentCard.nuance}</p>}
                  {currentCard.example && (
                    <div className="mt-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800 max-w-lg w-full text-left space-y-1">
                      <p className="text-xs font-semibold text-primary">{currentCard.example}</p>
                      {currentCard.exampleTranslation && <p className="text-[11px] text-secondary">{currentCard.exampleTranslation}</p>}
                    </div>
                  )}
                </>
              )}
            </button>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {[
                { rate: 1 as const, title: '1 · Revisar', sub: 'Agora (+10m)', cls: 'bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 border-rose-500/30', subCls: 'text-rose-400' },
                { rate: 2 as const, title: '2 · Bom', sub: 'Próximo dia', cls: 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/35', subCls: 'text-amber-400' },
                { rate: 3 as const, title: '3 · Dominado', sub: '+4 dias', cls: 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/35', subCls: 'text-emerald-400' },
              ].map((btn) => (
                <button
                  key={btn.rate}
                  type="button"
                  onClick={() => handleRateCard(btn.rate)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-0.5 transition-colors cursor-pointer ${btn.cls}`}
                >
                  <span>{btn.title}</span>
                  <span className={`text-[10px] font-mono ${btn.subCls}`}>{btn.sub}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
              <button
                type="button"
                onClick={() => { setIsFlipped(false); setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length); }}
                className="px-3 py-1.5 rounded-xl btn-matte-dark text-secondary hover:text-primary flex items-center gap-1 cursor-pointer"
              >
                <GoogleIcon name="chevron_left" size={16} />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                onClick={() => deleteFlashcardFromDeck(currentCard.id)}
                className="px-2.5 py-1.5 rounded-xl text-rose-400 hover:bg-rose-950/40 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              >
                <GoogleIcon name="delete" size={14} />
                <span>Excluir Card</span>
              </button>
              <button
                type="button"
                onClick={() => { setIsFlipped(false); setCurrentIndex((prev) => (prev + 1) % filteredCards.length); }}
                className="px-3 py-1.5 rounded-xl btn-matte-dark text-secondary hover:text-primary flex items-center gap-1 cursor-pointer"
              >
                <span>Próximo</span>
                <GoogleIcon name="chevron_right" size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Visão em Grade do Baralho */
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/25 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <GoogleIcon name="delete" size={15} />
                <span>Limpar Todo o Baralho</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-300 font-bold">Confirmar exclusão total?</span>
                <button
                  type="button"
                  onClick={() => { clearFlashcardDeck(); setConfirmClear(false); }}
                  className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                >
                  Sim, Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredCards.map((card, idx) => (
              <div key={card.id} className="p-4 rounded-2xl card-matte border border-slate-800/80 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold">
                      {normalizeLanguageBadge(card.language)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void playCardTts(card, false)}
                        aria-label={`Ouvir ${card.front}`}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 cursor-pointer"
                      >
                        <GoogleIcon name="volume_up" size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCurrentIndex(idx); setIsFlipped(false); setViewMode('arena'); }}
                        aria-label={`Estudar ${card.front} na Arena 3D`}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 cursor-pointer"
                      >
                        <GoogleIcon name="school" size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFlashcardFromDeck(card.id)}
                        aria-label={`Remover ${card.front}`}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800 cursor-pointer"
                      >
                        <GoogleIcon name="delete" size={15} />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-sm font-extrabold text-primary font-display">{card.front}</h3>
                  <p className="text-xs font-semibold text-emerald-300">{card.back}</p>
                  {card.nuance && <p className="text-[11px] text-secondary">{card.nuance}</p>}
                </div>
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-secondary">
                  <span>{card.deckName || 'Baralho Poliglota'}</span>
                  <span className="uppercase">{card.status || 'new'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <FlashcardImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImport={(importedCards) => addFlashcardsToDeck(importedCards)}
        defaultVoiceId={selectedVoice.id}
      />
    </section>
  );
};

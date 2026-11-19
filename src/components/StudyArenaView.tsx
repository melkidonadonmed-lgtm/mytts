import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { FlashcardImporterModal } from './FlashcardImporterModal';
import { StudyDeckOverview } from './study/StudyDeckOverview';
import { FlashcardCreatorPanel, type CreatorLanguageMode } from './study/FlashcardCreatorPanel';
import { FlashcardCatalogManager } from './study/FlashcardCatalogManager';
import { normalizeLanguageBadge } from '../utils/flashcardParser';
import {
  formatCalendarDateLabelPtBr,
  resolveCardDateKey,
  toLocalCalendarDateKey,
} from '../utils/flashcardOrganizer';
import {
  readFlashcardDeck,
  subscribeFlashcardDeck,
  addFlashcardsToDeck,
  deleteFlashcardFromDeck,
  rateFlashcardRetention,
  computeDeckSummaries,
  filterStudyQueue,
  reorganizeFlashcardDeck,
} from '../services/flashcardDeckStorage';
import { downloadFlashcardsCsv } from '../utils/csvExporter';
import { generateAudioCacheKey, synthesizeWithCache } from '../utils/audioCache';
import { base64ToBlobUrl, revokeAudioUrl, speakBrowserFallback, stopBrowserSpeech } from '../utils/audio';
import { computeNextTablistIndex, type StudySubTab } from '../utils/navigationOrganizer';
import type { DateFilterPreset, FlashcardItem } from '../types/polyglot';
import type { VoiceProfile } from '../types/voices';

export type { StudySubTab };

interface StudyArenaViewProps {
  selectedVoice: VoiceProfile;
  initialCardId?: string | null;
  activeSubTab?: StudySubTab;
  onChangeSubTab?: (subTab: StudySubTab) => void;
  onOpenPolyglotTab?: () => void;
  onOpenChunksTab?: () => void;
}

const STUDY_TABS: ReadonlyArray<{ id: StudySubTab; label: string; icon: string }> = [
  { id: 'decks', label: 'Baralhos', icon: 'school' },
  { id: 'review', label: 'Estudar', icon: 'auto_awesome' },
  { id: 'create', label: 'Criar & Gerenciar', icon: 'add' },
];

function mapLanguageBadgeToBcp47(lang: string): string {
  const upper = (lang || '').toUpperCase();
  if (upper.includes('IT')) return 'it-IT';
  if (upper.includes('JA') || upper.includes('JP')) return 'ja-JP';
  return 'en-US';
}

export const StudyArenaView: React.FC<StudyArenaViewProps> = ({
  selectedVoice,
  initialCardId,
  activeSubTab,
  onChangeSubTab,
  onOpenPolyglotTab,
  onOpenChunksTab,
}) => {
  const [cards, setCards] = useState<FlashcardItem[]>(() => readFlashcardDeck());
  const [customDecks, setCustomDecks] = useState<string[]>([]);
  const [internalSubTab, setInternalSubTab] = useState<StudySubTab>(activeSubTab ?? 'decks');
  const studySubTab = activeSubTab ?? internalSubTab;
  const setStudySubTab = useCallback(
    (next: StudySubTab) => {
      setInternalSubTab(next);
      onChangeSubTab?.(next);
    },
    [onChangeSubTab]
  );
  const studyTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>('Baralho Principal');
  const [selectedLang, setSelectedLang] = useState<'ALL' | 'EN' | 'IT' | 'JA'>('ALL');
  const [selectedDatePreset, setSelectedDatePreset] = useState<DateFilterPreset>('ALL');
  const [customDateKey, setCustomDateKey] = useState<string>(() => toLocalCalendarDateKey(Date.now()));
  const [dueOnly, setDueOnly] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [autoPlayTts, setAutoPlayTts] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashcardItem | null>(null);
  const [creatorLangPreset, setCreatorLangPreset] = useState<CreatorLanguageMode>('auto');
  const [creatorDatePreset, setCreatorDatePreset] = useState<string>(() =>
    toLocalCalendarDateKey(Date.now())
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setCards(readFlashcardDeck());
    return subscribeFlashcardDeck((updated) => setCards(updated));
  }, []);

  const summaries = useMemo(() => {
    const computed = computeDeckSummaries(cards);
    for (const name of customDecks) {
      if (!computed.some((s) => s.deckName === name)) {
        computed.push({ deckName: name, total: 0, newCount: 0, dueCount: 0, learningCount: 0, masteredCount: 0, masteryPercent: 0, languages: [] });
      }
    }
    return computed;
  }, [cards, customDecks]);

  const allDeckNames = useMemo(() => {
    const set = new Set<string>(['Baralho Principal', ...customDecks]);
    for (const c of cards) if (c.deckName) set.add(c.deckName);
    return Array.from(set);
  }, [cards, customDecks]);

  const totalCards = cards.length;
  const totalDueToday = useMemo(() => summaries.reduce((acc, s) => acc + s.dueCount, 0), [summaries]);
  const overallMastery = useMemo(() => {
    if (totalCards === 0) return 0;
    return Math.round((cards.filter((c) => c.status === 'mastered').length / totalCards) * 100);
  }, [cards, totalCards]);

  const reviewQueue = useMemo(
    () =>
      filterStudyQueue(cards, {
        deckName: selectedDeck,
        language: selectedLang,
        dueOnly,
        datePreset: selectedDatePreset,
        customDateKey,
      }),
    [cards, selectedDeck, selectedLang, dueOnly, selectedDatePreset, customDateKey]
  );

  useEffect(() => {
    if (currentIndex >= reviewQueue.length && reviewQueue.length > 0) setCurrentIndex(0);
  }, [reviewQueue.length, currentIndex]);

  useEffect(() => {
    if (!initialCardId) return;
    const idx = reviewQueue.findIndex((c) => c.id === initialCardId);
    if (idx >= 0) { setCurrentIndex(idx); setIsFlipped(false); setStudySubTab('review'); }
  }, [initialCardId, reviewQueue, setStudySubTab]);

  const currentCard = reviewQueue[currentIndex] || null;

  const stopAudio = useCallback(() => {
    stopBrowserSpeech();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (currentBlobUrlRef.current) { revokeAudioUrl(currentBlobUrlRef.current); currentBlobUrlRef.current = null; }
    setIsSpeaking(false);
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const playCardTts = useCallback(async (card: FlashcardItem, speakExample = false) => {
    const textToSpeak = speakExample && card.example ? card.example : card.front;
    if (!textToSpeak.trim()) return;
    stopAudio();
    setIsSpeaking(true);
    const bcp47 = mapLanguageBadgeToBcp47(card.language);
    const voiceId = selectedVoice.id;
    const cacheKey = generateAudioCacheKey({ type: 'speech', text: textToSpeak, language: bcp47, voiceId, speed: 1.0, emotion: 'natural' });
    try {
      const result = await synthesizeWithCache({
        endpoint: '/api/synthesize-speech',
        body: { text: textToSpeak, voiceName: voiceId, languageCode: bcp47, speed: 1.0 },
        cacheKey,
        metadata: { language: bcp47, voiceId, speed: 1.0, emotion: 'natural' },
      });
      if (result.audioBase64) {
        const blobUrl = base64ToBlobUrl(result.audioBase64, 'audio/wav');
        currentBlobUrlRef.current = blobUrl;
        const audio = new Audio(blobUrl);
        audio.preservesPitch = true;
        audioRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        await audio.play();
        return;
      }
    } catch { /* Fallback Web Speech */ }
    speakBrowserFallback(textToSpeak, { lang: bcp47, voiceId, onEnd: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });
  }, [selectedVoice.id, stopAudio]);

  useEffect(() => {
    if (autoPlayTts && currentCard && studySubTab === 'review') void playCardTts(currentCard, false);
  }, [currentIndex, autoPlayTts, currentCard, playCardTts, studySubTab]);

  const handleRate = useCallback((rating: 1 | 2 | 3) => {
    if (!currentCard) return;
    rateFlashcardRetention(currentCard.id, rating);
    setIsFlipped(false);
    if (reviewQueue.length > 1) setCurrentIndex((prev) => (prev + 1) % reviewQueue.length);
  }, [currentCard, reviewQueue.length]);

  useEffect(() => {
    if (studySubTab !== 'review' || isImporterOpen || !currentCard) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); setIsFlipped((p) => !p); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); void playCardTts(currentCard, false); }
      else if (e.key === '1' || e.key === '2' || e.key === '3') { e.preventDefault(); handleRate(Number(e.key) as 1 | 2 | 3); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [studySubTab, isImporterOpen, currentCard, playCardTts, handleRate]);

  const ratingIntervals = useMemo(() => {
    const iv = currentCard?.intervalDays || 0;
    return {
      again: '<10m',
      good: iv <= 0 ? '1d' : `${Math.min(30, Math.round(iv * 1.8))}d`,
      easy: iv <= 1 ? '4d' : `${Math.min(90, Math.round(iv * 2.5))}d`,
    };
  }, [currentCard]);

  return (
    <section aria-label="Área de Estudo e Flashcards" className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl btn-matte-amber flex items-center justify-center text-white shadow-lg shadow-amber-500/20 shrink-0">
              <GoogleIcon name="school" size={22} filled />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-primary font-display tracking-tight">Área de Estudo</h1>
              <p className="text-xs text-secondary">Repetição espaçada Anki/Brainscape com síntese neural de voz</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {onOpenPolyglotTab && (
              <button
                type="button"
                onClick={onOpenPolyglotTab}
                className="min-h-[40px] px-3 py-1.5 rounded-xl btn-matte-dark text-xs font-semibold text-secondary hover:text-primary border border-[var(--border-subtle)] flex items-center gap-1.5 cursor-pointer"
              >
                <GoogleIcon name="translate" size={15} className="text-amber-400" />
                <span>Chat Poliglota</span>
              </button>
            )}
            {onOpenChunksTab && (
              <button
                type="button"
                onClick={onOpenChunksTab}
                className="min-h-[40px] px-3 py-1.5 rounded-xl btn-matte-dark text-xs font-semibold text-secondary hover:text-primary border border-[var(--border-subtle)] flex items-center gap-1.5 cursor-pointer"
              >
                <GoogleIcon name="bolt" size={15} className="text-amber-400" />
                <span>FastChunks</span>
              </button>
            )}
            <span className="text-xs font-mono px-2.5 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
              Voz: {selectedVoice.name}
            </span>
          </div>
        </div>

        <div className="hidden lg:block">
          <div
            role="tablist"
            aria-label="Navegação de Modos da Área de Estudo"
            className="tabsOverflowContainer items-center pb-px"
          >
          {STUDY_TABS.map((tab, idx) => {
            const isSelected = studySubTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  studyTabRefs.current[idx] = el;
                }}
                id={`tab-${tab.id}`}
                role="tab"
                type="button"
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                onClick={() => {
                  setStudySubTab(tab.id);
                  if (tab.id !== 'create') setEditingCard(null);
                  studyTabRefs.current[idx]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }}
                onKeyDown={(e) => {
                  const nextIdx = computeNextTablistIndex(idx, STUDY_TABS.length, e.key);
                  if (nextIdx === null) return;
                  e.preventDefault();
                  const nextTab = STUDY_TABS[nextIdx];
                  setStudySubTab(nextTab.id);
                  if (nextTab.id !== 'create') setEditingCard(null);
                  const btn = studyTabRefs.current[nextIdx];
                  btn?.focus();
                  btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }}
                className={`min-h-[44px] px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'text-amber-300 border-b-2 border-amber-400 font-extrabold'
                    : 'text-secondary hover:text-primary border-b-2 border-transparent'
                }`}
              >
                <GoogleIcon name={tab.icon} size={16} />
                <span>{tab.label}</span>
                {tab.id === 'review' && totalDueToday > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 tabular-nums">
                    {totalDueToday}
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </div>
      </header>

      {studySubTab === 'decks' && (
        <div id="panel-decks" role="tabpanel" aria-labelledby="tab-decks">
          <StudyDeckOverview
            cards={cards}
            summaries={summaries}
            totalCards={totalCards}
            totalDueToday={totalDueToday}
            overallMastery={overallMastery}
            onStudyDeck={(d) => {
              setSelectedDeck(d);
              setSelectedLang('ALL');
              setSelectedDatePreset('ALL');
              setDueOnly(true);
              setCurrentIndex(0);
              setIsFlipped(false);
              setStudySubTab('review');
            }}
            onStudyFilter={(filter) => {
              setSelectedDeck(filter.deckName || 'ALL');
              setSelectedLang(filter.language || 'ALL');
              setSelectedDatePreset(filter.datePreset || 'ALL');
              if (filter.customDateKey) setCustomDateKey(filter.customDateKey);
              setDueOnly(false);
              setCurrentIndex(0);
              setIsFlipped(false);
              setStudySubTab('review');
            }}
            onCreateCard={(d) => {
              if (d) setSelectedDeck(d);
              setCreatorLangPreset('auto');
              setCreatorDatePreset(toLocalCalendarDateKey(Date.now()));
              setEditingCard(null);
              setStudySubTab('create');
            }}
            onCreateCardWithPreset={(preset) => {
              if (preset.deckName) setSelectedDeck(preset.deckName);
              setCreatorLangPreset(preset.language || 'auto');
              setCreatorDatePreset(preset.dateKey || toLocalCalendarDateKey(Date.now()));
              setEditingCard(null);
              setStudySubTab('create');
            }}
            onCreateDeck={(d) => { setCustomDecks((p) => Array.from(new Set([...p, d]))); setSelectedDeck(d); setStudySubTab('create'); }}
            onOpenImporter={() => setIsImporterOpen(true)}
            onExportCsv={() => downloadFlashcardsCsv(cards)}
            onExportFilteredCsv={(subset, filename) => downloadFlashcardsCsv(subset, filename)}
            onReorganizeDecks={(mode) => {
              reorganizeFlashcardDeck(mode);
              setSelectedDeck('ALL');
            }}
          />
        </div>
      )}

      {studySubTab === 'review' && (
        <div id="panel-review" role="tabpanel" aria-labelledby="tab-review" className="space-y-5">
          <div className="flex flex-col gap-3 p-3.5 rounded-2xl card-matte border border-slate-800 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="deck-filter" className="text-secondary font-bold">Baralho:</label>
                <select id="deck-filter" value={selectedDeck} onChange={(e) => { setSelectedDeck(e.target.value); setCurrentIndex(0); setIsFlipped(false); }} className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-primary focus:outline-none cursor-pointer">
                  <option value="ALL">Todos os Baralhos</option>
                  {allDeckNames.map((d) => (<option key={d} value={d}>{d}</option>))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-900 border border-slate-800">
                  {(['ALL', 'EN', 'IT', 'JA'] as const).map((l) => (
                    <button key={l} type="button" onClick={() => { setSelectedLang(l); setCurrentIndex(0); setIsFlipped(false); }} className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer ${selectedLang === l ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35' : 'text-secondary hover:text-primary'}`}>
                      {l === 'ALL' ? 'TODOS' : l}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setDueOnly((p) => !p)} className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${dueOnly ? 'bg-amber-500/15 text-amber-300 border-amber-500/35' : 'bg-slate-900 text-secondary border-slate-800'}`}>
                  {dueOnly ? 'Somente pendentes hoje' : 'Todos do baralho'}
                </button>
                <button type="button" onClick={() => setAutoPlayTts((p) => !p)} className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${autoPlayTts ? 'bg-amber-500/15 text-amber-300 border-amber-500/35' : 'bg-slate-900 text-secondary border-slate-800'}`}>
                  Auto-TTS {autoPlayTts ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
              <span className="text-[10px] font-mono uppercase text-secondary font-bold mr-1">Data de criação:</span>
              {([
                { id: 'ALL' as const, label: 'Todas' },
                { id: 'TODAY' as const, label: 'Hoje' },
                { id: 'YESTERDAY' as const, label: 'Ontem' },
                { id: 'LAST_7D' as const, label: '7d' },
                { id: 'LAST_30D' as const, label: '30d' },
                { id: 'CUSTOM' as const, label: 'Data' },
              ]).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={selectedDatePreset === p.id}
                  onClick={() => { setSelectedDatePreset(p.id); setCurrentIndex(0); setIsFlipped(false); }}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                    selectedDatePreset === p.id
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/35'
                      : 'bg-slate-900 text-secondary border-slate-800 hover:text-primary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {selectedDatePreset === 'CUSTOM' && (
                <input
                  type="date"
                  value={customDateKey}
                  onChange={(e) => { setCustomDateKey(e.target.value); setCurrentIndex(0); setIsFlipped(false); }}
                  aria-label="Selecionar data de estudo para revisão"
                  className="min-h-[32px] px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-mono text-primary"
                />
              )}
            </div>
          </div>

          {reviewQueue.length === 0 ? (
            <div className="p-10 rounded-3xl card-matte border border-slate-800 text-center max-w-lg mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <GoogleIcon name="check" size={24} />
              </div>
              <h2 className="text-base font-extrabold text-primary font-display">Tudo revisado neste filtro!</h2>
              <p className="text-xs text-secondary">
                {dueOnly ? 'Você concluiu todos os cards agendados para hoje.' : 'Não há cartas cadastradas com este filtro.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {dueOnly && (
                  <button type="button" onClick={() => setDueOnly(false)} className="min-h-[44px] px-4 py-2 rounded-xl btn-matte-amber text-white text-xs font-bold cursor-pointer">
                    Estudar Todas as Cartas do Baralho
                  </button>
                )}
                <button type="button" onClick={() => { setEditingCard(null); setStudySubTab('create'); }} className="min-h-[44px] px-4 py-2 rounded-xl btn-matte-dark text-secondary hover:text-primary text-xs font-bold border border-slate-800 cursor-pointer">
                  + Criar Nova Carta
                </button>
              </div>
            </div>
          ) : currentCard && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="flex items-center justify-between text-xs text-secondary font-mono tabular-nums px-1">
                <span>Card <strong className="text-primary">{currentIndex + 1}</strong> de <strong className="text-primary">{reviewQueue.length}</strong></span>
                <span className="uppercase text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">{currentCard.status || 'new'}</span>
              </div>

              <div className="rounded-3xl card-matte border border-slate-700/80 p-6 sm:p-8 shadow-2xl space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-xs font-extrabold">
                      {normalizeLanguageBadge(currentCard.language)}
                    </span>
                    <span className="text-xs font-semibold text-secondary">{currentCard.deckName || 'Baralho Principal'}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-secondary">
                      {formatCalendarDateLabelPtBr(resolveCardDateKey(currentCard))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => void playCardTts(currentCard, false)} className="min-h-[44px] px-3.5 py-2 rounded-xl btn-matte-amber text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                      <GoogleIcon name={isSpeaking ? 'graphic_eq' : 'volume_up'} size={16} />
                      <span>{isSpeaking ? 'Tocando...' : 'Ouvir (R)'}</span>
                    </button>
                    <button type="button" onClick={() => { setEditingCard(currentCard); setStudySubTab('create'); }} className="min-h-[44px] px-3 py-2 rounded-xl btn-matte-dark text-secondary hover:text-primary text-xs font-bold flex items-center gap-1.5 border border-slate-800 cursor-pointer">
                      <GoogleIcon name="edit" size={15} />
                      <span>Editar</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFlipped((p) => !p)}
                  className="w-full min-h-[200px] py-6 px-4 rounded-2xl surface-inset border border-slate-800/80 flex flex-col items-center justify-center text-center gap-3 hover:border-amber-500/40 transition-all cursor-pointer"
                >
                  {!isFlipped ? (
                    <>
                      <p className="text-xl sm:text-2xl font-extrabold text-primary font-display leading-snug">{currentCard.front}</p>
                      {currentCard.pronunciation && (
                        <p className="text-xs font-mono text-amber-300/90 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">/{currentCard.pronunciation}/</p>
                      )}
                      <span className="text-[11px] text-secondary flex items-center gap-1 pt-2">
                        <GoogleIcon name="flip" size={14} className="text-amber-400" />
                        <span>Espaço ou clique para virar</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <p className="text-lg sm:text-xl font-extrabold text-emerald-300 font-display leading-snug">{currentCard.back}</p>
                      {currentCard.nuance && <p className="text-xs text-secondary max-w-lg leading-relaxed">{currentCard.nuance}</p>}
                      {currentCard.example && (
                        <div className="mt-2 p-3 rounded-xl bg-slate-900 border border-slate-800 max-w-lg w-full text-left space-y-1">
                          <p className="text-xs font-semibold text-primary">{currentCard.example}</p>
                          {currentCard.exampleTranslation && <p className="text-[11px] text-secondary">{currentCard.exampleTranslation}</p>}
                        </div>
                      )}
                    </>
                  )}
                </button>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {([
                    { r: 1 as const, title: '1 · Rever', sub: ratingIntervals.again, cls: 'bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 border-rose-500/30' },
                    { r: 2 as const, title: '2 · Bom', sub: ratingIntervals.good, cls: 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/35' },
                    { r: 3 as const, title: '3 · Fácil', sub: ratingIntervals.easy, cls: 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/35' },
                  ] as const).map((btn) => (
                    <button key={btn.r} type="button" onClick={() => handleRate(btn.r)} className={`min-h-[44px] py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-colors cursor-pointer ${btn.cls}`}>
                      <span>{btn.title}</span>
                      <span className="text-[10px] font-mono opacity-80">{btn.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {studySubTab === 'create' && (
        <div id="panel-create" role="tabpanel" aria-labelledby="tab-create" className="space-y-6">
          <FlashcardCreatorPanel
            initialCard={editingCard}
            availableDecks={allDeckNames}
            existingCards={cards}
            defaultDeckName={selectedDeck === 'ALL' ? 'Baralho Principal' : selectedDeck}
            defaultLanguage={creatorLangPreset}
            defaultDateKey={creatorDatePreset}
            onSaveCard={(saved) => { addFlashcardsToDeck(saved); setEditingCard(null); }}
            onSaveCards={(saved) => { addFlashcardsToDeck(saved); setEditingCard(null); }}
            onCancelEdit={() => setEditingCard(null)}
            onOpenImporter={() => setIsImporterOpen(true)}
          />

          <FlashcardCatalogManager
            cards={cards}
            availableDecks={allDeckNames}
            selectedDeck={selectedDeck}
            onChangeDeck={setSelectedDeck}
            selectedLang={selectedLang}
            onChangeLang={setSelectedLang}
            datePreset={selectedDatePreset}
            onChangeDatePreset={setSelectedDatePreset}
            customDateKey={customDateKey}
            onChangeCustomDateKey={setCustomDateKey}
            onPlayCardTts={(card) => void playCardTts(card, false)}
            onEditCard={(card) => { setEditingCard(card); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onDeleteCard={(cardId) => deleteFlashcardFromDeck(cardId)}
            onExportCsv={(subset) => downloadFlashcardsCsv(subset)}
          />
        </div>
      )}

      <FlashcardImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImport={(imported) => addFlashcardsToDeck(imported)}
        defaultVoiceId={selectedVoice.id}
      />
    </section>
  );
};

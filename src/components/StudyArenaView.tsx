import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { FlashcardImporterModal } from './FlashcardImporterModal';
import { StudyDeckOverview } from './study/StudyDeckOverview';
import { FlashcardCreatorPanel } from './study/FlashcardCreatorPanel';
import { normalizeLanguageBadge } from '../utils/flashcardParser';
import {
  readFlashcardDeck,
  subscribeFlashcardDeck,
  addFlashcardsToDeck,
  deleteFlashcardFromDeck,
  rateFlashcardRetention,
  computeDeckSummaries,
  filterStudyQueue,
} from '../services/flashcardDeckStorage';
import { downloadFlashcardsCsv } from '../utils/csvExporter';
import { generateAudioCacheKey, synthesizeWithCache } from '../utils/audioCache';
import { base64ToBlobUrl, revokeAudioUrl, speakBrowserFallback, stopBrowserSpeech } from '../utils/audio';
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

export const StudyArenaView: React.FC<StudyArenaViewProps> = ({ selectedVoice, initialCardId }) => {
  const [cards, setCards] = useState<FlashcardItem[]>(() => readFlashcardDeck());
  const [customDecks, setCustomDecks] = useState<string[]>([]);
  const [studySubTab, setStudySubTab] = useState<'decks' | 'review' | 'create'>('decks');
  const [selectedDeck, setSelectedDeck] = useState<string>('Baralho Principal');
  const [selectedLang, setSelectedLang] = useState<'ALL' | 'EN' | 'IT' | 'JA'>('ALL');
  const [dueOnly, setDueOnly] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [autoPlayTts, setAutoPlayTts] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashcardItem | null>(null);
  const [tableQuery, setTableQuery] = useState('');

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
    () => filterStudyQueue(cards, { deckName: selectedDeck, language: selectedLang, dueOnly }),
    [cards, selectedDeck, selectedLang, dueOnly]
  );

  useEffect(() => {
    if (currentIndex >= reviewQueue.length && reviewQueue.length > 0) setCurrentIndex(0);
  }, [reviewQueue.length, currentIndex]);

  useEffect(() => {
    if (!initialCardId) return;
    const idx = reviewQueue.findIndex((c) => c.id === initialCardId);
    if (idx >= 0) { setCurrentIndex(idx); setIsFlipped(false); setStudySubTab('review'); }
  }, [initialCardId, reviewQueue]);

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

  const filteredTableCards = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    return cards.filter((c) => {
      if (selectedDeck !== 'ALL' && (c.deckName || 'Baralho Principal') !== selectedDeck) return false;
      if (!q) return true;
      return c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q) || (c.nuance && c.nuance.toLowerCase().includes(q));
    });
  }, [cards, selectedDeck, tableQuery]);

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
          <span className="text-xs font-mono px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold self-start sm:self-auto">
            Voz: {selectedVoice.name}
          </span>
        </div>

        <nav role="tablist" aria-label="Navegação de Modos da Área de Estudo" className="flex items-center gap-2 border-b border-slate-800/80 pb-px">
          {[
            { id: 'decks' as const, label: 'Baralhos', icon: 'school' },
            { id: 'review' as const, label: 'Estudar', icon: 'auto_awesome' },
            { id: 'create' as const, label: 'Criar & Gerenciar', icon: 'add' },
          ].map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={studySubTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => { setStudySubTab(tab.id); if (tab.id !== 'create') setEditingCard(null); }}
              className={`min-h-[44px] px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                studySubTab === tab.id ? 'text-amber-300 border-b-2 border-amber-400 font-extrabold' : 'text-secondary hover:text-primary border-b-2 border-transparent'
              }`}
            >
              <GoogleIcon name={tab.icon} size={16} />
              <span>{tab.label}</span>
              {tab.id === 'review' && totalDueToday > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">{totalDueToday}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {studySubTab === 'decks' && (
        <div id="panel-decks" role="tabpanel" aria-labelledby="tab-decks">
          <StudyDeckOverview
            summaries={summaries}
            totalCards={totalCards}
            totalDueToday={totalDueToday}
            overallMastery={overallMastery}
            onStudyDeck={(d) => { setSelectedDeck(d); setDueOnly(true); setStudySubTab('review'); }}
            onCreateCard={(d) => { if (d) setSelectedDeck(d); setEditingCard(null); setStudySubTab('create'); }}
            onCreateDeck={(d) => { setCustomDecks((p) => Array.from(new Set([...p, d]))); setSelectedDeck(d); setStudySubTab('create'); }}
            onOpenImporter={() => setIsImporterOpen(true)}
            onExportCsv={() => downloadFlashcardsCsv(cards)}
          />
        </div>
      )}

      {studySubTab === 'review' && (
        <div id="panel-review" role="tabpanel" aria-labelledby="tab-review" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl card-matte border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <label htmlFor="deck-filter" className="text-secondary font-bold">Baralho:</label>
              <select id="deck-filter" value={selectedDeck} onChange={(e) => { setSelectedDeck(e.target.value); setCurrentIndex(0); setIsFlipped(false); }} className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-primary focus:outline-none cursor-pointer">
                <option value="ALL">Todos os Baralhos</option>
                {allDeckNames.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-xs font-extrabold">
                      {normalizeLanguageBadge(currentCard.language)}
                    </span>
                    <span className="text-xs font-semibold text-secondary">{currentCard.deckName || 'Baralho Principal'}</span>
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
            defaultDeckName={selectedDeck === 'ALL' ? 'Baralho Principal' : selectedDeck}
            onSaveCard={(saved) => { addFlashcardsToDeck(saved); setEditingCard(null); }}
            onCancelEdit={() => setEditingCard(null)}
            onOpenImporter={() => setIsImporterOpen(true)}
          />

          <div className="p-5 rounded-3xl card-matte border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-sm font-extrabold text-primary font-display">
                Flashcards do Baralho ({filteredTableCards.length})
              </h3>
              <input
                type="text"
                value={tableQuery}
                onChange={(e) => setTableQuery(e.target.value)}
                placeholder="Buscar por frente, tradução ou nuance..."
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl input-sunken text-xs text-primary border border-slate-800 sm:w-72"
              />
            </div>

            <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/50">
              {filteredTableCards.length === 0 ? (
                <p className="p-4 text-xs text-secondary text-center">Nenhum flashcard encontrado.</p>
              ) : (
                filteredTableCards.slice(0, 50).map((card) => (
                  <div key={card.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">{normalizeLanguageBadge(card.language)}</span>
                        <span className="text-xs font-bold text-primary">{card.front}</span>
                        <span className="text-xs text-emerald-300">— {card.back}</span>
                      </div>
                      <p className="text-[11px] text-secondary">{card.deckName || 'Baralho Principal'} · Status: {card.status || 'new'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => void playCardTts(card, false)} aria-label={`Ouvir ${card.front}`} className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <GoogleIcon name="volume_up" size={14} />
                      </button>
                      <button type="button" onClick={() => { setEditingCard(card); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label={`Editar ${card.front}`} className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-secondary hover:text-primary border border-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <GoogleIcon name="edit" size={14} />
                        <span>Editar</span>
                      </button>
                      <button type="button" onClick={() => deleteFlashcardFromDeck(card.id)} aria-label={`Excluir ${card.front}`} className="min-h-[36px] px-2 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-rose-400 border border-slate-800 text-xs cursor-pointer">
                        <GoogleIcon name="delete" size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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

import React, { useMemo, useState } from 'react';
import { GoogleIcon } from '../GoogleIcon';
import type { DeckSummary } from '../../services/flashcardDeckStorage';
import type { DateFilterPreset, DeckNamingMode, FlashcardItem } from '../../types/polyglot';
import { normalizeLanguageBadge } from '../../utils/flashcardParser';
import {
  computeDateSummaries,
  computeLanguageSummaries,
  formatCalendarDateLabelPtBr,
  resolveCardDateKey,
} from '../../utils/flashcardOrganizer';

export interface StudyDeckOverviewProps {
  cards: FlashcardItem[];
  summaries: DeckSummary[];
  totalCards: number;
  totalDueToday: number;
  overallMastery: number;
  onStudyDeck: (deckName: string) => void;
  onStudyFilter: (filter: {
    deckName?: string;
    language?: 'ALL' | 'EN' | 'IT' | 'JA';
    datePreset?: DateFilterPreset;
    customDateKey?: string;
  }) => void;
  onCreateCard: (deckName?: string) => void;
  onCreateCardWithPreset?: (preset: {
    deckName?: string;
    language?: 'auto' | 'EN' | 'IT' | 'JA' | 'TRIO';
    dateKey?: string;
  }) => void;
  onOpenImporter: () => void;
  onExportCsv: (deckName?: string) => void;
  onExportFilteredCsv?: (cards: FlashcardItem[], filename?: string) => void;
  onCreateDeck: (deckName: string) => void;
  onReorganizeDecks?: (mode: Exclude<DeckNamingMode, 'custom'>) => void;
}

type OverviewViewMode = 'decks' | 'languages' | 'dates';

export const StudyDeckOverview: React.FC<StudyDeckOverviewProps> = ({
  cards,
  summaries,
  totalCards,
  totalDueToday,
  overallMastery,
  onStudyDeck,
  onStudyFilter,
  onCreateCard,
  onCreateCardWithPreset,
  onOpenImporter,
  onExportCsv,
  onExportFilteredCsv,
  onCreateDeck,
  onReorganizeDecks,
}) => {
  const [newDeckInput, setNewDeckInput] = useState('');
  const [viewMode, setViewMode] = useState<OverviewViewMode>('decks');
  const [reorgBanner, setReorgBanner] = useState<string | null>(null);

  const languageSummaries = useMemo(() => computeLanguageSummaries(cards), [cards]);
  const dateSummaries = useMemo(() => computeDateSummaries(cards), [cards]);

  const handleCreateDeckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newDeckInput.trim();
    if (!clean) return;
    onCreateDeck(clean);
    setNewDeckInput('');
  };

  const handleReorganize = (mode: Exclude<DeckNamingMode, 'custom'>, label: string) => {
    if (!onReorganizeDecks || totalCards === 0) return;
    onReorganizeDecks(mode);
    setReorgBanner(`Baralhos separados ${label} para todos os ${totalCards} cards.`);
    window.setTimeout(() => setReorgBanner(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Resumo Global Superior */}
      <section
        aria-label="Resumo geral de retenção e baralhos"
        className="p-5 rounded-3xl card-matte border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-center">
            <span className="block text-[10px] font-mono text-secondary uppercase tracking-wider">Total Cards</span>
            <span className="text-lg font-extrabold font-mono tabular-nums text-primary">{totalCards}</span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
            <span className="block text-[10px] font-mono text-amber-300 uppercase tracking-wider">Para Hoje</span>
            <span className="text-lg font-extrabold font-mono tabular-nums text-amber-300">{totalDueToday}</span>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
            <span className="block text-[10px] font-mono text-emerald-300 uppercase tracking-wider">Domínio</span>
            <span className="text-lg font-extrabold font-mono tabular-nums text-emerald-300">{overallMastery}%</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onCreateCard()}
            className="min-h-[44px] px-4 py-2.5 rounded-xl btn-matte-amber text-white text-xs font-extrabold flex items-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <GoogleIcon name="add" size={17} />
            <span>Criar Flashcard</span>
          </button>
          <button
            type="button"
            onClick={onOpenImporter}
            className="min-h-[44px] px-4 py-2.5 rounded-xl btn-matte-dark text-secondary hover:text-primary text-xs font-bold flex items-center gap-2 border border-slate-800 cursor-pointer"
          >
            <GoogleIcon name="upload_file" size={16} className="text-amber-400" />
            <span>Importar Lote</span>
          </button>
          {totalCards > 0 && (
            <button
              type="button"
              onClick={() => onExportCsv()}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl btn-matte-dark text-secondary hover:text-primary text-xs font-bold flex items-center gap-1.5 border border-slate-800 cursor-pointer"
              title="Exportar todos os baralhos para CSV compatível com Anki"
            >
              <GoogleIcon name="download" size={15} className="text-emerald-400" />
              <span>Exportar CSV</span>
            </button>
          )}
        </div>
      </section>

      {/* Modo de Separação + Reorganização Rápida */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-3.5 rounded-2xl card-matte border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Modo de separação da visão geral">
          <span className="text-[11px] font-bold text-secondary mr-1">Visualizar por:</span>
          {([
            { id: 'decks' as const, label: 'Por Baralho' },
            { id: 'languages' as const, label: 'Por Língua (EN · IT · JA)' },
            { id: 'dates' as const, label: 'Por Data (Calendário)' },
          ]).map((mode) => (
            <button
              key={mode.id}
              type="button"
              aria-pressed={viewMode === mode.id}
              onClick={() => setViewMode(mode.id)}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                viewMode === mode.id
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 text-secondary border-slate-800 hover:text-primary'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {totalCards > 0 && onReorganizeDecks && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-secondary font-semibold mr-1">Reorganizar baralhos:</span>
            <button
              type="button"
              onClick={() => handleReorganize('by_language', 'por Língua (EN/IT/JA)')}
              className="min-h-[40px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-secondary hover:text-amber-300 border border-slate-800 text-[11px] font-bold cursor-pointer"
            >
              Separar por Língua
            </button>
            <button
              type="button"
              onClick={() => handleReorganize('by_date', 'por Data')}
              className="min-h-[40px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-secondary hover:text-amber-300 border border-slate-800 text-[11px] font-bold cursor-pointer"
            >
              Separar por Data
            </button>
            <button
              type="button"
              onClick={() => handleReorganize('by_language_and_date', 'por Língua + Data')}
              className="min-h-[40px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-secondary hover:text-amber-300 border border-slate-800 text-[11px] font-bold cursor-pointer"
            >
              Língua + Data
            </button>
          </div>
        )}
      </div>

      {reorgBanner && (
        <div role="status" className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <GoogleIcon name="check_circle" size={16} className="text-emerald-400 shrink-0" />
          <span>{reorgBanner}</span>
        </div>
      )}

      {/* Input Rápido: Novo Baralho */}
      {viewMode === 'decks' && (
        <form
          onSubmit={handleCreateDeckSubmit}
          className="p-4 rounded-2xl card-matte border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <div className="flex-1 relative">
            <input
              type="text"
              value={newDeckInput}
              onChange={(e) => setNewDeckInput(e.target.value)}
              placeholder="Criar novo baralho (ex: Viagem Itália, Expressões C1, JLPT N3)..."
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl input-sunken text-xs text-primary placeholder-slate-500 border border-slate-800 focus:outline-none focus:border-amber-500/50"
              aria-label="Nome do novo baralho"
            />
          </div>
          <button
            type="submit"
            disabled={!newDeckInput.trim()}
            className="min-h-[44px] px-4 py-2 rounded-xl btn-matte-amber text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <GoogleIcon name="add" size={16} />
            <span>Adicionar Baralho</span>
          </button>
        </form>
      )}

      {/* Visão 1: Por Baralho */}
      {viewMode === 'decks' && (
        summaries.length === 0 ? (
          <div className="p-10 rounded-3xl card-matte border border-slate-800 text-center space-y-3">
            <p className="text-sm font-semibold text-primary">Nenhum baralho disponível no momento.</p>
            <p className="text-xs text-secondary">Crie seu primeiro baralho acima ou importe um arquivo Anki/CSV.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summaries.map((deck) => (
              <article
                key={deck.deckName}
                className="p-5 rounded-2xl card-matte border border-slate-800/90 hover:border-slate-700 flex flex-col justify-between gap-4 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-primary font-display leading-tight">{deck.deckName}</h3>
                      <p className="text-[11px] font-mono text-secondary">
                        {deck.total} {deck.total === 1 ? 'card cadastrado' : 'cards cadastrados'}
                        {deck.latestDateKey ? ` · Último: ${formatCalendarDateLabelPtBr(deck.latestDateKey)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {deck.languages.map((lang) => (
                        <span key={lang} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800/80">
                    <div className="text-center">
                      <span className="block text-[10px] font-mono text-cyan-400 font-bold uppercase">Novos</span>
                      <span className="text-sm font-mono font-extrabold text-cyan-300 tabular-nums">{deck.newCount}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[10px] font-mono text-amber-400 font-bold uppercase">Revisar</span>
                      <span className="text-sm font-mono font-extrabold text-amber-300 tabular-nums">{deck.dueCount}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[10px] font-mono text-emerald-400 font-bold uppercase">Dominados</span>
                      <span className="text-sm font-mono font-extrabold text-emerald-300 tabular-nums">{deck.masteredCount}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-secondary">Nível de Domínio</span>
                      <span className="font-bold text-emerald-300">{deck.masteryPercent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, deck.masteryPercent))}%` }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => onStudyDeck(deck.deckName)}
                    disabled={deck.total === 0}
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl btn-matte-amber text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <GoogleIcon name="school" size={16} />
                    <span>Estudar ({deck.dueCount > 0 ? `${deck.dueCount} pendentes` : 'Tudo'})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateCard(deck.deckName)}
                    className="min-h-[44px] px-3 py-2 rounded-xl btn-matte-dark text-secondary hover:text-primary text-xs font-bold flex items-center justify-center gap-1 border border-slate-800 cursor-pointer"
                    title={`Adicionar novo flashcard em ${deck.deckName}`}
                  >
                    <GoogleIcon name="add" size={15} />
                    <span>+ Card</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {/* Visão 2: Por Língua (EN / IT / JA) */}
      {viewMode === 'languages' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {languageSummaries.map((lang) => {
            const langCards = cards.filter((c) => normalizeLanguageBadge(c.language) === lang.badge);
            return (
              <article
                key={lang.badge}
                className="p-5 rounded-2xl card-matte border border-slate-800/90 hover:border-slate-700 flex flex-col justify-between gap-4 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-primary font-display">{lang.deckLabel}</h3>
                      <p className="text-[11px] font-mono text-secondary">
                        {lang.total} {lang.total === 1 ? 'card' : 'cards'} · {lang.distinctDates.length} {lang.distinctDates.length === 1 ? 'dia ativo' : 'dias ativos'}
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-xs font-extrabold">
                      {lang.badge}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800/80">
                    <div className="text-center">
                      <span className="block text-[10px] font-mono text-cyan-400 font-bold uppercase">Novos</span>
                      <span className="text-sm font-mono font-extrabold text-cyan-300 tabular-nums">{lang.newCount}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[10px] font-mono text-amber-400 font-bold uppercase">Revisar</span>
                      <span className="text-sm font-mono font-extrabold text-amber-300 tabular-nums">{lang.dueCount}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[10px] font-mono text-emerald-400 font-bold uppercase">Dominados</span>
                      <span className="text-sm font-mono font-extrabold text-emerald-300 tabular-nums">{lang.masteredCount}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-secondary">Domínio em {lang.labelPtBr}</span>
                      <span className="font-bold text-emerald-300">{lang.masteryPercent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, lang.masteryPercent))}%` }} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
                  <button
                    type="button"
                    disabled={lang.total === 0}
                    onClick={() => onStudyFilter({ deckName: 'ALL', language: lang.badge, datePreset: 'ALL' })}
                    className="flex-1 min-h-[44px] px-3 py-2 rounded-xl btn-matte-amber text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <GoogleIcon name="school" size={16} />
                    <span>Estudar {lang.badge}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateCardWithPreset ? onCreateCardWithPreset({ language: lang.badge }) : onCreateCard()}
                    className="min-h-[44px] px-3 py-2 rounded-xl btn-matte-dark text-secondary hover:text-primary text-xs font-bold border border-slate-800 cursor-pointer"
                  >
                    + Card
                  </button>
                  {lang.total > 0 && onExportFilteredCsv && (
                    <button
                      type="button"
                      onClick={() => onExportFilteredCsv(langCards, `mytts-${lang.badge.toLowerCase()}.csv`)}
                      aria-label={`Exportar CSV de ${lang.labelPtBr}`}
                      className="min-h-[44px] px-2.5 py-2 rounded-xl btn-matte-dark text-emerald-400 border border-slate-800 cursor-pointer"
                    >
                      <GoogleIcon name="download" size={15} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Visão 3: Por Data (Calendário) */}
      {viewMode === 'dates' && (
        dateSummaries.length === 0 ? (
          <div className="p-10 rounded-3xl card-matte border border-slate-800 text-center space-y-3">
            <p className="text-sm font-semibold text-primary">Nenhuma sessão datada registrada ainda.</p>
            <p className="text-xs text-secondary">Crie seu primeiro flashcard para abrir o histórico diário por língua.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dateSummaries.map((day) => {
              const dayCards = cards.filter((c) => resolveCardDateKey(c) === day.dateKey);
              return (
                <article
                  key={day.dateKey}
                  className="p-5 rounded-2xl card-matte border border-slate-800/90 hover:border-slate-700 flex flex-col justify-between gap-4 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-extrabold text-primary font-display">{day.labelPtBr}</h3>
                        <p className="text-[11px] font-mono text-secondary">
                          {day.total} {day.total === 1 ? 'card criado' : 'cards criados'} · {day.dueCount} pendentes
                        </p>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                        {day.masteryPercent}%
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 py-2 border-y border-slate-800/80">
                      {(['EN', 'IT', 'JA'] as const).map((lang) => (
                        <span
                          key={lang}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                            day.byLanguage[lang] > 0
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-slate-900/60 text-slate-500 border-slate-800'
                          }`}
                        >
                          {lang}: {day.byLanguage[lang]}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => onStudyFilter({ deckName: 'ALL', language: 'ALL', datePreset: 'CUSTOM', customDateKey: day.dateKey })}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl btn-matte-amber text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <GoogleIcon name="school" size={16} />
                      <span>Estudar Dia</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCreateCardWithPreset ? onCreateCardWithPreset({ dateKey: day.dateKey }) : onCreateCard()}
                      className="min-h-[44px] px-3 py-2 rounded-xl btn-matte-dark text-secondary hover:text-primary text-xs font-bold border border-slate-800 cursor-pointer"
                    >
                      + Card
                    </button>
                    {onExportFilteredCsv && (
                      <button
                        type="button"
                        onClick={() => onExportFilteredCsv(dayCards, `mytts-${day.dateKey}.csv`)}
                        aria-label={`Exportar CSV do dia ${day.dateKey}`}
                        className="min-h-[44px] px-2.5 py-2 rounded-xl btn-matte-dark text-emerald-400 border border-slate-800 cursor-pointer"
                      >
                        <GoogleIcon name="download" size={15} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};

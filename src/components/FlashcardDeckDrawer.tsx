/**
 * Gaveta lateral de revisão do deck de flashcards com filtro por língua/data e agrupamento diário.
 */
import React, { useMemo, useState } from 'react';
import type { DateFilterPreset, FlashcardItem } from '../types/polyglot';
import { downloadFlashcardsCsv } from '../utils/csvExporter';
import { normalizeLanguageBadge } from '../utils/flashcardParser';
import {
  formatCalendarDateLabelPtBr,
  groupFlashcardsTree,
  matchesDateFilter,
  resolveCardDateKey,
} from '../utils/flashcardOrganizer';
import { GoogleIcon } from './GoogleIcon';

export interface FlashcardDeckDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cards: FlashcardItem[];
  onDeleteCard: (id: string) => void;
  onClearDeck: () => void;
  onPlayCardAudio?: (text: string, language: string) => void;
}

export const FlashcardDeckDrawer: React.FC<FlashcardDeckDrawerProps> = ({
  isOpen,
  onClose,
  cards,
  onDeleteCard,
  onClearDeck,
  onPlayCardAudio,
}) => {
  const [langFilter, setLangFilter] = useState<'ALL' | 'EN' | 'IT' | 'JA'>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('ALL');

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      if (langFilter !== 'ALL' && normalizeLanguageBadge(c.language) !== langFilter) {
        return false;
      }
      if (!matchesDateFilter(c.createdAt, { preset: dateFilter })) {
        return false;
      }
      return true;
    });
  }, [cards, langFilter, dateFilter]);

  const dateSections = useMemo(
    () => groupFlashcardsTree(filteredCards, { groupBy: 'date', sortOrder: 'newest' }),
    [filteredCards]
  );

  if (!isOpen) return null;

  const handleExport = () => {
    if (filteredCards.length === 0) return;
    downloadFlashcardsCsv(filteredCards);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 flex justify-end animate-in fade-in duration-200"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Meu Deck de Flashcards"
        className="w-full max-w-md surface-flat border-l border-[var(--border-subtle)] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250"
      >
        {/* 1. Cabeçalho da Gaveta */}
        <div className="p-4 surface-flat border-b border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <GoogleIcon name="style" size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-display">
                  <span>Meu Deck de Flashcards</span>
                  <span className="text-[11px] font-mono bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                    {filteredCards.length}/{cards.length}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">Separados por língua e data</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Fechar gaveta"
            >
              <GoogleIcon name="close" size={20} />
            </button>
          </div>

          {cards.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1" role="group" aria-label="Filtrar deck por língua">
                {(['ALL', 'EN', 'IT', 'JA'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    aria-pressed={langFilter === lang}
                    onClick={() => setLangFilter(lang)}
                    className={`min-h-11 px-2.5 py-1 rounded-lg font-mono font-bold border transition-colors cursor-pointer ${
                      langFilter === lang
                        ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-[var(--border-control)]'
                    }`}
                  >
                    {lang === 'ALL' ? 'TODOS' : lang}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1" role="group" aria-label="Filtrar deck por data">
                {([
                  { id: 'ALL' as const, label: 'Todas' },
                  { id: 'TODAY' as const, label: 'Hoje' },
                  { id: 'LAST_7D' as const, label: '7d' },
                ]).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={dateFilter === p.id}
                    onClick={() => setDateFilter(p.id)}
                    className={`min-h-11 px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                      dateFilter === p.id
                        ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-[var(--border-control)]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Lista de Flashcards Agrupada por Data */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {filteredCards.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 surface-inset border border-[var(--border-subtle)] rounded-2xl">
              <GoogleIcon name="menu_book" size={36} className="text-slate-400 dark:text-slate-600 mb-3" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-300">
                {cards.length === 0 ? 'Nenhum flashcard gerado ainda' : 'Nenhum card neste filtro'}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-500 mt-1 max-w-[240px]">
                {cards.length === 0
                  ? 'No chat poliglota, clique sobre qualquer frase ou selecione um trecho e escolha "Criar Flashcard".'
                  : 'Ajuste os filtros de língua ou data acima para ver seus outros flashcards.'}
              </p>
            </div>
          ) : (
            dateSections.map((section) => (
              <div key={section.key} className="space-y-2.5">
                <div className="flex items-center justify-between px-1 text-[11px] font-mono">
                  <span className="font-bold text-amber-700 dark:text-amber-300">{section.title}</span>
                  <span className="text-slate-500">{section.subtitle}</span>
                </div>
                {section.cards.map((card) => (
                  <div
                    key={card.id}
                    className="card-matte rounded-2xl p-4 flex flex-col gap-2.5 border border-[var(--border-subtle)] hover:border-[var(--border-control)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-300">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          {normalizeLanguageBadge(card.language)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                          {card.deckName || 'Baralho Principal'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          · {formatCalendarDateLabelPtBr(resolveCardDateKey(card))}
                        </span>
                      </span>

                      <div className="flex items-center gap-1">
                        {onPlayCardAudio && (
                          <button
                            type="button"
                            onClick={() => onPlayCardAudio(card.front, card.language)}
                            title="Ouvir pronúncia"
                            aria-label={`Ouvir pronúncia de ${card.front}`}
                            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <GoogleIcon name="volume_up" size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteCard(card.id)}
                          title="Excluir card"
                          aria-label={`Excluir ${card.front}`}
                          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <GoogleIcon name="delete" size={16} />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">{card.front}</h3>

                    {card.pronunciation && (
                      <p className="text-[11px] font-mono text-amber-800 dark:text-amber-400/90 -mt-1 font-semibold flex items-center gap-1.5">
                        <GoogleIcon name="record_voice_over" size={13} className="text-amber-500 shrink-0" />
                        <span>{card.pronunciation}</span>
                      </p>
                    )}

                    <div className="bg-slate-50 dark:bg-slate-900/90 rounded-xl p-3 border border-[var(--border-subtle)] space-y-1">
                      <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">→ {card.back}</p>
                      {card.nuance && (
                        <p className="text-[11px] text-slate-700 dark:text-slate-400 leading-snug">{card.nuance}</p>
                      )}
                    </div>

                    {card.example && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 italic pt-1 border-t border-[var(--border-subtle)]">
                        <p className="text-slate-800 dark:text-slate-300 font-medium">&quot;{card.example}&quot;</p>
                        {card.exampleTranslation && (
                          <p className="text-slate-600 dark:text-slate-500 not-italic">{card.exampleTranslation}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* 3. Rodapé com Botão de Exportação CSV */}
        {cards.length > 0 && (
          <div className="p-4 surface-flat border-t border-[var(--border-subtle)] flex flex-col gap-2">
            <button
              type="button"
              disabled={filteredCards.length === 0}
              onClick={handleExport}
              className="btn-matte btn-matte-amber w-full min-h-11 text-xs font-bold text-white shadow-sm disabled:opacity-40"
            >
              <GoogleIcon name="download" size={18} filled className="text-white" />
              <span>Exportar {filteredCards.length} Cards para Anki / Notion (CSV)</span>
            </button>

            <button
              type="button"
              onClick={onClearDeck}
              className="w-full min-h-11 py-1 text-center text-[11px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Limpar todo o deck
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

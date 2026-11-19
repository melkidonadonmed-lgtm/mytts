import React, { useMemo, useState } from 'react';
import { GoogleIcon } from '../GoogleIcon';
import type {
  DateFilterPreset,
  FlashcardGroupByMode,
  FlashcardItem,
  FlashcardSortOrder,
} from '../../types/polyglot';
import { normalizeLanguageBadge } from '../../utils/flashcardParser';
import {
  formatCalendarDateLabelPtBr,
  groupFlashcardsTree,
  matchesDateFilter,
  resolveCardDateKey,
} from '../../utils/flashcardOrganizer';

export interface FlashcardCatalogManagerProps {
  cards: FlashcardItem[];
  availableDecks: string[];
  selectedDeck: string;
  onChangeDeck: (deck: string) => void;
  selectedLang: 'ALL' | 'EN' | 'IT' | 'JA';
  onChangeLang: (lang: 'ALL' | 'EN' | 'IT' | 'JA') => void;
  datePreset: DateFilterPreset;
  onChangeDatePreset: (preset: DateFilterPreset) => void;
  customDateKey: string;
  onChangeCustomDateKey: (dateKey: string) => void;
  onPlayCardTts: (card: FlashcardItem) => void;
  onEditCard: (card: FlashcardItem) => void;
  onDeleteCard: (cardId: string) => void;
  onExportCsv: (filteredCards: FlashcardItem[]) => void;
}

const DATE_PRESETS: ReadonlyArray<{ id: DateFilterPreset; label: string }> = [
  { id: 'ALL', label: 'Todas' },
  { id: 'TODAY', label: 'Hoje' },
  { id: 'YESTERDAY', label: 'Ontem' },
  { id: 'LAST_7D', label: '7d' },
  { id: 'LAST_30D', label: '30d' },
  { id: 'CUSTOM', label: 'Data' },
];

const GROUP_MODES: ReadonlyArray<{ id: FlashcardGroupByMode; label: string }> = [
  { id: 'date_then_lang', label: 'Data + Língua' },
  { id: 'lang_then_date', label: 'Língua + Data' },
  { id: 'language', label: 'Apenas Língua' },
  { id: 'date', label: 'Apenas Data' },
  { id: 'deck', label: 'Baralho' },
  { id: 'none', label: 'Lista Plana' },
];

function FlashcardRowCard({
  card,
  onPlayCardTts,
  onEditCard,
  onDeleteCard,
}: {
  card: FlashcardItem;
  onPlayCardTts: (card: FlashcardItem) => void;
  onEditCard: (card: FlashcardItem) => void;
  onDeleteCard: (cardId: string) => void;
}) {
  const dateKey = resolveCardDateKey(card);
  const badge = normalizeLanguageBadge(card.language);

  return (
    <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors">
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
            {badge}
          </span>
          <span className="text-xs font-bold text-primary break-words">{card.front}</span>
          <span className="text-xs text-emerald-300 break-words">— {card.back}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-secondary font-mono">
          <span>{card.deckName || 'Baralho Principal'}</span>
          <span>·</span>
          <span>{formatCalendarDateLabelPtBr(dateKey)}</span>
          <span>·</span>
          <span className="uppercase">{card.status || 'new'}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onPlayCardTts(card)}
          aria-label={`Ouvir ${card.front}`}
          className="min-h-[38px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
        >
          <GoogleIcon name="volume_up" size={14} />
        </button>
        <button
          type="button"
          onClick={() => onEditCard(card)}
          aria-label={`Editar ${card.front}`}
          className="min-h-[38px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-secondary hover:text-primary border border-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
        >
          <GoogleIcon name="edit" size={14} />
          <span>Editar</span>
        </button>
        <button
          type="button"
          onClick={() => onDeleteCard(card.id)}
          aria-label={`Excluir ${card.front}`}
          className="min-h-[38px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-rose-400 border border-slate-800 text-xs cursor-pointer"
        >
          <GoogleIcon name="delete" size={14} />
        </button>
      </div>
    </div>
  );
}

export const FlashcardCatalogManager: React.FC<FlashcardCatalogManagerProps> = ({
  cards,
  availableDecks,
  selectedDeck,
  onChangeDeck,
  selectedLang,
  onChangeLang,
  datePreset,
  onChangeDatePreset,
  customDateKey,
  onChangeCustomDateKey,
  onPlayCardTts,
  onEditCard,
  onDeleteCard,
  onExportCsv,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<FlashcardGroupByMode>('date_then_lang');
  const [sortOrder, setSortOrder] = useState<FlashcardSortOrder>('newest');

  const deckAndDateCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cards.filter((c) => {
      const cardDeck = (c.deckName || 'Baralho Principal').trim() || 'Baralho Principal';
      if (selectedDeck !== 'ALL' && cardDeck !== selectedDeck) return false;
      if (!matchesDateFilter(c.createdAt, { preset: datePreset, customDateKey })) return false;
      if (!q) return true;
      return (
        c.front.toLowerCase().includes(q) ||
        c.back.toLowerCase().includes(q) ||
        (c.nuance && c.nuance.toLowerCase().includes(q)) ||
        cardDeck.toLowerCase().includes(q)
      );
    });
  }, [cards, selectedDeck, datePreset, customDateKey, searchQuery]);

  const langCounts = useMemo(() => {
    const counts = { ALL: deckAndDateCards.length, EN: 0, IT: 0, JA: 0 };
    for (const c of deckAndDateCards) {
      counts[normalizeLanguageBadge(c.language)]++;
    }
    return counts;
  }, [deckAndDateCards]);

  const filteredCards = useMemo(() => {
    if (selectedLang === 'ALL') return deckAndDateCards;
    return deckAndDateCards.filter((c) => normalizeLanguageBadge(c.language) === selectedLang);
  }, [deckAndDateCards, selectedLang]);

  const sections = useMemo(
    () => groupFlashcardsTree(filteredCards, { groupBy, sortOrder }),
    [filteredCards, groupBy, sortOrder]
  );

  const statusAnnouncement = useMemo(() => {
    const groupLabel = GROUP_MODES.find((m) => m.id === groupBy)?.label || groupBy;
    const sortLabel = sortOrder === 'az' ? 'A a Z' : sortOrder === 'oldest' ? 'mais antigos' : 'mais recentes';
    return `${filteredCards.length} flashcards exibidos, agrupados por ${groupLabel}, ordenados por ${sortLabel}.`;
  }, [filteredCards.length, groupBy, sortOrder]);

  return (
    <div className="p-5 rounded-3xl card-matte border border-slate-800 space-y-4">
      <p role="status" className="sr-only">
        {statusAnnouncement}
      </p>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-extrabold text-primary font-display">
            Flashcards Separados por Língua e Data ({filteredCards.length})
          </h3>
          <p className="text-[11px] text-secondary">
            Filtre por idioma, janela de criação ou baralho e alterne a organização hierárquica
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar flashcards por frente, tradução ou baralho"
            placeholder="Buscar frente, tradução ou baralho..."
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl input-sunken text-xs text-primary border border-slate-800 sm:w-64"
          />
          {filteredCards.length > 0 && (
            <button
              type="button"
              onClick={() => onExportCsv(filteredCards)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl btn-matte-dark text-secondary hover:text-primary text-xs font-bold flex items-center gap-1.5 border border-slate-800 cursor-pointer"
            >
              <GoogleIcon name="download" size={14} className="text-emerald-400" />
              <span>Exportar Filtro (CSV)</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros por Língua, Data e Agrupamento */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs">
        <div className="xl:col-span-4 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase text-secondary font-bold mr-1">Língua:</span>
          {(['ALL', 'EN', 'IT', 'JA'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              aria-pressed={selectedLang === lang}
              onClick={() => onChangeLang(lang)}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border transition-colors cursor-pointer ${
                selectedLang === lang
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-950/60 text-secondary border-slate-800 hover:text-primary'
              }`}
            >
              {lang === 'ALL' ? 'TODOS' : lang} ({langCounts[lang]})
            </button>
          ))}
        </div>

        <div className="xl:col-span-5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase text-secondary font-bold mr-1">Data:</span>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={datePreset === p.id}
              onClick={() => onChangeDatePreset(p.id)}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                datePreset === p.id
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-950/60 text-secondary border-slate-800 hover:text-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
          {datePreset === 'CUSTOM' && (
            <input
              type="date"
              value={customDateKey}
              onChange={(e) => onChangeCustomDateKey(e.target.value)}
              aria-label="Filtrar flashcards por data específica"
              className="min-h-[34px] px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-mono text-primary"
            />
          )}
        </div>

        <div className="xl:col-span-3 flex flex-wrap items-center gap-2 justify-start xl:justify-end">
          <select
            value={selectedDeck}
            onChange={(e) => onChangeDeck(e.target.value)}
            aria-label="Filtrar catálogo por baralho"
            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-bold text-primary cursor-pointer max-w-[160px]"
          >
            <option value="ALL">Todos Baralhos</option>
            {availableDecks.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as FlashcardGroupByMode)}
            aria-label="Modo de agrupamento dos flashcards"
            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-bold text-amber-300 cursor-pointer"
          >
            {GROUP_MODES.map((m) => (
              <option key={m.id} value={m.id}>Agrupar: {m.label}</option>
            ))}
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as FlashcardSortOrder)}
            aria-label="Ordenação dos flashcards"
            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-bold text-secondary cursor-pointer"
          >
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="az">A–Z</option>
          </select>
        </div>
      </div>

      {/* Grupos Hierárquicos */}
      {sections.length === 0 ? (
        <div className="p-6 rounded-2xl surface-inset border border-slate-800 text-center text-xs text-secondary">
          Nenhum flashcard encontrado com os filtros de língua, data e busca selecionados.
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.key} className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/40">
              <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-primary font-display">{section.title}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                    {section.subtitle}
                  </span>
                </div>
              </div>

              {section.subGroups && section.subGroups.length > 0 ? (
                <div className="divide-y divide-slate-800/80">
                  {section.subGroups.map((sub) => (
                    <div key={sub.key}>
                      <div className="px-4 py-1.5 bg-slate-950/50 border-b border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
                        <span className="font-bold text-amber-300">{sub.label}</span>
                        <span className="text-secondary">{sub.cards.length} {sub.cards.length === 1 ? 'card' : 'cards'}</span>
                      </div>
                      <div className="divide-y divide-slate-800/60">
                        {sub.cards.slice(0, 60).map((card) => (
                          <FlashcardRowCard
                            key={card.id}
                            card={card}
                            onPlayCardTts={onPlayCardTts}
                            onEditCard={onEditCard}
                            onDeleteCard={onDeleteCard}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {section.cards.slice(0, 60).map((card) => (
                    <FlashcardRowCard
                      key={card.id}
                      card={card}
                      onPlayCardTts={onPlayCardTts}
                      onEditCard={onEditCard}
                      onDeleteCard={onDeleteCard}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

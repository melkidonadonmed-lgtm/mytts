/**
 * Pure, timezone-safe organizer for flashcard creation, language separation,
 * calendar date bucketing, deduplication, and immutable hierarchical grouping.
 */
import type {
  DateFilterPreset,
  DeckNamingMode,
  FlashcardGroupByMode,
  FlashcardItem,
  FlashcardLanguageBadge,
  FlashcardSortOrder,
} from '../types/polyglot';
import { normalizeLanguageBadge } from './flashcardParser';

export interface LanguageCatalogEntry {
  badge: FlashcardLanguageBadge;
  bcp47: 'en-US' | 'it-IT' | 'ja-JP';
  labelPtBr: string;
  deckLabel: string;
}

export const LANGUAGE_CATALOG: Record<FlashcardLanguageBadge, LanguageCatalogEntry> = {
  EN: { badge: 'EN', bcp47: 'en-US', labelPtBr: 'Inglês', deckLabel: 'Inglês (EN)' },
  IT: { badge: 'IT', bcp47: 'it-IT', labelPtBr: 'Italiano', deckLabel: 'Italiano (IT)' },
  JA: { badge: 'JA', bcp47: 'ja-JP', labelPtBr: 'Japonês', deckLabel: 'Japonês (JA)' },
};

const CANONICAL_LANGS: readonly FlashcardLanguageBadge[] = ['EN', 'IT', 'JA'];
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getLanguageMeta(lang: string): LanguageCatalogEntry {
  return LANGUAGE_CATALOG[normalizeLanguageBadge(lang)];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Converts an epoch timestamp into a location-safe YYYY-MM-DD calendar key.
 * Avoids UTC .toISOString().slice(0, 10) drift for evening local timestamps.
 */
export function toLocalCalendarDateKey(epochMs: number, timeZone?: string): string {
  const safeMs = typeof epochMs === 'number' && Number.isFinite(epochMs) ? epochMs : Date.now();
  const dateObj = new Date(safeMs);
  if (timeZone) {
    try {
      const formatted = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(dateObj);
      if (DATE_KEY_PATTERN.test(formatted)) {
        return formatted;
      }
    } catch {
      // Fall back to local calendar fields if an invalid IANA zone is provided.
    }
  }
  return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
}

/**
 * Anchors a YYYY-MM-DD calendar date key at local noon (12:00) to avoid UTC day shift.
 */
export function calendarDateKeyToEpochMs(dateKey: string, fallbackNow = Date.now()): number {
  const match = (dateKey || '').trim().match(DATE_KEY_PATTERN);
  if (!match) return fallbackNow;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return fallbackNow;
  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return fallbackNow;
  }
  return d.getTime();
}

export function shiftCalendarDateKey(dateKey: string, deltaDays: number): string {
  const match = (dateKey || '').trim().match(DATE_KEY_PATTERN);
  if (!match) return toLocalCalendarDateKey(Date.now());
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays, 12, 0, 0, 0);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatCalendarDateLabelPtBr(
  dateKey: string,
  options?: { now?: number; timeZone?: string }
): string {
  const cleanKey = DATE_KEY_PATTERN.test((dateKey || '').trim())
    ? dateKey.trim()
    : toLocalCalendarDateKey(options?.now ?? Date.now(), options?.timeZone);
  const parts = cleanKey.split('-');
  const display = `${parts[2]}/${parts[1]}/${parts[0]}`;
  const todayKey = toLocalCalendarDateKey(options?.now ?? Date.now(), options?.timeZone);
  if (cleanKey === todayKey) return `Hoje · ${display}`;
  if (cleanKey === shiftCalendarDateKey(todayKey, -1)) return `Ontem · ${display}`;
  return display;
}

export function resolveCardDateKey(card: Pick<FlashcardItem, 'createdAt' | 'createdDateKey'>, timeZone?: string): string {
  if (!timeZone && card.createdDateKey && DATE_KEY_PATTERN.test(card.createdDateKey.trim())) {
    return card.createdDateKey.trim();
  }
  return toLocalCalendarDateKey(card.createdAt, timeZone);
}

export function matchesDateFilter(
  createdAt: number,
  options: { preset: DateFilterPreset; customDateKey?: string; now?: number; timeZone?: string }
): boolean {
  if (options.preset === 'ALL') return true;
  const now = options.now ?? Date.now();
  const cardKey = toLocalCalendarDateKey(createdAt, options.timeZone);
  const todayKey = toLocalCalendarDateKey(now, options.timeZone);

  if (options.preset === 'TODAY') return cardKey === todayKey;
  if (options.preset === 'YESTERDAY') return cardKey === shiftCalendarDateKey(todayKey, -1);
  if (options.preset === 'LAST_7D') {
    return cardKey >= shiftCalendarDateKey(todayKey, -6) && cardKey <= todayKey;
  }
  if (options.preset === 'LAST_30D') {
    return cardKey >= shiftCalendarDateKey(todayKey, -29) && cardKey <= todayKey;
  }
  if (options.preset === 'CUSTOM') {
    const target = (options.customDateKey || '').trim();
    return !target ? true : cardKey === target;
  }
  return true;
}

export function resolveOrganizedDeckName(options: {
  mode: DeckNamingMode;
  customDeckName?: string;
  language: string;
  dateKey: string;
}): string {
  const safeDate = DATE_KEY_PATTERN.test((options.dateKey || '').trim())
    ? options.dateKey.trim()
    : toLocalCalendarDateKey(Date.now());
  const meta = getLanguageMeta(options.language);

  if (options.mode === 'by_language') return meta.deckLabel;
  if (options.mode === 'by_date') return `Estudo · ${safeDate}`;
  if (options.mode === 'by_language_and_date') return `${meta.deckLabel} · ${safeDate}`;
  return options.customDeckName?.trim() || 'Baralho Principal';
}

export function reorganizeExistingCardsIntoDecks(
  cards: FlashcardItem[],
  mode: Exclude<DeckNamingMode, 'custom'>,
  options?: { timeZone?: string }
): FlashcardItem[] {
  return cards.map((card) => {
    const dateKey = resolveCardDateKey(card, options?.timeZone);
    return {
      ...card,
      createdDateKey: dateKey,
      deckName: resolveOrganizedDeckName({ mode, language: card.language, dateKey }),
    };
  });
}

export function findDuplicateFlashcard(
  cards: FlashcardItem[],
  front: string,
  language: string,
  excludeId?: string
): FlashcardItem | undefined {
  const normalizedFront = front.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalizedFront) return undefined;
  const targetBadge = normalizeLanguageBadge(language);
  return cards.find((card) => {
    if (excludeId && card.id === excludeId) return false;
    const cardFront = (card.front || '').trim().replace(/\s+/g, ' ').toLowerCase();
    return cardFront === normalizedFront && normalizeLanguageBadge(card.language) === targetBadge;
  });
}

export interface LanguageGroupSummary {
  badge: FlashcardLanguageBadge;
  bcp47: string;
  labelPtBr: string;
  deckLabel: string;
  total: number;
  newCount: number;
  dueCount: number;
  learningCount: number;
  masteredCount: number;
  masteryPercent: number;
  distinctDates: string[];
  latestDateKey?: string;
}

export function computeLanguageSummaries(
  cards: FlashcardItem[],
  options?: { now?: number; timeZone?: string }
): LanguageGroupSummary[] {
  const now = options?.now ?? Date.now();
  const grouped = Object.groupBy(cards, (c) => normalizeLanguageBadge(c.language));

  return CANONICAL_LANGS.map((badge) => {
    const meta = LANGUAGE_CATALOG[badge];
    const list = grouped[badge] ?? [];
    let newCount = 0;
    let learningCount = 0;
    let masteredCount = 0;
    let dueCount = 0;
    const dateSet = new Set<string>();

    for (const card of list) {
      const status = card.status || 'new';
      if (status === 'mastered') masteredCount++;
      else if (status === 'learning' || status === 'review') learningCount++;
      else newCount++;
      if (status === 'new' || !card.nextReviewAt || card.nextReviewAt <= now) dueCount++;
      dateSet.add(resolveCardDateKey(card, options?.timeZone));
    }

    const distinctDates = Array.from(dateSet).toSorted((a, b) => b.localeCompare(a));
    const total = list.length;
    return {
      badge,
      bcp47: meta.bcp47,
      labelPtBr: meta.labelPtBr,
      deckLabel: meta.deckLabel,
      total,
      newCount,
      dueCount,
      learningCount,
      masteredCount,
      masteryPercent: total > 0 ? Math.round((masteredCount / total) * 100) : 0,
      distinctDates,
      latestDateKey: distinctDates[0],
    };
  });
}

export interface DateGroupSummary {
  dateKey: string;
  labelPtBr: string;
  total: number;
  newCount: number;
  dueCount: number;
  masteredCount: number;
  masteryPercent: number;
  byLanguage: Record<FlashcardLanguageBadge, number>;
  languages: FlashcardLanguageBadge[];
}

export function computeDateSummaries(
  cards: FlashcardItem[],
  options?: { now?: number; timeZone?: string }
): DateGroupSummary[] {
  const now = options?.now ?? Date.now();
  const grouped = Object.groupBy(cards, (c) => resolveCardDateKey(c, options?.timeZone));

  return Object.entries(grouped)
    .map(([dateKey, bucket]) => {
      const list = bucket ?? [];
      const byLanguage: Record<FlashcardLanguageBadge, number> = { EN: 0, IT: 0, JA: 0 };
      let newCount = 0;
      let dueCount = 0;
      let masteredCount = 0;

      for (const card of list) {
        const badge = normalizeLanguageBadge(card.language);
        byLanguage[badge]++;
        const status = card.status || 'new';
        if (status === 'mastered') masteredCount++;
        else if (status === 'new') newCount++;
        if (status === 'new' || !card.nextReviewAt || card.nextReviewAt <= now) dueCount++;
      }

      const total = list.length;
      return {
        dateKey,
        labelPtBr: formatCalendarDateLabelPtBr(dateKey, { now, timeZone: options?.timeZone }),
        total,
        newCount,
        dueCount,
        masteredCount,
        masteryPercent: total > 0 ? Math.round((masteredCount / total) * 100) : 0,
        byLanguage,
        languages: CANONICAL_LANGS.filter((lang) => byLanguage[lang] > 0),
      };
    })
    .toSorted((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export interface FlashcardSubGroup {
  key: string;
  label: string;
  badge?: string;
  cards: FlashcardItem[];
}

export interface FlashcardGroupSection {
  key: string;
  title: string;
  subtitle: string;
  total: number;
  cards: FlashcardItem[];
  subGroups?: FlashcardSubGroup[];
}

export function sortFlashcardsImmutable(
  cards: FlashcardItem[],
  sortOrder: FlashcardSortOrder
): FlashcardItem[] {
  if (sortOrder === 'oldest') {
    return cards.toSorted((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
  if (sortOrder === 'az') {
    return cards.toSorted((a, b) => (a.front || '').localeCompare(b.front || '', 'pt-BR'));
  }
  return cards.toSorted((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function buildLangSubGroups(cards: FlashcardItem[]): FlashcardSubGroup[] {
  const byLang = Object.groupBy(cards, (c) => normalizeLanguageBadge(c.language));
  return CANONICAL_LANGS.filter((lang) => (byLang[lang] ?? []).length > 0).map((lang) => ({
    key: lang,
    label: LANGUAGE_CATALOG[lang].deckLabel,
    badge: lang,
    cards: byLang[lang] ?? [],
  }));
}

function buildDateSubGroups(
  cards: FlashcardItem[],
  options: { now?: number; timeZone?: string }
): FlashcardSubGroup[] {
  const byDate = Object.groupBy(cards, (c) => resolveCardDateKey(c, options.timeZone));
  return Object.entries(byDate)
    .toSorted(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, bucket]) => ({
      key: dateKey,
      label: formatCalendarDateLabelPtBr(dateKey, options),
      badge: dateKey,
      cards: bucket ?? [],
    }));
}

export function groupFlashcardsTree(
  cards: FlashcardItem[],
  options: { groupBy: FlashcardGroupByMode; sortOrder: FlashcardSortOrder; now?: number; timeZone?: string }
): FlashcardGroupSection[] {
  const sorted = sortFlashcardsImmutable(cards, options.sortOrder);
  if (sorted.length === 0) return [];
  const timeOpts = { now: options.now, timeZone: options.timeZone };

  if (options.groupBy === 'none') {
    return [{ key: 'all', title: 'Todos os Flashcards', subtitle: `${sorted.length} card(s)`, total: sorted.length, cards: sorted }];
  }

  if (options.groupBy === 'language' || options.groupBy === 'lang_then_date') {
    const byLang = Object.groupBy(sorted, (c) => normalizeLanguageBadge(c.language));
    return CANONICAL_LANGS.filter((lang) => (byLang[lang] ?? []).length > 0).map((lang) => {
      const list = byLang[lang] ?? [];
      return {
        key: lang,
        title: LANGUAGE_CATALOG[lang].deckLabel,
        subtitle: `${list.length} ${list.length === 1 ? 'card' : 'cards'}`,
        total: list.length,
        cards: list,
        subGroups: options.groupBy === 'lang_then_date' ? buildDateSubGroups(list, timeOpts) : undefined,
      };
    });
  }

  if (options.groupBy === 'deck') {
    const byDeck = Object.groupBy(sorted, (c) => (c.deckName || 'Baralho Principal').trim() || 'Baralho Principal');
    return Object.entries(byDeck)
      .toSorted(([a], [b]) => (a === 'Baralho Principal' ? -1 : b === 'Baralho Principal' ? 1 : a.localeCompare(b, 'pt-BR')))
      .map(([deckName, bucket]) => {
        const list = bucket ?? [];
        return { key: deckName, title: deckName, subtitle: `${list.length} ${list.length === 1 ? 'card' : 'cards'}`, total: list.length, cards: list };
      });
  }

  const byDate = Object.groupBy(sorted, (c) => resolveCardDateKey(c, options.timeZone));
  return Object.entries(byDate)
    .toSorted(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, bucket]) => {
      const list = bucket ?? [];
      return {
        key: dateKey,
        title: formatCalendarDateLabelPtBr(dateKey, timeOpts),
        subtitle: `${list.length} ${list.length === 1 ? 'card' : 'cards'}`,
        total: list.length,
        cards: list,
        subGroups: options.groupBy === 'date_then_lang' ? buildLangSubGroups(list) : undefined,
      };
    });
}

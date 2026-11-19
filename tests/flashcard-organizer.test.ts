import assert from 'assert';
import type { FlashcardItem } from '../src/types/polyglot';
import {
  calendarDateKeyToEpochMs,
  computeDateSummaries,
  computeLanguageSummaries,
  groupFlashcardsTree,
  reorganizeExistingCardsIntoDecks,
  resolveOrganizedDeckName,
  toLocalCalendarDateKey,
} from '../src/utils/flashcardOrganizer';
import { filterStudyQueue } from '../src/services/flashcardDeckStorage';
import { candidatesToFlashcardItems, parseFlashcardsInput } from '../src/utils/flashcardParser';
import { formatFlashcardsToCsv } from '../src/utils/csvExporter';
import { ROUTE_ALLOWED_KEYS, validateStrictPayload } from '../src/server/validators';

type TestFn = () => void | Promise<void>;
const organizerTests: Array<{ name: string; fn: TestFn }> = [];

function test(name: string, fn: TestFn): void {
  organizerTests.push({ name, fn });
}

test('Suite 21: Chaves de Data Locais Sem Drift de Fuso e Tratamento de Entradas Inválidas', () => {
  // 2026-11-18 22:30:00 in America/Manaus (-04:00) == 2026-11-19 02:30:00 UTC
  const lateEveningMs = Date.UTC(2026, 10, 19, 2, 30, 0);
  const manausKey = toLocalCalendarDateKey(lateEveningMs, 'America/Manaus');
  const utcKey = toLocalCalendarDateKey(lateEveningMs, 'UTC');
  assert.strictEqual(manausKey, '2026-11-18', 'Noite local (-04:00) deve permanecer no dia 18');
  assert.strictEqual(utcKey, '2026-11-19', 'UTC deve registrar dia 19');

  const roundTripMs = calendarDateKeyToEpochMs('2026-11-18');
  assert.strictEqual(toLocalCalendarDateKey(roundTripMs), '2026-11-18');

  const fallbackMs = 1_763_481_600_000;
  assert.strictEqual(calendarDateKeyToEpochMs('2026-99-99', fallbackMs), fallbackMs);
  assert.strictEqual(calendarDateKeyToEpochMs('not-a-date', fallbackMs), fallbackMs);
  const nanDateKey = toLocalCalendarDateKey(Number.NaN);
  assert.match(nanDateKey, /^\d{4}-\d{2}-\d{2}$/);
});

test('Suite 22: Separação por Língua e Data, Reorganização SRS Segura e Agrupamento Imutável', () => {
  const now = calendarDateKeyToEpochMs('2026-11-18');
  const dayYesterday = calendarDateKeyToEpochMs('2026-11-17');
  const dayOlder = calendarDateKeyToEpochMs('2026-11-01');

  assert.strictEqual(
    resolveOrganizedDeckName({ mode: 'by_language', language: 'it-IT', dateKey: '2026-11-18' }),
    'Italiano (IT)'
  );
  assert.strictEqual(
    resolveOrganizedDeckName({ mode: 'by_date', language: 'en-US', dateKey: '2026-11-18' }),
    'Estudo · 2026-11-18'
  );
  assert.strictEqual(
    resolveOrganizedDeckName({ mode: 'by_language_and_date', language: 'ja-JP', dateKey: '2026-11-18' }),
    'Japonês (JA) · 2026-11-18'
  );
  assert.strictEqual(
    resolveOrganizedDeckName({ mode: 'custom', customDeckName: 'Viagem Roma', language: 'it-IT', dateKey: '2026-11-18' }),
    'Viagem Roma'
  );

  const cards: FlashcardItem[] = [
    {
      id: 'fc_en_today',
      chunkText: 'Break the ice',
      language: 'en-US',
      front: 'Break the ice',
      back: 'Quebrar o gelo',
      nuance: 'Coloquial',
      example: 'Let us break the ice.',
      exampleTranslation: 'Vamos quebrar o gelo.',
      createdAt: now,
      createdDateKey: '2026-11-18',
      deckName: 'Geral',
      status: 'new',
      intervalDays: 0,
      repetitions: 0,
    },
    {
      id: 'fc_it_yesterday',
      chunkText: 'Meno male',
      language: 'it-IT',
      front: 'Meno male',
      back: 'Ainda bem',
      nuance: 'Alívio',
      example: 'Meno male che sei qui!',
      exampleTranslation: 'Ainda bem que você está aqui!',
      createdAt: dayYesterday,
      createdDateKey: '2026-11-17',
      deckName: 'Geral',
      status: 'mastered',
      intervalDays: 12,
      repetitions: 4,
      nextReviewAt: now + 10 * 86_400_000,
    },
    {
      id: 'fc_ja_older',
      chunkText: 'なるほど',
      language: 'ja-JP',
      front: 'なるほど (Naruhodo)',
      back: 'Entendi',
      nuance: 'Escuta ativa',
      example: 'なるほど、わかりました。',
      exampleTranslation: 'Entendi, compreendi.',
      createdAt: dayOlder,
      createdDateKey: '2026-11-01',
      deckName: 'Geral',
      status: 'learning',
      intervalDays: 1,
      repetitions: 1,
      nextReviewAt: now - 1000,
    },
  ];

  const snapshotIdsBefore = cards.map((c) => c.id);
  const reorg = reorganizeExistingCardsIntoDecks(cards, 'by_language_and_date');
  assert.strictEqual(reorg[1].deckName, 'Italiano (IT) · 2026-11-17');
  assert.strictEqual(reorg[1].status, 'mastered');
  assert.strictEqual(reorg[1].intervalDays, 12);
  assert.strictEqual(reorg[1].repetitions, 4);
  assert.strictEqual(reorg[1].nextReviewAt, now + 10 * 86_400_000);

  const langSummaries = computeLanguageSummaries(cards, { now });
  assert.strictEqual(langSummaries.length, 3);
  assert.strictEqual(langSummaries.find((s) => s.badge === 'IT')?.masteredCount, 1);
  assert.strictEqual(langSummaries.find((s) => s.badge === 'JA')?.distinctDates[0], '2026-11-01');

  const dateSummaries = computeDateSummaries(cards, { now });
  assert.strictEqual(dateSummaries[0].dateKey, '2026-11-18');
  assert.strictEqual(dateSummaries[0].byLanguage.EN, 1);
  assert.strictEqual(dateSummaries[2].dateKey, '2026-11-01');

  const treeDateLang = groupFlashcardsTree(cards, { groupBy: 'date_then_lang', sortOrder: 'az', now });
  assert.strictEqual(treeDateLang[0].key, '2026-11-18');
  assert.strictEqual(treeDateLang[0].subGroups?.[0].key, 'EN');
  assert.deepStrictEqual(cards.map((c) => c.id), snapshotIdsBefore, 'Array original não pode sofrer mutação');

  const todayQueue = filterStudyQueue(cards, {
    deckName: 'ALL',
    language: 'ALL',
    dueOnly: false,
    now,
    datePreset: 'TODAY',
  });
  assert.strictEqual(todayQueue.length, 1);
  assert.strictEqual(todayQueue[0].id, 'fc_en_today');

  const weekQueue = filterStudyQueue(cards, {
    deckName: 'ALL',
    language: 'ALL',
    dueOnly: false,
    now,
    datePreset: 'LAST_7D',
  });
  assert.strictEqual(weekQueue.length, 2);

  const customDayQueue = filterStudyQueue(cards, {
    deckName: 'ALL',
    language: 'JA',
    dueOnly: false,
    now,
    datePreset: 'CUSTOM',
    customDateKey: '2026-11-01',
  });
  assert.strictEqual(customDayQueue.length, 1);
  assert.strictEqual(customDayQueue[0].id, 'fc_ja_older');
});

test('Suite 23: Parser com Idioma Padrão, Lote Datado, CSV Estendido e Validação Trilingue', () => {
  const parsedWithDefaultIt = parseFlashcardsInput(
    'Ciao amici - Olá amigos\nよろしくお願いします - Conto com você',
    { deckName: 'Lote', defaultLanguage: 'IT' }
  );
  assert.strictEqual(parsedWithDefaultIt.cards.length, 2);
  assert.strictEqual(parsedWithDefaultIt.cards[0].language, 'it-IT');
  assert.strictEqual(parsedWithDefaultIt.cards[1].language, 'ja-JP');

  const items = candidatesToFlashcardItems(parsedWithDefaultIt.cards, 'Lote', {
    deckMode: 'by_language_and_date',
    customDateKey: '2026-11-18',
  });
  assert.strictEqual(items[0].createdDateKey, '2026-11-18');
  assert.strictEqual(items[0].deckName, 'Italiano (IT) · 2026-11-18');
  assert.strictEqual(items[1].deckName, 'Japonês (JA) · 2026-11-18');

  const csv = formatFlashcardsToCsv(items);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Frente (Original);Verso (Tradução);Nuance & Contexto;Pronúncia;Exemplo;Tradução do Exemplo;Idioma;Baralho;Data de Criação'));
  assert.ok(csv.includes('"Italiano (IT) · 2026-11-18";"2026-11-18"'));

  const validTrioPayload = validateStrictPayload(
    { chunkText: 'Break the ice', language: 'auto', trilingual: true },
    ROUTE_ALLOWED_KEYS.generateFlashcard
  );
  const adversarialPayload = validateStrictPayload(
    { chunkText: 'Ciao', trilingual: true, unauthorizedRole: 'owner' },
    ROUTE_ALLOWED_KEYS.generateFlashcard
  );
  assert.strictEqual(validTrioPayload.ok, true);
  assert.strictEqual(adversarialPayload.ok, false);
});

export async function runFlashcardOrganizerTests(): Promise<number> {
  let passed = 0;
  for (const t of organizerTests) {
    await t.fn();
    passed++;
    console.log(`  ✓ [PASS] ${t.name}`);
  }
  return passed;
}

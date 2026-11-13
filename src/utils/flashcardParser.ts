/**
 * Parser Multi-Formato Zero-Trust para Importação Rápida de Flashcards (JSON, CSV/TSV Anki, Markdown e HTML).
 * Opera com isolamento estrito (zero dangerouslySetInnerHTML, bloqueio de __proto__/constructor e teto de 500 cards / 1 MB).
 */
import type { FlashcardItem } from '../types/polyglot';

export type FlashcardImportFormat = 'auto' | 'json' | 'csv' | 'markdown' | 'html';

export interface ParsedFlashcardCandidate {
  id: string;
  front: string;
  back: string;
  context: string;
  pronunciation: string;
  example: string;
  exampleTranslation: string;
  language: 'en-US' | 'it-IT' | 'ja-JP';
  deckName: string;
}

export interface FlashcardParseResult {
  detectedFormat: Exclude<FlashcardImportFormat, 'auto'>;
  cards: ParsedFlashcardCandidate[];
  warnings: string[];
}

const MAX_RAW_INPUT_BYTES = 1_000_000; // 1 MB
const MAX_PARSED_CARDS = 500;
const MAX_FIELD_LEN = 600;

function cleanTextField(val: unknown, maxLen = MAX_FIELD_LEN): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Classifica automaticamente o idioma ('en-US' | 'it-IT' | 'ja-JP') a partir de tag explícita ou heurística lexical/Unicode.
 */
export function detectFlashcardLanguage(
  frontText: string,
  explicitTag?: string
): 'en-US' | 'it-IT' | 'ja-JP' {
  const tag = (explicitTag || '').trim().toLowerCase();
  if (tag.startsWith('ja') || tag === 'jp' || tag.includes('japon')) return 'ja-JP';
  if (tag.startsWith('it') || tag.includes('ital')) return 'it-IT';
  if (tag.startsWith('en') || tag.includes('ingl') || tag.includes('us') || tag.includes('uk')) {
    return 'en-US';
  }

  const sample = (frontText || '').trim();
  // Hiragana, Katakana ou Kanji CJK
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(sample)) {
    return 'ja-JP';
  }

  const lower = ` ${sample.toLowerCase()} `;
  // Padrões frequentes do italiano e romaji japonês
  if (
    /\b(onegaishimasu|arigatou|sumimasen|otsukaresama|naruhodo|toriaezu|kudasai|desu|masu)\b/i.test(
      lower
    )
  ) {
    return 'ja-JP';
  }

  if (
    /[àèéìòù](?:\s|[.,!?;:]|$)/i.test(lower) ||
    /\b(potrei|vorrei|per favore|grazie|figurati|meno male|che ne pensi|non c'è|buongiorno|stasera|allora|proprio|questo|quella|anche|perché|più|già|può)\b/i.test(
      lower
    ) ||
    /\b(gli|gne|cchi|zz)\w*/i.test(lower)
  ) {
    return 'it-IT';
  }

  return 'en-US';
}

export function normalizeLanguageBadge(lang: string): 'EN' | 'IT' | 'JA' {
  const normalized = detectFlashcardLanguage('', lang);
  if (normalized === 'ja-JP') return 'JA';
  if (normalized === 'it-IT') return 'IT';
  return 'EN';
}

function makeCandidate(
  partial: {
    front?: unknown;
    back?: unknown;
    context?: unknown;
    pronunciation?: unknown;
    example?: unknown;
    exampleTranslation?: unknown;
    language?: unknown;
  },
  idx: number,
  deckName: string
): ParsedFlashcardCandidate | null {
  const front = cleanTextField(partial.front);
  const back = cleanTextField(partial.back);
  if (!front || !back) return null;

  const language = detectFlashcardLanguage(front, cleanTextField(partial.language, 24));
  return {
    id: `imp_${Date.now()}_${idx}`,
    front,
    back,
    context: cleanTextField(partial.context),
    pronunciation: cleanTextField(partial.pronunciation, 280),
    example: cleanTextField(partial.example),
    exampleTranslation: cleanTextField(partial.exampleTranslation),
    language,
    deckName: cleanTextField(deckName, 80) || 'Baralho Importado',
  };
}

function parseJsonFlashcards(raw: string, deckName: string): ParsedFlashcardCandidate[] {
  const parsed: unknown = JSON.parse(raw, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  });

  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { cards?: unknown[] }).cards)
      ? (parsed as { cards: unknown[] }).cards
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { flashcards?: unknown[] }).flashcards)
        ? (parsed as { flashcards: unknown[] }).flashcards
        : parsed && typeof parsed === 'object'
          ? [parsed]
          : [];

  const results: ParsedFlashcardCandidate[] = [];
  for (let i = 0; i < list.length && results.length < MAX_PARSED_CARDS; i++) {
    const item = list[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const candidate = makeCandidate(
      {
        front: obj.front ?? obj.chunk ?? obj.chunkText ?? obj.term ?? obj.question ?? obj.frente,
        back: obj.back ?? obj.meaning ?? obj.literalOrNuance ?? obj.translation ?? obj.answer ?? obj.verso,
        context: obj.context ?? obj.nuance ?? obj.notes ?? obj.contexto,
        pronunciation: obj.pronunciation ?? obj.phonetic ?? obj.pronunciationHint ?? obj.romaji,
        example: obj.example ?? obj.exampleSentence ?? obj.exemplo,
        exampleTranslation: obj.exampleTranslation ?? obj.examplePtBr,
        language: obj.language ?? obj.lang ?? obj.idioma,
      },
      i,
      typeof obj.deckName === 'string' ? obj.deckName : deckName
    );
    if (candidate) results.push(candidate);
  }
  return results;
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function isHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const c0 = cells[0].toLowerCase().trim();
  const c1 = cells[1].toLowerCase().trim();
  const headerKeywords = new Set([
    'front',
    'frente',
    'term',
    'termo',
    'phrase',
    'frase',
    'question',
    'chunk',
    'idioma alvo',
  ]);
  const backKeywords = new Set([
    'back',
    'verso',
    'meaning',
    'significado',
    'translation',
    'tradução',
    'traducao',
    'answer',
  ]);
  return headerKeywords.has(c0) && backKeywords.has(c1);
}

function parseMarkdownFlashcards(raw: string, deckName: string): ParsedFlashcardCandidate[] {
  const lines = raw.split(/\r?\n/);
  const results: ParsedFlashcardCandidate[] = [];

  // 1. Tabelas Markdown (| Col1 | Col2 | ...)
  const tableLines = lines.filter((l) => l.trim().startsWith('|') && l.trim().endsWith('|'));
  if (tableLines.length >= 2) {
    for (let i = 0; i < tableLines.length && results.length < MAX_PARSED_CARDS; i++) {
      const row = tableLines[i].trim();
      // Ignora linha separadora |---|---|
      if (/^\|[\s:-]+\|/.test(row) && !/[a-zA-Z0-9\u3040-\u9fff]/.test(row)) continue;
      const cells = row
        .slice(1, -1)
        .split('|')
        .map((c) => c.replace(/\*\*/g, '').replace(/`/g, '').trim());
      if (cells.length < 2 || isHeaderRow(cells)) continue;

      const candidate = makeCandidate(
        {
          front: cells[0],
          back: cells[1],
          context: cells[2] || '',
          language: cells[3] || '',
        },
        results.length,
        deckName
      );
      if (candidate) results.push(candidate);
    }
    if (results.length > 0) return results;
  }

  // 2. Blocos Q: / A: ou Frente: / Verso:
  const blocks = raw.split(/\n\s*---+\s*\n|\n{2,}/);
  for (let i = 0; i < blocks.length && results.length < MAX_PARSED_CARDS; i++) {
    const block = blocks[i].trim();
    const qMatch = block.match(/^(?:Q|Frente|Front|Pergunta|Termo)\s*:\s*(.+)$/im);
    const aMatch = block.match(/^(?:A|Verso|Back|Resposta|Significado|Tradu[cç][aã]o)\s*:\s*(.+)$/im);
    if (qMatch && aMatch) {
      const ctxMatch = block.match(/^(?:Contexto|Context|Nuance|Exemplo)\s*:\s*(.+)$/im);
      const langMatch = block.match(/^(?:Idioma|Lang|Language)\s*:\s*(.+)$/im);
      const pronMatch = block.match(/^(?:Pron[uú]ncia|Phonetic|Romaji)\s*:\s*(.+)$/im);
      const candidate = makeCandidate(
        {
          front: qMatch[1],
          back: aMatch[1],
          context: ctxMatch?.[1] || '',
          pronunciation: pronMatch?.[1] || '',
          language: langMatch?.[1] || '',
        },
        results.length,
        deckName
      );
      if (candidate) results.push(candidate);
    }
  }
  if (results.length > 0) return results;

  // 3. Listas Markdown (- Termo :: Significado ou - **Termo** - Significado)
  for (let i = 0; i < lines.length && results.length < MAX_PARSED_CARDS; i++) {
    const line = lines[i].trim().replace(/^[-*•]\s+|\d+\.\s+/, '');
    if (!line) continue;
    const sepMatch =
      line.split(/\s*::\s*|\s*→\s*|\s+—\s+|\s+-\s+/) ||
      [];
    if (sepMatch.length >= 2) {
      const frontRaw = sepMatch[0].replace(/\*\*/g, '').trim();
      const backRaw = sepMatch.slice(1).join(' - ').replace(/\*\*/g, '').trim();
      const candidate = makeCandidate(
        {
          front: frontRaw,
          back: backRaw,
        },
        results.length,
        deckName
      );
      if (candidate) results.push(candidate);
    }
  }

  return results;
}

function parseHtmlFlashcards(raw: string, deckName: string): ParsedFlashcardCandidate[] {
  const sanitizedHtml = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');

  const results: ParsedFlashcardCandidate[] = [];

  // Extrai linhas <tr><td>...</td><td>...</td></tr>
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(sanitizedHtml)) !== null && results.length < MAX_PARSED_CARDS) {
    const rowHtml = trMatch[1];
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells: string[] = [];
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(cleanTextField(tdMatch[1]));
    }
    if (cells.length >= 2 && !isHeaderRow(cells)) {
      const candidate = makeCandidate(
        {
          front: cells[0],
          back: cells[1],
          context: cells[2] || '',
          language: cells[3] || '',
        },
        results.length,
        deckName
      );
      if (candidate) results.push(candidate);
    }
  }
  if (results.length > 0) return results;

  // Extrai pares <dt>...</dt><dd>...</dd>
  const dlRegex = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let dlMatch: RegExpExecArray | null;
  while ((dlMatch = dlRegex.exec(sanitizedHtml)) !== null && results.length < MAX_PARSED_CARDS) {
    const candidate = makeCandidate(
      {
        front: dlMatch[1],
        back: dlMatch[2],
      },
      results.length,
      deckName
    );
    if (candidate) results.push(candidate);
  }

  return results;
}

function parseCsvFlashcards(raw: string, deckName: string): ParsedFlashcardCandidate[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t')
    ? '\t'
    : firstLine.includes(';')
      ? ';'
      : firstLine.includes(',')
        ? ','
        : '';

  const results: ParsedFlashcardCandidate[] = [];

  for (let i = 0; i < lines.length && results.length < MAX_PARSED_CARDS; i++) {
    const line = lines[i];
    let cells: string[];
    if (delimiter) {
      cells = splitDelimitedLine(line, delimiter);
    } else {
      cells = line.split(/\s+-\s+|\s+—\s+|\s*::\s*|\s*→\s*/);
    }

    if (cells.length < 2 || (i === 0 && isHeaderRow(cells))) continue;

    const candidate = makeCandidate(
      {
        front: cells[0],
        back: cells[1],
        context: cells[2] || '',
        pronunciation: cells[3] || '',
        example: cells[4] || '',
        language: cells[5] || cells[3] || '',
      },
      results.length,
      deckName
    );
    if (candidate) results.push(candidate);
  }

  return results;
}

export function parseFlashcardsInput(
  rawInput: string,
  options?: { format?: FlashcardImportFormat; deckName?: string }
): FlashcardParseResult {
  const warnings: string[] = [];
  const deckName = options?.deckName?.trim() || 'Baralho Importado';
  const trimmed = (rawInput || '').slice(0, MAX_RAW_INPUT_BYTES).trim();

  if (!trimmed) {
    return { detectedFormat: 'csv', cards: [], warnings: [] };
  }

  if (rawInput.length > MAX_RAW_INPUT_BYTES) {
    warnings.push('Conteúdo truncado em 1 MB por segurança.');
  }

  const forcedFormat = options?.format || 'auto';

  // 1. JSON
  if (forcedFormat === 'json' || (forcedFormat === 'auto' && (trimmed.startsWith('[') || trimmed.startsWith('{')))) {
    try {
      const cards = parseJsonFlashcards(trimmed, deckName);
      return { detectedFormat: 'json', cards, warnings };
    } catch {
      if (forcedFormat === 'json') {
        warnings.push('JSON inválido. Verifique a estrutura de chaves e aspas.');
        return { detectedFormat: 'json', cards: [], warnings };
      }
    }
  }

  // 2. HTML
  if (
    forcedFormat === 'html' ||
    (forcedFormat === 'auto' && /<(table|tr|td|dt|dd|div|html|body)\b/i.test(trimmed))
  ) {
    const cards = parseHtmlFlashcards(trimmed, deckName);
    if (cards.length > 0 || forcedFormat === 'html') {
      return { detectedFormat: 'html', cards, warnings };
    }
  }

  // 3. Markdown (Tabelas |...| ou blocos Q:/A: ou listas)
  if (
    forcedFormat === 'markdown' ||
    (forcedFormat === 'auto' &&
      (/(?:^|\n)\|.+\|/.test(trimmed) ||
        /(?:^|\n)(?:Q|Frente|Front)\s*:/i.test(trimmed) ||
        /(?:^|\n)[-*]\s+.+(?:::|→|\s-\s)/.test(trimmed)))
  ) {
    const cards = parseMarkdownFlashcards(trimmed, deckName);
    if (cards.length > 0 || forcedFormat === 'markdown') {
      return { detectedFormat: 'markdown', cards, warnings };
    }
  }

  // 4. CSV / TSV / Linhas "Frente - Verso"
  const csvCards = parseCsvFlashcards(trimmed, deckName);
  if (csvCards.length > 0) {
    return { detectedFormat: 'csv', cards: csvCards, warnings };
  }

  // Fallback Markdown se CSV não encontrou pares
  const mdFallback = parseMarkdownFlashcards(trimmed, deckName);
  return {
    detectedFormat: mdFallback.length > 0 ? 'markdown' : 'csv',
    cards: mdFallback,
    warnings,
  };
}

export function candidatesToFlashcardItems(
  candidates: ParsedFlashcardCandidate[],
  overrideDeckName?: string
): FlashcardItem[] {
  const now = Date.now();
  return candidates.map((c, idx) => ({
    id: c.id || `fc_${now}_${idx}`,
    chunkText: c.front,
    language: c.language,
    front: c.front,
    back: c.back,
    nuance: c.context || 'Importado para estudo ativo',
    pronunciation: c.pronunciation || undefined,
    example: c.example || c.front,
    exampleTranslation: c.exampleTranslation || c.back,
    createdAt: now - idx,
    deckName: overrideDeckName?.trim() || c.deckName || 'Baralho Importado',
    status: 'new',
    intervalDays: 0,
    repetitions: 0,
  }));
}

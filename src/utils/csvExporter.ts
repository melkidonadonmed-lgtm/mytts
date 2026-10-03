import { FlashcardItem } from '../types/polyglot';

/**
 * Converte uma lista de flashcards para formato CSV estruturado e sanitizado,
 * otimizado para importação direta no Anki e Notion (delimitador ponto e vírgula ';').
 */
export function formatFlashcardsToCsv(cards: FlashcardItem[]): string {
  const headers = [
    'Frente (Original)',
    'Verso (Tradução)',
    'Nuance & Contexto',
    'Pronúncia',
    'Exemplo',
    'Tradução do Exemplo',
    'Idioma',
  ];

  const escapeCsv = (str: string = ''): string => {
    // Sanitiza quebras de linha e escapa aspas duplas
    const clean = str.replace(/"/g, '""').trim();
    return `"${clean}"`;
  };

  const rows = cards.map((card) =>
    [
      escapeCsv(card.front),
      escapeCsv(card.back),
      escapeCsv(card.nuance),
      escapeCsv(card.pronunciation || ''),
      escapeCsv(card.example),
      escapeCsv(card.exampleTranslation),
      escapeCsv(card.language),
    ].join(';')
  );

  // Prepend UTF-8 BOM (\uFEFF) para garantir que Anki, Excel e Notion reconheçam acentos italianos e caracteres japoneses
  return `\uFEFF${headers.join(';')}\n${rows.join('\n')}`;
}

/**
 * Dispara o download no navegador do arquivo CSV gerado.
 */
export function downloadFlashcardsCsv(cards: FlashcardItem[], filename?: string): void {
  if (typeof window === 'undefined') return;
  const csvContent = formatFlashcardsToCsv(cards);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    filename || `mytts-flashcards-${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

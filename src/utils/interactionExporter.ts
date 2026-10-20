import type { PolyglotMessage, FlashcardItem } from '../types/polyglot';

/**
 * Utilitários para exportação de chunks e interações do Chat Poliglota
 * nos formatos Anki (CSV UTF-8 BOM), Markdown (Obsidian/Notion) e JSON estruturado.
 */

// 1. Exportação para Flashcards Anki (CSV com delimitador ';' e UTF-8 BOM)
export function generateInteractionAnkiCsv(message: PolyglotMessage): string {
  const headers = [
    'Frente (Original)',
    'Verso (Tradução / Contexto)',
    'Italiano',
    'Japonês (Kanji/Kana)',
    'Pronúncia (Japonês Rōmaji)',
    'Frase Completa (EN / IT / JA)',
  ];

  const escapeCsv = (str: string = ''): string => {
    const clean = str.replace(/\r?\n/g, ' ').replace(/"/g, '""').trim();
    return `"${clean}"`;
  };

  const fullContextTriad = `${message.fullText.en} | ${message.fullText.it} | ${message.fullText.ja}`;

  const rows = message.chunks.map((chunk) => {
    return [
      escapeCsv(chunk.en),
      escapeCsv(message.userPrompt),
      escapeCsv(chunk.it),
      escapeCsv(chunk.ja),
      escapeCsv(chunk.jaPronunciation || chunk.ja),
      escapeCsv(fullContextTriad),
    ].join(';');
  });

  return `\uFEFF${headers.join(';')}\n${rows.join('\n')}`;
}

// 2. Exportação para Markdown (Tabela Comparativa pronta para Obsidian e Notion)
export function generateInteractionMarkdown(message: PolyglotMessage): string {
  const dateStr = new Date(message.timestamp).toLocaleString('pt-BR');
  const voices = message.cardVoices || { en: 'Puck', it: 'Kore', ja: 'Aoede' };

  let md = `# Interação de Estudo Poliglota — MyTTS Studio\n\n`;
  md += `**Data:** ${dateStr}\n`;
  md += `**Texto Original (PT-BR):** "${message.userPrompt}"\n`;
  md += `**Vozes por Card:** 🇺🇸 ${voices.en} · 🇮🇹 ${voices.it} · 🇯🇵 ${voices.ja}\n\n`;
  
  md += `## 1. Frases Completas Alinhadas\n\n`;
  md += `- 🇺🇸 **Inglês (${voices.en}):** ${message.fullText.en}\n`;
  md += `- 🇮🇹 **Italiano (${voices.it}):** ${message.fullText.it}\n`;
  md += `- 🇯🇵 **Japonês (${voices.ja}):** ${message.fullText.ja}\n\n`;

  md += `## 2. Decomposição em Blocos Lexicais (Fast Chunks)\n\n`;
  md += `| # | 🇺🇸 Inglês | 🇮🇹 Italiano | 🇯🇵 Japonês | Pronúncia Fonética (Rōmaji) |\n`;
  md += `| :---: | :--- | :--- | :--- | :--- |\n`;

  message.chunks.forEach((chunk, index) => {
    const num = index + 1;
    const jaPron = chunk.jaPronunciation ? chunk.jaPronunciation.replace(/\|/g, '\\|') : '-';
    md += `| ${num} | ${chunk.en.replace(/\|/g, '\\|')} | ${chunk.it.replace(/\|/g, '\\|')} | ${chunk.ja.replace(/\|/g, '\\|')} | ${jaPron} |\n`;
  });

  md += `\n---\n*Exportado automaticamente via MyTTS Studio - Polyglot Chat*\n`;
  return md;
}

// 3. Exportação para JSON Estruturado
export function generateInteractionJson(message: PolyglotMessage): string {
  const voices = message.cardVoices || { en: 'Puck', it: 'Kore', ja: 'Aoede' };
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    sourceApp: 'MyTTS Studio Polyglot Chat',
    interaction: {
      id: message.id,
      promptPtBr: message.userPrompt,
      timestamp: message.timestamp,
      cardVoices: voices,
      fullText: message.fullText,
      chunks: message.chunks.map((c) => ({
        id: c.id,
        english: c.en,
        italian: c.it,
        japanese: c.ja,
        japanesePronunciation: c.jaPronunciation || null,
      })),
    },
  };
  return JSON.stringify(exportPayload, null, 2);
}

// 4. Conversão Direta para Flashcards do Deck Interno
export function convertInteractionToFlashcards(message: PolyglotMessage): FlashcardItem[] {
  const cards: FlashcardItem[] = [];
  const now = Date.now();

  message.chunks.forEach((chunk, index) => {
    // Card Inglês
    cards.push({
      id: `card-en-${message.id}-${index}-${now}`,
      chunkText: chunk.en,
      language: 'en-US',
      front: chunk.en,
      back: `Bloco ${index + 1}: ${message.userPrompt}`,
      nuance: `Inglês natural da frase: "${message.fullText.en}"`,
      pronunciation: '',
      example: message.fullText.en,
      exampleTranslation: message.userPrompt,
      createdAt: now,
    });

    // Card Italiano
    cards.push({
      id: `card-it-${message.id}-${index}-${now}`,
      chunkText: chunk.it,
      language: 'it-IT',
      front: chunk.it,
      back: `Bloco ${index + 1}: ${message.userPrompt}`,
      nuance: `Italiano coloquial da frase: "${message.fullText.it}"`,
      pronunciation: '',
      example: message.fullText.it,
      exampleTranslation: message.userPrompt,
      createdAt: now,
    });

    // Card Japonês
    cards.push({
      id: `card-ja-${message.id}-${index}-${now}`,
      chunkText: chunk.ja,
      language: 'ja-JP',
      front: chunk.ja,
      back: `Bloco ${index + 1}: ${message.userPrompt}`,
      nuance: chunk.jaPronunciation ? `Pronúncia: ${chunk.jaPronunciation}` : 'Japonês fluente',
      pronunciation: chunk.jaPronunciation || '',
      example: message.fullText.ja,
      exampleTranslation: message.userPrompt,
      createdAt: now,
    });
  });

  return cards;
}

// 5. Função Utilitária para Download no Navegador
export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

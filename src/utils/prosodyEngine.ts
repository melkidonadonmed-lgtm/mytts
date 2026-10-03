/**
 * Motor de Auto-Prosódia e Calibração Fonética em Português Brasileiro (pt-BR)
 * 
 * Responsável por calibrar o Director's Chair do Gemini 3.1 Flash TTS
 * e aplicar pontuação acústica natural sem injeção de tags de texto literais,
 * prevenindo que o modelo leia comandos acústicos em voz alta.
 */

export type EmotionStyleType = 'natural' | 'storytelling' | 'technical' | 'spontaneous';

export interface ProsodyOptions {
  enabled?: boolean;
  speed?: number;
}

export function getEmotionStyle(
  emotion: string = 'natural',
  speed: number = 1.0,
  language: string = 'pt-BR'
): string {
  const speedAdj =
    speed < 0.9
      ? 'slow, deliberate and well-paced'
      : speed > 1.1
      ? 'agile, fast and energetic'
      : 'natural and steady-paced';

  let langInstruction = 'Speak strictly in natural Brazilian Portuguese (pt-BR). ';
  if (language === 'en-US' || language === 'en') {
    langInstruction = 'Speak strictly in natural American English with authentic native accent, clear articulation, and natural conversational cadence. ';
  } else if (language === 'it-IT' || language === 'it') {
    langInstruction = 'Speak strictly in authentic, natural Italian with native Italian cadence, lively tempo, open/closed vowels, natural double consonant rhythm, and authentic colloquial intonation. Avoid any foreign accent. ';
  } else if (language === 'ja-JP' || language === 'ja') {
    langInstruction = 'Speak strictly in natural, native Japanese with standard Tokyo pitch-accent, authentic mora timing, and native colloquial inflection. Avoid any English or foreign accent. ';
  }

  switch (emotion) {
    case 'storytelling':
      return `${langInstruction}Warm storytelling cadence, ${speedAdj} rhythm, rich expressive timbre, thoughtful pauses before key concepts, and natural vocal modulation as in a high-end audiobook. Take subtle breath intakes naturally at punctuation.`;
    case 'technical':
      return `${langInstruction}Crystal clear diction, ${speedAdj} professional and grounded rhythm, steady breathing, authoritative articulation without theatrical melodrama. Maintain crisp pronunciation.`;
    case 'spontaneous':
      return `${langInstruction}Agile colloquial cadence, ${speedAdj} friendly inflections, subtle conversational hesitations, and warm energetic presence like a casual podcast dialogue.`;
    case 'natural':
    default:
      return `${langInstruction}Human, balanced, and fluent delivery with subtle breath intakes before long clauses, ${speedAdj} organic rhythm, and natural prosody.`;
  }
}

/**
 * Pré-processa o texto para síntese neural:
 * 1. Remove tags brutas (como [deep breath], [pause], <sigh>) para impedir que o modelo as leia em voz alta.
 * 2. Emprega pontuação acústica sutil (reticências, travessões e quebras duplas) para induzir respiração humana natural.
 */
export function applyAcousticProsody(text: string, options: ProsodyOptions & { language?: string } = {}): string {
  if (!text) return '';

  const { enabled = true, language = 'pt-BR' } = options;

  // 1. Sanitização estrita: remove tags colchetes ou angulares e seus nomes literais para evitar leitura em voz alta
  let cleaned = text
    .replace(/\[\s*(deep\s+breath|breath|sighs?|pauses?|laughs?|whispers?|gasp)\s*\]/gi, '')
    .replace(/<\s*(deep\s+breath|breath|sighs?|pauses?|laughs?|whispers?|gasp)\s*>/gi, '')
    .replace(/<[^>]+>/g, '') // remove tags HTML ou XML residuais
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!enabled) {
    return cleaned;
  }

  // Idiomas sem espaços ou pontuação ocidental (ex: Japonês) não devem sofrer divisões por vírgula arbitrárias
  if (language === 'ja-JP' || language === 'ja') {
    return cleaned;
  }

  // 2. Normalização de parágrafos: garante quebras duplas para indicar repouso vocal entre tópicos
  const paragraphs = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const processedParagraphs = paragraphs.map((para) => {
    // Quebra por orações terminadas em ponto, exclamação ou interrogação
    const sentences = para.split(/(?<=[.!?])\s+/);

    return sentences
      .map((sentence) => {
        const words = sentence.trim().split(/\s+/);

        // Se a frase for longa (> 25 palavras) e contiver vírgula ou ponto-e-vírgula,
        // substitui a primeira vírgula intermediária estratégica por '...' ou ' — ' para respirar
        if (words.length > 25) {
          // Procura vírgula após a 12ª palavra
          const commaIndex = sentence.indexOf(',', 60);
          if (commaIndex !== -1 && commaIndex < sentence.length - 20) {
            return (
              sentence.slice(0, commaIndex) +
              '...' +
              sentence.slice(commaIndex + 1)
            );
          }
        }
        return sentence;
      })
      .join(' ');
  });

  return processedParagraphs.join('\n\n');
}

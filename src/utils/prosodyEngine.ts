/**
 * Motor de Auto-Prosódia, Direção Vocal e Calibração Fonética Multilíngue (pt-BR, en-US, it-IT, ja-JP)
 *
 * Responsável por calibrar o `speech_metadata.style` (Director's Chair) do Gemini 3.8 Flash TTS,
 * diferenciar a acústica de cada persona vocal (Puck, Kore, Aoede, Fenrir, Enceladus)
 * e preservar/injetar marcadores vocais canônicos (`<breath>`, `<short pause>`, `<sigh>`, `<laugh>`, `<chuckle>`).
 */

export type EmotionStyleType =
  | 'natural'
  | 'storytelling'
  | 'technical'
  | 'spontaneous'
  | 'thoughtful'
  | 'inquisitive'
  | 'skeptical'
  | 'ironic'
  | 'passionate'
  | 'resolute'
  | 'expressive'
  | 'calm';

export interface ProsodyOptions {
  enabled?: boolean;
  speed?: number;
}

export interface ExpressiveTranscriptOptions extends ProsodyOptions {
  language?: string;
  emotion?: string;
  injectNaturalBreaths?: boolean;
}

/**
 * Perfis acústicos e respiratórios exclusivos de cada uma das 5 vozes oficiais do estúdio.
 * Usados em `speech_metadata.style` do Gemini 3.8 Flash TTS para garantir identidade timbrística real.
 */
const VOICE_ACOUSTIC_PERSONAS: Record<string, string> = {
  Puck:
    'Voice Persona (Puck): Energetic, charismatic, upbeat and agile vocal presence with bright expressive dynamics, natural micro-inflections, spontaneous warmth, and light lively breath intakes between thoughts.',
  Kore:
    'Voice Persona (Kore): Poised, crystal-clear, articulate and intelligent female studio voice with balanced warmth, composed breath control, subtle empathetic inflections, and natural conversational authority.',
  Aoede:
    'Voice Persona (Aoede): Lyrical, velvety, deeply expressive storytelling female voice with rich harmonic warmth, intimate close-mic presence, organic soft breaths before emotional clauses, and musical cadence.',
  Fenrir:
    'Voice Persona (Fenrir): Deep, resonant, grounded baritone voice with commanding presence, chest-voice warmth, deliberate pacing, perceptible diaphragmatic breath intakes, and firm gravitas.',
  Enceladus:
    'Voice Persona (Enceladus): Intimate, breathy, close-mic atmospheric voice with soft velvet texture, audible gentle inhalations and exhalations, contemplative warmth, and deeply human micro-pauses.',
};

const CANONICAL_VOCAL_TAGS = new Set([
  'argh',
  'breath',
  'heavy breath',
  'exhales',
  'cackle',
  'cheer',
  'chuckle',
  'chuckles',
  'cough',
  'cry',
  'gasp',
  'giggle',
  'groan',
  'growl',
  'grunt',
  'grr',
  'hiss',
  'laugh',
  'laughter',
  'moan',
  'pant',
  'pff',
  'phew',
  'scream',
  'shout',
  'shriek',
  'sigh',
  'sighs',
  'sneeze',
  'snicker',
  'snort',
  'sob',
  'throat-clearing',
  'throat clear',
  'tsk',
  'whimper',
  'whispers',
  'whispering',
  'yawn',
  'short pause',
  'long pause',
]);

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
    case 'thoughtful':
      return `${langInstruction}Contemplative, reflective and deeply thoughtful delivery, ${speedAdj} measured cadence, soft audible breath intakes before philosophical or analytical observations, and warm introspective tone.`;
    case 'inquisitive':
      return `${langInstruction}Curious, probing and inquisitive tone, ${speedAdj} lively rhythm, rising questioning inflections, engaged conversational energy, and natural breath intakes before questions.`;
    case 'skeptical':
      return `${langInstruction}Analytical, questioning and subtly skeptical delivery, ${speedAdj} measured tempo, raised-eyebrow vocal inflection, deliberate micro-pauses before counterarguments, and grounded realism.`;
    case 'ironic':
      return `${langInstruction}Wry, dryly witty and subtly ironic delivery, ${speedAdj} conversational timing, nuanced sardonic micro-inflections, light audible exhale or chuckle on punchlines, and sharp intelligence.`;
    case 'passionate':
      return `${langInstruction}Passionate, vibrant and emotionally charged delivery, ${speedAdj} dynamic momentum, expressive pitch contour, audible deep breath intakes before emphatic statements, and heartfelt conviction.`;
    case 'resolute':
      return `${langInstruction}Firm, decisive and resolute delivery, ${speedAdj} grounded cadence, unwavering vocal authority, clear downward inflection at sentence endings, and confident diaphragmatic breathing.`;
    case 'expressive':
      return `${langInstruction}Highly expressive, emotionally rich and dramatic human delivery, ${speedAdj} dynamic rhythm, vivid tonal contrast, natural audible breathing, and intimate studio presence.`;
    case 'calm':
      return `${langInstruction}Serene, soothing and calm close-mic delivery, ${speedAdj} unhurried cadence, soft gentle breath intakes, warm velvet resonance, and relaxed pauses.`;
    case 'natural':
    default:
      return `${langInstruction}Human, balanced, and fluent delivery with subtle breath intakes before long clauses, ${speedAdj} organic rhythm, and natural prosody.`;
  }
}

/**
 * Constrói a diretriz de `speechMetadata.style` para o Gemini 3.8 Flash TTS,
 * unindo idioma, emoção, velocidade e o perfil acústico/respiratório exclusivo da voz
 * sem injetar sintaxe de tags angulares na propriedade `style`.
 */
export function getVoiceAcousticStyle(
  voiceId: string = 'Kore',
  emotion: string = 'natural',
  speed: number = 1.0,
  language: string = 'pt-BR'
): string {
  const baseStyle = getEmotionStyle(emotion, speed, language);
  const personaStyle = VOICE_ACOUSTIC_PERSONAS[voiceId] || VOICE_ACOUSTIC_PERSONAS.Kore;
  return `${baseStyle} ${personaStyle}`;
}

/**
 * Converte marcadores vocais em colchetes ou variantes legadas para as tags angulares canônicas
 * do Gemini 3.8 Flash TTS (`<breath>`, `<heavy breath>`, `<sigh>`, `<laugh>`, `<chuckle>`, `<gasp>`, `<short pause>`, `<long pause>`),
 * removendo HTML arbitrário e injetando respirações/pausas orgânicas em frases longas.
 */
export function buildExpressiveTtsTranscript(
  text: string,
  options: ExpressiveTranscriptOptions = {}
): string {
  if (!text) return '';

  const {
    enabled = true,
    language = 'pt-BR',
    emotion = 'natural',
    injectNaturalBreaths = true,
  } = options;

  // 1. Converte tags em colchetes `[...]` ou tags angulares equivalentes para tags canônicas do Gemini 3.8 TTS
  let normalized = text
    .replace(/\[\s*(?:deep\s+breath|heavy\s+breath)\s*\]/gi, '<heavy breath>')
    .replace(/<\s*(?:deep\s+breath|heavy\s+breath)\s*>/gi, '<heavy breath>')
    .replace(/\[\s*breaths?\s*\]/gi, '<breath>')
    .replace(/<\s*breaths?\s*>/gi, '<breath>')
    .replace(/\[\s*exhales?\s*\]/gi, '<exhales>')
    .replace(/<\s*exhales?\s*>/gi, '<exhales>')
    .replace(/\[\s*sighs?\s*\]/gi, '<sigh>')
    .replace(/<\s*sighs?\s*>/gi, '<sigh>')
    .replace(/\[\s*(?:laughs?|laughter)\s*\]/gi, '<laugh>')
    .replace(/<\s*laughs?\s*>/gi, '<laugh>')
    .replace(/\[\s*chuckles?\s*\]/gi, '<chuckle>')
    .replace(/<\s*chuckles?\s*>/gi, '<chuckle>')
    .replace(/\[\s*giggles?\s*\]/gi, '<giggle>')
    .replace(/\[\s*snickers?\s*\]/gi, '<snicker>')
    .replace(/\[\s*groans?\s*\]/gi, '<groan>')
    .replace(/\[\s*gasps?\s*\]/gi, '<gasp>')
    .replace(/<\s*gasps?\s*>/gi, '<gasp>')
    .replace(/\[\s*(?:whispers?|whispering)\s*\]/gi, '<whispers>')
    .replace(/<\s*whispers?\s*>/gi, '<whispers>')
    .replace(/\[\s*short\s+pauses?\s*\]/gi, '<short pause>')
    .replace(/<\s*short\s+pauses?\s*>/gi, '<short pause>')
    .replace(/\[\s*long\s+pauses?\s*\]/gi, '<long pause>')
    .replace(/<\s*long\s+pauses?\s*>/gi, '<long pause>')
    .replace(/\[\s*pauses?\s*\]/gi, '<short pause>')
    .replace(/<\s*pauses?\s*>/gi, '<short pause>')
    .replace(/\[\s*coughs?\s*\]/gi, '<cough>')
    .replace(/\[\s*throat[\s-]+clear(?:ing)?\s*\]/gi, '<throat-clearing>')
    .replace(/<\s*throat[\s-]+clear(?:ing)?\s*>/gi, '<throat-clearing>')
    .replace(/\[\s*yawns?\s*\]/gi, '<yawn>')
    .replace(/\[\s*pants?\s*\]/gi, '<pant>')
    .replace(/\[\s*(?:phew|pff)\s*\]/gi, '<phew>')
    .replace(/\[\s*tsk\s*\]/gi, '<tsk>')
    .replace(/\[\s*sobs?\s*\]/gi, '<sob>');

  // 2. Remove qualquer tag `<...>` que NÃO faça parte do conjunto canônico de tags vocais do Gemini 3.8 TTS
  normalized = normalized.replace(/<([^>]+)>/g, (_full, inner: string) => {
    const cleanTag = inner.trim().toLowerCase().replace(/\s+/g, ' ');
    if (cleanTag === 'throat clear') {
      return '<throat-clearing>';
    }
    if (CANONICAL_VOCAL_TAGS.has(cleanTag)) {
      return `<${cleanTag}>`;
    }
    return '';
  });

  if (!enabled) {
    return normalized.replace(/[ \t]{2,}/g, ' ').trim();
  }

  // Japonês preserva pontuação nativa sem fatiamento por vírgula ocidental, mas mantém tags vocais explícitas
  if (language === 'ja-JP' || language === 'ja') {
    return normalized.replace(/[ \t]{2,}/g, ' ').trim();
  }

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const hasExplicitBreathOrPause = /<(?:breath|heavy breath|sigh|short pause|long pause)>/i.test(normalized);

  const processedParagraphs = paragraphs.map((para, paraIdx) => {
    const sentences = para.split(/(?<=[.!?])\s+/);

    const processedSentences = sentences.map((sentence, sentIdx) => {
      const trimmed = sentence.trim();
      if (!trimmed) return '';

      const withoutLeadingTags = trimmed.replace(/^(?:<[^>]+>\s*)+/, '');
      const words = withoutLeadingTags.split(/\s+/).filter(Boolean);
      let updated = trimmed;

      // Em orações longas (> 20 palavras) sem pausa/respiração no meio da frase, injeta fôlego na primeira fronteira estratégica (, ; ou —)
      if (
        injectNaturalBreaths &&
        words.length > 20 &&
        !/<(?:breath|heavy breath|short pause|long pause)>/i.test(withoutLeadingTags)
      ) {
        const searchStart = Math.min(48, Math.floor(updated.length * 0.35));
        const sliceAfterStart = updated.slice(searchStart);
        const boundaryMatch = sliceAfterStart.match(/[,;]|(?:\s—\s)/);
        if (boundaryMatch && boundaryMatch.index !== undefined) {
          const boundaryIndex = searchStart + boundaryMatch.index;
          const token = boundaryMatch[0];
          if (boundaryIndex < updated.length - 18) {
            const cue =
              emotion === 'passionate' || emotion === 'expressive'
                ? '<breath>'
                : '<short pause> <breath>';
            updated = `${updated.slice(0, boundaryIndex + token.length)} ${cue} ${updated
              .slice(boundaryIndex + token.length)
              .trimStart()}`;
          }
        }
      }

      // Em leituras com múltiplas frases, adiciona respiração sutil antes da 3ª frase se não houver tags explícitas
      if (
        injectNaturalBreaths &&
        !hasExplicitBreathOrPause &&
        sentIdx > 0 &&
        sentIdx % 2 === 0 &&
        words.length >= 10 &&
        !/^<(?:breath|heavy breath|sigh|short pause)/.test(updated)
      ) {
        updated = `<breath> ${updated}`;
      }

      return updated.replace(/[ \t]{2,}/g, ' ').trim();
    });

    const joinedSentences = processedSentences.filter(Boolean).join(' ');
    const paraWordCount = joinedSentences
      .replace(/<[^>]+>/g, '')
      .split(/\s+/)
      .filter(Boolean).length;
    const prevParaWordCount =
      paraIdx > 0
        ? paragraphs[paraIdx - 1]
            .replace(/<[^>]+>/g, '')
            .split(/\s+/)
            .filter(Boolean).length
        : 0;

    // Entre parágrafos substantivos (>= 6 palavras ou após parágrafo >= 10 palavras), garante tomada de fôlego orgânica
    if (
      injectNaturalBreaths &&
      paraIdx > 0 &&
      (paraWordCount >= 6 || prevParaWordCount >= 10) &&
      !/^<(?:breath|heavy breath|sigh|short pause|long pause)/.test(joinedSentences)
    ) {
      return `<short pause> <breath> ${joinedSentences}`;
    }
    return joinedSentences;
  });

  return processedParagraphs.join('\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Pré-processa o texto para motores legados ou sanitização pura:
 * 1. Remove tags brutas (como [deep breath], [pause], <sigh>) para impedir que motores sem suporte a tags as leiam em voz alta.
 * 2. Emprega pontuação acústica sutil (reticências e quebras duplas) para induzir respiração natural.
 */
export function applyAcousticProsody(text: string, options: ProsodyOptions & { language?: string } = {}): string {
  if (!text) return '';

  const { enabled = true, language = 'pt-BR' } = options;

  // 1. Sanitização estrita: remove tags colchetes ou angulares e seus nomes literais para evitar leitura em voz alta
  const cleaned = text
    .replace(/\[\s*(deep\s+breath|heavy\s+breath|breath|sighs?|pauses?|short\s+pauses?|long\s+pauses?|laughs?|chuckles?|whispers?|gasps?)\s*\]/gi, '')
    .replace(/<\s*(deep\s+breath|heavy\s+breath|breath|sighs?|pauses?|short\s+pauses?|long\s+pauses?|laughs?|chuckles?|whispers?|gasps?)\s*>/gi, '')
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

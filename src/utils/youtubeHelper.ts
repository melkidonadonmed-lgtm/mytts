/**
 * Utilitários determinísticos para detecção, normalização canônica (Vertex AI fileData),
 * inferência de intenção pós-link e extração de metadados/resultados de busca do YouTube.
 */
import type { YoutubePostLinkAction, YoutubeVideoMetadata } from '../types/polyglot';

const YOUTUBE_URL_REGEX =
  /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^"\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[^\s"']*)?/i;

export function normalizeYoutubeVideo(
  input: string
): { videoId: string; canonicalUrl: string; rawMatch: string } | null {
  if (!input || typeof input !== 'string') return null;
  const match = input.match(YOUTUBE_URL_REGEX);
  if (!match || !match[1]) return null;
  const videoId = match[1];
  return {
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    rawMatch: match[0],
  };
}

export function detectYoutubeUrl(text: string): string | null {
  const normalized = normalizeYoutubeVideo(text);
  return normalized ? normalized.canonicalUrl : null;
}

/**
 * Verifica se o usuário colou APENAS o link do YouTube (sem instruções adicionais).
 * Nesse caso, o fluxo pós-link abre o Card Interativo perguntando o que ele deseja fazer.
 */
export function isBareYoutubeLinkOnly(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const normalized = normalizeYoutubeVideo(text);
  if (!normalized) return false;
  const remainder = text
    .replace(normalized.rawMatch, '')
    .replace(/[\s.,;!?()-]+/g, '')
    .trim();
  return remainder.length === 0;
}

/**
 * Infere a ação pós-link a partir do texto digitado pelo usuário junto ao link.
 */
export function inferYoutubeActionFromPrompt(prompt: string): YoutubePostLinkAction {
  if (isBareYoutubeLinkOnly(prompt)) {
    return 'ask_intent';
  }
  const normalized = normalizeYoutubeVideo(prompt);
  const instructionPart = (normalized ? prompt.replace(normalized.rawMatch, '') : prompt)
    .toLowerCase()
    .trim();

  if (!instructionPart) {
    return 'ask_intent';
  }

  if (
    /\b(traduz\w*|transcrev\w*|transcri\w*|fala\w*|legenda\w*|inteir\w*|complet\w*|todo\s+o\s+v[ií]deo|trecho)\b/i.test(
      instructionPart
    )
  ) {
    return 'translate_video';
  }

  if (
    /\b(flashcard\w*|card\w*|express[oõ]es|chunk\w*|g[ií]ria\w*|vocabul[aá]rio)\b/i.test(
      instructionPart
    )
  ) {
    return 'extract_expressions';
  }

  if (/\b(resum\w*|explic\w*|s[ií]ntese|pontos\s+principais|di[aá]logo)\b/i.test(instructionPart)) {
    return 'summary_dialogue';
  }

  return 'custom_prompt';
}

/**
 * Detecta se o texto digitado no modo padrão tem intenção explícita de buscar no YouTube ou na Web,
 * evitando que comandos como "busque no youtube vídeos sobre café" caiam no tradutor literal.
 */
export function hasYoutubeOrWebSearchIntent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  if (detectYoutubeUrl(text)) return true;
  const clean = text.trim().toLowerCase();
  if (
    /\b(youtube|yt)\b/i.test(clean) &&
    /\b(busc\w*|busq\w*|procur\w*|pesquis\w*|ach\w*|encontr\w*|v[ií]deo\w*|canal|recomen\w*|mostr\w*|trag\w*)\b/i.test(
      clean
    )
  ) {
    return true;
  }
  if (
    /^(busque|pesquise|procure|encontre)\s+(na\s+web|no\s+google|na\s+internet|no\s+youtube|v[ií]deos?\s+sobre)/i.test(
      clean
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Extrai de forma resiliente um objeto JSON estruturado da resposta textual do modelo Gemini,
 * mesmo quando envolto em blocos markdown ```json ou acompanhado de texto introdutório.
 */
export function parseStructuredJsonFromModel<T = Record<string, unknown>>(
  rawText: string
): T | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();

  // 1. Tentativa direta
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // continua
  }

  // 2. Bloco fenced ```json ... ```
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim()) as T;
    } catch {
      // continua
    }
  }

  // 3. Varredura balanceada de chaves '{' ... '}' procurando objeto que contenha "chunks" ou "agentReplyPtBr"
  const startPositions: number[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') startPositions.push(i);
  }

  for (const start of startPositions) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = start; j < trimmed.length; j++) {
      const ch = trimmed[j];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            const candidate = trimmed.slice(start, j + 1);
            try {
              const parsed = JSON.parse(candidate) as Record<string, unknown>;
              if (
                parsed &&
                typeof parsed === 'object' &&
                ('chunks' in parsed || 'agentReplyPtBr' in parsed || 'turns' in parsed)
              ) {
                return parsed as T;
              }
            } catch {
              // tenta próximo bloco balanceado
            }
            break;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Extrai metadados de vídeos reais a partir do HTML de busca do YouTube (ytInitialData).
 */
export function parseYoutubeSearchResultsHtml(
  html: string,
  maxResults = 4
): YoutubeVideoMetadata[] {
  if (!html || typeof html !== 'string') return [];
  const results: YoutubeVideoMetadata[] = [];
  const seenIds = new Set<string>();

  const regex =
    /"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null && results.length < maxResults) {
    const videoId = match[1];
    if (!videoId || seenIds.has(videoId)) continue;
    seenIds.add(videoId);

    const rawTitle = match[2] || 'Vídeo do YouTube';
    let cleanTitle = rawTitle;
    try {
      cleanTitle = JSON.parse(`"${rawTitle}"`);
    } catch {
      cleanTitle = rawTitle.replace(/\\"/g, '"');
    }

    // Busca janela próxima até o próximo videoRenderer para extrair duração e canal
    const nextVideoIdx = html.indexOf('"videoRenderer":{"videoId":', match.index + 30);
    const windowEnd =
      nextVideoIdx !== -1
        ? Math.min(nextVideoIdx, match.index + 8500)
        : Math.min(html.length, match.index + 8500);
    const windowSlice = html.slice(match.index, windowEnd);
    const authorMatch = windowSlice.match(
      /"(?:ownerText|longBylineText|shortBylineText)":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/
    );
    const lengthMatch = windowSlice.match(
      /"lengthText":\{(?:"accessibility":\{[\s\S]*?\},)?"simpleText":"([^"]+)"/
    );

    let authorName: string | undefined;
    if (authorMatch && authorMatch[1]) {
      try {
        authorName = JSON.parse(`"${authorMatch[1]}"`);
      } catch {
        authorName = authorMatch[1];
      }
    }

    results.push({
      videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      title: cleanTitle,
      authorName,
      durationHint: lengthMatch?.[1] || undefined,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  }

  return results;
}

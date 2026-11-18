import type { YoutubeVideoMetadata } from '../../types/polyglot';
import {
  normalizeYoutubeVideo,
  parseYoutubeSearchResultsHtml,
} from '../../utils/youtubeHelper';

export interface LiveAgentToolCallResult {
  id: string;
  name: 'create_study_flashcard' | 'switch_studio_voice';
  behavior: 'NON_BLOCKING';
  args: {
    frontPhrase?: string;
    backTranslation?: string;
    targetVoice?: 'Puck' | 'Kore' | 'Aoede' | 'Fenrir' | 'Enceladus';
    language?: 'en' | 'it' | 'ja' | 'all';
  };
  status: 'executed';
  summaryPtBr: string;
}

const VALID_STUDIO_VOICES = new Set(['Puck', 'Kore', 'Aoede', 'Fenrir', 'Enceladus']);

export function resolveLiveToolCalls(
  rawToolCalls: unknown,
  userTranscript: string,
  chunks: Array<{ en: string; it: string; ja: string }>
): LiveAgentToolCallResult[] {
  const results: LiveAgentToolCallResult[] = [];
  const seenSignatures = new Set<string>();

  if (Array.isArray(rawToolCalls)) {
    for (const raw of rawToolCalls) {
      if (!raw || typeof raw !== 'object') continue;
      const candidate = raw as Record<string, unknown>;
      const name = String(candidate.name || '');
      if (name !== 'create_study_flashcard' && name !== 'switch_studio_voice') continue;

      const sig = `${name}:${JSON.stringify(candidate)}`;
      if (seenSignatures.has(sig)) continue;
      seenSignatures.add(sig);

      if (name === 'create_study_flashcard') {
        const frontPhrase = String(candidate.frontPhrase || chunks[0]?.en || userTranscript).slice(0, 240);
        const backTranslation = String(
          candidate.backTranslation || `${chunks[0]?.it || ''} • ${chunks[0]?.ja || ''}`
        ).slice(0, 240);
        results.push({
          id: `tool-fc-${Date.now()}-${results.length}`,
          name: 'create_study_flashcard',
          behavior: 'NON_BLOCKING',
          args: { frontPhrase, backTranslation },
          status: 'executed',
          summaryPtBr: `Flashcard criado automaticamente: "${frontPhrase}"`,
        });
      } else if (name === 'switch_studio_voice') {
        const rawVoice = String(candidate.targetVoice || 'Puck');
        const targetVoice = (VALID_STUDIO_VOICES.has(rawVoice) ? rawVoice : 'Puck') as
          | 'Puck'
          | 'Kore'
          | 'Aoede'
          | 'Fenrir'
          | 'Enceladus';
        const rawLang = String(candidate.language || 'all');
        const language = (['en', 'it', 'ja', 'all'].includes(rawLang) ? rawLang : 'all') as
          | 'en'
          | 'it'
          | 'ja'
          | 'all';
        results.push({
          id: `tool-voice-${Date.now()}-${results.length}`,
          name: 'switch_studio_voice',
          behavior: 'NON_BLOCKING',
          args: { targetVoice, language },
          status: 'executed',
          summaryPtBr: `Voz do estúdio alterada para ${targetVoice} (${language.toUpperCase()})`,
        });
      }
    }
  }

  if (results.length === 0 && userTranscript) {
    const lower = userTranscript.toLowerCase();
    if (lower.includes('flashcard') || lower.includes('salvar card') || lower.includes('salve um card')) {
      const frontPhrase = chunks[0]?.en || userTranscript;
      const backTranslation = chunks[0] ? `${chunks[0].it} • ${chunks[0].ja}` : 'Expressão salva via Agente Live';
      results.push({
        id: `tool-fc-${Date.now()}`,
        name: 'create_study_flashcard',
        behavior: 'NON_BLOCKING',
        args: { frontPhrase, backTranslation },
        status: 'executed',
        summaryPtBr: `Flashcard criado automaticamente: "${frontPhrase}"`,
      });
    }
    for (const v of ['Puck', 'Kore', 'Aoede', 'Fenrir', 'Enceladus'] as const) {
      if (lower.includes(`voz ${v.toLowerCase()}`) || lower.includes(`mudar para ${v.toLowerCase()}`)) {
        results.push({
          id: `tool-voice-${Date.now()}`,
          name: 'switch_studio_voice',
          behavior: 'NON_BLOCKING',
          args: { targetVoice: v, language: 'all' },
          status: 'executed',
          summaryPtBr: `Voz do estúdio alterada para ${v}`,
        });
        break;
      }
    }
  }

  return results;
}

export async function fetchYoutubeMetadata(rawUrlOrId: string): Promise<YoutubeVideoMetadata | null> {
  const normalized = normalizeYoutubeVideo(rawUrlOrId);
  if (!normalized) return null;

  const { videoId, canonicalUrl } = normalized;
  const fallbackMeta: YoutubeVideoMetadata = {
    videoId,
    canonicalUrl,
    title: `Vídeo do YouTube (${videoId})`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
    const resp = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return fallbackMeta;
    const data = (await resp.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      videoId,
      canonicalUrl,
      title: data.title || fallbackMeta.title,
      authorName: data.author_name || undefined,
      thumbnailUrl: data.thumbnail_url || fallbackMeta.thumbnailUrl,
    };
  } catch (err: unknown) {
    console.debug(
      '[YouTube] Metadata fallback:',
      err instanceof Error ? err.message : String(err)
    );
    return fallbackMeta;
  }
}

export async function searchYoutubeVideos(query: string, maxResults = 4): Promise<YoutubeVideoMetadata[]> {
  const cleanQuery = query
    .replace(/^(busque|pesquise|procure|encontre|mostrar)\s+(no\s+youtube|v[ií]deos?\s+(no\s+youtube\s+)?(sobre|de)?)\s*/i, '')
    .trim();
  if (!cleanQuery) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}&hl=pt&gl=BR`;
    const resp = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    clearTimeout(timeout);
    if (!resp.ok) return [];
    const html = await resp.text();
    return parseYoutubeSearchResultsHtml(html, maxResults);
  } catch (err: unknown) {
    console.debug(
      '[YouTube] Search fallback:',
      err instanceof Error ? err.message : String(err)
    );
    return [];
  }
}

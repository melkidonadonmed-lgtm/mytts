import { Router } from 'express';
import { randomUUID } from 'crypto';
import { ThinkingLevel, Type } from '@google/genai';
import { chunkStorage } from '../../services/chunkStorage';
import type { ChunkItem } from '../../types/chunks';
import type { AlignedChunk, FlashcardItem } from '../../types/polyglot';
import { detectFlashcardLanguage } from '../../utils/flashcardParser';
import { toLocalCalendarDateKey } from '../../utils/flashcardOrganizer';
import { parseStructuredJsonFromModel } from '../../utils/youtubeHelper';
import {
  ALLOWED_CHUNK_TARGET_LANGS,
  capText,
  formatGeminiError,
} from '../audioContainer';
import { resolveRequestUserId } from '../authSession';
import { ai } from '../geminiClient';
import { MODEL_REGISTRY } from '../modelRegistry';
import { ROUTE_ALLOWED_KEYS, validateStrictPayload } from '../validators';

const MAX_PARALLEL_TRANSLATE_CHARS = 6000;

function resolveGeminiHttpStatus(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return 429;
  }
  return 502;
}

function normalizeGeneratedCard(
  item: Record<string, string>,
  fallbackFront: string,
  explicitLang: string | undefined,
  now: number,
  idx = 0
): FlashcardItem {
  const front = (item.front || fallbackFront).trim();
  const resolvedLang = detectFlashcardLanguage(front, explicitLang || item.language);
  return {
    id: `card_${now}_${idx}_${randomUUID().slice(0, 6)}`,
    chunkText: front,
    language: resolvedLang,
    front,
    back: item.back || '',
    nuance: item.nuance || '',
    pronunciation: item.pronunciation || '',
    example: item.example || front,
    exampleTranslation: item.exampleTranslation || item.back || '',
    createdAt: now - idx,
    createdDateKey: toLocalCalendarDateKey(now),
  };
}

async function generateTrilingualFlashcards(
  chunkText: string,
  contextSentence?: string
): Promise<FlashcardItem[]> {
  const systemPrompt = `Você é um professor poliglota especialista na metodologia Anki de repetição espaçada.
A partir de uma expressão ou frase (em Português, Inglês, Italiano ou Japonês), gere exatamente 3 flashcards paralelos e equivalentes para estudo em Inglês ('en-US'), Italiano ('it-IT') e Japonês ('ja-JP').
Use 'en-US', 'it-IT' e 'ja-JP' em "language"; expressão idiomática no idioma alvo em "front" (kanji/kana + romaji para japonês); tradução natural em pt-BR em "back"; nuance em pt-BR; guia fonético em "pronunciation"; e exemplo real + tradução pt-BR.`;

  const response = await ai.models.generateContent({
    model: MODEL_REGISTRY.TEXT_REASONING_MODEL,
    contents: [{ role: 'user', parts: [{ text: `Entrada: "${chunkText}"\nContexto: "${contextSentence || chunkText}"` }] }],
    config: {
      systemInstruction: systemPrompt,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                language: { type: Type.STRING },
                front: { type: Type.STRING },
                back: { type: Type.STRING },
                nuance: { type: Type.STRING },
                pronunciation: { type: Type.STRING },
                example: { type: Type.STRING },
                exampleTranslation: { type: Type.STRING },
              },
              required: ['language', 'front', 'back', 'nuance', 'pronunciation', 'example', 'exampleTranslation'],
            },
          },
        },
        required: ['cards'],
      },
    },
  });

  const parsed =
    parseStructuredJsonFromModel<{ cards?: Array<Record<string, string>> }>(response.text || '{}') || {};
  const rawList = Array.isArray(parsed.cards) ? parsed.cards.slice(0, 3) : [];
  if (rawList.length === 0) {
    throw new Error('O modelo não retornou cartões trilíngues válidos.');
  }
  const now = Date.now();
  return rawList.map((item, idx) => normalizeGeneratedCard(item, chunkText, item.language, now, idx));
}

async function generateSingleFlashcard(
  chunkText: string,
  language: string,
  contextSentence?: string
): Promise<FlashcardItem> {
  const requestedLang = (language || '').trim();
  const isAuto = !requestedLang || requestedLang.toLowerCase() === 'auto';
  const systemPrompt = `Você é um professor poliglota especialista na metodologia Anki de repetição espaçada.
A partir de uma frase ou chunk ${isAuto ? 'detectando o idioma alvo (en-US, it-IT ou ja-JP)' : `em ${requestedLang}`}, elabore um Flashcard pedagógico em Português do Brasil (pt-BR).
Se a entrada estiver em português e o idioma alvo for EN/IT/JA, traduza para "front" no idioma alvo e coloque o significado pt-BR em "back".
Inclua "language" ('en-US' | 'it-IT' | 'ja-JP'), "front", "back", "nuance", "pronunciation", "example" e "exampleTranslation".`;

  const response = await ai.models.generateContent({
    model: MODEL_REGISTRY.TEXT_REASONING_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: `Chunk: "${chunkText}"\nIdioma alvo: ${isAuto ? 'auto' : requestedLang}\nContexto: "${contextSentence || chunkText}"` }],
      },
    ],
    config: {
      systemInstruction: systemPrompt,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          language: { type: Type.STRING },
          front: { type: Type.STRING },
          back: { type: Type.STRING },
          nuance: { type: Type.STRING },
          pronunciation: { type: Type.STRING },
          example: { type: Type.STRING },
          exampleTranslation: { type: Type.STRING },
        },
        required: ['language', 'front', 'back', 'nuance', 'pronunciation', 'example', 'exampleTranslation'],
      },
    },
  });

  const parsed = parseStructuredJsonFromModel<Record<string, string>>(response.text || '{}') || {};
  if (!parsed.front || !parsed.back) {
    throw new Error('O modelo não retornou frente e verso válidos para o flashcard.');
  }
  return normalizeGeneratedCard(parsed, chunkText, isAuto ? undefined : requestedLang, Date.now(), 0);
}

export function createStudyRouter(): Router {
  const router = Router();

  router.post('/api/generate-chunks', async (req, res) => {
    try {
      const identity = resolveRequestUserId(req);
      if (!identity.ok) {
        return res.status(identity.status).json({ error: identity.error });
      }
      const userId = identity.userId;

      const check = validateStrictPayload<{
        textOrPrompt?: string;
        language?: string;
        count?: number;
      }>(req.body, ROUTE_ALLOWED_KEYS.generateChunks);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const { textOrPrompt, language = 'en-US', count = 3 } = check.data;
      const safeCount = Math.max(1, Math.min(20, Math.floor(Number(count)) || 3));

      if (!textOrPrompt || typeof textOrPrompt !== 'string' || !textOrPrompt.trim()) {
        return res.status(400).json({ error: 'Texto ou intenção é obrigatório.' });
      }
      const safePrompt = capText(textOrPrompt.trim(), 4000);
      const safeLanguage = ALLOWED_CHUNK_TARGET_LANGS.has(language) ? language : 'en-US';

      const langMap: Record<string, string> = {
        'en-US': 'Inglês falado nos Estados Unidos (coloquial americano contemporâneo)',
        'it-IT': 'Italiano falado na Itália (linguagem coloquial cotidiana, gírias e reações expressivas)',
        'ja-JP': 'Japonês falado no Japão (coloquial, aizuchi, expressões do dia a dia; obrigatório incluir romaji entre parênteses para pronúncia)',
      };

      const targetLangDesc = langMap[safeLanguage] || 'Inglês coloquial';
      const systemPrompt = `Você é um linguista nativo de ${targetLangDesc} e especialista internacional no Método Lexical (Chunking / Formulaic Language).
Sua missão: a partir de uma ideia, situação informal ou texto de entrada, extrair ou criar exatamente ${safeCount} blocos de fala natural (chunks coloquiais) prontos para a vida real.

Regras estritas:
1. NUNCA faça traduções literais de dicionário. Use frases que um falante nativo diria espontaneamente em uma conversa real.
2. Forneça o sentimento real / nuance em português do Brasil (ex: "Tô dentro", "Resumindo a ópera", "Nem esquenta").
3. Forneça um guia fonético aproximado simplificado em português (ex: "aim-dáun-fer-thæt", "ma fi-gú-ra-ti", "na-ru-ho-do-ne").
4. Se o idioma for japonês, coloque o texto nativo com kanji/kana seguido da romanização entre parênteses no campo chunk: ex: "なるほどね (Naruhodo ne)".`;

      const response = await ai.models.generateContent({
        model: MODEL_REGISTRY.TEXT_FAST_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Gere ${safeCount} chunks coloquiais de alta fluência para a seguinte situação ou texto:\n"${safePrompt}"\n\nIdioma Alvo: ${safeLanguage}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              chunks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    chunk: { type: Type.STRING },
                    literalOrNuance: { type: Type.STRING },
                    meaning: { type: Type.STRING },
                    context: { type: Type.STRING },
                    pronunciationHint: { type: Type.STRING },
                  },
                  required: ['chunk', 'literalOrNuance', 'meaning', 'context', 'pronunciationHint'],
                },
              },
            },
            required: ['chunks'],
          },
        },
      });

      interface RawGeneratedChunk {
        chunk: string;
        literalOrNuance: string;
        meaning: string;
        context: string;
        pronunciationHint: string;
      }

      const parsed = parseStructuredJsonFromModel<{ chunks?: RawGeneratedChunk[] }>(
        response.text || '{}'
      );
      const rawChunks = Array.isArray(parsed?.chunks) ? parsed.chunks : [];
      if (rawChunks.length === 0) {
        throw new Error('O modelo não retornou chunks coloquiais válidos.');
      }
      const generatedChunks: ChunkItem[] = rawChunks.map((item, idx) => ({
        id: `gen-${Date.now()}-${idx}-${randomUUID().slice(0, 6)}`,
        chunk: String(item.chunk || ''),
        literalOrNuance: String(item.literalOrNuance || ''),
        meaning: String(item.meaning || ''),
        context: String(item.context || ''),
        pronunciationHint: String(item.pronunciationHint || ''),
        language: safeLanguage as ChunkItem['language'],
        userId,
        isCustom: true,
        createdAt: Date.now(),
      }));

      await chunkStorage.saveUserChunks(userId, generatedChunks);
      return res.json({ success: true, chunks: generatedChunks });
    } catch (error: unknown) {
      console.error('Error in /api/generate-chunks:', error);
      return res.status(resolveGeminiHttpStatus(error)).json({
        success: false,
        error: formatGeminiError(error, 'Falha ao gerar chunks com Gemini.'),
      });
    }
  });

  router.post('/api/translate-parallel-chunks', async (req, res) => {
    try {
      const check = validateStrictPayload<{ text?: string; sourceLanguage?: string }>(
        req.body,
        ROUTE_ALLOWED_KEYS.translateParallelChunks
      );
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const { text, sourceLanguage = 'auto' } = check.data;
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Texto de entrada é obrigatório.' });
      }
      const trimmedInput = text.trim();
      if (trimmedInput.length > MAX_PARALLEL_TRANSLATE_CHARS) {
        return res.status(400).json({
          success: false,
          error: `Texto excede o limite de ${MAX_PARALLEL_TRANSLATE_CHARS} caracteres para tradução paralela em blocos. Divida o texto ou use o Estúdio Solo.`,
        });
      }

      const systemPrompt = `Você é um linguista computacional poliglota de altíssimo nível especializado em Inglês (EN), Italiano (IT) e Japonês (JA).
Sua missão: receber um texto de entrada em qualquer idioma e convertê-lo em uma estrutura alinhada de frases/chunks semânticos paralelos nas 3 línguas para estudo comparativo interativo em tempo real.

Regras Invioláveis:
1. Segmentação de Chunks: Divida o texto em partes coerentes com sentido completo (chunks entre 3 a 15 palavras).
2. Para CADA chunk:
   - "id": número sequencial inteiro começando em 0.
   - "en": versão em inglês coloquial natural e moderno (American/Global English).
   - "it": versão em italiano coloquial cotidiano e espontâneo (autêntico da Itália).
   - "ja": versão em japonês nativo padrão com kanji e kana naturais.
   - "jaPronunciation": romanização correspondente (Romaji) com espaçamento limpo entre palavras para facilitar a leitura fonética.
3. No campo "fullText": Forneça o texto completo e contínuo montado para cada um dos 3 idiomas ("en", "it", "ja").
4. Mantenha correspondência semântica exata entre os chunks com o mesmo id, para que o usuário possa passar o mouse em um idioma e ver exatamente o mesmo trecho correspondente nos outros dois.`;

      const response = await ai.models.generateContent({
        model: MODEL_REGISTRY.TEXT_FAST_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Texto de entrada para tradução paralela e alinhamento de chunks:\n"${trimmedInput}"\n\nIdioma de origem detectado/declarado: ${sourceLanguage}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              chunks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    en: { type: Type.STRING },
                    it: { type: Type.STRING },
                    ja: { type: Type.STRING },
                    jaPronunciation: { type: Type.STRING },
                  },
                  required: ['id', 'en', 'it', 'ja'],
                },
              },
              fullText: {
                type: Type.OBJECT,
                properties: {
                  en: { type: Type.STRING },
                  it: { type: Type.STRING },
                  ja: { type: Type.STRING },
                },
                required: ['en', 'it', 'ja'],
              },
            },
            required: ['chunks', 'fullText'],
          },
        },
      });

      const parsed = parseStructuredJsonFromModel<{
        chunks?: Array<Partial<AlignedChunk>>;
        fullText?: { en?: string; it?: string; ja?: string };
      }>(response.text || '{}');

      if (!parsed || !Array.isArray(parsed.chunks) || parsed.chunks.length === 0) {
        throw new Error('Formato inválido retornado pelo modelo de tradução.');
      }

      const normalizedChunks: AlignedChunk[] = parsed.chunks
        .map((c, idx) => ({
          id: typeof c.id === 'number' && Number.isFinite(c.id) ? c.id : idx,
          en: String(c.en || '').trim(),
          it: String(c.it || '').trim(),
          ja: String(c.ja || '').trim(),
          jaPronunciation: c.jaPronunciation ? String(c.jaPronunciation).trim() : undefined,
        }))
        .filter((c) => Boolean(c.en || c.it || c.ja));

      if (normalizedChunks.length === 0) {
        throw new Error('Nenhum chunk traduzido válido foi retornado pelo modelo.');
      }

      const normalizedFullText = {
        en: String(parsed.fullText?.en || '').trim() || normalizedChunks.map((c) => c.en).join(' '),
        it: String(parsed.fullText?.it || '').trim() || normalizedChunks.map((c) => c.it).join(' '),
        ja: String(parsed.fullText?.ja || '').trim() || normalizedChunks.map((c) => c.ja).join(' '),
      };

      return res.json({
        success: true,
        chunks: normalizedChunks,
        fullText: normalizedFullText,
      });
    } catch (error: unknown) {
      const formatted = formatGeminiError(error, 'Falha ao traduzir e alinhar os idiomas.');
      console.error('[Error] /api/translate-parallel-chunks:', formatted);
      return res.status(resolveGeminiHttpStatus(error)).json({
        success: false,
        error: formatted,
      });
    }
  });

  router.post('/api/generate-flashcard', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        chunkText?: string;
        language?: string;
        contextSentence?: string;
        trilingual?: boolean;
      }>(req.body, ROUTE_ALLOWED_KEYS.generateFlashcard);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const { chunkText, language = 'auto', contextSentence, trilingual = false } = check.data;
      if (!chunkText || typeof chunkText !== 'string' || !chunkText.trim()) {
        return res.status(400).json({ error: 'Texto da expressão (chunk) é obrigatório.' });
      }

      if (trilingual) {
        const cards = await generateTrilingualFlashcards(chunkText.trim(), contextSentence);
        return res.json({ success: true, cards, card: cards[0] });
      }

      const card = await generateSingleFlashcard(chunkText.trim(), language, contextSentence);
      return res.json({ success: true, card });
    } catch (error: unknown) {
      console.error('Error in /api/generate-flashcard:', error);
      return res.status(500).json({
        error: formatGeminiError(error, 'Falha ao gerar flashcard com Gemini.'),
      });
    }
  });

  return router;
}

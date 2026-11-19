import { Router } from 'express';
import { randomUUID } from 'crypto';
import { Type } from '@google/genai';
import { chunkStorage } from '../../services/chunkStorage';
import type { ChunkItem } from '../../types/chunks';
import type { AgentPersona, AlignedChunk, FlashcardItem } from '../../types/polyglot';
import { detectFlashcardLanguage } from '../../utils/flashcardParser';
import { toLocalCalendarDateKey } from '../../utils/flashcardOrganizer';
import { formatGeminiError, sanitizeUserId } from '../audioContainer';
import { ai } from '../geminiClient';
import { ROUTE_ALLOWED_KEYS, validateStrictPayload } from '../validators';

export function buildFallbackPolyglotReply(
  inputPrompt: string,
  persona: AgentPersona,
  youtubeUrl?: string
): {
  userTranscript: string;
  agentReplyPtBr: string;
  chunks: AlignedChunk[];
  fullText: { en: string; it: string; ja: string };
} {
  const cleanPrompt = inputPrompt.trim() || 'Olá! Vamos praticar conversação hoje?';
  const isYoutube = Boolean(youtubeUrl);

  const agentReplyPtBr = isYoutube
    ? `Analisei o link do YouTube (${youtubeUrl}). Preparei abaixo uma conversa prática em 3 idiomas com os pontos principais sobre "${cleanPrompt}" para estudo e escuta comparada.`
    : persona === 'tutor_conversational'
    ? `Ótima pergunta sobre "${cleanPrompt}"! Como seu Tutor Poliglota, estruturei uma resposta natural nos 3 idiomas abaixo para você ouvir a pronúncia e comparar cada bloco.`
    : persona === 'practice_partner'
    ? `Excelente iniciativa! Vamos praticar uma situação real sobre "${cleanPrompt}". Ouça a resposta abaixo e tente repetir em voz alta!`
    : `Tradução e alinhamento em 3 idiomas concluídos para: "${cleanPrompt}".`;

  const chunks: AlignedChunk[] = [
    {
      id: 0,
      en: "That's a great topic to explore together,",
      it: 'Questo è un ottimo argomento da esplorare insieme,',
      ja: 'それは一緒に探求するのに素晴らしいテーマですね、',
      jaPronunciation: 'Sore wa issho ni tankyū suru no ni subarashii tēma desu ne,',
    },
    {
      id: 1,
      en: 'let us break down the key ideas naturally',
      it: 'analizziamo le idee principali in modo naturale',
      ja: '重要なポイントを自然に整理してみましょう',
      jaPronunciation: 'jūyō na pointo o shizen ni seiri shite mimashō',
    },
    {
      id: 2,
      en: 'and practice speaking step by step.',
      it: 'e facciamo pratica parlando passo dopo passo.',
      ja: 'そして一歩ずつ会話の練習をしていきましょう。',
      jaPronunciation: 'soshite ippo zutsu kaiwa no renshū o shite ikimashō.',
    },
  ];

  return {
    userTranscript: cleanPrompt,
    agentReplyPtBr,
    chunks,
    fullText: {
      en: chunks.map((c) => c.en).join(' '),
      it: chunks.map((c) => c.it).join(' '),
      ja: chunks.map((c) => c.ja).join(' '),
    },
  };
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
    model: 'gemini-3.8-flash',
    contents: [{ role: 'user', parts: [{ text: `Entrada: "${chunkText}"\nContexto: "${contextSentence || chunkText}"` }] }],
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.45,
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

  const parsed = JSON.parse(response.text || '{}') as { cards?: Array<Record<string, string>> };
  const rawList = Array.isArray(parsed.cards) ? parsed.cards.slice(0, 3) : [];
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
    model: 'gemini-3.8-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: `Chunk: "${chunkText}"\nIdioma alvo: ${isAuto ? 'auto' : requestedLang}\nContexto: "${contextSentence || chunkText}"` }],
      },
    ],
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.45,
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

  const parsed = JSON.parse(response.text || '{}') as Record<string, string>;
  return normalizeGeneratedCard(parsed, chunkText, isAuto ? undefined : requestedLang, Date.now(), 0);
}

export function createStudyRouter(): Router {
  const router = Router();

  router.post('/api/generate-chunks', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        textOrPrompt?: string;
        language?: string;
        count?: number;
      }>(req.body, ROUTE_ALLOWED_KEYS.generateChunks);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const { textOrPrompt, language = 'en-US', count = 3 } = check.data;
      const userId = sanitizeUserId(req.headers['x-user-id']);
      const safeCount = Math.max(1, Math.min(20, Math.floor(Number(count)) || 3));

      if (!textOrPrompt || typeof textOrPrompt !== 'string') {
        return res.status(400).json({ error: 'Texto ou intenção é obrigatório.' });
      }

      const langMap: Record<string, string> = {
        'en-US': 'Inglês falado nos Estados Unidos (coloquial americano contemporâneo)',
        'it-IT': 'Italiano falado na Itália (linguagem coloquial cotidiana, gírias e reações expressivas)',
        'ja-JP': 'Japonês falado no Japão (coloquial, aizuchi, expressões do dia a dia; obrigatório incluir romaji entre parênteses para pronúncia)',
      };

      const targetLangDesc = langMap[language] || 'Inglês coloquial';
      const systemPrompt = `Você é um linguista nativo de ${targetLangDesc} e especialista internacional no Método Lexical (Chunking / Formulaic Language).
Sua missão: a partir de uma ideia, situação informal ou texto de entrada, extrair ou criar exatamente ${safeCount} blocos de fala natural (chunks coloquiais) prontos para a vida real.

Regras estritas:
1. NUNCA faça traduções literais de dicionário. Use frases que um falante nativo diria espontaneamente em uma conversa real.
2. Forneça o sentimento real / nuance em português do Brasil (ex: "Tô dentro", "Resumindo a ópera", "Nem esquenta").
3. Forneça um guia fonético aproximado simplificado em português (ex: "aim-dáun-fer-thæt", "ma fi-gú-ra-ti", "na-ru-ho-do-ne").
4. Se o idioma for japonês, coloque o texto nativo com kanji/kana seguido da romanização entre parênteses no campo chunk: ex: "なるほどね (Naruhodo ne)".`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Gere ${safeCount} chunks coloquiais de alta fluência para a seguinte situação ou texto:\n"${textOrPrompt}"\n\nIdioma Alvo: ${language}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
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

      const parsed = JSON.parse(response.text || '{}');
      const rawChunks = (parsed.chunks || []) as RawGeneratedChunk[];
      const generatedChunks: ChunkItem[] = rawChunks.map((item, idx) => ({
        id: `gen-${Date.now()}-${idx}-${randomUUID().slice(0, 6)}`,
        chunk: item.chunk,
        literalOrNuance: item.literalOrNuance,
        meaning: item.meaning,
        context: item.context,
        pronunciationHint: item.pronunciationHint,
        userId,
        isCustom: true,
        createdAt: Date.now(),
      }));

      await chunkStorage.saveUserChunks(userId, generatedChunks);
      return res.json({ success: true, chunks: generatedChunks });
    } catch (error: unknown) {
      console.error('Error in /api/generate-chunks:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao gerar chunks com Gemini.',
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
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Texto de entrada para tradução paralela e alinhamento de chunks:\n"${text.trim()}"\n\nIdioma de origem detectado/declarado: ${sourceLanguage}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.4,
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

      const parsed = JSON.parse(response.text || '{}');
      if (!parsed.chunks || !parsed.fullText) {
        throw new Error('Formato inválido retornado pelo modelo Gemini.');
      }

      return res.json({
        success: true,
        chunks: parsed.chunks,
        fullText: parsed.fullText,
      });
    } catch (error: unknown) {
      console.warn(
        '[WARN] /api/translate-parallel-chunks fallback ativado:',
        formatGeminiError(error, 'Erro tradução paralela')
      );
      const fallback = buildFallbackPolyglotReply(
        typeof req.body?.text === 'string' ? req.body.text : 'Conversa Poliglota',
        'polyglot_translator'
      );
      return res.json({
        success: true,
        fallback: true,
        warning: formatGeminiError(error, 'Operando em modo de contingência local.'),
        chunks: fallback.chunks,
        fullText: fallback.fullText,
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

import { Router } from 'express';
import { Type } from '@google/genai';
import type {
  AgentPersona,
  AgentExploreSource,
  AlignedChunk,
  YoutubePostLinkAction,
  YoutubeClipRange,
} from '../../types/polyglot';
import {
  normalizeYoutubeVideo,
  inferYoutubeActionFromPrompt,
  parseStructuredJsonFromModel,
} from '../../utils/youtubeHelper';
import { capText, formatGeminiError } from '../audioContainer';
import { ai } from '../geminiClient';
import { ROUTE_ALLOWED_KEYS, validateStrictPayload } from '../validators';
import { buildFallbackPolyglotReply } from './studyRoutes';
import {
  fetchYoutubeMetadata,
  resolveLiveToolCalls,
  searchYoutubeVideos,
  type LiveAgentToolCallResult,
} from './agentHelpers';

export type { LiveAgentToolCallResult };

export function createAgentRouter(): Router {
  const router = Router();

  router.post('/api/live-agent-turn', async (req, res) => {
    const check = validateStrictPayload<{
      text?: string;
      audioBase64?: string;
      mimeType?: string;
      persona?: AgentPersona;
      history?: Array<{ role: string; text: string }>;
    }>(req.body, ROUTE_ALLOWED_KEYS.liveAgentTurn);
    if (!check.ok) {
      return res.status(400).json({ error: check.error });
    }

    const {
      text,
      audioBase64,
      mimeType = 'audio/webm',
      persona = 'tutor_conversational',
      history = [],
    } = check.data;

    if ((!text || !text.trim()) && !audioBase64) {
      return res.status(400).json({ error: 'Forneça texto ou áudio para o turno do Agente Live.' });
    }

    const personaInstructions: Record<AgentPersona, string> = {
      polyglot_translator:
        'Você atua como um Tradutor Simultâneo Poliglota: transcreva o que o usuário disse e alinhe fielmente o conteúdo dele em Inglês (EN), Italiano (IT) e Japonês (JA), explicando brevemente em Português (agentReplyPtBr) qualquer expressão interessante.',
      tutor_conversational:
        'Você atua como um Tutor Poliglota caloroso e didático da família: responda diretamente à dúvida ou comentário do usuário em Português no campo "agentReplyPtBr" (2 a 3 frases claras) e elabore a sua fala/resposta prática dividida em chunks alinhados em Inglês (EN), Italiano (IT) e Japonês (JA).',
      practice_partner:
        'Você atua como um Parceiro Nativo de Conversação: reaja naturalmente ao que o usuário falou, dê um retorno encorajador em Português no campo "agentReplyPtBr" e faça uma pergunta curta do cotidiano alinhada em Inglês (EN), Italiano (IT) e Japonês (JA) para manter o diálogo vivo.',
    };

    try {
      const recentContext = Array.isArray(history)
        ? history.slice(-4).map((h) => `${h.role}: ${h.text}`).join('\n')
        : '';

      const systemPrompt = `Você é o Agente de Voz em Tempo Real (Live API) do MyTTS Studio.
Modo ativo: ${personaInstructions[persona] || personaInstructions.tutor_conversational}

Ferramentas nativas do estúdio (Function Calling NON_BLOCKING disponíveis no array opcional "toolCalls"):
- "create_study_flashcard": use quando o usuário pedir para criar/salvar um flashcard ou cartão de estudo.
- "switch_studio_voice": use quando o usuário pedir para trocar a voz neural ("Puck", "Kore", "Aoede", "Fenrir" ou "Enceladus").

Regras obrigatórias de saída JSON:
1. "userTranscript": transcrição exata do que o usuário falou ou enviou.
2. "agentReplyPtBr": resposta, dica ou explicação amigável em Português do Brasil (pt-BR).
3. "chunks": array de 2 a 5 blocos semânticos alinhados (EN, IT, JA + jaPronunciation em Romaji).
4. "fullText": texto completo contínuo em "en", "it" e "ja".
5. "toolCalls": lista opcional de chamadas de função acionadas neste turno.`;

      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

      if (audioBase64 && typeof audioBase64 === 'string') {
        const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || 'audio/webm',
          },
        });
      }

      parts.push({
        text: `${
          recentContext ? `Histórico recente da conversa:\n${recentContext}\n\n` : ''
        }Entrada atual do usuário: ${
          text && text.trim() ? `"${capText(text, 2000)}"` : '(Áudio falado pelo microfone Live)'
        }`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.5,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              userTranscript: { type: Type.STRING },
              agentReplyPtBr: { type: Type.STRING },
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
              toolCalls: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    frontPhrase: { type: Type.STRING },
                    backTranslation: { type: Type.STRING },
                    targetVoice: { type: Type.STRING },
                    language: { type: Type.STRING },
                  },
                  required: ['name'],
                },
              },
            },
            required: ['userTranscript', 'agentReplyPtBr', 'chunks', 'fullText'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const resolvedTranscript = parsed.userTranscript || text || 'Áudio recebido';
      const resolvedChunks = parsed.chunks || [];
      const toolCallsExecuted = resolveLiveToolCalls(
        parsed.toolCalls,
        resolvedTranscript,
        resolvedChunks
      );

      return res.json({
        success: true,
        persona,
        userTranscript: resolvedTranscript,
        agentReplyPtBr: parsed.agentReplyPtBr || '',
        chunks: resolvedChunks,
        fullText: parsed.fullText || { en: '', it: '', ja: '' },
        toolCallsExecuted,
      });
    } catch (error: unknown) {
      console.warn('[WARN] /api/live-agent-turn fallback ativado:', formatGeminiError(error, 'Erro Live Agent'));
      const fallback = buildFallbackPolyglotReply(text || 'Conversa por Voz Live', persona);
      const toolCallsExecuted = resolveLiveToolCalls([], fallback.userTranscript, fallback.chunks);
      return res.json({
        success: true,
        persona,
        fallback: true,
        warning: formatGeminiError(error, 'Operando em modo de contingência local.'),
        ...fallback,
        toolCallsExecuted,
      });
    }
  });

  router.get('/api/youtube/metadata', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const metadata = await fetchYoutubeMetadata(rawUrl);
    if (!metadata) {
      return res.status(400).json({ success: false, error: 'URL do YouTube inválida.' });
    }
    return res.json({ success: true, metadata });
  });

  router.post('/api/agent-explore', async (req, res) => {
    const check = validateStrictPayload<{
      prompt?: string;
      youtubeUrl?: string;
      youtubeAction?: YoutubePostLinkAction;
      clipRange?: YoutubeClipRange;
      enableSearch?: boolean;
    }>(req.body, ROUTE_ALLOWED_KEYS.agentExplore);
    if (!check.ok) {
      return res.status(400).json({ error: check.error });
    }

    const {
      prompt = '',
      youtubeUrl: explicitYoutubeUrl,
      youtubeAction: explicitAction,
      clipRange,
      enableSearch = true,
    } = check.data;

    const normalizedYt =
      normalizeYoutubeVideo(explicitYoutubeUrl || '') || normalizeYoutubeVideo(prompt);
    const detectedYt = normalizedYt?.canonicalUrl;
    const effectiveAction: YoutubePostLinkAction | undefined = detectedYt
      ? explicitAction || inferYoutubeActionFromPrompt(prompt)
      : undefined;

    const cleanPrompt = capText(
      prompt.trim() ||
        (detectedYt ? 'Analise este vídeo do YouTube e gere o conteúdo solicitado.' : ''),
      3000
    );

    if (!cleanPrompt && !detectedYt) {
      return res.status(400).json({
        error: 'Informe uma pergunta, tema de busca ou cole um link do YouTube.',
      });
    }

    if (detectedYt && effectiveAction === 'ask_intent') {
      const youtubeMeta = (await fetchYoutubeMetadata(detectedYt)) || undefined;
      const videoTitle = youtubeMeta?.title || 'Vídeo do YouTube';
      const channelLabel = youtubeMeta?.authorName ? ` do canal ${youtubeMeta.authorName}` : '';

      const introChunks: AlignedChunk[] = [
        {
          id: 0,
          en: `Ready to explore "${videoTitle}"! Choose above whether to translate the spoken video, summarize key ideas, or create a 2-voice podcast.`,
          it: `Pronto per esplorare "${videoTitle}"! Scegli qui sopra se tradurre il parlato del video, riassumere le idee chiave o creare un podcast a 2 voci.`,
          ja: `「${videoTitle}」の準備ができました！上のボタンから、動画の音声翻訳、要約と会話、または2人のポッドキャスト作成を選んでください。`,
          jaPronunciation: `"${videoTitle}" no junbi ga dekimashita! Ue no botan kara, dōga no onsei honyaku, yōyaku to kaiwa, matawa futari no poddokyasuto sakusei o erande kudasai.`,
        },
      ];

      return res.json({
        success: true,
        originMode: 'youtube',
        youtubeUrl: detectedYt,
        youtubeMeta,
        youtubeAction: 'ask_intent',
        awaitingYoutubeIntent: true,
        agentReplyPtBr: `Vídeo identificado: "${videoTitle}"${channelLabel}. O que você quer fazer com este link? Escolha uma das opções abaixo (Traduzir a fala do vídeo nos 3 idiomas, Resumo + Diálogo de estudo, Extrair Flashcards ou transformar em Podcast de 2 vozes):`,
        sources: [{ title: youtubeMeta?.title || 'Vídeo do YouTube', uri: detectedYt }],
        chunks: introChunks,
        fullText: {
          en: introChunks[0].en,
          it: introChunks[0].it,
          ja: introChunks[0].ja,
        },
      });
    }

    try {
      const [youtubeMeta, youtubeSearchResults] = await Promise.all([
        detectedYt ? fetchYoutubeMetadata(detectedYt) : Promise.resolve(null),
        !detectedYt && enableSearch ? searchYoutubeVideos(cleanPrompt, 4) : Promise.resolve([]),
      ]);

      const parts: Array<{ text: string } | { fileData: { fileUri: string; mimeType: string } }> = [];
      if (detectedYt) {
        parts.push({ fileData: { fileUri: detectedYt, mimeType: 'video/mp4' } });
      }

      const clipRangeInstruction =
        clipRange?.start || clipRange?.end
          ? `Foque especificamente no trecho de tempo do vídeo de ${clipRange.start || '00:00'} até ${clipRange.end || 'o final'}.`
          : 'Considere o conteúdo integral do vídeo (se for longo, divida os momentos mais importantes cronologicamente em até 8 blocos).';

      const actionSpecificInstructions =
        effectiveAction === 'translate_video'
          ? `MODO SELECIONADO PELO USUÁRIO: TRADUZIR E TRANSCREVER A FALA DO VÍDEO NOS 3 IDIOMAS.
- ${clipRangeInstruction}
- Transcreva fielmente o que é dito no vídeo em sequência cronológica e traduza/alinhe cada trecho (6 a 10 chunks) em Inglês ("en"), Italiano ("it") e Japonês ("ja" + "jaPronunciation" em Romaji).
- No campo "agentReplyPtBr", apresente um guia em Português do Brasil indicando o tema central e a tradução contextual da fala do vídeo.`
          : effectiveAction === 'extract_expressions'
          ? `MODO SELECIONADO PELO USUÁRIO: EXTRAIR EXPRESSÕES NATIVAS & FLASHCARDS DO VÍDEO.
- ${clipRangeInstruction}
- Extraia de 5 a 8 expressões idiomáticas, frases de alta frequência ou vocabulário real usado no vídeo e alinhe cada expressão em Inglês ("en"), Italiano ("it") e Japonês ("ja" + "jaPronunciation" em Romaji).
- No campo "agentReplyPtBr", explique em Português do Brasil o significado, tom e nuance de cada expressão extraída do vídeo.`
          : effectiveAction === 'summary_dialogue'
          ? `MODO SELECIONADO PELO USUÁRIO: RESUMO EXECUTIVO + DIÁLOGO PRÁTICO DE ESTUDO.
- ${clipRangeInstruction}
- No campo "agentReplyPtBr", elabore um resumo completo, didático e bem estruturado em Português do Brasil (pt-BR) sobre tudo o que o vídeo ensina ou mostra.
- Nos "chunks" (4 a 6 blocos), crie um diálogo natural de estudo nos 3 idiomas ("en", "it", "ja" + "jaPronunciation") aplicando o tema do vídeo.`
          : `MODO SELECIONADO PELO USUÁRIO: PESQUISA & RESPOSTA POLIGLOTA.
- Analise profundamente o vídeo ou tema solicitado ("${cleanPrompt}").
- Se houver vídeos encontrados no catálogo do YouTube listados abaixo, recomende os mais relevantes no campo "agentReplyPtBr" explicando por que valem a pena.
- Elabore de 4 a 6 chunks alinhados em Inglês ("en"), Italiano ("it") e Japonês ("ja" + "jaPronunciation" em Romaji) sobre o tema.`;

      const youtubeCatalogContext =
        youtubeSearchResults.length > 0
          ? `\nVídeos reais encontrados no catálogo do YouTube para esta busca:\n${youtubeSearchResults
              .map(
                (v, idx) =>
                  `${idx + 1}. "${v.title}" (${v.authorName || 'YouTube'}${v.durationHint ? ` · ${v.durationHint}` : ''}) -> ${v.canonicalUrl}`
              )
              .join('\n')}\n`
          : '';

      parts.push({
        text: `Solicitação do usuário: "${cleanPrompt}"
${
  detectedYt
    ? `Vídeo do YouTube anexado: ${detectedYt}${
        youtubeMeta?.title ? ` — Título: "${youtubeMeta.title}" (${youtubeMeta.authorName || 'YouTube'})` : ''
      }`
    : ''
}
${youtubeCatalogContext}
${actionSpecificInstructions}

Retorne ESTRITAMENTE um objeto JSON válido (sem blocos markdown ao redor) com as chaves:
{
  "agentReplyPtBr": "Texto completo em português do Brasil...",
  "chunks": [
    { "id": 0, "en": "...", "it": "...", "ja": "...", "jaPronunciation": "..." }
  ],
  "fullText": { "en": "...", "it": "...", "ja": "..." }
}`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts }],
        config: {
          temperature: 0.35,
          tools: detectedYt ? undefined : enableSearch ? [{ googleSearch: {} }] : undefined,
        },
      });

      const parsed = parseStructuredJsonFromModel<{
        agentReplyPtBr?: string;
        chunks?: AlignedChunk[];
        fullText?: { en: string; it: string; ja: string };
      }>((response.text || '').trim());

      if (!parsed || !Array.isArray(parsed.chunks) || parsed.chunks.length === 0) {
        throw new Error('O Agente não retornou os blocos de chunks estruturados esperados.');
      }

      const normalizedChunks: AlignedChunk[] = parsed.chunks.map((c, idx) => ({
        id: typeof c.id === 'number' ? c.id : idx,
        en: String(c.en || ''),
        it: String(c.it || ''),
        ja: String(c.ja || ''),
        jaPronunciation: c.jaPronunciation ? String(c.jaPronunciation) : undefined,
      }));

      const resolvedFullText = {
        en: parsed.fullText?.en || normalizedChunks.map((c) => c.en).join(' '),
        it: parsed.fullText?.it || normalizedChunks.map((c) => c.it).join(' '),
        ja: parsed.fullText?.ja || normalizedChunks.map((c) => c.ja).join(' '),
      };

      const sources: AgentExploreSource[] = [];
      if (detectedYt) {
        sources.push({
          title: youtubeMeta?.title
            ? `${youtubeMeta.title}${youtubeMeta.authorName ? ` (${youtubeMeta.authorName})` : ''}`
            : 'Vídeo do YouTube Analisado',
          uri: detectedYt,
        });
      }

      for (const ytItem of youtubeSearchResults) {
        if (!sources.some((s) => s.uri === ytItem.canonicalUrl)) {
          sources.push({
            title: `YouTube: ${ytItem.title}${ytItem.authorName ? ` · ${ytItem.authorName}` : ''}`,
            uri: ytItem.canonicalUrl,
          });
        }
      }

      const candidate = response.candidates?.[0] as
        | { groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }
        | undefined;
      for (const gc of candidate?.groundingMetadata?.groundingChunks || []) {
        if (gc.web?.uri && !sources.some((s) => s.uri === gc.web?.uri)) {
          sources.push({ title: gc.web.title || gc.web.uri, uri: gc.web.uri });
        }
      }

      const toolCallsExecuted: LiveAgentToolCallResult[] =
        effectiveAction === 'extract_expressions'
          ? normalizedChunks.slice(0, 3).map((chunk, idx) => ({
              id: `tool-yt-fc-${Date.now()}-${idx}`,
              name: 'create_study_flashcard',
              behavior: 'NON_BLOCKING',
              args: {
                frontPhrase: chunk.en,
                backTranslation: `${chunk.it} • ${chunk.ja}`,
              },
              status: 'executed',
              summaryPtBr: `Expressão do vídeo salva no Deck: "${chunk.en}"`,
            }))
          : [];

      return res.json({
        success: true,
        originMode: detectedYt ? 'youtube' : 'web_search',
        youtubeUrl: detectedYt,
        youtubeMeta: youtubeMeta || undefined,
        youtubeSearchResults: youtubeSearchResults.length > 0 ? youtubeSearchResults : undefined,
        youtubeAction: effectiveAction,
        awaitingYoutubeIntent: false,
        agentReplyPtBr: parsed.agentReplyPtBr || '',
        sources: sources.slice(0, 6),
        chunks: normalizedChunks,
        fullText: resolvedFullText,
        toolCallsExecuted: toolCallsExecuted.length > 0 ? toolCallsExecuted : undefined,
      });
    } catch (error: unknown) {
      console.warn('[WARN] /api/agent-explore fallback ativado:', formatGeminiError(error, 'Erro Agent Explore'));
      const [youtubeMeta, youtubeSearchResults] = await Promise.all([
        detectedYt ? fetchYoutubeMetadata(detectedYt) : Promise.resolve(null),
        !detectedYt ? searchYoutubeVideos(cleanPrompt, 4) : Promise.resolve([]),
      ]);
      const fallback = buildFallbackPolyglotReply(cleanPrompt, 'tutor_conversational', detectedYt);
      const fallbackSources: AgentExploreSource[] = [];
      if (detectedYt) {
        fallbackSources.push({ title: youtubeMeta?.title || 'Vídeo do YouTube Informado', uri: detectedYt });
      }
      for (const v of youtubeSearchResults) {
        fallbackSources.push({ title: `YouTube: ${v.title}`, uri: v.canonicalUrl });
      }

      return res.json({
        success: true,
        fallback: true,
        warning: formatGeminiError(error, 'Operando em modo de contingência local.'),
        originMode: detectedYt ? 'youtube' : 'web_search',
        youtubeUrl: detectedYt,
        youtubeMeta: youtubeMeta || undefined,
        youtubeSearchResults: youtubeSearchResults.length > 0 ? youtubeSearchResults : undefined,
        youtubeAction: effectiveAction,
        agentReplyPtBr: fallback.agentReplyPtBr,
        sources: fallbackSources.slice(0, 6),
        chunks: fallback.chunks,
        fullText: fallback.fullText,
      });
    }
  });

  return router;
}

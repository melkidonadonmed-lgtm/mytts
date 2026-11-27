import { Router } from 'express';
import { AudioTranscriptionConfigMode, ThinkingLevel, Type } from '@google/genai';
import {
  normalizeYoutubeVideo,
  parseStructuredJsonFromModel,
} from '../../utils/youtubeHelper';
import { buildExpressiveTtsTranscript } from '../../utils/prosodyEngine';
import { capText, formatGeminiError } from '../audioContainer';
import { ai } from '../geminiClient';
import { MODEL_REGISTRY } from '../modelRegistry';
import { ROUTE_ALLOWED_KEYS, validateStrictPayload } from '../validators';

export function createStudioRouter(): Router {
  const router = Router();

  router.post('/api/extract-text', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        text?: string;
        fileData?: string;
        fileName?: string;
        mimeType?: string;
      }>(req.body, ROUTE_ALLOWED_KEYS.extractText);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const { text, fileData, fileName, mimeType } = check.data;

      if (fileData && mimeType === 'application/pdf') {
        const cleanPdfBase64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        const response = await ai.models.generateContent(
          {
            model: MODEL_REGISTRY.TEXT_REASONING_MODEL,
            contents: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: cleanPdfBase64,
                },
              },
              {
                text: 'Extract the full clean text of this document verbatim, omitting repeated headers/footers. Then at the bottom provide a 2-sentence executive summary and key philosophical/practical tension points for debate.',
              },
            ],
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            },
          },
          { timeoutMs: 60_000 }
        );

        const extracted = response.text || '';
        return res.json({
          success: true,
          text: extracted,
          fileName: fileName || 'document.pdf',
          wordCount: extracted.split(/\s+/).filter(Boolean).length,
        });
      }

      if (text) {
        return res.json({
          success: true,
          text: text.trim(),
          fileName: fileName || 'pasted-text.txt',
          wordCount: text.split(/\s+/).filter(Boolean).length,
        });
      }

      return res.status(400).json({ error: 'Nenhum texto ou arquivo recebido.' });
    } catch (error: unknown) {
      console.error('Error in /api/extract-text:', error);
      return res.status(500).json({
        success: false,
        error: formatGeminiError(error, 'Falha ao processar e extrair documento.'),
      });
    }
  });

  router.post('/api/generate-script', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        documentText?: string;
        language?: string;
        audienceLevel?: string;
        tensionIntensity?: string;
        format?: string;
        speakers?: Array<{ name: string; roleTitle: string; voiceId: string }>;
        maxTurns?: number;
      }>(req.body, ROUTE_ALLOWED_KEYS.generateScript);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const {
        documentText,
        language = 'pt-BR',
        audienceLevel = 'intermediate',
        tensionIntensity = 'provocative',
        format = 'debate',
        speakers,
        maxTurns = 6,
      } = check.data;

      if (!documentText || documentText.trim().length === 0) {
        return res.status(400).json({ error: 'O texto do documento é obrigatório.' });
      }

      const speaker1 = speakers?.[0] || {
        name: 'Sofia',
        roleTitle: 'Analista Teórica & Fundamentada',
        voiceId: 'Kore',
      };
      const speaker2 = speakers?.[1] || {
        name: 'Lucas',
        roleTitle: 'Provocador Pragmático & Cético',
        voiceId: 'Puck',
      };

      const languageDirectives: Record<string, string> = {
        'pt-BR': `Idioma estrito: Português do Brasil natural, contemporâneo e oralizado. Use marcadores rítmicos brasileiros autênticos ("Olha...", "Mas espera aí...", "Não é bem assim", "Na prática...").`,
        'en-US': `Strict language: Natural spoken American English. Use authentic conversational rhythm ("Wait a second...", "Come on, look at the incentives", "Let's be real here...").`,
        'it-IT': `Lingua rigorosa: Italiano naturale, colloquiale ed espressivo. Usa intercalari e ritmo autentico ("Ma fermiamoci un attimo...", "Guarda che...", "I numeri dicono l'opposto").`,
        'ja-JP': `厳格な言語：自然で流暢な現代日本語。漢字の誤読を避ける自然な文脈構成にし、口語表現と知的な対話を両立（「ちょっと待ってください」「現場を直視すべきです」「なるほど、でも実際はどうでしょう」）。`,
      };

      const formatDirectives: Record<string, string> = {
        debate: `FORMATO DE RENDERIZAÇÃO: DEBATE DIALÉTICO.
Os interlocutores têm visões antagônicas ou complementares sob tensão: se um faz um ponto forte, o outro desafia a premissa, expõe o custo oculto ou contra-ataca com um exemplo prático. Proibido clichês de concordância passiva.`,
        podcast: `FORMATO DE RENDERIZAÇÃO: PODCAST DE ESTÚDIO (2 HOSTS).
Os interlocutores são co-apresentadores de um podcast envolvente e dinâmico. Eles constroem raciocínios juntos, fazem perguntas instigantes um ao outro, trazem bastidores e exemplos curiosos com ritmo radiofônico fluido.`,
        bar_chat: `FORMATO DE RENDERIZAÇÃO: CONVERSA DE BAR / CAFÉ ENTRE AMIGOS.
Papo espontâneo, descontraído, coloquial e bem-humorado em uma mesa de bar ou café. Sem formalidades acadêmicas: use analogias cotidianas afiadas, risadas naturais (<laugh>, <chuckle>), interjeições coloquiais e franqueza de amigos próximos.`,
        dinner: `FORMATO DE RENDERIZAÇÃO: MESA DE JANTAR EM FAMÍLIA / AMIGOS.
Conversa calorosa, acolhedora, reflexiva e humana ao redor de uma mesa de jantar. Mistura sabedoria prática, histórias do dia a dia, empatia e troca de experiências de forma leve e cativante.`,
      };

      const tensionDirectives: Record<string, string> = {
        reflective: `Dinâmica Reflexiva: Foco em nuances, escuta ativa e exemplos claros.`,
        balanced: `Dinâmica Ágil: Troca rápida de ideias, perguntas diretas e exemplos práticos do mundo real.`,
        provocative: `Dinâmica Fervorosa & Incisiva: Confronto direto entre teoria e realidade prática, ironia elegante, réplicas rápidas e zero rodeios.`,
      };

      const audienceDirectives: Record<string, string> = {
        layman: `Nível Acessível: Analogias vivas, exemplos do cotidiano e vocabulário claro.`,
        intermediate: `Nível Equilibrado: Equilíbrio entre clareza e profundidade conceitual, citando impactos reais.`,
        expert: `Nível Especialista: Rigor conceitual elevado, terminologia precisa e análise profunda.`,
      };

      const systemInstruction = `Você é o Diretor Dramatúrgico e Roteirizador Chefe de Áudio Neural do MyTTS Studio.
Sua missão é transformar o texto ou tema fornecido em uma conversa de áudio viva, hiper-realista e cativante entre dois interlocutores:

PERSONAGENS:
- Interlocutor 1: "${speaker1.name}" (${speaker1.roleTitle}) — Voz: ${speaker1.voiceId}
- Interlocutor 2: "${speaker2.name}" (${speaker2.roleTitle}) — Voz: ${speaker2.voiceId}

${formatDirectives[format] || formatDirectives.debate}

DIRETRIZES PROSÓDICAS PARA SÍNTESE NEURAL (GEMINI 3.8 FLASH TTS):
1. O texto DEVE ser formatado com as tags vocais angulares canônicas que o decodificador neural do Gemini 3.8 Flash TTS interpreta nativamente:
   - Use tags angulares expressivas quando natural: <breath>, <heavy breath>, <sigh>, <laugh>, <chuckle>, <gasp>, <whispers>, <short pause>, <long pause>.
   - Use backchannels curtos entre barras verticais quando natural no início de réplicas: |mhm|, |yeah|.
   - Use reticências (...) para hesitações deliberadas e travessões (—) para quebras súbitas de pensamento.
   - Inclua ao menos uma tag vocal (<breath>, <sigh>, <chuckle>, <short pause>) por turno para que a respiração e a emoção soem 100% humanas.

2. IDIOMA E CALIBRAÇÃO:
   ${languageDirectives[language] || languageDirectives['pt-BR']}
   ${tensionDirectives[tensionIntensity] || tensionDirectives.balanced}
   ${audienceDirectives[audienceLevel] || audienceDirectives.intermediate}

3. ESTRUTURA:
   - Gere exatamente entre 6 e ${Math.min(maxTurns, 8)} turnos alternados entre ${speaker1.name} e ${speaker2.name}.
   - Comece direto no assunto (in media res), sem introduções artificiais.`;

      const ytDetectedInDoc = normalizeYoutubeVideo(documentText);
      const prompt = ytDetectedInDoc
        ? `Analise profundamente o vídeo do YouTube anexado (${ytDetectedInDoc.canonicalUrl}) e as instruções adicionais abaixo, produzindo o roteiro estruturado em JSON sobre o conteúdo real do vídeo:\n\n--- INSTRUÇÕES / CONTEXTO ---\n${documentText.slice(0, 10000)}\n--- FIM ---`
        : `Analise detalhadamente o seguinte documento e produza o roteiro de debate dialético estruturado em JSON:\n\n--- CONTEÚDO DO DOCUMENTO ---\n${documentText.slice(0, 10000)}\n--- FIM DO DOCUMENTO ---\n\nGere a resposta em formato JSON correspondente ao esquema solicitado.`;

      const scriptContents: Parameters<typeof ai.models.generateContent>[0]['contents'] =
        ytDetectedInDoc
          ? [
              {
                role: 'user',
                parts: [
                  {
                    fileData: {
                      fileUri: ytDetectedInDoc.canonicalUrl,
                      mimeType: 'video/mp4',
                    },
                  },
                  { text: prompt },
                ],
              },
            ]
          : prompt;

      const response = await ai.models.generateContent(
        {
          model: MODEL_REGISTRY.TEXT_REASONING_MODEL,
          contents: scriptContents,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              topicSummary: { type: Type.STRING },
              keyThesis: { type: Type.STRING },
              turns: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    turn: { type: Type.INTEGER },
                    speaker: { type: Type.STRING },
                    voice_id: { type: Type.STRING },
                    emotion: {
                      type: Type.STRING,
                      enum: [
                        'natural',
                        'spontaneous',
                        'storytelling',
                        'calm',
                        'thoughtful',
                        'inquisitive',
                        'skeptical',
                        'ironic',
                        'passionate',
                        'resolute',
                      ],
                    },
                    text: { type: Type.STRING },
                    clean_text: { type: Type.STRING },
                    prosody: {
                      type: Type.OBJECT,
                      properties: {
                        pre_delay_ms: { type: Type.INTEGER },
                        speech_rate: { type: Type.NUMBER },
                        breath_sound: { type: Type.BOOLEAN },
                      },
                      required: ['pre_delay_ms', 'speech_rate', 'breath_sound'],
                    },
                  },
                  required: ['turn', 'speaker', 'voice_id', 'emotion', 'text', 'prosody'],
                },
              },
            },
            required: ['title', 'topicSummary', 'keyThesis', 'turns'],
          },
        },
      });

      interface RawScriptTurn {
        turn: number;
        speaker: string;
        voice_id: string;
        emotion: string;
        text: string;
        clean_text?: string;
        prosody?: {
          pre_delay_ms?: number;
          speech_rate?: number;
          breath_sound?: boolean;
        };
      }

      const parsed = parseStructuredJsonFromModel<{
        title?: string;
        topicSummary?: string;
        keyThesis?: string;
        turns?: RawScriptTurn[];
      }>(response.text?.trim() || '{}');

      if (!parsed || !Array.isArray(parsed.turns) || parsed.turns.length === 0) {
        throw new Error('O modelo não retornou os turnos estruturados do roteiro.');
      }

      const normalizedTurns = parsed.turns.map((t: RawScriptTurn, idx: number) => {
        const speakerStr = String(t.speaker || '');
        const isSpk1 = speakerStr.toLowerCase().includes(speaker1.name.toLowerCase());
        const selectedVoice = isSpk1 ? speaker1.voiceId : speaker2.voiceId;
        const normalizedText = buildExpressiveTtsTranscript(String(t.text || ''), {
          enabled: true,
          language,
          emotion: t.emotion,
          injectNaturalBreaths: true,
        });
        const clean = String(t.clean_text || normalizedText)
          .replace(/<[^>]+>/g, '')
          .replace(/\[[^\]]+\]/g, '')
          .replace(/\|[^|]+\|/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        return {
          ...t,
          turn: typeof t.turn === 'number' && Number.isFinite(t.turn) ? t.turn : idx + 1,
          speaker: isSpk1 ? speaker1.name : speaker2.name,
          voice_id: selectedVoice,
          text: normalizedText,
          clean_text: clean,
          prosody: {
            pre_delay_ms: t.prosody?.pre_delay_ms || 100,
            speech_rate: Math.min(1.15, Math.max(0.9, t.prosody?.speech_rate || 1.0)),
            breath_sound: Boolean(t.prosody?.breath_sound),
          },
        };
      });

      return res.json({
        success: true,
        script: {
          id: `debate-${Date.now()}`,
          title: parsed.title || 'Conversa Gerada no Estúdio',
          topicSummary: parsed.topicSummary || '',
          keyThesis: parsed.keyThesis || '',
          language,
          audienceLevel,
          tensionIntensity,
          format,
          speakers: [speaker1, speaker2],
          turns: normalizedTurns,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error: unknown) {
      console.error('Error in /api/generate-script:', error);
      return res.status(500).json({
        success: false,
        error: formatGeminiError(error, 'Falha ao gerar roteiro dialético.'),
      });
    }
  });

  router.post('/api/transcribe-audio', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        audioData?: string;
        mimeType?: string;
        sourceText?: string;
      }>(req.body, ROUTE_ALLOWED_KEYS.transcribeAudio);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const { audioData, mimeType = 'audio/webm', sourceText } = check.data;
      if (!audioData) {
        return res.status(400).json({ error: 'Nenhum dado de áudio recebido para transcrição.' });
      }

      const cleanBase64 = audioData.includes(',') ? audioData.split(',')[1] : audioData;
      const safeMimeType = mimeType || 'audio/webm';
      let transcript = '';
      let modelUsed: string = MODEL_REGISTRY.TRANSCRIBE_BATCH_MODEL;

      try {
        // Dedicated batch transcription model: audio-only content + AudioTranscriptionConfig SMART mode
        const response = await ai.models.generateContent({
          model: MODEL_REGISTRY.TRANSCRIBE_BATCH_MODEL,
          contents: [
            {
              inlineData: {
                mimeType: safeMimeType,
                data: cleanBase64,
              },
            },
          ],
          config: {
            audioTranscriptionConfig: {
              mode: AudioTranscriptionConfigMode.SMART,
              ...(sourceText && typeof sourceText === 'string' && sourceText.trim()
                ? { sourceText: capText(sourceText.trim(), 60_000) }
                : {}),
            },
          },
        });
        transcript = response.text?.trim() || '';
      } catch (transcribeErr: unknown) {
        console.warn(
          '[Transcribe] Fallback from gemini-3.5-transcribe to reasoning model:',
          transcribeErr instanceof Error ? transcribeErr.message : String(transcribeErr)
        );
        modelUsed = MODEL_REGISTRY.TEXT_REASONING_MODEL;
        const fallbackResp = await ai.models.generateContent({
          model: MODEL_REGISTRY.TEXT_REASONING_MODEL,
          contents: [
            {
              inlineData: {
                mimeType: safeMimeType,
                data: cleanBase64,
              },
            },
            {
              text: 'Transcreva este áudio com máxima fidelidade, pontuação natural e inteligente (vírgulas, pontos e parágrafos). Retorne estritamente o texto transcrito, sem preâmbulos, aspas extras ou explicações.',
            },
          ],
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        transcript = fallbackResp.text?.trim() || '';
      }

      return res.json({
        success: true,
        transcript,
        model: modelUsed,
        wordCount: transcript.split(/\s+/).filter(Boolean).length,
      });
    } catch (error: unknown) {
      console.error('Error in /api/transcribe-audio:', error);
      return res.status(500).json({
        success: false,
        error: formatGeminiError(error, 'Falha ao transcrever gravação do microfone.'),
      });
    }
  });

  return router;
}

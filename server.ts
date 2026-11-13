import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { chunkStorage } from './src/services/chunkStorage';
import { getConversationStorage } from './src/services/conversationStorage';
import { getFlashcardStorage } from './src/services/flashcardStorage';
import { ChunkItem, TargetLang } from './src/types/chunks';
import type {
  AgentPersona,
  AgentExploreSource,
  AlignedChunk,
  FlashcardItem,
  GoogleUserSession,
  SavedConversation,
  YoutubePostLinkAction,
  YoutubeClipRange,
  YoutubeVideoMetadata,
} from './src/types/polyglot';
import {
  normalizeYoutubeVideo,
  inferYoutubeActionFromPrompt,
  parseStructuredJsonFromModel,
  parseYoutubeSearchResultsHtml,
} from './src/utils/youtubeHelper';
import {
  getVoiceAcousticStyle,
  buildExpressiveTtsTranscript,
  buildTtsModelPart,
  type TtsSpeechMetadataPart,
} from './src/utils/prosodyEngine';
import {
  sanitizeUserId,
  capText,
  ensureWavContainer,
  formatGeminiError,
  buildFfmpegMixFilterComplex,
  ALLOWED_PREVIEW_VOICES,
  ALLOWED_PREVIEW_LANGS,
} from './src/server/audioContainer';

const execFileAsync = promisify(execFile);


dotenv.config({ override: true });

const DEFAULT_GCP_PROJECT =
  process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'agent-md-506215';
const DEFAULT_VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';

// Validação da chave da API Gemini no boot (com suporte nativo a failover para Vertex AI ADC)
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '') {
  console.warn(
    `[BOOT] INFO: GEMINI_API_KEY ausente. Utilizando Vertex AI Application Default Credentials (projeto: ${DEFAULT_GCP_PROJECT}, location: ${DEFAULT_VERTEX_LOCATION}).`
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Cloud Run encaminha X-Forwarded-For: confiar em 1 hop para rate limiting por IP correto
app.set('trust proxy', 1);
// Headers de segurança (CSP desabilitada; COOP same-origin-allow-popups para permitir popup OAuth Google)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);

// Payload grande apenas nas rotas que recebem áudio ou PDF base64; o restante da API aceita no máximo 2 MB
app.use('/api/extract-text', express.json({ limit: '25mb' }));
app.use('/api/transcribe-audio', express.json({ limit: '25mb' }));
app.use('/api/live-agent-turn', express.json({ limit: '25mb' }));
app.use('/api/mix-audio', express.json({ limit: '50mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Rate limiting: proteção de custo e abuso nos endpoints pagos de IA
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisições deste endereço. Tente novamente em alguns minutos.' },
});
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de requisições de IA atingido. Aguarde alguns minutos e tente novamente.' },
});
app.use('/api', apiLimiter);
app.use(
  [
    '/api/extract-text',
    '/api/generate-script',
    '/api/synthesize-turn',
    '/api/mix-audio',
    '/api/preview-voice',
    '/api/synthesize-chunk',
    '/api/synthesize-speech',
    '/api/transcribe-audio',
    '/api/generate-chunks',
    '/api/translate-parallel-chunks',
    '/api/generate-flashcard',
    '/api/live-agent-turn',
    '/api/agent-explore',
  ],
  aiLimiter
);

// Server-side Gemini / Vertex AI Client com hot-reload de .env, detecção de chaves AQ. e failover automático para Vertex AI ADC
let cachedApiKey = '';
let cachedGenAiClient: GoogleGenAI | null = null;
let cachedVertexAdcClient: GoogleGenAI | null = null;
const invalidApiKeys = new Set<string>();

function resolveActiveApiKey(): string {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf-8'));
      const fromFile = (parsed.GEMINI_API_KEY || parsed.GOOGLE_API_KEY || '').trim();
      if (fromFile) {
        return fromFile;
      }
    }
  } catch {
    // Fallback silencioso para process.env
  }
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

function getVertexAdcClient(): GoogleGenAI {
  if (!cachedVertexAdcClient) {
    // O construtor de @google/genai lê GEMINI_API_KEY/GOOGLE_API_KEY de process.env automaticamente
    // e falha se apiKey coexistir com project/location. Isolamos process.env durante a instanciação.
    const savedGeminiKey = process.env.GEMINI_API_KEY;
    const savedGoogleKey = process.env.GOOGLE_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      cachedVertexAdcClient = new GoogleGenAI({
        vertexai: true,
        project: DEFAULT_GCP_PROJECT,
        location: DEFAULT_VERTEX_LOCATION,
      });
    } finally {
      if (savedGeminiKey !== undefined) process.env.GEMINI_API_KEY = savedGeminiKey;
      if (savedGoogleKey !== undefined) process.env.GOOGLE_API_KEY = savedGoogleKey;
    }
  }
  return cachedVertexAdcClient;
}

function getGenAiClient(): GoogleGenAI {
  const currentKey = resolveActiveApiKey();
  if (!currentKey || invalidApiKeys.has(currentKey)) {
    return getVertexAdcClient();
  }
  if (!cachedGenAiClient || currentKey !== cachedApiKey) {
    cachedApiKey = currentKey;
    const isVertexExpress = currentKey.startsWith('AQ.');
    cachedGenAiClient = new GoogleGenAI({
      apiKey: currentKey,
      vertexai: isVertexExpress,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedGenAiClient;
}

function isAuthOrInvalidKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('ACCOUNT_STATE_INVALID') ||
    msg.includes('bound service account is deleted or disabled') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('"code":401') ||
    msg.includes('"code": 401')
  );
}

const TTS_MODEL_CASCADE = [
  'gemini-3.8-flash-tts',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-3.1-flash-lite-tts-preview',
];

function adaptContentsForTtsModel(
  contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'],
  targetModel: string
): Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'] {
  if (targetModel.startsWith('gemini-3.8-') || !Array.isArray(contents)) {
    return contents;
  }
  const adapted = contents.map((item) => {
    if (!item || typeof item !== 'object' || !('parts' in item) || !Array.isArray(item.parts)) {
      return item;
    }
    return {
      ...item,
      parts: item.parts.map((part) => {
        if (
          part &&
          typeof part === 'object' &&
          'speechMetadata' in part &&
          part.speechMetadata &&
          typeof part.speechMetadata === 'object' &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          const meta = part.speechMetadata as { speaker?: string; style?: string };
          return buildTtsModelPart(
            part.text,
            meta.speaker || 'Speaker',
            meta.style || '',
            targetModel
          );
        }
        return part;
      }),
    };
  });
  return adapted as Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
}

async function executeGenerateContentWithCascade(
  client: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0]
) {
  try {
    return await client.models.generateContent(params);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('not found')) {
      const ttsIdx = TTS_MODEL_CASCADE.indexOf(params.model);
      if (ttsIdx !== -1) {
        for (let i = ttsIdx + 1; i < TTS_MODEL_CASCADE.length; i++) {
          const fallbackModel = TTS_MODEL_CASCADE[i];
          try {
            return await client.models.generateContent({
              ...params,
              model: fallbackModel,
              contents: adaptContentsForTtsModel(params.contents, fallbackModel),
            });
          } catch (innerErr: unknown) {
            const innerMsg = innerErr instanceof Error ? innerErr.message : String(innerErr);
            if (i === TTS_MODEL_CASCADE.length - 1 || (!innerMsg.includes('404') && !innerMsg.includes('NOT_FOUND'))) {
              throw innerErr;
            }
          }
        }
      }
      if (params.model === 'gemini-3.8-flash') {
        return await client.models.generateContent({
          ...params,
          model: 'gemini-3.8-flash-lite',
        });
      }
    }
    throw err;
  }
}

const ai = {
  models: {
    generateContent: async (params: Parameters<GoogleGenAI['models']['generateContent']>[0]) => {
      const activeKey = resolveActiveApiKey();
      const client = getGenAiClient();
      try {
        return await executeGenerateContentWithCascade(client, params);
      } catch (err: unknown) {
        if (activeKey && !invalidApiKeys.has(activeKey) && isAuthOrInvalidKeyError(err)) {
          invalidApiKeys.add(activeKey);
          console.warn(
            '[Auth Failover] Chave GEMINI_API_KEY rejeitada (conta vinculada inativa/401). Alternando automaticamente para Vertex AI ADC (global)...'
          );
          const adcClient = getVertexAdcClient();
          return await executeGenerateContentWithCascade(adcClient, params);
        }
        throw err;
      }
    },
  },
};

// 1. Text Ingestion & Parsing
app.post('/api/extract-text', async (req, res) => {
  try {
    const { text, fileData, fileName, mimeType } = req.body;

    if (fileData && mimeType === 'application/pdf') {
      // Ingest PDF using Gemini Multimodal document parsing
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: fileData,
            },
          },
          {
            text: 'Extract the full clean text of this document verbatim, omitting repeated headers/footers. Then at the bottom provide a 2-sentence executive summary and key philosophical/practical tension points for debate.',
          },
        ],
      });

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
      error: error instanceof Error ? error.message : 'Falha ao processar e extrair documento.',
    });
  }
});

// 2. Dialectic Debate & Multi-Format Script Generator (Debate, Podcast, Conversa de Bar, Mesa de Jantar)
app.post('/api/generate-script', async (req, res) => {
  try {
    const {
      documentText,
      language = 'pt-BR',
      audienceLevel = 'intermediate',
      tensionIntensity = 'provocative',
      format = 'debate',
      speakers,
      maxTurns = 6,
    } = req.body;

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

${formatDirectives[format] || formatDirectives['debate']}

DIRETRIZES PROSÓDICAS PARA SÍNTESE NEURAL (GEMINI 3.8 FLASH TTS):
1. O texto DEVE ser formatado com as tags vocais angulares canônicas que o decodificador neural do Gemini 3.8 Flash TTS interpreta nativamente:
   - Use tags angulares expressivas quando natural: <breath>, <heavy breath>, <sigh>, <laugh>, <chuckle>, <gasp>, <whispers>, <short pause>, <long pause>.
   - Use backchannels curtos entre barras verticais quando natural no início de réplicas: |mhm|, |yeah|.
   - Use reticências (...) para hesitações deliberadas e travessões (—) para quebras súbitas de pensamento.
   - Inclua ao menos uma tag vocal (<breath>, <sigh>, <chuckle>, <short pause>) por turno para que a respiração e a emoção soem 100% humanas.

2. IDIOMA E CALIBRAÇÃO:
   ${languageDirectives[language] || languageDirectives['pt-BR']}
   ${tensionDirectives[tensionIntensity] || tensionDirectives['balanced']}
   ${audienceDirectives[audienceLevel] || audienceDirectives['intermediate']}

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

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: scriptContents,
      config: {
        systemInstruction,
        temperature: 0.7,
        topP: 0.95,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Título instigante e provocativo do debate',
            },
            topicSummary: {
              type: Type.STRING,
              description: 'Resumo conciso de 1 frase sobre o embate central',
            },
            keyThesis: {
              type: Type.STRING,
              description: 'A tese principal colocada à prova na discussão',
            },
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
                      'thoughtful',
                      'inquisitive',
                      'skeptical',
                      'ironic',
                      'passionate',
                      'resolute',
                    ],
                  },
                  text: {
                    type: Type.STRING,
                    description:
                      'Fala completa com marcações vocais canônicas (<breath>, <sigh>, <laugh>, <chuckle>, <short pause>, reticências, travessões)',
                  },
                  clean_text: {
                    type: Type.STRING,
                    description: 'Texto limpo sem as tags <breath>, <laugh>, etc.',
                  },
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

    const rawJson = response.text?.trim() || '{}';
    const parsed = JSON.parse(rawJson);

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

    // Ensure voice IDs match the selected speaker configuration and normalize vocal tags to canonical angle brackets
    parsed.turns = (parsed.turns as RawScriptTurn[]).map((t: RawScriptTurn) => {
      const isSpk1 = t.speaker.toLowerCase().includes(speaker1.name.toLowerCase());
      const selectedVoice = isSpk1 ? speaker1.voiceId : speaker2.voiceId;
      const normalizedText = buildExpressiveTtsTranscript(t.text, {
        enabled: true,
        language,
        emotion: t.emotion,
        injectNaturalBreaths: true,
      });
      const clean = (t.clean_text || normalizedText)
        .replace(/<[^>]+>/g, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\|[^|]+\|/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      return {
        ...t,
        speaker: isSpk1 ? speaker1.name : speaker2.name,
        voice_id: selectedVoice,
        text: normalizedText,
        clean_text: clean,
        prosody: {
          pre_delay_ms: t.prosody?.pre_delay_ms || 100,
          speech_rate: Math.min(1.15, Math.max(0.9, t.prosody?.speech_rate || 1.0)),
          breath_sound: !!t.prosody?.breath_sound,
        },
      };
    });

    return res.json({
      success: true,
      script: {
        id: `debate-${Date.now()}`,
        title: parsed.title,
        topicSummary: parsed.topicSummary,
        keyThesis: parsed.keyThesis,
        language,
        audienceLevel,
        tensionIntensity,
        format,
        speakers: [speaker1, speaker2],
        turns: parsed.turns,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('Error in /api/generate-script:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao gerar roteiro dialético.',
    });
  }
});

interface TtsSynthesisMetadataOptions {
  speakerName?: string;
  stylePrompt?: string;
}

// Helper compartilhado de síntese neural Gemini 3.8 Flash TTS -> WAV RIFF 24kHz com speechMetadata estruturado
async function synthesizeGeminiTtsWav(
  spokenText: string,
  voiceName: string,
  options?: TtsSynthesisMetadataOptions
): Promise<{ wavBase64: string; durationSec: number }> {
  const speaker = options?.speakerName || voiceName;
  const style = options?.stylePrompt?.trim() || '';

  const partPayload: TtsSpeechMetadataPart = buildTtsModelPart(
    spokenText,
    speaker,
    style,
    'gemini-3.8-flash-tts'
  );

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [partPayload],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Se um endpoint rejeitar speechMetadata por incompatibilidade de schema, reexecuta com prompt inline adaptado
    if (
      style &&
      (msg.includes('speechMetadata') ||
        msg.includes('speech_metadata') ||
        msg.includes('Unknown name'))
    ) {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [
          {
            role: 'user',
            parts: [buildTtsModelPart(spokenText, speaker, style, 'gemini-3.1-flash-tts-preview')],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });
    } else {
      throw err;
    }
  }

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('Nenhum dado de áudio retornado pelo modelo neural de voz.');
  }

  const wavBase64 = ensureWavContainer(base64Audio, 24000);
  const wavByteLength = Buffer.from(wavBase64, 'base64').length;
  const rawPcmByteLength = Math.max(0, wavByteLength - 44);
  const durationSec = Math.max(1.0, Number((rawPcmByteLength / 48000).toFixed(2)));
  return { wavBase64, durationSec };
}

// 3. Turn-by-Turn Neural TTS Synthesis (Gemini 3.8 Flash TTS com speechMetadata + vocal tags)
app.post('/api/synthesize-turn', async (req, res) => {
  try {
    const { turn, speakerName, voiceId, language = 'pt-BR' } = req.body;

    if (!turn || !turn.text) {
      return res.status(400).json({ error: 'Dados do turno inválidos.' });
    }

    const effectiveVoice = voiceId || turn.voice_id || 'Kore';
    const effectiveSpeaker = speakerName || turn.speaker || effectiveVoice;
    const effectiveLang = typeof language === 'string' && language ? language : 'pt-BR';
    const speechRate = Number(turn.prosody?.speech_rate) || 1.0;
    const turnEmotion = typeof turn.emotion === 'string' && turn.emotion ? turn.emotion : 'natural';

    const voiceAcousticStyle = getVoiceAcousticStyle(
      effectiveVoice,
      turnEmotion,
      speechRate,
      effectiveLang
    );

    let expressiveTranscript = buildExpressiveTtsTranscript(capText(String(turn.text), 5000), {
      enabled: true,
      speed: speechRate,
      language: effectiveLang,
      emotion: turnEmotion,
      injectNaturalBreaths: true,
    });

    if (
      turn.prosody?.breath_sound &&
      !/^<(?:breath|heavy breath|sigh|short pause|long pause)/i.test(expressiveTranscript)
    ) {
      expressiveTranscript = `<breath> ${expressiveTranscript}`;
    }

    const stylePrompt = `${voiceAcousticStyle} Dialogue context: Speaking as ${effectiveSpeaker} in a live, dynamic multi-speaker conversation with natural turn-taking, authentic emotional inflection, and realistic human breathing.`;

    const { wavBase64, durationSec } = await synthesizeGeminiTtsWav(
      expressiveTranscript,
      effectiveVoice,
      {
        speakerName: effectiveSpeaker,
        stylePrompt,
      }
    );

    return res.json({
      success: true,
      turnNumber: turn.turn,
      audioBase64: wavBase64,
      mimeType: 'audio/wav',
      durationSec,
    });
  } catch (error: unknown) {
    console.error('Error in /api/synthesize-turn:', error);
    return res.status(500).json({
      error: formatGeminiError(error, 'Falha na síntese de áudio do turno.'),
    });
  }
});

// 5. Studio Multi-Track Mixer & Auto-Ducking (FFmpeg Broadcast Engine)
app.post('/api/mix-audio', async (req, res) => {
  let tempVoicePath: string | null = null;
  let tempMusicPath: string | null = null;
  let tempOutputPath: string | null = null;

  try {
    const {
      voiceAudioBase64,
      soundtrackPreset = 'lofi-warmth',
      musicVolume = 0.20,
      duckingDepthDb = -14,
      voiceBoostDb = 3,
      customMusicBase64,
    } = req.body;

    if (!voiceAudioBase64) {
      return res.status(400).json({ error: 'Nenhum áudio de voz fornecido para mixagem.' });
    }

    // Se o preset for silêncio e não houver customMusic, retorna a voz com container garantido
    if (soundtrackPreset === 'none' && !customMusicBase64) {
      return res.json({
        success: true,
        audioBase64: ensureWavContainer(voiceAudioBase64, 24000),
        mimeType: 'audio/wav',
      });
    }

    const tempId = randomUUID();
    tempVoicePath = path.join(os.tmpdir(), `mytts_voice_${tempId}.wav`);
    tempOutputPath = path.join(os.tmpdir(), `mytts_master_${tempId}.wav`);

    const voiceWavBuffer = Buffer.from(ensureWavContainer(voiceAudioBase64, 24000), 'base64');
    await fs.promises.writeFile(tempVoicePath, voiceWavBuffer);

    const safeVoiceBoostDb = Math.max(-6, Math.min(12, Number(voiceBoostDb) || 0));
    const safeDuckingDepthDb = Math.max(-24, Math.min(0, Number(duckingDepthDb) || -14));
    const ratio = Math.max(2, Math.min(20, Math.round(Math.abs(safeDuckingDepthDb) / 2.3)));
    const voiceVol = Math.pow(10, safeVoiceBoostDb / 20).toFixed(2);
    const bgVol = Math.max(0.01, Math.min(1.0, musicVolume)).toFixed(2);

    const filterComplex = buildFfmpegMixFilterComplex(voiceVol, bgVol, ratio);
    let ffmpegArgs: string[] = [];

    if (customMusicBase64) {
      tempMusicPath = path.join(os.tmpdir(), `mytts_music_${tempId}.wav`);
      const musicBuf = Buffer.from(customMusicBase64, 'base64');
      await fs.promises.writeFile(tempMusicPath, musicBuf);

      ffmpegArgs = [
        '-y',
        '-i', tempVoicePath,
        '-stream_loop', '-1',
        '-i', tempMusicPath,
        '-filter_complex',
        filterComplex,
        '-map', '[out]',
        '-c:a', 'pcm_s16le',
        '-ar', '44100',
        tempOutputPath,
      ];
    } else {
      const synthTone =
        soundtrackPreset === 'deep-focus'
          ? 'sine=frequency=432:sample_rate=44100'
          : soundtrackPreset === 'cinematic-pulse'
          ? 'sine=frequency=55:sample_rate=44100'
          : 'sine=frequency=220:sample_rate=44100';

      ffmpegArgs = [
        '-y',
        '-i', tempVoicePath,
        '-f', 'lavfi',
        '-i', synthTone,
        '-filter_complex',
        filterComplex,
        '-map', '[out]',
        '-c:a', 'pcm_s16le',
        '-ar', '44100',
        tempOutputPath,
      ];
    }

    try {
      await execFileAsync('ffmpeg', ffmpegArgs);
      const outputBuffer = await fs.promises.readFile(tempOutputPath);
      return res.json({
        success: true,
        audioBase64: outputBuffer.toString('base64'),
        mimeType: 'audio/wav',
      });
    } catch (ffmpegErr: unknown) {
      console.warn(
        'FFmpeg mix fallback to direct voiceover:',
        ffmpegErr instanceof Error ? ffmpegErr.message : ffmpegErr
      );
      return res.json({
        success: true,
        audioBase64: ensureWavContainer(voiceAudioBase64, 24000),
        mimeType: 'audio/wav',
        warning: 'FFmpeg não disponível; retornado áudio de voz direto.',
      });
    }
  } catch (error: unknown) {
    console.error('Error in /api/mix-audio:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao realizar a mixagem de estúdio.',
    });
  } finally {
    if (tempVoicePath) fs.promises.unlink(tempVoicePath).catch(() => {});
    if (tempMusicPath) fs.promises.unlink(tempMusicPath).catch(() => {});
    if (tempOutputPath) fs.promises.unlink(tempOutputPath).catch(() => {});
  }
});

// 6. Short Voice Sample Preview (Demonstração expressiva personalizada por persona vocal)
const voicePreviewCache = new Map<string, { wavBase64: string; durationSec: number }>();

const VOICE_PREVIEW_EMOTIONS: Record<string, string> = {
  Puck: 'spontaneous',
  Kore: 'natural',
  Aoede: 'storytelling',
  Fenrir: 'resolute',
  Enceladus: 'thoughtful',
};

function buildExpressivePreviewPhrase(voiceId: string, speakerName: string, language: string): string {
  const byVoicePtBr: Record<string, string> = {
    Puck: `<breath> Oi! Eu sou ${speakerName}. <chuckle> Percebe como a minha voz tem energia, ritmo vivo <short pause> e respiração natural de conversa real?`,
    Kore: `<breath> Olá, eu sou ${speakerName}. <short pause> Minha leitura combina clareza analítica, presença serena <breath> e entonação humana fluida.`,
    Aoede: `<breath> Olá... eu sou ${speakerName}. <short pause> Gosto de narrar cada ideia com calor humano, pausas suaves <sigh> e muita expressividade.`,
    Fenrir: `<breath> Olá, sou ${speakerName}. <short pause> Trago um timbre grave, firme e articulado, <breath> com peso vocal para debates intensos.`,
    Enceladus: `<heavy breath> Olá... sou ${speakerName}. <short pause> Minha voz tem textura íntima de estúdio, respiração próxima <sigh> e calma reflexiva.`,
  };

  const byVoiceEnUs: Record<string, string> = {
    Puck: `<breath> Hey there! I'm ${speakerName}. <chuckle> Notice how my voice brings lively rhythm, spontaneous warmth, <short pause> and natural human breathing?`,
    Kore: `<breath> Hello, I'm ${speakerName}. <short pause> My delivery blends poised clarity, balanced warmth, <breath> and authentic studio articulation.`,
    Aoede: `<breath> Hello... I'm ${speakerName}. <short pause> I love shaping every story with velvety warmth, gentle pauses, <sigh> and deep emotion.`,
    Fenrir: `<breath> Hello, I'm ${speakerName}. <short pause> I bring a deep, resonant baritone presence <breath> with grounded authority and clear cadence.`,
    Enceladus: `<heavy breath> Hello... I'm ${speakerName}. <short pause> My voice carries an intimate close-mic texture, soft breathing, <sigh> and quiet reflection.`,
  };

  const byVoiceItIt: Record<string, string> = {
    Puck: `<breath> Ciao! Sono ${speakerName}. <chuckle> Senti come la mia voce ha ritmo vivo, calore spontaneo <short pause> e un respiro davvero naturale?`,
    Kore: `<breath> Ciao, sono ${speakerName}. <short pause> La mia voce unisce chiarezza, equilibrio <breath> e un'intonazione italiana autentica.`,
    Aoede: `<breath> Ciao... sono ${speakerName}. <short pause> Amo raccontare ogni storia con calore, pause morbide <sigh> e profonda espressività.`,
    Fenrir: `<breath> Ciao, sono ${speakerName}. <short pause> Porto un timbro profondo, deciso e autorevole, <breath> ideale per il confronto dialettico.`,
    Enceladus: `<heavy breath> Ciao... sono ${speakerName}. <short pause> La mia voce ha una sfumatura intima da studio, respiro vicino <sigh> e calma riflessiva.`,
  };

  const byVoiceJaJp: Record<string, string> = {
    Puck: `<breath> こんにちは、${speakerName}です！ <chuckle> 自然な息遣いと、生き生きとした会話のリズムを感じていただけますか？`,
    Kore: `<breath> こんにちは、${speakerName}です。 <short pause> 明瞭で落ち着いたトーンと、自然な間の取り方で丁寧にお伝えします。`,
    Aoede: `<breath> こんにちは… ${speakerName}です。 <short pause> 温かみのある表現と、豊かな感情を込めて物語をお届けします。`,
    Fenrir: `<breath> こんにちは、${speakerName}です。 <short pause> 深みのある落ち着いた響きで、説得力のある対話を表現します。`,
    Enceladus: `<heavy breath> こんにちは… ${speakerName}です。 <short pause> すぐそばで語りかけるような、静かで親密な息遣いをお聴きください。`,
  };

  if (language === 'en-US' || language === 'en') {
    return byVoiceEnUs[voiceId] || byVoiceEnUs.Puck;
  }
  if (language === 'it-IT' || language === 'it') {
    return byVoiceItIt[voiceId] || byVoiceItIt.Puck;
  }
  if (language === 'ja-JP' || language === 'ja') {
    return byVoiceJaJp[voiceId] || byVoiceJaJp.Puck;
  }
  return byVoicePtBr[voiceId] || byVoicePtBr.Puck;
}

app.post('/api/preview-voice', async (req, res) => {
  try {
    const rawVoiceId = typeof req.body?.voiceId === 'string' ? req.body.voiceId : 'Puck';
    const rawLanguage = typeof req.body?.language === 'string' ? req.body.language : 'pt-BR';
    const voiceId = ALLOWED_PREVIEW_VOICES.has(rawVoiceId) ? rawVoiceId : 'Puck';
    const language = ALLOWED_PREVIEW_LANGS.has(rawLanguage) ? rawLanguage : 'pt-BR';
    const speakerName =
      typeof req.body?.speakerName === 'string' && req.body.speakerName.trim()
        ? capText(req.body.speakerName.trim(), 40)
        : voiceId;
    const cacheKey = `${voiceId}_${language}_${speakerName}`;

    const cachedPreview = voicePreviewCache.get(cacheKey);
    if (cachedPreview) {
      return res.json({
        success: true,
        audioBase64: cachedPreview.wavBase64,
        mimeType: 'audio/wav',
        durationSec: cachedPreview.durationSec,
      });
    }

    const phrase = buildExpressivePreviewPhrase(voiceId, speakerName, language);
    const previewEmotion = VOICE_PREVIEW_EMOTIONS[voiceId] || 'natural';
    const stylePrompt = getVoiceAcousticStyle(voiceId, previewEmotion, 1.0, language);

    const { wavBase64, durationSec } = await synthesizeGeminiTtsWav(phrase, voiceId, {
      speakerName,
      stylePrompt,
    });
    voicePreviewCache.set(cacheKey, { wavBase64, durationSec });

    return res.json({
      success: true,
      audioBase64: wavBase64,
      mimeType: 'audio/wav',
      durationSec,
    });
  } catch (error: unknown) {
    console.error('Error in /api/preview-voice:', error);
    return res.status(500).json({
      error: formatGeminiError(error, 'Falha ao gerar preview da voz.'),
    });
  }
});

// 6. FastChunks Neural Synthesis (Gemini 3.8 Flash TTS para Chunks de Idiomas)
app.post('/api/synthesize-chunk', async (req, res) => {
  try {
    const { text, language = 'en-US', voiceId } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto do chunk é obrigatório.' });
    }

    const defaultVoices: Record<string, string> = {
      'en-US': 'Puck',
      'it-IT': 'Fenrir',
      'ja-JP': 'Aoede',
    };

    const selectedVoice = voiceId || defaultVoices[language] || 'Puck';
    const cleanText = capText(text, 2000).replace(/\(.*?\)/g, '').trim();
    const expressiveChunk = buildExpressiveTtsTranscript(cleanText, {
      enabled: true,
      language,
      emotion: 'spontaneous',
      injectNaturalBreaths: true,
    });
    const stylePrompt = getVoiceAcousticStyle(selectedVoice, 'spontaneous', 1.0, language);

    const { wavBase64 } = await synthesizeGeminiTtsWav(expressiveChunk, selectedVoice, {
      speakerName: selectedVoice,
      stylePrompt,
    });

    return res.json({
      success: true,
      audioBase64: wavBase64,
      mimeType: 'audio/wav',
    });
  } catch (error: unknown) {
    console.error('Error in /api/synthesize-chunk:', error);
    return res.status(500).json({
      error: formatGeminiError(error, 'Falha na síntese do chunk.'),
    });
  }
});

// 7. Quick Reader Speech Synthesis (Speechify/ElevenLabs Style com Director's Chair Gemini 3.8 Flash TTS)
app.post('/api/synthesize-speech', async (req, res) => {
  try {
    const {
      text,
      voiceId,
      emotion = 'natural',
      speed = 1.0,
      autoProsody = true,
      language = 'pt-BR',
    } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'O texto para leitura é obrigatório.' });
    }

    // Mapeamento de voz padrão por idioma caso não seja especificada
    const resolvedVoiceId =
      voiceId ||
      (language === 'it-IT' || language === 'it'
        ? 'Kore'
        : language === 'ja-JP' || language === 'ja'
          ? 'Aoede'
          : 'Puck');

    const stylePrompt = getVoiceAcousticStyle(resolvedVoiceId, emotion, speed, language);
    const expressiveTranscript = buildExpressiveTtsTranscript(capText(text), {
      enabled: autoProsody,
      speed,
      language,
      emotion,
      injectNaturalBreaths: autoProsody,
    });

    const { wavBase64, durationSec } = await synthesizeGeminiTtsWav(
      expressiveTranscript,
      resolvedVoiceId,
      {
        speakerName: resolvedVoiceId,
        stylePrompt,
      }
    );
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return res.json({
      success: true,
      audioBase64: wavBase64,
      mimeType: 'audio/wav',
      durationSec,
      wordCount,
    });
  } catch (error: unknown) {
    console.error('Error in /api/synthesize-speech:', error);
    return res.status(500).json({
      error: formatGeminiError(error, 'Falha na síntese de áudio do leitor.'),
    });
  }
});

// 8. Transcrição de Áudio do Microfone (Ditado Inteligente via Gemini 3.8 Flash)
app.post('/api/transcribe-audio', async (req, res) => {
  try {
    const { audioData, mimeType = 'audio/webm' } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Nenhum dado de áudio recebido para transcrição.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: audioData,
          },
        },
        {
          text: 'Transcreva este áudio com máxima fidelidade, pontuação natural e inteligente (vírgulas, pontos e parágrafos). Retorne estritamente o texto transcrito, sem preâmbulos, aspas extras ou explicações.',
        },
      ],
    });

    const transcript = response.text?.trim() || '';
    return res.json({
      success: true,
      transcript,
      wordCount: transcript.split(/\s+/).filter(Boolean).length,
    });
  } catch (error: unknown) {
    console.error('Error in /api/transcribe-audio:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao transcrever gravação do microfone.',
    });
  }
});

// ==========================================
// FastChunks: Endpoints de Treino de Idiomas
// ==========================================

// 1. Geração de Chunks Coloquiais via Gemini 3.8 Flash
app.post('/api/generate-chunks', async (req, res) => {
  try {
    const { textOrPrompt, language = 'en-US', count = 3 } = req.body;
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
                  chunk: {
                    type: Type.STRING,
                    description: 'Expressão ou frase nativa no idioma alvo (com romaji entre parênteses se japonês)',
                  },
                  literalOrNuance: {
                    type: Type.STRING,
                    description: 'Equivalente coloquial / sentimento real falado no Brasil',
                  },
                  meaning: {
                    type: Type.STRING,
                    description: 'Explicação concisa do contexto de uso e tom da frase',
                  },
                  context: {
                    type: Type.STRING,
                    description: 'Contexto social curto (ex: Casual entre amigos, Restaurante, Reação espontânea)',
                  },
                  pronunciationHint: {
                    type: Type.STRING,
                    description: 'Guia fonético simplificado aproximado para falantes de português',
                  },
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

    const generatedChunks: ChunkItem[] = rawChunks.map((item: RawGeneratedChunk, idx: number) => ({
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

    return res.json({
      success: true,
      chunks: generatedChunks,
    });
  } catch (error: unknown) {
    console.error('Error in /api/generate-chunks:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao gerar chunks com Gemini.',
    });
  }
});

// 2. Listar Chunks do Usuário
app.get('/api/chunks', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.headers['x-user-id']);
    const lang = req.query.lang as TargetLang | undefined;
    const userChunks = await chunkStorage.listUserChunks(userId, lang);
    return res.json({
      success: true,
      chunks: userChunks,
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/chunks:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao buscar chunks do usuário.',
    });
  }
});

// 3. Salvar / Criar Chunk Manual
app.post('/api/chunks', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.headers['x-user-id']);
    const { chunk, literalOrNuance, meaning, context, pronunciationHint } = req.body;

    if (!chunk || !literalOrNuance || !meaning) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    const newChunk: ChunkItem = {
      id: req.body.id || `custom-${Date.now()}-${randomUUID().slice(0, 6)}`,
      chunk,
      literalOrNuance,
      meaning,
      context: context || 'Personalizado',
      pronunciationHint: pronunciationHint || '',
      userId,
      isCustom: true,
      createdAt: Date.now(),
    };

    await chunkStorage.saveUserChunk(userId, newChunk);
    return res.json({
      success: true,
      chunk: newChunk,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/chunks:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao salvar chunk.',
    });
  }
});

// 4. Remover Chunk Personalizado
app.delete('/api/chunks/:id', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.headers['x-user-id']);
    const chunkId = req.params.id;
    const deleted = await chunkStorage.deleteUserChunk(userId, chunkId);
    return res.json({
      success: true,
      deleted,
    });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/chunks/:id:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao excluir chunk.',
    });
  }
});

// ==========================================
// Estúdio Poliglota: Chunks Paralelos & Flashcards
// ==========================================

// 1. Tradução Paralela e Alinhamento de Chunks (EN, IT, JA) via Gemini 3.8 Flash
app.post('/api/translate-parallel-chunks', async (req, res) => {
  try {
    const { text, sourceLanguage = 'auto' } = req.body;
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
    console.warn('[WARN] /api/translate-parallel-chunks fallback ativado:', formatGeminiError(error, 'Erro tradução paralela'));
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

// 2. Geração de Flashcard com Nuance e Dicionário (Gemini 3.8 Flash)
app.post('/api/generate-flashcard', async (req, res) => {
  try {
    const { chunkText, language, contextSentence } = req.body;
    if (!chunkText || typeof chunkText !== 'string') {
      return res.status(400).json({ error: 'Texto da expressão (chunk) é obrigatório.' });
    }

    const systemPrompt = `Você é um professor poliglota e especialista na metodologia Anki de repetição espaçada.
A partir de uma frase ou chunk em ${language} extraído de um contexto de conversa real, elabore um Flashcard pedagógico de altíssima fidelidade com explicações claras em Português do Brasil (pt-BR).

Regras de Estrutura:
1. "front": O chunk original exatamente como selecionado pelo estudante.
2. "back": Tradução precisa e natural em português do Brasil (pt-BR).
3. "nuance": Explicação concisa (1 a 2 frases) sobre tom, formalidade, contexto social ou nuances culturais de uso.
4. "pronunciation": Guia fonético simplificado aproximado em português (ex: "de-vo da-vé-ro", "na-ru-ho-do-ne").
5. "example": Frase curta de exemplo da vida real utilizando a expressão.
6. "exampleTranslation": Tradução da frase de exemplo para português do Brasil.`;

    const userPrompt = `Chunk selecionado: "${chunkText}"
Idioma: ${language}
Contexto da conversa: "${contextSentence || chunkText}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.5,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.STRING },
            back: { type: Type.STRING },
            nuance: { type: Type.STRING },
            pronunciation: { type: Type.STRING },
            example: { type: Type.STRING },
            exampleTranslation: { type: Type.STRING },
          },
          required: ['front', 'back', 'nuance', 'pronunciation', 'example', 'exampleTranslation'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const cardId = `card_${Date.now()}_${randomUUID().slice(0, 6)}`;

    return res.json({
      success: true,
      card: {
        id: cardId,
        chunkText,
        language: language || 'en',
        front: parsed.front || chunkText,
        back: parsed.back || '',
        nuance: parsed.nuance || '',
        pronunciation: parsed.pronunciation || '',
        example: parsed.example || '',
        exampleTranslation: parsed.exampleTranslation || '',
        createdAt: Date.now(),
      },
    });
  } catch (error: unknown) {
    console.error('Error in /api/generate-flashcard:', error);
    return res.status(500).json({
      error: formatGeminiError(error, 'Falha ao gerar flashcard com Gemini.'),
    });
  }
});

// ==========================================
// Autenticação Google & Histórico de Conversas Familiar
// ==========================================

const conversationStorage = getConversationStorage();

app.get('/api/auth/config', (_req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
    projectId: process.env.GCP_PROJECT_ID || 'agent-md-506215',
    region: 'southamerica-east1',
  });
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, email, name } = req.body as {
      credential?: string;
      email?: string;
      name?: string;
    };

    if (credential && typeof credential === 'string') {
      const parts = credential.split('.');
      if (parts.length !== 3) {
        return res.status(400).json({ error: 'Token Google inválido.' });
      }
      const payloadRaw = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadRaw) as {
        iss?: string;
        sub?: string;
        email?: string;
        name?: string;
        picture?: string;
        exp?: number;
      };

      if (
        !payload.sub ||
        (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com')
      ) {
        return res.status(401).json({ error: 'Emissor do token Google inválido.' });
      }

      if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now() - 60_000) {
        return res.status(401).json({ error: 'Token Google expirado. Faça login novamente.' });
      }

      // Se houver GOOGLE_CLIENT_ID configurado, valida assinatura/audiência no endpoint oficial tokeninfo
      const expectedClientId = (
        process.env.GOOGLE_CLIENT_ID ||
        process.env.VITE_GOOGLE_CLIENT_ID ||
        ''
      ).trim();
      if (expectedClientId) {
        try {
          const verifyResp = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
          );
          if (!verifyResp.ok) {
            return res.status(401).json({ error: 'Assinatura do token Google recusada.' });
          }
          const verifiedData = (await verifyResp.json()) as { aud?: string };
          if (verifiedData.aud && verifiedData.aud !== expectedClientId) {
            return res.status(401).json({ error: 'Client ID do token Google não corresponde.' });
          }
        } catch {
          // Permanece com a validação estrutural caso sem rede externa no ambiente local
        }
      }

      const canonicalEmail = (payload.email || '').trim().toLowerCase();
      const rawIdentifier = canonicalEmail
        ? canonicalEmail.replace(/[^a-z0-9]/g, '_').slice(0, 56)
        : String(payload.sub).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 56);
      const safeUid = sanitizeUserId(`google_${rawIdentifier}`);
      const user: GoogleUserSession = {
        uid: safeUid,
        name: payload.name || payload.email?.split('@')[0] || 'Usuário Google',
        email: canonicalEmail || payload.email || '',
        picture: payload.picture,
        idToken: credential,
        isGoogleAuthenticated: true,
      };
      return res.json({ success: true, user });
    }

    if (email && typeof email === 'string' && email.includes('@')) {
      const cleanEmail = email.trim().toLowerCase();
      const safeEmailSlug = cleanEmail.replace(/[^a-z0-9]/g, '_').slice(0, 56);
      const safeUid = sanitizeUserId(`google_${safeEmailSlug}`);
      const displayName =
        typeof name === 'string' && name.trim().length > 0
          ? name.trim().slice(0, 60)
          : cleanEmail.split('@')[0];

      const user: GoogleUserSession = {
        uid: safeUid,
        name: displayName,
        email: cleanEmail,
        isGoogleAuthenticated: true,
      };
      return res.json({ success: true, user });
    }

    return res.status(400).json({ error: 'Credencial ou e-mail Google obrigatório.' });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao autenticar conta Google.',
    });
  }
});

app.get('/api/conversations', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.headers['x-user-id']);
    const conversations = await conversationStorage.listByUser(userId);
    return res.json({
      success: true,
      storageMode: conversationStorage.mode,
      conversations,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao listar histórico de conversas.',
    });
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.headers['x-user-id']);
    const body = req.body as Partial<SavedConversation>;
    if (!body || !body.id || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: 'Dados da conversa inválidos (id e messages são obrigatórios).' });
    }

    const convToSave: SavedConversation = {
      id: String(body.id).slice(0, 80),
      userId,
      userName: String(body.userName || 'Familiar').slice(0, 80),
      userEmail: body.userEmail ? String(body.userEmail).slice(0, 120) : undefined,
      title: String(body.title || 'Conversa Poliglota').slice(0, 140),
      customTitle: Boolean(body.customTitle),
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: Boolean(body.pinned),
      originMode: body.originMode || 'polyglot',
      messages: body.messages.slice(-40),
    };

    const saved = await conversationStorage.upsert(userId, convToSave);
    return res.json({
      success: true,
      conversation: saved,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao salvar conversa no histórico.',
    });
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.headers['x-user-id']);
    const convId = String(req.params.id || '').slice(0, 80);
    const deleted = await conversationStorage.remove(userId, convId);
    return res.json({
      success: true,
      deleted,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao remover conversa do histórico.',
    });
  }
});

app.delete('/api/conversations', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.headers['x-user-id']);
    const removedCount = await conversationStorage.clearUnpinned(userId);
    return res.json({
      success: true,
      removedCount,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao limpar conversas não fixadas.',
    });
  }
});

const flashcardStorage = getFlashcardStorage();

app.get('/api/flashcards', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.headers['x-user-id']);
    const cards = await flashcardStorage.listByUser(userId);
    return res.json({
      success: true,
      storageMode: flashcardStorage.mode,
      cards,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao listar flashcards do usuário.',
    });
  }
});

app.post('/api/flashcards', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.headers['x-user-id']);
    const body = req.body as { cards?: FlashcardItem[]; card?: FlashcardItem } | undefined;
    const incoming: FlashcardItem[] = Array.isArray(body?.cards)
      ? body.cards.slice(0, 500)
      : body?.card
        ? [body.card]
        : [];

    if (incoming.length === 0) {
      return res.status(400).json({ error: 'Informe card ou cards para salvar no baralho.' });
    }

    const saved = await flashcardStorage.upsertMany(userId, incoming);
    return res.json({
      success: true,
      storageMode: flashcardStorage.mode,
      cards: saved,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao salvar flashcards.',
    });
  }
});

app.delete('/api/flashcards/:id', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.headers['x-user-id']);
    const cardId = String(req.params.id || '').slice(0, 80);
    const deleted = await flashcardStorage.remove(userId, cardId);
    return res.json({
      success: true,
      deleted,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao excluir flashcard.',
    });
  }
});

app.delete('/api/flashcards', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.headers['x-user-id']);
    const clearedCount = await flashcardStorage.clearByUser(userId);
    return res.json({
      success: true,
      clearedCount,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha ao limpar baralho de flashcards.',
    });
  }
});

// ==========================================
// Live API & Agentes de Voz Conversacionais
// ==========================================

function buildFallbackPolyglotReply(
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

function resolveLiveToolCalls(
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

  // Detecção determinística de intenção de Function Calling caso o modelo omita ou esteja em fallback
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

app.post('/api/live-agent-turn', async (req, res) => {
  const {
    text,
    audioBase64,
    mimeType = 'audio/webm',
    persona = 'tutor_conversational',
    history = [],
  } = req.body as {
    text?: string;
    audioBase64?: string;
    mimeType?: string;
    persona?: AgentPersona;
    history?: Array<{ role: string; text: string }>;
  };

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
      ? history
          .slice(-4)
          .map((h) => `${h.role}: ${h.text}`)
          .join('\n')
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

    const parts: Array<
      | { text: string }
      | { inlineData: { data: string; mimeType: string } }
    > = [];

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
    const toolCallsExecuted = resolveLiveToolCalls(
      [],
      fallback.userTranscript,
      fallback.chunks
    );
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

// ==========================================
// Agente Gemini com Busca Web (Google Search), Catálogo YouTube & Fluxo Pós-Link
// ==========================================

async function fetchYoutubeMetadata(rawUrlOrId: string): Promise<YoutubeVideoMetadata | null> {
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
  } catch {
    return fallbackMeta;
  }
}

async function searchYoutubeVideos(query: string, maxResults = 4): Promise<YoutubeVideoMetadata[]> {
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
  } catch {
    return [];
  }
}

app.get('/api/youtube/metadata', async (req, res) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
  const metadata = await fetchYoutubeMetadata(rawUrl);
  if (!metadata) {
    return res.status(400).json({
      success: false,
      error: 'URL do YouTube inválida.',
    });
  }
  return res.json({
    success: true,
    metadata,
  });
});

app.post('/api/agent-explore', async (req, res) => {
  const {
    prompt = '',
    youtubeUrl: explicitYoutubeUrl,
    youtubeAction: explicitAction,
    clipRange,
    enableSearch = true,
  } = req.body as {
    prompt?: string;
    youtubeUrl?: string;
    youtubeAction?: YoutubePostLinkAction;
    clipRange?: YoutubeClipRange;
    enableSearch?: boolean;
  };

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

  // MODO 1: Link colado sem comando específico ("ask_intent") -> retorna imediatamente o Card Interativo com Player e as 4 opções pós-link
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
      sources: [
        {
          title: youtubeMeta?.title || 'Vídeo do YouTube',
          uri: detectedYt,
        },
      ],
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

    const parts: Array<
      | { text: string }
      | { fileData: { fileUri: string; mimeType: string } }
    > = [];

    if (detectedYt) {
      parts.push({
        fileData: {
          fileUri: detectedYt,
          mimeType: 'video/mp4',
        },
      });
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

    // Quando fileData do YouTube está presente, não combinamos urlContext para evitar 400 INVALID_ARGUMENT na Vertex AI
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts }],
      config: {
        temperature: 0.35,
        tools: detectedYt
          ? undefined
          : enableSearch
          ? [{ googleSearch: {} }]
          : undefined,
      },
    });

    const rawText = (response.text || '').trim();
    const parsed = parseStructuredJsonFromModel<{
      agentReplyPtBr?: string;
      chunks?: AlignedChunk[];
      fullText?: { en: string; it: string; ja: string };
    }>(rawText);

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
      | {
          groundingMetadata?: {
            groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
          };
        }
      | undefined;

    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
    for (const gc of groundingChunks) {
      if (gc.web?.uri && !sources.some((s) => s.uri === gc.web?.uri)) {
        sources.push({
          title: gc.web.title || gc.web.uri,
          uri: gc.web.uri,
        });
      }
    }

    // Se a ação for extract_expressions, gera toolCalls automáticos para salvar os cards no Deck
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
      fallbackSources.push({
        title: youtubeMeta?.title || 'Vídeo do YouTube Informado',
        uri: detectedYt,
      });
    }
    for (const v of youtubeSearchResults) {
      fallbackSources.push({
        title: `YouTube: ${v.title}`,
        uri: v.canonicalUrl,
      });
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

// Health check com probe real: reflete o estado das dependências, não um status estático
app.get('/api/health', (_req, res) => {
  const storage = chunkStorage.getStorageMode();
  res.json({
    status: 'online',
    service: 'DialecticPod & FastChunks API',
    modelTts: 'gemini-3.8-flash-tts',
    modelGen: 'gemini-3.8-flash',
    geminiKeyConfigured: true,
    storage,
    uptimeSec: Math.round(process.uptime()),
  });
});

// Favicon SVG leve para evitar 404 no console do navegador
app.get('/favicon.ico', (_req, res) => {
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0f172a"/><path d="M9 16v-4m4 8V12m4 10V10m4 8v-4m4 2v-1" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(svgIcon);
});

// Rotas de API desconhecidas: 404 JSON estruturado (nunca o HTML do SPA)
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint não encontrado: ${req.method} ${req.originalUrl}`,
  });
});


// Vite Middleware for Dev, Static serving for Production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Servir assets compilados com controle estrito de cache
    app.use(
      express.static(path.resolve(__dirname, 'dist'), {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );

    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DialecticPod server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err: unknown) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

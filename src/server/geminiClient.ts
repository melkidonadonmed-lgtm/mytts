import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  buildTtsModelPart,
  type TtsSpeechMetadataPart,
} from '../utils/prosodyEngine';
import { ensureWavContainer } from './audioContainer';

dotenv.config({ override: true });

export const DEFAULT_GCP_PROJECT =
  process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'agent-md-506215';
export const DEFAULT_VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

let cachedApiKey = '';
let cachedGenAiClient: GoogleGenAI | null = null;
let cachedVertexAdcClient: GoogleGenAI | null = null;
const invalidApiKeys = new Set<string>();

export function resolveActiveApiKey(): string {
  try {
    if (fs.existsSync(ROOT_ENV_PATH)) {
      const parsed = dotenv.parse(fs.readFileSync(ROOT_ENV_PATH, 'utf-8'));
      const fromFile = (parsed.GEMINI_API_KEY || parsed.GOOGLE_API_KEY || '').trim();
      if (fromFile) {
        return fromFile;
      }
    }
  } catch (err: unknown) {
    console.debug(
      '[GeminiClient] Falha ao ler .env local:',
      err instanceof Error ? err.message : String(err)
    );
  }
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

export function getVertexAdcClient(): GoogleGenAI {
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

export function getGenAiClient(): GoogleGenAI {
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

const TTS_MODEL_CASCADE = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'];

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
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (msg.includes('404') || msg.includes('NOT_FOUND')) {
      const ttsIdx = TTS_MODEL_CASCADE.indexOf(params.model);
      if (ttsIdx !== -1 && ttsIdx < TTS_MODEL_CASCADE.length - 1) {
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
            if (
              i === TTS_MODEL_CASCADE.length - 1 ||
              (!innerMsg.includes('404') && !innerMsg.includes('NOT_FOUND'))
            ) {
              throw innerErr;
            }
          }
        }
      }
      if (params.model === 'gemini-3.8-flash') {
        return await client.models.generateContent({
          ...params,
          model: 'gemini-3.5-flash-lite',
        });
      }
    }
    throw err;
  }
}

export const ai = {
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

export interface TtsSynthesisMetadataOptions {
  speakerName?: string;
  stylePrompt?: string;
}

/** Síntese neural Gemini 3.8 Flash TTS -> WAV RIFF 24kHz com speechMetadata estruturado. */
export async function synthesizeGeminiTtsWav(
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
      contents: [{ role: 'user', parts: [partPayload] }],
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
    if (
      style &&
      (msg.includes('speechMetadata') ||
        msg.includes('speech_metadata') ||
        msg.includes('Unknown name'))
    ) {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [buildTtsModelPart(spokenText, speaker, style, 'inline-fallback')],
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

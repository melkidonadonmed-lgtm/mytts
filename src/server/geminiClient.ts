import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  buildTtsModelPart,
  type TtsSpeechMetadataPart,
} from '../utils/prosodyEngine';
import { ensureWavContainer, extractWavPcmInfo } from './audioContainer';
import {
  MODEL_REGISTRY,
  TEXT_FAST_CASCADE,
  TEXT_REASONING_CASCADE,
  TRANSCRIBE_CASCADE,
  TTS_FAST_CASCADE,
  TTS_FLAGSHIP_CASCADE,
} from './modelRegistry';

dotenv.config({ override: true });

export const DEFAULT_GCP_PROJECT =
  process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'agent-md-506215';
export const DEFAULT_VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';
export const DEFAULT_VERTEX_LIVE_AGENT_LOCATION =
  process.env.VERTEX_LIVE_AGENT_LOCATION || 'us-central1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

let cachedApiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
let lastEnvStatCheckAt = 0;
let lastEnvMtimeMs = 0;

function loadEnvFileSyncOnce(): void {
  try {
    if (fs.existsSync(ROOT_ENV_PATH)) {
      const stat = fs.statSync(ROOT_ENV_PATH);
      lastEnvMtimeMs = stat.mtimeMs;
      const parsed = dotenv.parse(fs.readFileSync(ROOT_ENV_PATH, 'utf-8'));
      const fromFile = (parsed.GEMINI_API_KEY || parsed.GOOGLE_API_KEY || '').trim();
      if (fromFile) {
        cachedApiKey = fromFile;
      }
    }
  } catch (err: unknown) {
    console.debug(
      '[GeminiClient] Falha ao ler .env inicial:',
      err instanceof Error ? err.message : String(err)
    );
  }
}

loadEnvFileSyncOnce();

let cachedGenAiClient: GoogleGenAI | null = null;
let cachedGenAiClientKey = '';
const cachedVertexAdcClients = new Map<string, GoogleGenAI>();
const invalidApiKeys = new Set<string>();
const inFlightTtsRequests = new Map<string, Promise<{ wavBase64: string; durationSec: number }>>();

async function refreshDevEnvKeyIfChanged(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  const now = Date.now();
  if (now - lastEnvStatCheckAt < 5000) return;
  lastEnvStatCheckAt = now;
  try {
    const stat = await fs.promises.stat(ROOT_ENV_PATH);
    if (stat.mtimeMs !== lastEnvMtimeMs) {
      lastEnvMtimeMs = stat.mtimeMs;
      const content = await fs.promises.readFile(ROOT_ENV_PATH, 'utf-8');
      const parsed = dotenv.parse(content);
      const fromFile = (parsed.GEMINI_API_KEY || parsed.GOOGLE_API_KEY || '').trim();
      if (fromFile) {
        cachedApiKey = fromFile;
      }
    }
  } catch {
    // .env is optional when using Vertex AI ADC
  }
}

function resolveActiveApiKey(): string {
  if (cachedApiKey) return cachedApiKey;
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

export function getAuthStatusSummary(): {
  authMode: 'adc' | 'vertex_express' | 'developer_api';
  geminiKeyConfigured: boolean;
  project: string;
  location: string;
} {
  const key = resolveActiveApiKey();
  if (!key || invalidApiKeys.has(key)) {
    return {
      authMode: 'adc',
      geminiKeyConfigured: true,
      project: DEFAULT_GCP_PROJECT,
      location: DEFAULT_VERTEX_LOCATION,
    };
  }
  return {
    authMode: key.startsWith('AQ.') ? 'vertex_express' : 'developer_api',
    geminiKeyConfigured: true,
    project: DEFAULT_GCP_PROJECT,
    location: DEFAULT_VERTEX_LOCATION,
  };
}

export function getVertexAdcClient(location: string = DEFAULT_VERTEX_LOCATION): GoogleGenAI {
  const normalizedLocation = location.trim() || DEFAULT_VERTEX_LOCATION;
  let client = cachedVertexAdcClients.get(normalizedLocation);
  if (!client) {
    // @google/genai auto-reads GEMINI_API_KEY/GOOGLE_API_KEY from process.env and rejects
    // mixing apiKey with project/location. Isolate env vars briefly during instantiation.
    const savedGeminiKey = process.env.GEMINI_API_KEY;
    const savedGoogleKey = process.env.GOOGLE_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      client = new GoogleGenAI({
        vertexai: true,
        project: DEFAULT_GCP_PROJECT,
        location: normalizedLocation,
      });
      cachedVertexAdcClients.set(normalizedLocation, client);
    } finally {
      if (savedGeminiKey !== undefined) process.env.GEMINI_API_KEY = savedGeminiKey;
      if (savedGoogleKey !== undefined) process.env.GOOGLE_API_KEY = savedGoogleKey;
    }
  }
  return client;
}

function getGenAiClient(): GoogleGenAI {
  const currentKey = resolveActiveApiKey();
  if (!currentKey || invalidApiKeys.has(currentKey)) {
    return getVertexAdcClient(DEFAULT_VERTEX_LOCATION);
  }
  if (!cachedGenAiClient || currentKey !== cachedGenAiClientKey) {
    cachedGenAiClientKey = currentKey;
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

/**
 * Returns a GoogleGenAI client suitable for Live API WebSockets, routing
 * gemini-3.8-live to us-central1 and gemini-3.5-transcribe-live to global under Vertex ADC.
 */
export function getLiveGenAiClient(mode: 'agent' | 'transcribe' = 'agent'): GoogleGenAI {
  const currentKey = resolveActiveApiKey();
  if (!currentKey || invalidApiKeys.has(currentKey)) {
    return getVertexAdcClient(
      mode === 'agent' ? DEFAULT_VERTEX_LIVE_AGENT_LOCATION : DEFAULT_VERTEX_LOCATION
    );
  }
  return getGenAiClient();
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

function isModelNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return msg.includes('404') || msg.includes('NOT_FOUND');
}

function isTransientRetryableError(err: unknown): boolean {
  if (isAuthOrInvalidKeyError(err) || isModelNotFoundError(err)) return false;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('500') ||
    msg.includes('INTERNAL') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('fetch failed')
  );
}

function getCascadeForModel(model: string): ReadonlyArray<string> | null {
  if (TTS_FLAGSHIP_CASCADE.includes(model)) return TTS_FLAGSHIP_CASCADE;
  if (TTS_FAST_CASCADE.includes(model)) return TTS_FAST_CASCADE;
  if (TEXT_FAST_CASCADE.includes(model)) return TEXT_FAST_CASCADE;
  if (TEXT_REASONING_CASCADE.includes(model)) return TEXT_REASONING_CASCADE;
  if (TRANSCRIBE_CASCADE.includes(model)) return TRANSCRIBE_CASCADE;
  return null;
}

function adaptContentsForModel(
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

function sanitizeConfigForModel(
  config: Parameters<GoogleGenAI['models']['generateContent']>[0]['config'],
  targetModel: string
): Parameters<GoogleGenAI['models']['generateContent']>[0]['config'] {
  if (!config) return config;
  if (targetModel.startsWith('gemini-4-') || targetModel === MODEL_REGISTRY.TEXT_FAST_MODEL) {
    const cleaned = { ...config };
    delete cleaned.temperature;
    delete cleaned.topP;
    delete cleaned.topK;
    return cleaned;
  }
  return config;
}

export interface GenerateContentExecutionOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

async function callWithTimeoutAndRetry(
  client: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  options: GenerateContentExecutionOptions = {}
) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxRetries = options.maxRetries ?? 2;

  let attempt = 0;
  while (true) {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
    const mergedConfig = {
      ...params.config,
      abortSignal: params.config?.abortSignal || timeoutController.signal,
    };

    try {
      return await client.models.generateContent({
        ...params,
        config: mergedConfig,
      });
    } catch (err: unknown) {
      if (attempt < maxRetries && isTransientRetryableError(err)) {
        const baseDelay = 350 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 180);
        await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
        attempt += 1;
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

async function executeGenerateContentWithCascade(
  client: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  options?: GenerateContentExecutionOptions
) {
  const normalizedParams = {
    ...params,
    config: sanitizeConfigForModel(params.config, params.model),
  };

  try {
    return await callWithTimeoutAndRetry(client, normalizedParams, options);
  } catch (err: unknown) {
    if (isModelNotFoundError(err)) {
      const cascade = getCascadeForModel(params.model);
      if (cascade) {
        const idx = cascade.indexOf(params.model);
        for (let i = idx + 1; i < cascade.length; i++) {
          const fallbackModel = cascade[i];
          try {
            return await callWithTimeoutAndRetry(
              client,
              {
                ...normalizedParams,
                model: fallbackModel,
                contents: adaptContentsForModel(normalizedParams.contents, fallbackModel),
                config: sanitizeConfigForModel(normalizedParams.config, fallbackModel),
              },
              options
            );
          } catch (innerErr: unknown) {
            if (i === cascade.length - 1 || !isModelNotFoundError(innerErr)) {
              throw innerErr;
            }
          }
        }
      }
    }
    throw err;
  }
}

export const ai = {
  models: {
    generateContent: async (
      params: Parameters<GoogleGenAI['models']['generateContent']>[0],
      options?: GenerateContentExecutionOptions
    ) => {
      await refreshDevEnvKeyIfChanged();
      const activeKey = resolveActiveApiKey();
      const client = getGenAiClient();
      try {
        return await executeGenerateContentWithCascade(client, params, options);
      } catch (err: unknown) {
        if (activeKey && !invalidApiKeys.has(activeKey) && isAuthOrInvalidKeyError(err)) {
          invalidApiKeys.add(activeKey);
          console.warn(
            '[Auth Failover] Chave GEMINI_API_KEY rejeitada (conta vinculada inativa/401). Alternando automaticamente para Vertex AI ADC (global)...'
          );
          const adcClient = getVertexAdcClient();
          return await executeGenerateContentWithCascade(adcClient, params, options);
        }
        throw err;
      }
    },
  },
};

export interface TtsSynthesisMetadataOptions {
  speakerName?: string;
  stylePrompt?: string;
  model?: string;
}

function extractFirstAudioInlineData(
  response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>
): { data: string; mimeType: string } | null {
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part?.inlineData;
    if (inline?.data) {
      return {
        data: inline.data,
        mimeType: inline.mimeType || 'audio/wav',
      };
    }
  }
  return null;
}

/**
 * Neural TTS synthesis via Gemini 3.8 TTS (flagship or lite) -> canonical WAV RIFF 24kHz.
 * Preserves camelCase speechMetadata across both Gemini 3.8 TTS models (never injects inline direction text).
 */
export async function synthesizeGeminiTtsWav(
  spokenText: string,
  voiceName: string,
  options?: TtsSynthesisMetadataOptions
): Promise<{ wavBase64: string; durationSec: number }> {
  const speaker = options?.speakerName || voiceName;
  const style = options?.stylePrompt?.trim() || '';
  const primaryModel = options?.model || MODEL_REGISTRY.TTS_FLAGSHIP_MODEL;
  const fallbackModel =
    primaryModel === MODEL_REGISTRY.TTS_FAST_MODEL
      ? MODEL_REGISTRY.TTS_FLAGSHIP_MODEL
      : MODEL_REGISTRY.TTS_FAST_MODEL;

  const flightKey = `${primaryModel}:${voiceName}:${speaker}:${style}:${spokenText}`;
  const existing = inFlightTtsRequests.get(flightKey);
  if (existing) {
    return existing;
  }

  const run = async (): Promise<{ wavBase64: string; durationSec: number }> => {
    const buildRequest = (targetModel: string) => {
      const partPayload: TtsSpeechMetadataPart = buildTtsModelPart(
        spokenText,
        speaker,
        style,
        targetModel
      );
      return {
        model: targetModel,
        contents: [{ role: 'user', parts: [partPayload] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      };
    };

    let response;
    try {
      response = await ai.models.generateContent(buildRequest(primaryModel), {
        timeoutMs: 30_000,
        maxRetries: 2,
      });
    } catch (err: unknown) {
      if (isAuthOrInvalidKeyError(err)) {
        throw err;
      }
      // Retry once on the companion Gemini 3.8 TTS model while preserving camelCase speechMetadata
      if (isModelNotFoundError(err) || isTransientRetryableError(err)) {
        response = await ai.models.generateContent(buildRequest(fallbackModel), {
          timeoutMs: 30_000,
          maxRetries: 1,
        });
      } else {
        throw err;
      }
    }

    const audioPart = extractFirstAudioInlineData(response);
    if (!audioPart?.data) {
      throw new Error('Nenhum dado de áudio retornado pelo modelo neural de voz.');
    }

    const wavBase64 = ensureWavContainer(audioPart.data, 24000);
    const wavBuffer = Buffer.from(wavBase64, 'base64');
    const pcmInfo = extractWavPcmInfo(wavBuffer);
    const durationSec = Math.max(
      0.5,
      Number((pcmInfo.dataByteLength / Math.max(1, pcmInfo.byteRate)).toFixed(2))
    );
    return { wavBase64, durationSec };
  };

  const promise = run().finally(() => {
    inFlightTtsRequests.delete(flightKey);
  });
  inFlightTtsRequests.set(flightKey, promise);
  return promise;
}

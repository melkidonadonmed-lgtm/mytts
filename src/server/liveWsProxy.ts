/**
 * Authenticated WebSocket proxy (/ws/live) bridging browser PCM audio to
 * Gemini Live (gemini-3.8-live) and Gemini Live Transcribe (gemini-3.5-transcribe-live).
 */
import type { IncomingMessage, Server as HttpServer } from 'http';
import type { Duplex } from 'stream';
import {
  AudioTranscriptionConfigMode,
  Behavior,
  Modality,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type { AgentPersona } from '../types/polyglot';
import { ALLOWED_STUDIO_VOICES, capText, formatGeminiError } from './audioContainer';
import { resolveRequestUserId, verifyLiveTicket } from './authSession';
import {
  DEFAULT_VERTEX_LIVE_AGENT_LOCATION,
  DEFAULT_VERTEX_LOCATION,
  getLiveGenAiClient,
  getVertexAdcClient,
} from './geminiClient';
import { MODEL_REGISTRY } from './modelRegistry';
import {
  createLiveStudioFunctionDeclarations,
  resolveLiveToolCalls,
} from './routes/agentHelpers';

const MAX_WS_PAYLOAD_BYTES = 64 * 1024;
const MAX_ACTIVE_GLOBAL_SESSIONS = 20;
const MAX_ACTIVE_SESSIONS_PER_USER = 2;
const LIVE_SESSION_IDLE_TIMEOUT_MS = 120_000;
const MAX_PRE_SETUP_BUFFER_CHUNKS = 32;

type LiveWsMode = 'agent' | 'transcribe';

interface ClientStartMessage {
  type: 'start';
  mode?: LiveWsMode;
  voiceId?: string;
  persona?: AgentPersona;
  history?: Array<{ role: string; text: string }>;
  resumeHandle?: string;
  sourceText?: string;
}

interface ClientAudioMessage {
  type: 'audio';
  data: string;
  mimeType?: string;
}

interface ClientTextMessage {
  type: 'text';
  text: string;
}

interface ClientAudioEndMessage {
  type: 'audio_end';
}

type ClientWsMessage =
  | ClientStartMessage
  | ClientAudioMessage
  | ClientTextMessage
  | ClientAudioEndMessage;

const LIVE_AGENT_FUNCTION_DECLARATIONS = createLiveStudioFunctionDeclarations({
  behavior: Behavior.NON_BLOCKING,
});

function isAllowedWsOrigin(originHeader: string | undefined, hostHeader: string | undefined): boolean {
  if (!originHeader) {
    // Non-browser CLI probes without Origin are allowed only in non-production
    return process.env.NODE_ENV !== 'production';
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originHeader);
  } catch {
    return false;
  }

  const host = (hostHeader || '').split(',')[0].trim().toLowerCase();
  if (host && parsedOrigin.host.toLowerCase() === host) {
    return true;
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1')
  ) {
    return true;
  }

  if (
    parsedOrigin.protocol === 'https:' &&
    (parsedOrigin.hostname.endsWith('.web.app') ||
      parsedOrigin.hostname.endsWith('.firebaseapp.com') ||
      parsedOrigin.hostname.endsWith('.run.app'))
  ) {
    return true;
  }

  const extraOrigins = (process.env.ALLOWED_WS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return extraOrigins.includes(parsedOrigin.origin.toLowerCase());
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function rejectUpgrade(socket: Duplex, statusCode: number, reason: string): void {
  try {
    socket.write(`HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\n\r\n`);
  } catch {
    // Ignore socket write errors on half-closed connections
  }
  socket.destroy();
}

function buildAgentSystemInstruction(
  persona: AgentPersona = 'tutor_conversational',
  history: Array<{ role: string; text: string }> = []
): string {
  const personaMap: Record<AgentPersona, string> = {
    polyglot_translator:
      'Você atua como um Tradutor Simultâneo Poliglota de alta fluência: responda de forma concisa em Português (pt-BR) e apresente equivalentes naturais em Inglês (EN), Italiano (IT) e Japonês (JA).',
    tutor_conversational:
      'Você é o Tutor Poliglota em tempo real do MyTTS Studio. Responda com naturalidade, pronúncia clara e ritmo acolhedor, combinando orientação objetiva em Português (pt-BR) e exemplos práticos em EN, IT e JA quando útil.',
    practice_partner:
      'Você atua como um Parceiro Nativo de Conversação em tempo real. Reaja ao que o usuário falou em ritmo natural, corrija suavemente apenas o essencial em Português e devolva uma pergunta curta para continuar o diálogo.',
  };

  const recent = Array.isArray(history)
    ? history
        .slice(-4)
        .map((h) => `${h.role}: ${capText(String(h.text || ''), 280)}`)
        .join('\n')
    : '';

  return [
    personaMap[persona] || personaMap.tutor_conversational,
    'Você possui ferramentas NON_BLOCKING para salvar flashcards (create_study_flashcard) e trocar a voz do estúdio (switch_studio_voice) quando o usuário pedir.',
    recent ? `Contexto recente:\n${recent}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function attachLiveWebSocketProxy(httpServer: HttpServer): void {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_WS_PAYLOAD_BYTES,
  });

  let activeGlobalSessions = 0;
  const activePerUser = new Map<string, number>();

  httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const rawUrl = request.url || '/';
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl, `http://${request.headers.host || 'localhost'}`);
    } catch {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    if (parsedUrl.pathname !== '/ws/live') {
      // Allow other upgrade handlers (e.g. Vite HMR in dev) to process non-live paths
      return;
    }

    const originHeader = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
    const hostHeader = typeof request.headers.host === 'string' ? request.headers.host : undefined;
    if (!isAllowedWsOrigin(originHeader, hostHeader)) {
      rejectUpgrade(socket, 403, 'Forbidden Origin');
      return;
    }

    const ticketParam = parsedUrl.searchParams.get('ticket') || undefined;
    let userId: string | null = null;
    if (ticketParam) {
      const ticketResult = verifyLiveTicket(ticketParam);
      if (!ticketResult.ok) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }
      userId = ticketResult.userId;
    } else {
      const cookieIdentity = resolveRequestUserId({ headers: request.headers });
      if (!cookieIdentity.ok || !cookieIdentity.isAuthenticated) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }
      userId = cookieIdentity.userId;
    }

    const currentUserCount = activePerUser.get(userId) || 0;
    if (
      activeGlobalSessions >= MAX_ACTIVE_GLOBAL_SESSIONS ||
      currentUserCount >= MAX_ACTIVE_SESSIONS_PER_USER
    ) {
      rejectUpgrade(socket, 429, 'Too Many Live Sessions');
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, userId);
    });
  });

  wss.on('connection', (ws: WebSocket, _request: IncomingMessage, userId: string) => {
    activeGlobalSessions += 1;
    activePerUser.set(userId, (activePerUser.get(userId) || 0) + 1);

    let liveSession: Session | null = null;
    let liveMode: LiveWsMode = 'agent';
    let setupComplete = false;
    let activityStarted = false;
    let closed = false;
    let latestInputTranscript = '';
    const preSetupAudioBuffer: Array<{ data: string; mimeType: string }> = [];
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        sendJson(ws, {
          type: 'error',
          message: 'Sessão Gemini Live encerrada por inatividade (120s).',
          recoverable: false,
        });
        ws.close(1000, 'Idle timeout');
      }, LIVE_SESSION_IDLE_TIMEOUT_MS);
    };

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      activeGlobalSessions = Math.max(0, activeGlobalSessions - 1);
      const count = activePerUser.get(userId) || 1;
      if (count <= 1) {
        activePerUser.delete(userId);
      } else {
        activePerUser.set(userId, count - 1);
      }
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // Ignore close errors
        }
        liveSession = null;
      }
    };

    const handleUpstreamMessage = (message: LiveServerMessage) => {
      if (closed) return;

      if (message.setupComplete && !setupComplete) {
        setupComplete = true;
        sendJson(ws, {
          type: 'ready',
          mode: liveMode,
          model:
            liveMode === 'transcribe'
              ? MODEL_REGISTRY.LIVE_TRANSCRIBE_MODEL
              : MODEL_REGISTRY.LIVE_AGENT_MODEL,
          sessionId: message.setupComplete.sessionId,
        });

        if (liveSession && liveMode === 'transcribe' && !activityStarted) {
          activityStarted = true;
          liveSession.sendRealtimeInput({ activityStart: {} });
        }

        while (preSetupAudioBuffer.length > 0 && liveSession) {
          const item = preSetupAudioBuffer.shift();
          if (item) {
            liveSession.sendRealtimeInput({
              audio: { data: item.data, mimeType: item.mimeType },
            });
          }
        }
      }

      const content = message.serverContent;
      if (content) {
        if (content.interrupted) {
          sendJson(ws, { type: 'interrupted' });
        }

        if (content.interimInputTranscription?.text) {
          sendJson(ws, {
            type: 'input_transcript',
            text: content.interimInputTranscription.text,
            interim: true,
          });
        }

        if (content.inputTranscription?.text) {
          latestInputTranscript = content.inputTranscription.text;
          sendJson(ws, {
            type: 'input_transcript',
            text: content.inputTranscription.text,
            interim: false,
          });
        }

        if (content.outputTranscription?.text) {
          sendJson(ws, {
            type: 'output_transcript',
            text: content.outputTranscription.text,
          });
        }

        const parts = content.modelTurn?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (part?.text) {
              sendJson(ws, { type: 'model_text', text: part.text });
            }
            if (part?.inlineData?.data) {
              sendJson(ws, {
                type: 'audio',
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
              });
            }
          }
        }

        if (content.turnComplete || content.generationComplete) {
          sendJson(ws, { type: 'turn_complete' });
        }
      }

      const functionCalls = message.toolCall?.functionCalls;
      if (Array.isArray(functionCalls) && functionCalls.length > 0) {
        const mappedRaw = functionCalls.map((fc) => ({
          name: fc.name,
          ...(fc.args && typeof fc.args === 'object' ? fc.args : {}),
        }));
        const resolvedCalls = resolveLiveToolCalls(mappedRaw, latestInputTranscript, []);
        if (resolvedCalls.length > 0) {
          sendJson(ws, { type: 'tool_call', calls: resolvedCalls });
        }
        if (liveSession) {
          liveSession.sendToolResponse({
            functionResponses: functionCalls.map((fc, idx) => {
              const perCall = resolveLiveToolCalls(
                [{ name: fc.name, ...(fc.args && typeof fc.args === 'object' ? fc.args : {}) }],
                latestInputTranscript,
                []
              )[0];
              return {
                id: fc.id || `fc-${idx}`,
                name: fc.name || 'unknown',
                response: {
                  result: perCall ? 'ok' : 'ignored',
                  status: perCall ? 'executed' : 'unsupported',
                  summaryPtBr: perCall?.summaryPtBr || 'Executado no estúdio.',
                },
              };
            }),
          });
        }
      }

      if (message.sessionResumptionUpdate?.newHandle) {
        sendJson(ws, {
          type: 'resumption',
          handle: message.sessionResumptionUpdate.newHandle,
          resumable: Boolean(message.sessionResumptionUpdate.resumable),
        });
      }

      if (message.goAway?.timeLeft) {
        sendJson(ws, {
          type: 'go_away',
          timeLeft: message.goAway.timeLeft,
        });
      }
    };

    const startUpstreamSession = async (msg: ClientStartMessage) => {
      if (liveSession) return;
      liveMode = msg.mode === 'transcribe' ? 'transcribe' : 'agent';
      const voiceId =
        msg.voiceId && ALLOWED_STUDIO_VOICES.has(msg.voiceId) ? msg.voiceId : 'Puck';

      const client = getLiveGenAiClient(liveMode);
      const model =
        liveMode === 'transcribe'
          ? MODEL_REGISTRY.LIVE_TRANSCRIBE_MODEL
          : MODEL_REGISTRY.LIVE_AGENT_MODEL;
      const targetAdcLocation =
        liveMode === 'agent' ? DEFAULT_VERTEX_LIVE_AGENT_LOCATION : DEFAULT_VERTEX_LOCATION;

      const config =
        liveMode === 'transcribe'
          ? {
              responseModalities: [Modality.TEXT],
              realtimeInputConfig: {
                automaticActivityDetection: { disabled: true },
              },
              inputAudioTranscription: {
                mode: AudioTranscriptionConfigMode.SMART,
                ...(msg.sourceText ? { sourceText: capText(msg.sourceText, 12_000) } : {}),
              },
            }
          : {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceId },
                },
              },
              systemInstruction: buildAgentSystemInstruction(msg.persona, msg.history),
              tools: [{ functionDeclarations: LIVE_AGENT_FUNCTION_DECLARATIONS }],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              sessionResumption: msg.resumeHandle ? { handle: msg.resumeHandle } : {},
              contextWindowCompression: {
                triggerTokens: '20000',
                slidingWindow: { targetTokens: '10000' },
              },
            };

      const callbacks = {
        onmessage: handleUpstreamMessage,
        onerror: (errEvent: unknown) => {
          console.error('[LiveWS] Upstream error:', errEvent);
          sendJson(ws, {
            type: 'error',
            message: 'Erro na conexão com Gemini Live API.',
            recoverable: true,
          });
        },
        onclose: () => {
          if (!closed) {
            sendJson(ws, { type: 'upstream_closed' });
            ws.close(1000, 'Upstream closed');
          }
        },
      };

      try {
        liveSession = await client.live.connect({
          model,
          config,
          callbacks,
        });
      } catch (connectErr: unknown) {
        const msgText = connectErr instanceof Error ? connectErr.message : String(connectErr ?? '');
        const isAuthFail =
          msgText.includes('ACCOUNT_STATE_INVALID') ||
          msgText.includes('API_KEY_INVALID') ||
          msgText.includes('UNAUTHENTICATED') ||
          msgText.includes('401');
        const adcClient = getVertexAdcClient(targetAdcLocation);
        if (isAuthFail && client !== adcClient) {
          console.warn(
            `[LiveWS] Chave API recusada (401/inativa). Alternando automaticamente para Vertex AI ADC (${targetAdcLocation})...`
          );
          liveSession = await adcClient.live.connect({
            model,
            config,
            callbacks,
          });
        } else {
          throw connectErr;
        }
      }
    };

    resetIdleTimer();

    ws.on('message', async (rawData: RawData) => {
      resetIdleTimer();
      let msg: ClientWsMessage;
      try {
        const text = typeof rawData === 'string' ? rawData : rawData.toString('utf-8');
        msg = JSON.parse(text) as ClientWsMessage;
      } catch {
        sendJson(ws, { type: 'error', message: 'Mensagem WebSocket inválida (JSON esperado).' });
        return;
      }

      try {
        if (msg.type === 'start') {
          await startUpstreamSession(msg);
          return;
        }

        if (!liveSession) {
          sendJson(ws, { type: 'error', message: 'Sessão Live ainda não iniciada.' });
          return;
        }

        if (msg.type === 'audio' && typeof msg.data === 'string' && msg.data.length > 0) {
          const mimeType = msg.mimeType || 'audio/pcm;rate=16000';
          if (!setupComplete) {
            if (preSetupAudioBuffer.length < MAX_PRE_SETUP_BUFFER_CHUNKS) {
              preSetupAudioBuffer.push({ data: msg.data, mimeType });
            }
            return;
          }
          liveSession.sendRealtimeInput({
            audio: { data: msg.data, mimeType },
          });
          return;
        }

        if (msg.type === 'text' && typeof msg.text === 'string' && msg.text.trim()) {
          liveSession.sendRealtimeInput({
            text: capText(msg.text.trim(), 4000),
          });
          return;
        }

        if (msg.type === 'audio_end') {
          if (liveMode === 'transcribe') {
            if (activityStarted) {
              liveSession.sendRealtimeInput({ activityEnd: {} });
              activityStarted = false;
            }
          } else {
            liveSession.sendRealtimeInput({ audioStreamEnd: true });
          }
        }
      } catch (err: unknown) {
        const formatted = formatGeminiError(err, 'Falha no streaming Gemini Live.');
        console.error('[LiveWS] Processing error:', formatted);
        sendJson(ws, { type: 'error', message: formatted, recoverable: false });
      }
    });

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });
}

import type { AgentPersona, LiveAgentToolCallResult } from '../types/polyglot';
import { parseApiJson } from './apiClient';
import { getAuthHeaders } from './authService';

export type LiveWsMode = 'agent' | 'transcribe';

export interface LiveWsStartConfig {
  mode: LiveWsMode;
  voiceId?: string;
  persona?: AgentPersona;
  history?: Array<{ role: string; text: string }>;
  resumeHandle?: string;
  sourceText?: string;
}

export interface LiveWsHandlers {
  onReady?: (info: { mode: LiveWsMode; model: string; sessionId?: string }) => void;
  onAudio?: (data: string, mimeType: string) => void;
  onInputTranscript?: (text: string, interim?: boolean) => void;
  onOutputTranscript?: (text: string) => void;
  onModelText?: (text: string) => void;
  onInterrupted?: () => void;
  onTurnComplete?: () => void;
  onToolCall?: (calls: LiveAgentToolCallResult[]) => void;
  onResumption?: (handle: string, resumable: boolean) => void;
  onError?: (message: string, recoverable?: boolean) => void;
  onClose?: () => void;
}

export interface LiveWsConnection {
  sendAudioChunk: (base64Pcm: string, mimeType?: string) => void;
  sendText: (text: string) => void;
  sendAudioEnd: () => void;
  close: () => void;
}

async function requestLiveTicket(): Promise<{
  ok: boolean;
  success?: boolean;
  ticket?: string;
  wsUrl?: string;
  expiresInSec?: number;
  error?: string;
}> {
  const resp = await fetch('/api/live/ticket', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({}),
  });
  return parseApiJson(resp);
}

export async function connectLiveWsSession(
  config: LiveWsStartConfig,
  handlers: LiveWsHandlers,
  connectTimeoutMs: number = 8000
): Promise<LiveWsConnection> {
  const ticketRes = await requestLiveTicket();
  if (!ticketRes.ok || !ticketRes.wsUrl) {
    throw new Error(ticketRes.error || 'Não foi possível obter ticket para Gemini Live WebSocket.');
  }

  const ws = new WebSocket(ticketRes.wsUrl);
  let settled = false;
  let closedByClient = false;

  return new Promise<LiveWsConnection>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          ws.close();
        } catch {
          // Ignore close failure
        }
        reject(new Error('Tempo limite ao iniciar sessão WebSocket Gemini Live.'));
      }
    }, connectTimeoutMs);

    const connection: LiveWsConnection = {
      sendAudioChunk: (base64Pcm, mimeType = 'audio/pcm;rate=16000') => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'audio', data: base64Pcm, mimeType }));
        }
      },
      sendText: (text) => {
        if (ws.readyState === WebSocket.OPEN && text.trim()) {
          ws.send(JSON.stringify({ type: 'text', text: text.trim() }));
        }
      },
      sendAudioEnd: () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'audio_end' }));
        }
      },
      close: () => {
        closedByClient = true;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'Client closed');
        }
      },
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'start', ...config }));
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(event.data || '{}')) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type || '');
      if (type === 'ready') {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve(connection);
        }
        handlers.onReady?.({
          mode: (msg.mode as LiveWsMode) || config.mode,
          model: String(msg.model || ''),
          sessionId: typeof msg.sessionId === 'string' ? msg.sessionId : undefined,
        });
        return;
      }

      if (type === 'audio' && typeof msg.data === 'string') {
        handlers.onAudio?.(msg.data, String(msg.mimeType || 'audio/pcm;rate=24000'));
      } else if (type === 'input_transcript' && typeof msg.text === 'string') {
        handlers.onInputTranscript?.(msg.text, Boolean(msg.interim));
      } else if (type === 'output_transcript' && typeof msg.text === 'string') {
        handlers.onOutputTranscript?.(msg.text);
      } else if (type === 'model_text' && typeof msg.text === 'string') {
        handlers.onModelText?.(msg.text);
      } else if (type === 'interrupted') {
        handlers.onInterrupted?.();
      } else if (type === 'turn_complete') {
        handlers.onTurnComplete?.();
      } else if (type === 'tool_call' && Array.isArray(msg.calls)) {
        handlers.onToolCall?.(msg.calls as LiveAgentToolCallResult[]);
      } else if (type === 'resumption' && typeof msg.handle === 'string') {
        handlers.onResumption?.(msg.handle, Boolean(msg.resumable));
      } else if (type === 'error') {
        const message = String(msg.message || 'Erro na sessão Gemini Live.');
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            ws.close();
          } catch {
            // Ignore close failure
          }
          reject(new Error(message));
          return;
        }
        handlers.onError?.(message, Boolean(msg.recoverable));
      }
    };

    ws.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error('Falha na conexão WebSocket com o servidor Gemini Live.'));
        return;
      }
      if (!closedByClient) {
        handlers.onError?.('Conexão WebSocket Gemini Live interrompida.', false);
      }
    };

    ws.onclose = () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(new Error('Conexão Gemini Live encerrada antes da inicialização.'));
        return;
      }
      handlers.onClose?.();
    };
  });
}

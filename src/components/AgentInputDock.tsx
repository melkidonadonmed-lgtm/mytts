import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { Plus } from 'lucide-react';
import { requestExtractTextJson, requestTranscribeAudio } from '../services/apiClient';
import type {
  AgentPersona,
  LiveAgentToolCallResult,
  YoutubePostLinkAction,
  YoutubeClipRange,
  YoutubeVideoMetadata,
} from '../types/polyglot';
import type { StudioRenderMode } from '../types/debate';
import {
  detectYoutubeUrl,
  hasYoutubeOrWebSearchIntent,
  inferYoutubeActionFromPrompt,
  requestYoutubeMetadata,
} from '../services/polyglotClient';
import {
  connectLiveWsSession,
  type LiveWsConnection,
  type LiveWsMode,
} from '../services/liveWsClient';
import { createLivePcmCapture, LivePcm24kPlayer, type LivePcmCaptureHandle } from '../utils/liveAudioBridge';
import { DockPlusMenu } from './polyglot/DockPlusMenu';
import { DockYoutubePreviewCard } from './polyglot/DockYoutubePreviewCard';
import { useVoiceRecorder } from './polyglot/useVoiceRecorder';

export type DockMode = 'translate' | 'live_tutor' | 'practice' | 'search_youtube';

export interface AgentInputDockSubmitPayload {
  text: string;
  dockMode: DockMode;
  persona: AgentPersona;
  youtubeUrl?: string;
  youtubeAction?: YoutubePostLinkAction;
  clipRange?: YoutubeClipRange;
  enableSearch: boolean;
  audioBase64?: string;
  mimeType?: string;
  autoSpeakReply?: boolean;
}

export interface AgentInputDockProps {
  onSendMessage: (
    text: string,
    autoPlayAfter?: boolean,
    payload?: AgentInputDockSubmitPayload
  ) => Promise<void>;
  onRecordLiveWsTurn?: (turn: {
    userTranscript: string;
    agentReplyPtBr: string;
    persona: AgentPersona;
  }) => void;
  recentHistory?: Array<{ role: string; text: string }>;
  onApplyLiveToolCalls?: (calls: LiveAgentToolCallResult[]) => void;
  onSendToCreationStudio?: (text: string, renderMode: StudioRenderMode) => void;
  isLoading: boolean;
  activeVoiceName?: string;
}

/**
 * Ícone oficial estilo Gemini Live (Estrela Gemini de 4 pontas + Ondas Acústicas Live)
 */
const GeminiLiveSymbol: React.FC<{ active?: boolean }> = ({ active = false }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={active ? 'text-emerald-300 animate-pulse' : 'text-amber-400'}
  >
    <path
      d="M4 9.5V14.5M7.2 7.5V16.5M16.8 7.5V16.5M20 9.5V14.5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <path
      d="M12 4.5C12 8.2 9.8 10.5 6.5 12C9.8 13.5 12 15.8 12 19.5C12 15.8 14.2 13.5 17.5 12C14.2 10.5 12 8.2 12 4.5Z"
      fill="currentColor"
    />
  </svg>
);

const getPersonaFromMode = (mode: DockMode): AgentPersona => {
  if (mode === 'live_tutor') return 'tutor_conversational';
  if (mode === 'practice') return 'practice_partner';
  return 'polyglot_translator';
};

const formatTimer = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const AgentInputDock: React.FC<AgentInputDockProps> = ({
  onSendMessage,
  onRecordLiveWsTurn,
  recentHistory,
  onApplyLiveToolCalls,
  onSendToCreationStudio,
  isLoading,
  activeVoiceName = 'Puck',
}) => {
  const [inputText, setInputText] = useState('');
  const [dockMode, setDockMode] = useState<DockMode>('translate');
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [isLiveApiMode, setIsLiveApiMode] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [failedThumbUrl, setFailedThumbUrl] = useState<string | null>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isCollapsedLine, setIsCollapsedLine] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);

  const [wsLiveState, setWsLiveState] = useState<'idle' | 'connecting' | 'streaming'>('idle');
  const [wsLiveMode, setWsLiveMode] = useState<LiveWsMode | null>(null);
  const [wsLiveBands, setWsLiveBands] = useState<[number, number, number, number, number]>([
    18, 28, 22, 34, 18,
  ]);
  const [liveCaption, setLiveCaption] = useState<string>('');
  const wsConnRef = useRef<LiveWsConnection | null>(null);
  const wsCaptureRef = useRef<LivePcmCaptureHandle | null>(null);
  const wsPlayerRef = useRef<LivePcm24kPlayer | null>(null);
  const wsResumeHandleRef = useRef<string | undefined>(undefined);
  const wsInputBeforeDictateRef = useRef<string>('');
  const wsDictateFinalRef = useRef<string>('');
  const liveTurnUserRef = useRef<string>('');
  const liveTurnAgentRef = useRef<string>('');
  const liveTurnPersonaRef = useRef<AgentPersona>('tutor_conversational');
  const gracefulCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onApplyToolCallsRef = useRef(onApplyLiveToolCalls);
  onApplyToolCallsRef.current = onApplyLiveToolCalls;
  const onRecordLiveWsTurnRef = useRef(onRecordLiveWsTurn);
  onRecordLiveWsTurnRef.current = onRecordLiveWsTurn;

  const detectedYoutubeUrl = useMemo(() => detectYoutubeUrl(inputText), [inputText]);
  const [previewYoutubeMeta, setPreviewYoutubeMeta] = useState<YoutubeVideoMetadata | null>(null);
  const [clipStart, setClipStart] = useState('');
  const [clipEnd, setClipEnd] = useState('');

  const {
    isRecording,
    recordingSeconds,
    isTranscribing,
    micError,
    setMicError,
    voiceBands,
    stopRecordingNow,
    toggleRecording,
  } = useVoiceRecorder({
    onAudioCaptured: async (base64Audio, mimeType, liveAutoSend) => {
      if (!liveAutoSend) {
        const res = await requestTranscribeAudio({
          audioData: base64Audio,
          mimeType,
          sourceText: inputText.trim() || undefined,
        });
        if (res.ok && res.success && res.transcript?.trim()) {
          const cleanTranscript = res.transcript.trim();
          setInputText((prev) =>
            prev.trim() ? `${prev.trim()} ${cleanTranscript}` : cleanTranscript
          );
          textareaRef.current?.focus();
        } else {
          setMicError(res.error || 'Falha ao transcrever o ditado.');
        }
        return;
      }

      const activeLiveMode: DockMode =
        dockMode === 'translate' ? 'live_tutor' : dockMode;

      await onSendMessage(inputText.trim() || 'Fala enviada por Voz Live', true, {
        text: inputText.trim() || '',
        dockMode: activeLiveMode,
        persona: getPersonaFromMode(activeLiveMode),
        enableSearch: enableWebSearch,
        audioBase64: base64Audio,
        mimeType,
        autoSpeakReply: true,
      });
      setInputText('');
    },
  });

  useEffect(() => {
    let active = true;
    if (!detectedYoutubeUrl) {
      setPreviewYoutubeMeta(null);
      return;
    }
    requestYoutubeMetadata(detectedYoutubeUrl).then((meta) => {
      if (active) setPreviewYoutubeMeta(meta);
    });
    return () => {
      active = false;
    };
  }, [detectedYoutubeUrl]);

  useEffect(() => {
    if (!isPlusMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isPlusMenuOpen]);

  const flushPendingLiveWsTurn = (): void => {
    const userText = liveTurnUserRef.current.trim();
    const agentText = liveTurnAgentRef.current.trim();
    if (!userText && !agentText) return;
    liveTurnUserRef.current = '';
    liveTurnAgentRef.current = '';
    onRecordLiveWsTurnRef.current?.({
      userTranscript: userText || 'Fala enviada por Gemini Live',
      agentReplyPtBr: agentText,
      persona: liveTurnPersonaRef.current,
    });
  };

  const stopWsLiveSession = (gracefulEnd: boolean = false): void => {
    if (gracefulCloseTimerRef.current) {
      clearTimeout(gracefulCloseTimerRef.current);
      gracefulCloseTimerRef.current = null;
    }
    try {
      wsCaptureRef.current?.stop();
    } catch {
      // Ignore capture stop failure
    }
    wsCaptureRef.current = null;

    if (wsLiveMode === 'agent') {
      flushPendingLiveWsTurn();
    }

    if (gracefulEnd && wsConnRef.current) {
      try {
        wsConnRef.current.sendAudioEnd();
      } catch {
        // Ignore end signal failure
      }
      const connToClose = wsConnRef.current;
      gracefulCloseTimerRef.current = setTimeout(() => {
        gracefulCloseTimerRef.current = null;
        try {
          connToClose.close();
        } catch {
          // Ignore close error
        }
      }, 900);
    } else if (wsConnRef.current) {
      try {
        wsConnRef.current.close();
      } catch {
        // Ignore close error
      }
    }
    wsConnRef.current = null;
    wsPlayerRef.current?.close();
    wsPlayerRef.current = null;
    setWsLiveState('idle');
    setWsLiveMode(null);
    setIsLiveApiMode(false);
  };

  useEffect(() => {
    return () => {
      stopWsLiveSession(false);
    };
  }, []);

  const startWsOrFallbackVoice = async (mode: LiveWsMode): Promise<void> => {
    setMicError(null);
    if (wsLiveState !== 'idle') {
      stopWsLiveSession(wsLiveMode === 'transcribe');
      return;
    }

    if (isRecording) {
      stopRecordingNow();
      return;
    }

    setWsLiveState('connecting');
    setWsLiveMode(mode);
    setLiveCaption('');
    liveTurnUserRef.current = '';
    liveTurnAgentRef.current = '';
    if (mode === 'agent') {
      setIsLiveApiMode(true);
      if (dockMode === 'translate') setDockMode('live_tutor');
    } else {
      wsInputBeforeDictateRef.current = inputText.trim();
      wsDictateFinalRef.current = '';
    }

    try {
      if (mode === 'agent') {
        wsPlayerRef.current = new LivePcm24kPlayer();
      }

      const activePersona = getPersonaFromMode(
        mode === 'agent' && dockMode === 'translate' ? 'live_tutor' : dockMode
      );
      liveTurnPersonaRef.current = activePersona;

      const conn = await connectLiveWsSession(
        {
          mode,
          voiceId: activeVoiceName,
          persona: activePersona,
          history: recentHistory,
          resumeHandle: wsResumeHandleRef.current,
          sourceText: mode === 'transcribe' ? inputText.trim() || undefined : undefined,
        },
        {
          onAudio: (pcmBase64) => {
            wsPlayerRef.current?.enqueueBase64Pcm(pcmBase64);
          },
          onInputTranscript: (transcript, interim) => {
            const clean = transcript.trim();
            if (!clean) return;
            if (mode === 'transcribe') {
              if (!interim) {
                wsDictateFinalRef.current = wsDictateFinalRef.current
                  ? `${wsDictateFinalRef.current} ${clean}`
                  : clean;
              }
              const prefix = wsInputBeforeDictateRef.current;
              const combined = interim
                ? [prefix, wsDictateFinalRef.current, clean].filter(Boolean).join(' ')
                : [prefix, wsDictateFinalRef.current].filter(Boolean).join(' ');
              setInputText(combined);
            } else {
              if (!interim) {
                liveTurnUserRef.current = liveTurnUserRef.current
                  ? `${liveTurnUserRef.current} ${clean}`
                  : clean;
              }
              setLiveCaption(`Você: ${clean}`);
            }
          },
          onOutputTranscript: (transcript) => {
            const clean = transcript.trim();
            if (clean) {
              liveTurnAgentRef.current = liveTurnAgentRef.current
                ? `${liveTurnAgentRef.current} ${clean}`
                : clean;
              setLiveCaption(`${activeVoiceName}: ${clean}`);
            }
          },
          onModelText: (textChunk) => {
            const clean = textChunk.trim();
            if (mode === 'agent' && clean && !liveTurnAgentRef.current) {
              liveTurnAgentRef.current = clean;
            }
          },
          onTurnComplete: () => {
            if (mode === 'agent') {
              flushPendingLiveWsTurn();
            }
          },
          onInterrupted: () => {
            wsPlayerRef.current?.clearQueue();
          },
          onToolCall: (calls) => {
            onApplyToolCallsRef.current?.(calls);
          },
          onResumption: (handle, resumable) => {
            if (resumable && handle) {
              wsResumeHandleRef.current = handle;
            }
          },
          onError: (msg) => {
            setMicError(msg);
          },
          onClose: () => {
            if (mode === 'agent') {
              flushPendingLiveWsTurn();
            }
            wsCaptureRef.current?.stop();
            wsCaptureRef.current = null;
            wsPlayerRef.current?.close();
            wsPlayerRef.current = null;
            wsConnRef.current = null;
            setWsLiveState('idle');
            setWsLiveMode(null);
            setIsLiveApiMode(false);
          },
        }
      );

      wsConnRef.current = conn;
      const capture = await createLivePcmCapture({
        onPcmChunk: (base64Pcm) => {
          conn.sendAudioChunk(base64Pcm, 'audio/pcm;rate=16000');
        },
        onLevelBands: (bands) => {
          setWsLiveBands(bands);
        },
      });
      wsCaptureRef.current = capture;
      setWsLiveState('streaming');
    } catch (wsErr: unknown) {
      console.warn(
        '[LiveWS] Fallback to HTTP recording mode:',
        wsErr instanceof Error ? wsErr.message : String(wsErr)
      );
      stopWsLiveSession(false);
      if (mode === 'agent') {
        setIsLiveApiMode(true);
      }
      await toggleRecording(mode === 'agent');
    }
  };

  const submitPromptWithPayload = async (
    overrideText?: string,
    overrideMode?: DockMode,
    overrideYoutubeAction?: YoutubePostLinkAction
  ): Promise<void> => {
    const textToSend = (overrideText ?? inputText).trim();
    if (!textToSend || isLoading || isTranscribing) return;

    const autoSearchIntent = hasYoutubeOrWebSearchIntent(textToSend);

    if (
      wsLiveState === 'streaming' &&
      wsLiveMode === 'agent' &&
      wsConnRef.current &&
      !detectedYoutubeUrl &&
      !autoSearchIntent &&
      !enableWebSearch &&
      !overrideYoutubeAction
    ) {
      liveTurnUserRef.current = textToSend;
      wsConnRef.current.sendText(textToSend);
      setLiveCaption(`Você: ${textToSend}`);
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }
    const effectiveMode: DockMode =
      detectedYoutubeUrl || autoSearchIntent
        ? 'search_youtube'
        : overrideMode ?? (enableWebSearch ? 'search_youtube' : dockMode);

    const resolvedYtAction: YoutubePostLinkAction | undefined = detectedYoutubeUrl
      ? overrideYoutubeAction || inferYoutubeActionFromPrompt(textToSend)
      : undefined;

    const resolvedClipRange: YoutubeClipRange | undefined =
      clipStart.trim() || clipEnd.trim()
        ? { start: clipStart.trim() || undefined, end: clipEnd.trim() || undefined }
        : undefined;

    const shouldAutoPlay =
      isLiveApiMode || effectiveMode === 'live_tutor' || effectiveMode === 'practice';

    setInputText('');
    setAttachedFileName(null);
    setClipStart('');
    setClipEnd('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSendMessage(textToSend, shouldAutoPlay, {
      text: textToSend,
      dockMode: effectiveMode,
      persona: getPersonaFromMode(effectiveMode),
      youtubeUrl: detectedYoutubeUrl || undefined,
      youtubeAction: resolvedYtAction,
      clipRange: resolvedClipRange,
      enableSearch: effectiveMode === 'search_youtube' || enableWebSearch || autoSearchIntent,
      autoSpeakReply: shouldAutoPlay,
    });
  };

  const handleSubmit = async (e?: React.FormEvent): Promise<void> => {
    if (e) e.preventDefault();
    await submitPromptWithPayload();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFileName(file.name);
    setFileError(null);
    setIsPlusMenuOpen(false);

    if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setInputText((prev) => (prev ? `${prev}\n\n${content}` : content));
        }
      };
      reader.onerror = () => {
        setFileError('Não foi possível ler o arquivo de texto selecionado.');
      };
      reader.readAsText(file);
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string)?.split(',')[1];
        if (!base64Data) {
          setFileError('Não foi possível ler o PDF selecionado.');
          return;
        }
        try {
          const data = await requestExtractTextJson({
            fileData: base64Data,
            mimeType: 'application/pdf',
            fileName: file.name,
          });
          if (data.ok && data.success && data.text) {
            setInputText((prev) => (prev ? `${prev}\n\n${data.text}` : data.text!));
          } else {
            setFileError(data.error || 'Falha ao extrair texto do PDF.');
          }
        } catch (err: unknown) {
          console.error('Falha ao extrair texto do PDF:', err);
          setFileError('Falha ao extrair texto do PDF. Tente outro arquivo.');
        }
      };
      reader.onerror = () => {
        setFileError('Não foi possível carregar o arquivo PDF.');
      };
      reader.readAsDataURL(file);
    }
  };

  const activeServiceLabel = useMemo(() => {
    if (detectedYoutubeUrl) return 'YouTube';
    if (enableWebSearch || dockMode === 'search_youtube') return 'Busca Web';
    if (dockMode === 'live_tutor') return 'Tutor Live';
    if (dockMode === 'practice') return 'Parceiro';
    return '3 Idiomas';
  }, [dockMode, enableWebSearch, detectedYoutubeUrl]);

  // MODO LINHA ANIMADA COLAPSADA
  if (isCollapsedLine) {
    return (
      <div className="sticky bottom-3 z-30 w-full max-w-2xl mx-auto px-4">
        <div className="card-matte rounded-full px-4 py-2 shadow-2xl flex items-center justify-between gap-3 border border-[var(--border-control)]">
          <button
            type="button"
            onClick={() => setIsCollapsedLine(false)}
            className="min-h-11 flex-1 flex items-center gap-3 text-left cursor-pointer min-w-0"
            title="Expandir Pílula de Chat"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div className="flex-1 h-1.5 rounded-full surface-inset overflow-hidden">
              <div className="h-full w-2/3 bg-gradient-to-r from-amber-500 via-emerald-400 to-amber-300 animate-pulse rounded-full" />
            </div>
            <span className="text-xs font-bold text-primary font-display truncate">
              Abrir Pílula de Chat ({activeServiceLabel} · {activeVoiceName})
            </span>
          </button>

          <button
            type="button"
            aria-label="Gemini Live"
            onClick={() => {
              setIsCollapsedLine(false);
              void startWsOrFallbackVoice('agent');
            }}
            className="min-h-11 min-w-11 h-11 w-11 rounded-full btn-matte-dark flex items-center justify-center cursor-pointer shrink-0"
            title="Iniciar conversa por voz no Gemini Live"
          >
            <GeminiLiveSymbol active={isLiveApiMode || isRecording || wsLiveState !== 'idle'} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-state={isRecording ? 'pressed' : isLoading || isTranscribing ? 'loading' : 'idle'}
      aria-busy={isLoading || isTranscribing}
      className="sticky bottom-3 z-30 w-full max-w-4xl mx-auto px-3 sm:px-5"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.25rem)' }}
    >
      <div className="relative flex flex-col gap-2" ref={plusMenuRef}>
        {isPlusMenuOpen && (
          <DockPlusMenu
            dockMode={dockMode}
            enableWebSearch={enableWebSearch}
            hasInputText={Boolean(inputText.trim())}
            onSendToCreationStudio={
              onSendToCreationStudio
                ? (renderMode) => {
                    setIsPlusMenuOpen(false);
                    onSendToCreationStudio(inputText.trim(), renderMode);
                  }
                : undefined
            }
            onSelectTranslate={() => {
              setDockMode('translate');
              setEnableWebSearch(false);
              setIsLiveApiMode(false);
              setIsPlusMenuOpen(false);
            }}
            onSelectLiveTutor={() => {
              setDockMode('live_tutor');
              setIsLiveApiMode(true);
              setIsPlusMenuOpen(false);
            }}
            onSelectPractice={() => {
              setDockMode('practice');
              setIsLiveApiMode(true);
              setIsPlusMenuOpen(false);
            }}
            onSelectSearchYoutube={() => {
              setEnableWebSearch(true);
              setDockMode('search_youtube');
              setIsPlusMenuOpen(false);
            }}
            onTriggerFilePicker={() => fileInputRef.current?.click()}
          />
        )}

        {detectedYoutubeUrl && (
          <DockYoutubePreviewCard
            detectedYoutubeUrl={detectedYoutubeUrl}
            previewYoutubeMeta={previewYoutubeMeta}
            failedThumbUrl={failedThumbUrl}
            onThumbError={(url) => setFailedThumbUrl(url)}
            clipStart={clipStart}
            clipEnd={clipEnd}
            onClipStartChange={setClipStart}
            onClipEndChange={setClipEnd}
            onSubmitAction={(text, mode, action) => {
              void submitPromptWithPayload(text, mode, action);
            }}
            onSendToCreationStudio={onSendToCreationStudio}
          />
        )}

        {(isLiveApiMode || isRecording || isTranscribing || wsLiveState !== 'idle' || micError) && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-full card-matte border border-emerald-500/30 text-xs shadow-lg">
            <div className="flex items-center gap-2.5 min-w-0">
              {isRecording || wsLiveState === 'streaming' ? (
                <div className="flex items-end gap-0.5 h-3.5 px-1" aria-hidden="true">
                  {(wsLiveState === 'streaming' ? wsLiveBands : voiceBands).map((b, i) => (
                    <span
                      key={i}
                      style={{ height: `${Math.max(25, b)}%` }}
                      className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                    />
                  ))}
                </div>
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <span className="font-bold text-primary text-[11px] sm:text-xs tabular-nums truncate max-w-[420px]">
                {wsLiveState === 'connecting'
                  ? 'Conectando Gemini Live WebSocket...'
                  : wsLiveState === 'streaming'
                  ? liveCaption ||
                    (wsLiveMode === 'transcribe'
                      ? 'Ditado em tempo real (SMART)... clique no mic para concluir'
                      : `Gemini Live Stream (${activeVoiceName}) · Fale naturalmente`)
                  : isRecording
                  ? `Ouvindo (${formatTimer(recordingSeconds)}) · Envia ao pausar`
                  : isTranscribing
                  ? 'Gemini processando áudio...'
                  : `Gemini Live Ativo (${activeVoiceName})`}
              </span>
              {micError && <span className="text-rose-400 font-medium">· {micError}</span>}
            </div>
            {(isLiveApiMode || wsLiveState !== 'idle') && !isRecording && (
              <button
                type="button"
                onClick={() => {
                  stopWsLiveSession(false);
                  setMicError(null);
                }}
                className="min-h-11 text-secondary hover:text-primary text-[11px] font-mono px-2.5 cursor-pointer"
              >
                fechar
              </button>
            )}
          </div>
        )}

        {fileError && (
          <p role="alert" className="text-xs font-medium text-rose-400 px-2 pb-1">
            {fileError}
          </p>
        )}

        {/* COMPOSITOR FLEX BAR */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-1.5 card-matte rounded-2xl sm:rounded-3xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xl border border-[var(--border-control)] focus-within:border-amber-400/60 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all"
        >
          <input
            id="dock-file-upload"
            name="attachment"
            aria-label="Selecionar arquivo para anexar"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".txt,.md,.pdf"
            className="hidden"
          />

          <div className="w-full flex items-center gap-1.5 min-w-0">
            <textarea
              id="dock-prompt-textarea"
              name="prompt"
              aria-label="Mensagem, pergunta ou link do YouTube"
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Digite, cole link do YouTube ou use +..."
              rows={1}
              disabled={isLoading}
              className="dock-composer-textarea w-full bg-transparent border-0 text-primary placeholder-slate-400 text-[13px] sm:text-sm focus:ring-0 focus:outline-none resize-none py-1 px-0.5 max-h-32 min-h-[30px] leading-snug no-scrollbar"
            />
            {attachedFileName && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono surface-inset border border-[var(--border-subtle)] text-primary px-2.5 py-0.5 rounded-full truncate max-w-[140px] shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)] shrink-0" aria-hidden="true" />
                <span className="truncate">{attachedFileName}</span>
              </span>
            )}
            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  if (textareaRef.current) textareaRef.current.style.height = 'auto';
                }}
                className="btn-compact-touch min-h-11 min-w-11 text-secondary hover:text-primary flex items-center justify-center rounded-full shrink-0 cursor-pointer"
                title="Limpar texto"
                aria-label="Limpar texto"
              >
                <GoogleIcon name="close" size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                aria-expanded={isPlusMenuOpen}
                aria-label="Abrir menu de serviços e Estúdio de Criação"
                onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                title="Adicionar ao Estúdio de Criação (Debate, Podcast, Bar, Jantar), trocar serviço ou anexar arquivo"
                className={`min-h-11 min-w-11 h-11 w-11 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                  isPlusMenuOpen
                    ? 'btn-matte-amber text-white rotate-45'
                    : 'btn-matte-dark text-primary hover:border-amber-400/50'
                }`}
              >
                <Plus className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                className="btn-compact-touch inline-flex items-center gap-1 min-h-11 px-3.5 rounded-full surface-inset border border-[var(--border-subtle)] text-[11px] font-bold text-amber-300 hover:text-primary shrink-0 cursor-pointer transition-colors"
                title="Serviço ativo (toque para mudar ou enviar ao Estúdio de Criação)"
              >
                <span className="truncate max-w-[110px] sm:max-w-none">{activeServiceLabel}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                aria-pressed={(isRecording && !isLiveApiMode) || wsLiveMode === 'transcribe'}
                onClick={() => void startWsOrFallbackVoice('transcribe')}
                title="Ditar pelo microfone"
                aria-label="Ditar pelo microfone"
                className={`min-h-11 min-w-11 h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                  (isRecording && !isLiveApiMode) || wsLiveMode === 'transcribe'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : 'btn-matte-dark text-secondary hover:text-primary'
                }`}
              >
                <GoogleIcon name="mic" size={18} />
              </button>

              <button
                type="button"
                aria-label="Ativar Gemini Live por voz"
                aria-pressed={isLiveApiMode || wsLiveMode === 'agent'}
                onClick={() => void startWsOrFallbackVoice('agent')}
                title="Gemini Live (Conversa por voz em tempo real com WebSocket e detecção de fala)"
                className={`min-h-11 min-w-11 h-11 w-11 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer border ${
                  isLiveApiMode || wsLiveMode === 'agent'
                    ? 'bg-emerald-500/20 border-emerald-400/60 shadow-md ring-2 ring-emerald-400/30'
                    : 'btn-matte-dark border-[var(--border-subtle)] hover:border-amber-400/50'
                }`}
              >
                <GeminiLiveSymbol active={isLiveApiMode || isRecording || wsLiveState !== 'idle'} />
              </button>

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                title="Enviar mensagem (Enter)"
                className="btn-matte-amber min-h-11 h-11 px-4 rounded-full text-xs font-bold text-white shrink-0 disabled:opacity-45 transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                {isLoading ? (
                  <GoogleIcon name="progress_activity" size={18} className="animate-spin text-white" />
                ) : (
                  <>
                    <GoogleIcon name="arrow_upward" size={18} className="text-white" />
                    <span className="hidden sm:inline">
                      {detectedYoutubeUrl
                        ? 'Vídeo'
                        : enableWebSearch || dockMode === 'search_youtube'
                        ? 'Buscar'
                        : 'Enviar'}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsCollapsedLine(true)}
                title="Recolher Pílula de Chat para Linha Animada"
                aria-label="Recolher Pílula de Chat para Linha Animada"
                className="btn-compact-touch min-h-11 min-w-11 h-11 w-11 rounded-full text-secondary hover:text-primary flex items-center justify-center shrink-0 cursor-pointer"
              >
                <GoogleIcon name="minimize" size={16} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

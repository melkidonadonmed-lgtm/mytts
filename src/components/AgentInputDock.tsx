import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { Globe, Video, Sparkles, Radio, Plus, Headphones } from 'lucide-react';
import { requestExtractTextJson } from '../services/apiClient';
import type { AgentPersona } from '../types/polyglot';
import type { StudioRenderMode } from '../types/debate';
import { detectYoutubeUrl } from '../services/polyglotClient';
import { startLiveVoiceMonitor, LiveVoiceMonitorHandle } from '../utils/liveVoiceMonitor';

export type DockMode = 'translate' | 'live_tutor' | 'practice' | 'search_youtube';

export interface AgentInputDockSubmitPayload {
  text: string;
  dockMode: DockMode;
  persona: AgentPersona;
  youtubeUrl?: string;
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
    {/* Ondas acústicas laterais do Gemini Live */}
    <path
      d="M4 9.5V14.5M7.2 7.5V16.5M16.8 7.5V16.5M20 9.5V14.5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    {/* Estrela central de 4 pontas do Gemini */}
    <path
      d="M12 4.5C12 8.2 9.8 10.5 6.5 12C9.8 13.5 12 15.8 12 19.5C12 15.8 14.2 13.5 17.5 12C14.2 10.5 12 8.2 12 4.5Z"
      fill="currentColor"
    />
  </svg>
);

export const AgentInputDock: React.FC<AgentInputDockProps> = ({
  onSendMessage,
  onSendToCreationStudio,
  isLoading,
  activeVoiceName = 'Puck',
}) => {
  const [inputText, setInputText] = useState('');
  const [dockMode, setDockMode] = useState<DockMode>('translate');
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLiveApiMode, setIsLiveApiMode] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isCollapsedLine, setIsCollapsedLine] = useState(false);
  const [voiceBands, setVoiceBands] = useState<[number, number, number, number, number]>([
    18, 28, 22, 34, 18,
  ]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceMonitorRef = useRef<LiveVoiceMonitorHandle | null>(null);

  const detectedYoutubeUrl = useMemo(() => detectYoutubeUrl(inputText), [inputText]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      voiceMonitorRef.current?.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Fecha o menu "+" ao clicar fora
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

  const formatTimer = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getPersonaFromMode = (mode: DockMode): AgentPersona => {
    if (mode === 'live_tutor') return 'tutor_conversational';
    if (mode === 'practice') return 'practice_partner';
    return 'polyglot_translator';
  };

  const submitPromptWithPayload = async (
    overrideText?: string,
    overrideMode?: DockMode
  ): Promise<void> => {
    const textToSend = (overrideText ?? inputText).trim();
    if (!textToSend || isLoading || isTranscribing) return;

    const effectiveMode: DockMode = detectedYoutubeUrl
      ? 'search_youtube'
      : overrideMode ?? (enableWebSearch ? 'search_youtube' : dockMode);

    const shouldAutoPlay =
      isLiveApiMode || effectiveMode === 'live_tutor' || effectiveMode === 'practice';

    setInputText('');
    setAttachedFileName(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSendMessage(textToSend, shouldAutoPlay, {
      text: textToSend,
      dockMode: effectiveMode,
      persona: getPersonaFromMode(effectiveMode),
      youtubeUrl: detectedYoutubeUrl || undefined,
      enableSearch: effectiveMode === 'search_youtube' || enableWebSearch,
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
      handleSubmit();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFileName(file.name);
    setIsPlusMenuOpen(false);

    if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setInputText((prev) => (prev ? `${prev}\n\n${content}` : content));
        }
      };
      reader.readAsText(file);
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string)?.split(',')[1];
        if (!base64Data) return;
        try {
          const data = await requestExtractTextJson({
            fileData: base64Data,
            mimeType: 'application/pdf',
            fileName: file.name,
          });
          if (data.ok && data.success && data.text) {
            setInputText((prev) => (prev ? `${prev}\n\n${data.text}` : data.text!));
          }
        } catch (err: unknown) {
          console.error('Falha ao extrair texto do PDF:', err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const stopRecordingNow = (): void => {
    if (timerRef.current) clearInterval(timerRef.current);
    voiceMonitorRef.current?.stop();
    voiceMonitorRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleRecording = async (liveAutoSend = isLiveApiMode): Promise<void> => {
    setMicError(null);
    if (isRecording) {
      stopRecordingNow();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      setRecordingSeconds(0);
      const mimeType =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      voiceMonitorRef.current = startLiveVoiceMonitor({
        stream,
        speechThreshold: 0.022,
        silenceDurationMs: 1650,
        onLevelChange: (_level, bands) => {
          setVoiceBands(bands);
        },
        onSilenceAfterSpeech: () => {
          stopRecordingNow();
        },
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        voiceMonitorRef.current?.stop();
        voiceMonitorRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size === 0) return;

        try {
          setIsTranscribing(true);
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Audio = (reader.result as string)?.split(',')[1];
              if (!base64Audio) return;

              const activeLiveMode: DockMode =
                dockMode === 'translate' && liveAutoSend ? 'live_tutor' : dockMode;

              await onSendMessage(
                inputText.trim() || 'Fala enviada por Voz Live',
                true,
                {
                  text: inputText.trim() || '',
                  dockMode: activeLiveMode,
                  persona: getPersonaFromMode(activeLiveMode),
                  enableSearch: enableWebSearch,
                  audioBase64: base64Audio,
                  mimeType,
                  autoSpeakReply: true,
                }
              );
              setInputText('');
            } catch (innerErr: unknown) {
              console.error('Erro no envio de voz Live:', innerErr);
              setMicError('Erro ao processar áudio com o Agente Live.');
            } finally {
              setIsTranscribing(false);
            }
          };
          reader.readAsDataURL(audioBlob);
        } catch (err: unknown) {
          console.error('Erro na gravação Live:', err);
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.warn('Microfone indisponível ou permissão negada:', err);
      setMicError('Autorize o microfone no navegador para usar o ditado e o modo Live API.');
      setIsRecording(false);
    }
  };

  const activeServiceLabel = useMemo(() => {
    if (detectedYoutubeUrl) return 'YouTube';
    if (enableWebSearch || dockMode === 'search_youtube') return 'Busca Web';
    if (dockMode === 'live_tutor') return 'Tutor Live';
    if (dockMode === 'practice') return 'Parceiro';
    return '3 Idiomas';
  }, [dockMode, enableWebSearch, detectedYoutubeUrl]);

  const studioRenderServices: { id: StudioRenderMode; label: string; icon: string; desc: string }[] = [
    { id: 'solo', label: 'Leitura Solo', icon: 'headphones', desc: 'Narração 1 voz no Estúdio' },
    { id: 'debate', label: 'Debate Dialético', icon: 'forum', desc: '2 vozes em embate de ideias' },
    { id: 'podcast', label: 'Podcast de Estúdio', icon: 'podcasts', desc: '2 hosts conversando' },
    { id: 'bar_chat', label: 'Conversa de Bar', icon: 'local_cafe', desc: 'Papo descontraído entre amigos' },
    { id: 'dinner', label: 'Mesa de Jantar', icon: 'restaurant', desc: 'Conversa acolhedora em família' },
  ];

  // MODO LINHA ANIMADA COLAPSADA (Pílula mínima flutuante)
  if (isCollapsedLine) {
    return (
      <div className="sticky bottom-3 z-30 w-full max-w-2xl mx-auto px-4">
        <div className="card-matte rounded-full px-4 py-2 shadow-2xl flex items-center justify-between gap-3 border border-amber-400/30">
          <button
            type="button"
            onClick={() => setIsCollapsedLine(false)}
            className="flex-1 flex items-center gap-3 text-left cursor-pointer min-w-0"
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
              setIsLiveApiMode(true);
              toggleRecording(true);
            }}
            className="h-8 w-8 rounded-full btn-matte-dark flex items-center justify-center cursor-pointer shrink-0"
            title="Iniciar conversa por voz no Gemini Live"
          >
            <GeminiLiveSymbol active={isLiveApiMode || isRecording} />
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
        {/* POPOVER DO BOTÃO "+" ESTILO CHAT LLM (Serviços do Chat + Enviar para Estúdio de Criação) */}
        {isPlusMenuOpen && (
          <div
            role="menu"
            aria-label="Selecionar serviço do chat ou enviar para o Estúdio de Criação"
            className="absolute bottom-full left-0 mb-2.5 w-full sm:w-[420px] max-h-[72dvh] overflow-y-auto overscroll-contain rounded-2xl card-matte p-3 shadow-2xl border border-amber-400/30 z-50 flex flex-col gap-3 animate-in fade-in"
          >
            {/* Seção 1: Enviar Texto / Conversa para o Estúdio de Criação */}
            {onSendToCreationStudio && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                    <Headphones className="w-3 h-3" />
                    <span>Enviar para o Estúdio de Criação</span>
                  </span>
                  <span className="text-[10px] font-mono text-secondary">
                    {inputText.trim() ? 'Usa o texto digitado' : 'Usa a conversa atual'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {studioRenderServices.map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        onSendToCreationStudio(inputText.trim(), srv.id);
                      }}
                      className="p-2 rounded-xl btn-matte-dark hover:border-amber-400/40 text-left flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <GoogleIcon name={srv.icon} size={16} className="text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-primary block truncate">
                          {srv.label}
                        </span>
                        <span className="text-[10px] text-secondary block truncate">
                          {srv.desc}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Seção 2: Modo / Serviço do Chat LLM */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800/60">
              <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-bold px-1">
                Modo do Agente no Chat
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDockMode('translate');
                    setEnableWebSearch(false);
                    setIsLiveApiMode(false);
                    setIsPlusMenuOpen(false);
                  }}
                  className={`p-2 rounded-xl text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                    dockMode === 'translate' && !enableWebSearch
                      ? 'card-matte-active text-primary'
                      : 'btn-matte-dark text-secondary hover:text-primary'
                  }`}
                >
                  <GoogleIcon name="translate" size={15} className="text-amber-400 shrink-0" />
                  <span className="truncate">Tradução 3 Idiomas</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDockMode('live_tutor');
                    setIsLiveApiMode(true);
                    setIsPlusMenuOpen(false);
                  }}
                  className={`p-2 rounded-xl text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                    dockMode === 'live_tutor'
                      ? 'card-matte-active text-primary'
                      : 'btn-matte-dark text-secondary hover:text-primary'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Agente Tutor Live</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDockMode('practice');
                    setIsLiveApiMode(true);
                    setIsPlusMenuOpen(false);
                  }}
                  className={`p-2 rounded-xl text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                    dockMode === 'practice'
                      ? 'card-matte-active text-primary'
                      : 'btn-matte-dark text-secondary hover:text-primary'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">Parceiro de Conversa</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setEnableWebSearch(true);
                    setDockMode('search_youtube');
                    setIsPlusMenuOpen(false);
                  }}
                  className={`p-2 rounded-xl text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                    enableWebSearch || dockMode === 'search_youtube'
                      ? 'card-matte-active text-primary'
                      : 'btn-matte-dark text-secondary hover:text-primary'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Busca Web & YouTube</span>
                </button>
              </div>
            </div>

            {/* Seção 3: Anexar Documento */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
              <button
                type="button"
                role="menuitem"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-3 rounded-xl btn-matte-dark text-xs font-bold text-primary flex items-center justify-center gap-2 cursor-pointer"
              >
                <GoogleIcon name="attach_file" size={16} className="text-amber-400" />
                <span>Anexar Arquivo (PDF, TXT ou Markdown)</span>
              </button>
            </div>
          </div>
        )}

        {/* Banner Compacto de Link do YouTube ou Gravação Live Ativa */}
        {detectedYoutubeUrl && (
          <div className="rounded-2xl card-matte border border-rose-500/40 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2 min-w-0">
              <Video className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-xs font-bold text-primary truncate">
                YouTube detectado:
              </span>
              <span className="text-[11px] font-mono text-rose-300 truncate max-w-[240px]">
                {detectedYoutubeUrl}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  submitPromptWithPayload(
                    `Analise o vídeo do YouTube ${detectedYoutubeUrl} e crie uma conversa prática nos 3 idiomas baseada nele.`,
                    'search_youtube'
                  )
                }
                className="px-2.5 py-1 rounded-full btn-matte-amber text-white text-[11px] font-bold cursor-pointer"
              >
                Gerar Conversa
              </button>
              {onSendToCreationStudio && (
                <button
                  type="button"
                  onClick={() => onSendToCreationStudio(inputText.trim(), 'podcast')}
                  className="px-2.5 py-1 rounded-full btn-matte-dark text-primary text-[11px] font-semibold cursor-pointer"
                >
                  + Podcast no Estúdio
                </button>
              )}
            </div>
          </div>
        )}

        {(isLiveApiMode || isRecording || isTranscribing || micError) && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-full card-matte border border-emerald-500/30 text-xs shadow-lg">
            <div className="flex items-center gap-2.5">
              {isRecording ? (
                <div className="flex items-end gap-0.5 h-3.5 px-1" aria-hidden="true">
                  {voiceBands.map((b, i) => (
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
              <span className="font-bold text-primary text-[11px] sm:text-xs">
                {isRecording
                  ? `Ouvindo (${formatTimer(recordingSeconds)}) · Envia ao pausar`
                  : isTranscribing
                  ? 'Gemini Live processando sua voz...'
                  : `Gemini Live Ativo (${activeVoiceName})`}
              </span>
              {micError && <span className="text-rose-400 font-medium">· {micError}</span>}
            </div>
            {isLiveApiMode && !isRecording && (
              <button
                type="button"
                onClick={() => {
                  setIsLiveApiMode(false);
                  setMicError(null);
                }}
                className="text-secondary hover:text-primary text-[10px] font-mono px-2 cursor-pointer"
              >
                fechar
              </button>
            )}
          </div>
        )}

        {/* COMPOSITOR FLEX BAR (Linha 1: Texto 100% largura | Linha 2: Barra Flex de Ações com DOM Order === Visual Order) */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-1.5 card-matte rounded-2xl sm:rounded-3xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xl border border-slate-700/70 focus-within:border-amber-400/60 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all"
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

          {/* Linha 1: Campo de Texto Autoexpansível com 100% da Largura Útil */}
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
              <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full truncate max-w-[120px] shrink-0">
                {attachedFileName}
              </span>
            )}
            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  if (textareaRef.current) textareaRef.current.style.height = 'auto';
                }}
                className="btn-compact-touch text-secondary hover:text-primary p-1 rounded-full shrink-0 cursor-pointer"
                title="Limpar texto"
              >
                <GoogleIcon name="close" size={15} />
              </button>
            )}
          </div>

          {/* Linha 2: Flex Bar de Controles (Esquerda: + & Serviço Ativo | Direita: Mic, Gemini Live, Enviar, Recolher) */}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.08]">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* 1. Botão "+" estilo Chat LLM (Abre Serviços e Estúdio de Criação) */}
              <button
                type="button"
                aria-expanded={isPlusMenuOpen}
                aria-label="Abrir menu de serviços e Estúdio de Criação"
                onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                title="Adicionar ao Estúdio de Criação (Debate, Podcast, Bar, Jantar), trocar serviço ou anexar arquivo"
                className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                  isPlusMenuOpen
                    ? 'btn-matte-amber text-white rotate-45'
                    : 'btn-matte-dark text-primary hover:border-amber-400/50'
                }`}
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* 2. Chip do Serviço Ativo (Clicável para abrir o menu "+" no mobile e desktop) */}
              <button
                type="button"
                onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                className="btn-compact-touch inline-flex items-center gap-1 h-8 px-2.5 rounded-full surface-inset text-[11px] font-bold text-amber-300 hover:text-primary shrink-0 cursor-pointer transition-colors"
                title="Serviço ativo (toque para mudar ou enviar ao Estúdio de Criação)"
              >
                <span className="truncate max-w-[110px] sm:max-w-none">{activeServiceLabel}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* 3. Botão Microfone de Ditado */}
              <button
                type="button"
                aria-pressed={isRecording && !isLiveApiMode}
                onClick={() => toggleRecording(false)}
                title="Ditar pelo microfone"
                className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                  isRecording && !isLiveApiMode
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : 'btn-matte-dark text-secondary hover:text-primary'
                }`}
              >
                <GoogleIcon name="mic" size={18} />
              </button>

              {/* 4. Botão Gemini Live (APENAS o símbolo do Gemini Live) */}
              <button
                type="button"
                aria-label="Ativar Gemini Live por voz"
                aria-pressed={isLiveApiMode}
                onClick={() => {
                  const nextLive = !isLiveApiMode;
                  setIsLiveApiMode(nextLive);
                  if (nextLive) {
                    if (dockMode === 'translate') setDockMode('live_tutor');
                    if (!isRecording) toggleRecording(true);
                  } else if (isRecording) {
                    stopRecordingNow();
                  }
                }}
                title="Gemini Live (Conversa por voz em tempo real com detecção automática de fala)"
                className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer border ${
                  isLiveApiMode
                    ? 'bg-emerald-500/20 border-emerald-400/60 shadow-md ring-2 ring-emerald-400/30'
                    : 'btn-matte-dark hover:border-amber-400/50'
                }`}
              >
                <GeminiLiveSymbol active={isLiveApiMode || isRecording} />
              </button>

              {/* 5. Botão Enviar / Executar */}
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                title="Enviar mensagem (Enter)"
                className="btn-matte-amber h-9 sm:h-10 px-3.5 sm:px-4 rounded-full text-xs font-bold text-white shrink-0 disabled:opacity-45 transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
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

              {/* 6. Botão Colapsar para Linha Animada */}
              <button
                type="button"
                onClick={() => setIsCollapsedLine(true)}
                title="Recolher Pílula de Chat para Linha Animada"
                aria-label="Recolher Pílula de Chat para Linha Animada"
                className="btn-compact-touch h-8 w-8 rounded-full text-secondary hover:text-primary flex items-center justify-center shrink-0 cursor-pointer"
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

import React, { useState, useRef, useEffect } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { requestExtractTextJson, requestTranscribeAudio } from '../services/apiClient';

export interface AgentInputDockProps {
  onSendMessage: (text: string, autoPlayAfter?: boolean) => Promise<void>;
  isLoading: boolean;
  activeVoiceName?: string;
}

export const AgentInputDock: React.FC<AgentInputDockProps> = ({
  onSendMessage,
  isLoading,
  activeVoiceName = 'Puck',
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLiveApiMode, setIsLiveApiMode] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTimer = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e?: React.FormEvent): Promise<void> => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const textToSend = inputText.trim();
    setInputText('');
    setAttachedFileName(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(textToSend, isLiveApiMode);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
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

  // Gravação via microfone integrada no Chat (modo Ditado ou Live API com resposta falada automática)
  const toggleRecording = async (liveAutoSend = isLiveApiMode): Promise<void> => {
    setMicError(null);
    if (isRecording) {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
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

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
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
              const data = await requestTranscribeAudio({
                audioData: base64Audio,
                mimeType,
              });
              if (data.ok && data.success && data.transcript) {
                const cleanTranscript = data.transcript.trim();
                if (liveAutoSend && cleanTranscript) {
                  await onSendMessage(cleanTranscript, true);
                } else {
                  setInputText((prev) => (prev ? `${prev} ${cleanTranscript}` : cleanTranscript));
                }
              } else {
                setMicError(data.error || 'Não foi possível transcrever o áudio.');
              }
            } catch (innerErr: unknown) {
              console.error('Erro na transcrição:', innerErr);
              setMicError('Erro ao conectar ao serviço de transcrição.');
            } finally {
              setIsTranscribing(false);
            }
          };
          reader.readAsDataURL(audioBlob);
        } catch (err: unknown) {
          console.error('Erro na transcrição:', err);
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

  const quickSuggestions = [
    'Estou planejando uma viagem para o Japão e Itália',
    'Como pedir um café e a conta educadamente?',
    'Preciso de frases para uma reunião de negócios',
  ];

  return (
    <div className="sticky bottom-0 z-30 w-full dock-matte px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-2">
        
        {/* Barra Interativa Live Voice API (quando ativada pelo atalho no Chat) */}
        {(isLiveApiMode || isRecording || isTranscribing || micError) && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/75 border border-slate-800 text-xs">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isRecording
                    ? 'bg-rose-500 animate-ping'
                    : isTranscribing
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <span className="font-bold text-primary font-display">
                {isRecording
                  ? `Gravando Voz Ao Vivo (${formatTimer(recordingSeconds)})`
                  : isTranscribing
                  ? 'Gemini Live transcrevendo e alinhando 3 idiomas...'
                  : `Modo Live API Ativo · Resposta automática com voz ${activeVoiceName}`}
              </span>
              {micError && <span className="text-rose-400 font-medium">· {micError}</span>}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleRecording(true)}
                disabled={isTranscribing}
                className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  isRecording
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'btn-matte-amber text-white'
                }`}
              >
                <GoogleIcon name={isRecording ? 'stop_circle' : 'mic'} size={16} />
                <span>{isRecording ? 'Parar e Traduzir Agora' : 'Falar no Live API'}</span>
              </button>
              {isLiveApiMode && !isRecording && (
                <button
                  type="button"
                  onClick={() => {
                    setIsLiveApiMode(false);
                    setMicError(null);
                  }}
                  className="text-secondary hover:text-primary text-[11px] font-mono px-2 py-1 cursor-pointer"
                >
                  fechar live
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sugestões Rápidas (Pills Táteis) se o campo estiver vazio */}
        {!inputText && !isRecording && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-[11px] pt-1">
            <span className="font-semibold text-secondary uppercase tracking-wider text-[10px] shrink-0 font-mono select-none">
              Sugestões:
            </span>
            {quickSuggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInputText(sug)}
                className="btn-matte btn-matte-dark px-3 py-1 text-xs text-secondary hover:text-primary rounded-xl shrink-0 font-medium cursor-pointer"
                title={sug}
              >
                <span className="truncate max-w-[240px]">{sug}</span>
              </button>
            ))}
          </div>
        )}

        {/* Indicador de Arquivo Anexado */}
        {attachedFileName && (
          <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-xl w-fit">
            <GoogleIcon name="description" size={16} />
            <span className="truncate max-w-[240px] font-medium">{attachedFileName}</span>
            <button
              type="button"
              onClick={() => setAttachedFileName(null)}
              className="text-amber-400 hover:text-primary p-0.5 cursor-pointer ml-1"
            >
              <GoogleIcon name="close" size={14} />
            </button>
          </div>
        )}

        {/* Barra Central de Entrada (Com Atalho de Mic e Live API integrados) */}
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 card-matte rounded-2xl p-2 focus-within:border-amber-400/50 transition-all shadow-xl"
        >
          {/* Botão de Anexo */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".txt,.md,.pdf"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo (PDF, TXT, MD)"
            className="btn-matte btn-matte-dark h-11 w-11 rounded-xl text-secondary hover:text-primary shrink-0"
          >
            <GoogleIcon name="attach_file" size={20} />
          </button>

          {/* Botão de Ditado Rápido no Microfone */}
          <button
            type="button"
            onClick={() => toggleRecording(false)}
            title={isRecording ? 'Parar gravação e transcrever' : 'Ditar pelo microfone no chat'}
            className={`btn-matte h-11 px-3 rounded-xl shrink-0 transition-all ${
              isRecording && !isLiveApiMode
                ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                : 'btn-matte-dark text-secondary hover:text-primary'
            }`}
          >
            {isTranscribing && !isLiveApiMode ? (
              <GoogleIcon name="progress_activity" size={20} className="animate-spin text-amber-400" />
            ) : isRecording && !isLiveApiMode ? (
              <>
                <GoogleIcon name="mic_off" size={18} />
                <span className="text-[11px] font-mono tabular-nums">{formatTimer(recordingSeconds)}</span>
              </>
            ) : (
              <GoogleIcon name="mic" size={20} />
            )}
          </button>

          {/* Atalho Direto Mic Live API (Conversação & Tradução Instantânea com Voz) */}
          <button
            type="button"
            onClick={() => {
              const nextLive = !isLiveApiMode;
              setIsLiveApiMode(nextLive);
              if (nextLive && !isRecording) {
                toggleRecording(true);
              } else if (!nextLive && isRecording) {
                toggleRecording(false);
              }
            }}
            title="Atalho Mic com Live API: fale e ouça a tradução falada automaticamente"
            className={`btn-matte h-11 px-3 rounded-xl transition-all shrink-0 text-xs font-semibold border ${
              isLiveApiMode
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-sm'
                : 'btn-matte-dark text-secondary hover:text-primary'
            }`}
          >
            <GoogleIcon
              name="podcasts"
              size={18}
              className={isLiveApiMode ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}
            />
            <span className="hidden sm:inline">Live Mic</span>
          </button>

          {/* Área de Texto Autoexpansível */}
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Digite, cole um texto ou use o atalho Live Mic para alinhar em 3 idiomas..."
              rows={1}
              disabled={isLoading}
              className="w-full bg-transparent border-0 text-primary placeholder-slate-400 text-xs sm:text-sm focus:ring-0 resize-none py-2 px-1 max-h-40 min-h-[44px] leading-relaxed"
            />
            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  if (textareaRef.current) textareaRef.current.style.height = 'auto';
                }}
                className="text-secondary hover:text-primary p-1 rounded-lg text-xs shrink-0 cursor-pointer transition-colors"
                title="Limpar texto digitado"
              >
                <GoogleIcon name="close" size={16} />
              </button>
            )}
          </div>

          {/* Botão Enviar / Traduzir (Único CTA Primário Sólido) */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="btn-matte btn-matte-amber h-11 px-4 rounded-xl text-xs font-bold text-white shrink-0 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
          >
            {isLoading ? (
              <>
                <GoogleIcon name="progress_activity" size={18} className="animate-spin text-white" />
                <span className="hidden sm:inline">Alinhando...</span>
              </>
            ) : (
              <>
                <GoogleIcon name="auto_awesome" size={18} filled className="text-white" />
                <span className="hidden sm:inline">Traduzir Chunks</span>
              </>
            )}
          </button>
        </form>

        {/* Rodapé Sutil de Atalho */}
        <div className="flex items-center justify-between px-2 text-[10px] font-mono tabular-nums text-secondary">
          <span className="hidden sm:inline">
            Enter para traduzir · Shift+Enter para nova linha · Live Mic para voz direta
          </span>
          {inputText && (
            <span className="text-primary font-medium">
              {inputText.trim().split(/\s+/).filter(Boolean).length} palavras · {inputText.length} caracteres
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { GoogleIcon } from './GoogleIcon';

export interface AgentInputDockProps {
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  onOpenLive?: () => void;
}

export const AgentInputDock: React.FC<AgentInputDockProps> = ({
  onSendMessage,
  isLoading,
  onOpenLive,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Submissão do texto
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const textToSend = inputText.trim();
    setInputText('');
    setAttachedFileName(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(textToSend);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  // Tecla Enter para envio (Shift+Enter para quebra de linha)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Upload e leitura de arquivos (PDF, TXT, MD)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    } else if (file.type === 'application/pdf') {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/extract-text', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success && data.text) {
          setInputText((prev) => (prev ? `${prev}\n\n${data.text}` : data.text));
        }
      } catch (err) {
        console.error('Falha ao extrair texto do PDF:', err);
      }
    }
  };

  // Gravação via microfone com transcrição inteligente (Gemini 3.8 Flash)
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          setIsTranscribing(true);
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            const resp = await fetch('/api/transcribe-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioData: base64Audio, mimeType: 'audio/webm' }),
            });
            const data = await resp.json();
            if (data.success && data.transcript) {
              setInputText((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
            }
            setIsTranscribing(false);
          };
          reader.readAsDataURL(audioBlob);
        } catch (err) {
          console.error('Erro na transcrição:', err);
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.warn('Microfone indisponível ou permissão negada:', err);
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
        
        {/* Sugestões Rápidas (Pills Táteis) se o campo estiver vazio */}
        {!inputText && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-[11px] pt-1">
            <span className="font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px] shrink-0 font-mono select-none">
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
                <span className="truncate max-w-[260px]">{sug}</span>
              </button>
            ))}
          </div>
        )}

        {/* Indicador de Arquivo Anexado */}
        {attachedFileName && (
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-xl w-fit">
            <GoogleIcon name="description" size={16} />
            <span className="truncate max-w-[220px] font-medium">{attachedFileName}</span>
            <button
              type="button"
              onClick={() => setAttachedFileName(null)}
              className="text-amber-600 dark:text-amber-400 hover:text-primary p-0.5 cursor-pointer ml-1"
            >
              <GoogleIcon name="close" size={14} />
            </button>
          </div>
        )}

        {/* Barra Central de Entrada (Design Matte Sofisticado) */}
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
            className="btn-matte btn-matte-dark h-10 w-10 rounded-xl text-secondary hover:text-primary shrink-0"
          >
            <GoogleIcon name="attach_file" size={20} />
          </button>

          {/* Botão de Microfone */}
          <button
            type="button"
            onClick={toggleRecording}
            title={isRecording ? 'Parar gravação' : 'Falar pelo microfone'}
            className={`btn-matte h-10 w-10 rounded-xl shrink-0 transition-all ${
              isRecording
                ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                : 'btn-matte btn-matte-dark text-secondary hover:text-primary'
            }`}
          >
            {isTranscribing ? (
              <GoogleIcon name="progress_activity" size={20} className="animate-spin text-amber-400" />
            ) : isRecording ? (
              <GoogleIcon name="mic_off" size={20} />
            ) : (
              <GoogleIcon name="mic" size={20} />
            )}
          </button>

          {/* Botão Gemini Live (se ativo) */}
          {onOpenLive && (
            <button
              type="button"
              onClick={onOpenLive}
              title="Abrir sessão de voz bidirecional (Gemini Live)"
              className="btn-matte h-10 px-3 rounded-xl text-emerald-700 dark:text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 hover:bg-emerald-400/20 transition-all shrink-0 hidden sm:inline-flex text-xs font-semibold"
            >
              <GoogleIcon name="podcasts" size={18} className="animate-pulse" />
              <span>Live</span>
            </button>
          )}

          {/* Área de Texto Autoexpansível */}
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Digite, cole um texto ou fale pelo microfone para alinhar em 3 idiomas..."
              rows={1}
              disabled={isLoading}
              className="w-full bg-transparent border-0 text-primary placeholder-slate-500 text-xs sm:text-sm focus:ring-0 resize-none py-2 px-1 max-h-40 min-h-[38px] leading-relaxed"
            />
            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  if (textareaRef.current) textareaRef.current.style.height = 'auto';
                }}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 rounded-lg text-xs shrink-0 cursor-pointer transition-colors"
                title="Limpar texto digitado"
              >
                <GoogleIcon name="close" size={16} />
              </button>
            )}
          </div>

          {/* Botão Enviar / Traduzir */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="btn-matte btn-matte-amber h-10 px-4 rounded-xl text-xs font-bold text-white shrink-0 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
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
        <div className="flex items-center justify-between px-2 text-[10px] font-mono text-slate-600 dark:text-slate-500">
          <span className="hidden sm:inline">Pressione Enter para traduzir ou Shift + Enter para quebra de linha</span>
          {inputText && (
            <span className="text-slate-700 dark:text-slate-400 font-medium">
              {inputText.trim().split(/\s+/).filter(Boolean).length} palavras · {inputText.length} caracteres
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

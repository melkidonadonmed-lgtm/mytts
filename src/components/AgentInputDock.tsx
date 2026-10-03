import React, { useState, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  Mic, 
  MicOff, 
  Radio, 
  Sparkles, 
  Loader2, 
  FileText,
  X 
} from 'lucide-react';

interface AgentInputDockProps {
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Submissão do texto
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const textToSend = inputText.trim();
    setInputText('');
    setAttachedFileName(null);
    await onSendMessage(textToSend);
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
        
        // Transcrever áudio via backend Gemini 3.8
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
    'Como pedir um café e uma conta educadamente?',
    'Estou participando de uma reunião de trabalho importante',
  ];

  return (
    <div className="sticky bottom-0 z-20 w-full bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-xl px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
        
        {/* Sugestões Rápidas (Pills) se o campo estiver vazio */}
        {!inputText && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-[11px] text-slate-400">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] shrink-0">
              Ideias:
            </span>
            {quickSuggestions.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => setInputText(sug)}
                className="shrink-0 bg-slate-900/90 border border-slate-800 hover:border-amber-400/50 hover:text-amber-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer truncate max-w-[280px]"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {/* Indicador de Arquivo Anexado */}
        {attachedFileName && (
          <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-lg w-fit">
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate max-w-[200px]">{attachedFileName}</span>
            <button
              onClick={() => setAttachedFileName(null)}
              className="text-amber-400 hover:text-white ml-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Barra Central de Entrada (Design Matte Sólido) */}
        <form onSubmit={handleSubmit} className="flex items-end gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-2 focus-within:border-amber-400/70 transition-colors shadow-lg shadow-black/20">
          
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
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Botão de Gravação de Voz */}
          <button
            type="button"
            onClick={toggleRecording}
            title={isRecording ? 'Parar gravação' : 'Falar pelo microfone'}
            className={`p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              isRecording
                ? 'bg-rose-500 text-white animate-pulse'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : isRecording ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Botão Gemini Live (Fase 2) */}
          {onOpenLive && (
            <button
              type="button"
              onClick={onOpenLive}
              title="Abrir sessão de voz bidirecional (Gemini Live)"
              className="p-2.5 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 transition-colors cursor-pointer shrink-0 hidden sm:flex items-center gap-1.5 text-xs font-semibold"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="text-[11px] font-mono">Live</span>
            </button>
          )}

          {/* Área de Texto Autoexpansível */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite, cole um texto ou fale pelo microfone para estudar em 3 idiomas..."
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent border-0 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:ring-0 resize-none py-2 px-1 max-h-32 min-h-[38px] leading-relaxed"
          />

          {/* Botão Enviar / Gerar Chunks */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="min-h-[40px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/10 cursor-pointer shrink-0 active:scale-95"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Processando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-current" />
                <span className="hidden sm:inline">Traduzir Chunks</span>
                <Send className="w-3.5 h-3.5 sm:hidden" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

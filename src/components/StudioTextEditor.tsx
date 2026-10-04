import React, { useRef, useState } from 'react';
import {
  Clipboard,
  UploadCloud,
  Mic,
  MicOff,
  Trash2,
  Clock,
  BookOpen,
  FileCheck2,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface StudioTextEditorProps {
  text: string;
  onChangeText: (text: string) => void;
  isProcessing?: boolean;
  statusMessage?: string | null;
  placeholder?: string;
  onClear?: () => void;
}

export const StudioTextEditor: React.FC<StudioTextEditorProps> = ({
  text,
  onChangeText,
  isProcessing = false,
  statusMessage,
  placeholder = 'Cole aqui o texto, artigo ou relatório, arraste um arquivo PDF/TXT/MD, ou clique em Ditar...',
  onClear,
}) => {
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const estimatedMinutes = Math.max(1, Math.round(wordCount / 140));

  const showTempFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const showTempError = (msg: string) => {
    setErrorFeedback(msg);
    setTimeout(() => setErrorFeedback(null), 4500);
  };

  // 1. Colar da Área de Transferência
  const handlePasteClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && clipText.trim()) {
        onChangeText(clipText.trim());
        setUploadedFileName(null);
        showTempFeedback('Texto colado da área de transferência!');
      } else {
        showTempFeedback('A área de transferência está vazia.');
      }
    } catch {
      showTempError('Permissão para colar negada. Digite ou use Ctrl+V.');
    }
  };

  // 2. Processar Arquivo (Upload ou Drag & Drop)
  const processFile = async (file: File) => {
    if (!file) return;

    setUploadedFileName(file.name);
    setErrorFeedback(null);

    const isTextFile =
      file.type === 'text/plain' ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.json');

    if (isTextFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = (event.target?.result as string) || '';
        onChangeText(content);
        showTempFeedback(`Arquivo "${file.name}" carregado com sucesso!`);
      };
      reader.onerror = () => showTempError('Erro ao ler arquivo de texto.');
      reader.readAsText(file);
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string)?.split(',')[1];
        if (!base64Data) {
          showTempError('Falha ao codificar PDF.');
          return;
        }

        showTempFeedback(`Enviando "${file.name}" para extração com Gemini 3.8 Flash...`);

        try {
          const resp = await fetch('/api/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: base64Data,
              mimeType: 'application/pdf',
              fileName: file.name,
            }),
          });

          const data = await resp.json();
          if (data.success && data.text) {
            onChangeText(data.text);
            showTempFeedback(`PDF "${file.name}" extraído com sucesso!`);
          } else {
            throw new Error(data.error || 'Falha ao extrair texto do PDF.');
          }
        } catch (err: unknown) {
          console.error(err);
          showTempError(err instanceof Error ? err.message : 'Erro ao processar PDF.');
        }
      };
      reader.readAsDataURL(file);
    } else {
      showTempError('Formato não suportado. Por favor, envie arquivos PDF, TXT ou Markdown.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // 3. Ditado com Microfone
  const toggleDictation = () => {
    if (isDictating) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsDictating(false);
      showTempFeedback('Ditado finalizado.');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showTempError('Reconhecimento de fala não suportado neste navegador. Use Chrome ou Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsDictating(true);
        showTempFeedback('Microfone ativo... Fale naturalmente.');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript + ' ';
          }
        }
        if (transcript) {
          onChangeText(
            text.trim() ? `${text.trim()} ${transcript.trim()}` : transcript.trim()
          );
        }
      };

      recognition.onerror = () => {
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsDictating(false);
      showTempError('Não foi possível iniciar o microfone.');
    }
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* 1. Barra de Ingestão Superior (Touch Targets Mínimos de 44px) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl card-matte">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Botão Colar */}
          <button
            type="button"
            onClick={handlePasteClipboard}
            className="btn-matte-dark min-h-[40px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            title="Colar texto da área de transferência"
          >
            <Clipboard className="w-4 h-4 text-amber-400" />
            <span>Colar Texto</span>
          </button>

          {/* Botão Subir Arquivo */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-matte-dark min-h-[40px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            title="Carregar PDF, TXT ou Markdown"
          >
            <UploadCloud className="w-4 h-4 text-sky-400" />
            <span>Subir Arquivo (PDF / TXT)</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.json"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Botão Ditar */}
          <button
            type="button"
            onClick={toggleDictation}
            className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95 border ${
              isDictating
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                : 'btn-matte-dark'
            }`}
            title={isDictating ? 'Parar microfone' : 'Ditar texto com a voz'}
          >
            {isDictating ? (
              <>
                <MicOff className="w-4 h-4 text-rose-400" />
                <span>Ouvindo...</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>Ditar</span>
              </>
            )}
          </button>
        </div>

        {/* Indicador de Arquivo Carregado ou Botão Limpar */}
        <div className="flex items-center gap-2">
          {uploadedFileName && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-[11px] text-emerald-300 font-medium">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span className="truncate max-w-[140px]">{uploadedFileName}</span>
            </div>
          )}

          {text.trim().length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (onClear) onClear();
                else onChangeText('');
                setUploadedFileName(null);
              }}
              className="min-h-[40px] px-3 rounded-xl bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              title="Limpar editor"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Área Central do Textarea com Drag-and-Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border transition-all overflow-hidden flex flex-col card-matte ${
          isDraggingOver
            ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-500/5'
            : 'focus-within:border-amber-500/80'
        }`}
      >
        <textarea
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder={placeholder}
          rows={7}
          className="w-full p-4 sm:p-5 bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-500 focus:outline-none leading-relaxed resize-y selection:bg-amber-500/20"
        />

        {/* Rodapé Informativo: Palavras e Estimativa de Minutos */}
        <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              {wordCount} palavras
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              ~{estimatedMinutes} min de fala
            </span>
          </div>

          {isProcessing && (
            <div className="flex items-center gap-1.5 text-amber-300 text-xs font-medium animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{statusMessage || 'Processando com IA...'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Banners Rápidos de Feedback Temporário */}
      {feedback && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorFeedback && (
        <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorFeedback}</span>
        </div>
      )}
    </div>
  );
};

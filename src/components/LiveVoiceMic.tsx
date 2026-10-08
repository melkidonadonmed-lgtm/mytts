import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  AlertCircle,
  Radio
} from 'lucide-react';
import { VoiceProfile } from '../types/voices';

interface LiveVoiceMicProps {
  selectedVoice: VoiceProfile;
  onSendToReader: (text: string) => void;
}

export const LiveVoiceMic: React.FC<LiveVoiceMicProps> = ({
  onSendToReader,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [transcript, setTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Iniciar Gravação
  const startRecording = async () => {
    setErrorMessage(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        await processRecording();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Coleta a cada 250ms
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(
        'Permissão de microfone negada ou dispositivo indisponível. Por favor, autorize o acesso ao microfone no navegador.'
      );
    }
  };

  // Parar Gravação
  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Processar e Enviar para Transcrição Inteligente no Backend
  const processRecording = async () => {
    const audioBlob = new Blob(audioChunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || 'audio/webm',
    });

    if (audioBlob.size === 0) return;

    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string)?.split(',')[1];
        if (!base64Data) return;

        const res = await fetch('/api/transcribe-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioData: base64Data,
            mimeType: audioBlob.type,
          }),
        });

        const data = await res.json();
        if (data.success && data.transcript) {
          setTranscript((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
        } else {
          throw new Error(data.error || 'Falha ao transcrever gravação.');
        }
        setIsTranscribing(false);
      };
      reader.readAsDataURL(audioBlob);
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao processar transcrição do áudio.');
      setIsTranscribing(false);
    }
  };

  const handleCopy = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript).catch((e) => console.warn('Clipboard indisponível:', e));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-8 pb-36">
      
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs font-semibold mb-3">
          <Radio className="w-3.5 h-3.5 animate-pulse text-rose-600 dark:text-rose-400" />
          <span>Voz ao Vivo & Ditado Inteligente</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Grave sua voz e transcreva com IA
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-lg mx-auto">
          Fale livremente pelo microfone. O Gemini 3.8 pontua, corrige e estrutura sua fala automaticamente para ser lida por qualquer voz neural.
        </p>
      </div>

      {/* Esfera / Botão Reativo Central de Gravação */}
      <div className="flex flex-col items-center justify-center my-6">
        <div className="relative flex items-center justify-center">
          {/* Ondas pulsantes de fundo quando gravando */}
          {isRecording && (
            <>
              <div className="absolute w-44 h-44 rounded-full bg-rose-500/20 animate-ping opacity-75" />
              <div className="absolute w-36 h-36 rounded-full bg-amber-500/20 animate-pulse" />
            </>
          )}

          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all cursor-pointer active:scale-95 ${
              isRecording
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/40 ring-4 ring-rose-400/30'
                : 'btn-matte btn-matte-amber text-white shadow-amber-500/30 ring-4 ring-amber-400/20'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-8 h-8 fill-current mb-1 text-white" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">Parar</span>
              </>
            ) : (
              <>
                <Mic className="w-8 h-8 mb-1 text-white" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">Gravar</span>
              </>
            )}
          </button>
        </div>

        {/* Timer de Gravação */}
        <div className="mt-4 font-mono text-sm font-semibold">
          {isRecording ? (
            <span className="text-rose-600 dark:text-rose-400 animate-pulse flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Gravando: {formatTimer(recordingSeconds)}
            </span>
          ) : isTranscribing ? (
            <span className="text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-spin text-amber-500" />
              Transcrevendo com pontuação inteligente...
            </span>
          ) : (
            <span className="text-slate-600 dark:text-slate-500 font-medium">Clique para iniciar o microfone</span>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Caixa de Transcrição Estruturada */}
      <div className="rounded-2xl card-matte p-5 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
              Texto Transcrito
            </h2>
          </div>
          {transcript && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                title="Copiar texto"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="font-medium">{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
              <button
                onClick={() => setTranscript('')}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer transition-colors font-medium"
              >
                Limpar
              </button>
            </div>
          )}
        </div>

        <div className="min-h-[140px] max-h-72 overflow-y-auto p-4 rounded-xl input-sunken text-sm text-slate-900 dark:text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-amber-500/20">
          {transcript || (
            <span className="text-slate-500 dark:text-slate-600 italic">
              O texto falado aparecerá aqui com parágrafos e pontuação gerados pelo Gemini...
            </span>
          )}
        </div>

        {/* Ação: Transferir diretamente para o Leitor */}
        {transcript && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => onSendToReader(transcript)}
              className="btn-matte btn-matte-amber px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <span>Abrir no Leitor & Sintetizar</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

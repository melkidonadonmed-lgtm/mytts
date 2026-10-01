import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Clipboard,
  Trash2,
  Upload,
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  Loader2,
  Clock,
  Sliders,
  Check,
  AlertCircle
} from 'lucide-react';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { base64ToBlobUrl, revokeAudioUrl } from '../utils/audio';

interface QuickReaderProps {
  selectedVoice: VoiceProfile;
  onSelectVoice: (voice: VoiceProfile) => void;
  onNavigateToMic: () => void;
}

export const QuickReader: React.FC<QuickReaderProps> = ({
  selectedVoice,
  onSelectVoice,
  onNavigateToMic,
}) => {
  const [text, setText] = useState<string>(
    `[deep breath] Olá! Este é o novo estúdio de voz neural com qualidade hiper-realista. 
Você pode colar qualquer texto, notícia ou documento aqui... [pause] e ouvir a leitura com respiração natural, pausas orgânicas e entonação de estúdio. [laughs] Incrível, não é?`
  );

  const [emotion, setEmotion] = useState<string>('thoughtful');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDictating, setIsDictating] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Palavras e estimativa de leitura (~150 palavras por minuto)
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const estimatedMinutes = Math.max(1, Math.round(wordCount / 150));

  // Opções de emoção e estilo
  const emotionOptions = [
    { id: 'thoughtful', label: 'Reflexivo & Pausado', icon: '🤔' },
    { id: 'inquisitive', label: 'Curioso & Dinâmico', icon: '🧐' },
    { id: 'skeptical', label: 'Cético & Deliberado', icon: '🤨' },
    { id: 'passionate', label: 'Enérgico & Apaixonado', icon: '🔥' },
    { id: 'resolute', label: 'Calmo & Firme', icon: '🏛️' },
    { id: 'ironic', label: 'Irônico & Descontraído', icon: '😏' },
  ];

  // Limpeza de áudio ao desmontar
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      revokeAudioUrl(currentAudioUrlRef.current);
    };
  }, []);

  // Monitoramento de tempo de reprodução
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // 1. Colar da Área de Transferência
  const handlePasteClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setText(clipText);
        showFeedback('Texto colado da área de transferência!');
      }
    } catch {
      showFeedback('Permissão para colar negada. Digite ou cole com Ctrl+V.');
    }
  };

  // 2. Upload de Arquivo PDF ou TXT
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (event) => {
        setText((event.target?.result as string) || '');
        showFeedback(`Arquivo ${file.name} carregado!`);
      };
      reader.readAsText(file);
    } else if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string)?.split(',')[1];
        if (!base64Data) return;

        setIsSynthesizing(true);
        setStatusMessage('Extraindo texto do PDF com Gemini 3.8 Flash...');
        try {
          const res = await fetch('/api/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: base64Data,
              mimeType: 'application/pdf',
              fileName: file.name,
            }),
          });
          const data = await res.json();
          if (data.success && data.text) {
            setText(data.text);
            showFeedback(`PDF "${file.name}" extraído com sucesso!`);
          } else {
            throw new Error(data.error || 'Falha ao extrair PDF.');
          }
        } catch (err: any) {
          setErrorMessage(err.message || 'Erro ao processar PDF.');
        } finally {
          setIsSynthesizing(false);
          setStatusMessage(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // 3. Ditado pelo Microfone (Web Speech Recognition)
  const toggleDictation = () => {
    if (isDictating) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsDictating(false);
      showFeedback('Ditado pausado.');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onNavigateToMic();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsDictating(true);
      showFeedback('Ouvindo microfone... fale naturalmente.');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        setText((prev) => (prev.trim() ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim()));
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
  };

  // 4. Inserção de Tags Prosódicas na Posição do Cursor
  const insertProsodyTag = (tag: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newText = text.substring(0, start) + ` ${tag} ` + text.substring(end);
    setText(newText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + tag.length + 2, start + tag.length + 2);
      }
    }, 50);
  };

  // 5. Síntese e Leitura de Texto (Gemini 3.1 Flash TTS com Director's Chair)
  const handleSynthesizeAndPlay = async () => {
    if (!text.trim()) return;

    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // Se já temos o áudio sintetizado para esse mesmo texto, apenas tocar
    if (currentAudioUrl && audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsSynthesizing(true);
    setErrorMessage(null);
    setStatusMessage('Sintetizando voz com Director\'s Chair e respiração neural...');

    try {
      const res = await fetch('/api/synthesize-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: selectedVoice.id,
          emotion,
          speed: playbackSpeed,
          language: 'pt-BR',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.audioBase64) {
        throw new Error(data.error || 'Falha ao sintetizar áudio com Gemini TTS.');
      }

      // Revogar Blob URL anterior para economizar memória
      revokeAudioUrl(currentAudioUrlRef.current);
      const audioUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
      currentAudioUrlRef.current = audioUrl;
      setCurrentAudioUrl(audioUrl);
      setAudioDuration(data.durationSec || 10);

      // Iniciar reprodução imediata
      const audio = new Audio(audioUrl);
      audio.playbackRate = playbackSpeed;
      audioRef.current = audio;

      audio.ontimeupdate = handleTimeUpdate;
      audio.onended = handleAudioEnded;
      audio.onerror = () => {
        setIsPlaying(false);
        setErrorMessage('Erro ao reproduzir buffer de áudio.');
      };

      await audio.play();
      setIsPlaying(true);
      showFeedback('Reproduzindo áudio neural hiper-realista!');
    } catch (err: any) {
      console.warn('Erro na síntese neural:', err);
      setErrorMessage(err.message || 'Erro ao conectar à API do Gemini.');
      
      // Fallback para Web Speech nativo
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const clean = text.replace(/\[.*?\]/g, '').replace(/<.*?>/g, '').trim();
        const utter = new SpeechSynthesisUtterance(clean);
        utter.lang = 'pt-BR';
        utter.rate = playbackSpeed;
        utter.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utter);
        setIsPlaying(true);
        showFeedback('Aviso: Reproduzindo com voz de fallback do navegador.');
      }
    } finally {
      setIsSynthesizing(false);
      setStatusMessage(null);
    }
  };

  // Feedback temporário
  const showFeedback = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage(null);
    }, 3500);
  };

  // Baixar Áudio WAV
  const handleDownload = () => {
    if (!currentAudioUrl) return;
    const a = document.createElement('a');
    a.href = currentAudioUrl;
    a.download = `mytts-${selectedVoice.name.toLowerCase()}-${Date.now()}.wav`;
    a.click();
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-4 py-6 pb-36">
      
      {/* 1. Header do Leitor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Leitor Neural & Estúdio de Fala</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cole qualquer texto e ouça com respiração humana autêntica, pausas e emoção realista.
          </p>
        </div>

        {/* Seletor Rápido de Voz em Pílula */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <div
              className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${selectedVoice.avatarColor} flex items-center justify-center text-white text-[11px] font-bold`}
            >
              {selectedVoice.name[0]}
            </div>
            <select
              value={selectedVoice.id}
              onChange={(e) => {
                const found = GEMINI_VOICES.find((v) => v.id === e.target.value);
                if (found) {
                  onSelectVoice(found);
                  setCurrentAudioUrl(null); // Reseta cache de áudio para a nova voz
                }
              }}
              className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              {GEMINI_VOICES.map((v) => (
                <option key={v.id} value={v.id} className="bg-slate-900 text-slate-200">
                  {v.name} ({v.archetype})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Barra de Parâmetros e Ferramentas (Toolbar Superior) */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80">
        
        {/* Seletor de Emoção / Entonação */}
        <div className="sm:col-span-6 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            Tom:
          </span>
          <select
            value={emotion}
            onChange={(e) => {
              setEmotion(e.target.value);
              setCurrentAudioUrl(null);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            {emotionOptions.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-slate-900 text-slate-200">
                {opt.icon} {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Seletor de Velocidade */}
        <div className="sm:col-span-3 flex items-center gap-1.5 justify-end">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Velocidade:
          </span>
          <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800">
            {[0.8, 1.0, 1.2, 1.5].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setPlaybackSpeed(s);
                  if (audioRef.current) audioRef.current.playbackRate = s;
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                  playbackSpeed === s
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Ações de Importação Rápida */}
        <div className="sm:col-span-3 flex items-center gap-1.5 justify-end">
          <button
            onClick={handlePasteClipboard}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Colar da Área de Transferência"
          >
            <Clipboard className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Colar</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Carregar PDF ou Texto"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Arquivo</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={toggleDictation}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
              isDictating
                ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title={isDictating ? 'Parar Ditado' : 'Ditar com Microfone'}
          >
            {isDictating ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="hidden sm:inline">{isDictating ? 'Gravando' : 'Ditar'}</span>
          </button>

          <button
            onClick={() => {
              setText('');
              setCurrentAudioUrl(null);
            }}
            className="p-2 rounded-xl bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs cursor-pointer transition-all"
            title="Limpar editor"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Editor de Texto Estilo Speechify / ElevenLabs */}
      <div className="relative rounded-2xl border border-slate-800/90 bg-slate-900/60 shadow-xl flex flex-col overflow-hidden focus-within:border-amber-500/60 transition-colors">
        
        {/* Barra de Tags Prosódicas Rápidas */}
        <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-slate-500 font-medium whitespace-nowrap flex items-center gap-1 pr-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Tags de Realismo:
          </span>
          {[
            { tag: '[deep breath]', label: 'Fôlego' },
            { tag: '[sighs]', label: 'Suspiro' },
            { tag: '[pause]', label: 'Pausa' },
            { tag: '[laughs]', label: 'Riso' },
            { tag: '[whispers]', label: 'Sussurro' },
          ].map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => insertProsodyTag(item.tag)}
              className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-amber-400/10 text-slate-300 hover:text-amber-300 border border-slate-800/80 transition-all font-mono whitespace-nowrap cursor-pointer"
              title={`Inserir marcador ${item.tag} no texto`}
            >
              + {item.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCurrentAudioUrl(null); // Reseta o áudio antigo se o texto for modificado
          }}
          placeholder="Cole seu texto aqui ou clique no microfone para ditar em voz alta..."
          rows={9}
          className="w-full p-4 sm:p-5 bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-500 focus:outline-none leading-relaxed resize-none selection:bg-amber-500/20"
        />

        {/* Rodapé do Editor: Metadados */}
        <div className="px-4 py-2.5 border-t border-slate-800/60 bg-slate-950/40 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>{wordCount} palavras</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ~{estimatedMinutes} min de fala
            </span>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Voz: <strong className="text-amber-400 font-semibold">{selectedVoice.name}</strong> ({selectedVoice.archetype})
          </div>
        </div>
      </div>

      {/* Banner de Status ou Erro */}
      {statusMessage && (
        <div className="mt-3 p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4. Barra de Ação Principal Hero (Botão Gerar / Player Integrado) */}
      <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
        
        {/* Botão de Síntese Principal */}
        <button
          onClick={handleSynthesizeAndPlay}
          disabled={isSynthesizing || !text.trim()}
          className="w-full sm:flex-1 min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
        >
          {isSynthesizing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Sintetizando Voz Neural com Direção...</span>
            </>
          ) : isPlaying ? (
            <>
              <Pause className="w-5 h-5 fill-current" />
              <span>Pausar Leitura</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              <span>{currentAudioUrl ? 'Ouvir Novamente' : 'Ler Texto em Voz Alta'}</span>
            </>
          )}
        </button>

        {/* Ações Secundárias (Download do Áudio WAV gerado) */}
        {currentAudioUrl && (
          <button
            onClick={handleDownload}
            className="w-full sm:w-auto min-h-[52px] px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            title="Baixar arquivo WAV de estúdio"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Baixar WAV (24kHz)</span>
          </button>
        )}
      </div>

      {/* 5. Player Visual em Linha (Estilo ElevenLabs Waveform) */}
      {currentAudioUrl && (
        <div className="mt-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="text-amber-400 font-bold flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              Áudio de Estúdio Pronto ({selectedVoice.name})
            </span>
            <span>
              {formatTime(currentTime)} / {formatTime(audioDuration)}
            </span>
          </div>

          {/* Scrubber Progress Bar */}
          <input
            type="range"
            min={0}
            max={audioDuration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setCurrentTime(val);
              if (audioRef.current) audioRef.current.currentTime = val;
            }}
            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>
      )}
    </div>
  );
};

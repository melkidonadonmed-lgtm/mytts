import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Gauge, 
  Volume2, 
  VolumeX, 
  ChevronUp, 
  ChevronDown,
  Sparkles,
  MessageSquare,
  Tag,
  Sliders,
  Wind,
  Clock,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SpeakerProfile, DebateTurn, TurnEmotion, LanguageCode } from '../types/debate';
import { getAudioContext, base64ToArrayBuffer } from '../utils/audioEngine';

interface BottomAudioDockProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number; // em segundos
  duration: number; // em segundos
  onSeek: (newTime: number) => void;
  playbackRate: number; // 1.0, 1.25, 1.5, 1.75, 2.0
  onChangePlaybackRate: (rate: number) => void;
  currentSpeaker?: SpeakerProfile;
  currentTurn?: DebateTurn;
  currentTurnText?: string;
  turnIndex: number;
  totalTurns: number;
  language?: LanguageCode;
}

const EMOTIONS_MAP: Record<TurnEmotion | string, { label: string; ptLabel: string; bg: string; text: string; border: string; icon: string }> = {
  thoughtful: {
    label: 'Thoughtful',
    ptLabel: 'Reflexivo',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-300',
    border: 'border-indigo-500/30',
    icon: '💭',
  },
  inquisitive: {
    label: 'Inquisitive',
    ptLabel: 'Inquisitivo',
    bg: 'bg-sky-500/10',
    text: 'text-sky-300',
    border: 'border-sky-500/30',
    icon: '🔍',
  },
  skeptical: {
    label: 'Skeptical',
    ptLabel: 'Cético',
    bg: 'bg-purple-500/10',
    text: 'text-purple-300',
    border: 'border-purple-500/30',
    icon: '🤨',
  },
  ironic: {
    label: 'Ironic',
    ptLabel: 'Irônico',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    icon: '😏',
  },
  passionate: {
    label: 'Passionate',
    ptLabel: 'Apaixonado',
    bg: 'bg-rose-500/10',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
    icon: '🔥',
  },
  resolute: {
    label: 'Resolute',
    ptLabel: 'Resoluto',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
    icon: '⚡',
  },
};

export const BottomAudioDock: React.FC<BottomAudioDockProps> = ({
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeek,
  playbackRate,
  onChangePlaybackRate,
  currentSpeaker,
  currentTurn,
  currentTurnText,
  turnIndex,
  totalTurns,
  language = 'pt-BR',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Estados do Preview de Áudio (amostra de 3 segundos para confirmar seleção)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSecondsLeft, setPreviewSecondsLeft] = useState(3);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewTimerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  const stopPreview = () => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch (e) {}
      previewSourceRef.current = null;
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingPreview(false);
  };

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  // Ciclo rápido de velocidades para toque único com o polegar
  const availableRates = [1.0, 1.25, 1.5, 1.75, 2.0];
  const handleCycleSpeed = () => {
    const currentIndex = availableRates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % availableRates.length;
    onChangePlaybackRate(availableRates[nextIndex]);
  };

  const handleSkip = (seconds: number) => {
    const target = Math.min(Math.max(currentTime + seconds, 0), duration || 0);
    onSeek(target);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Destaca marcadores prosódicos no texto (<breath>, <laugh>, <gasp>, |mhm|, |yeah|, reticências)
  const renderProsodicText = (text?: string) => {
    if (!text) return 'Aguardando inicialização do debate...';
    const parts = text.split(/(<[^>]+>|\|[^|]+\||—|\.\.\.)/g);
    return parts.map((part, i) => {
      if (part.startsWith('<') && part.endsWith('>')) {
        return (
          <span
            key={i}
            className="text-[11px] font-mono px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mx-0.5 inline-block"
            title="Marcador vocal neural"
          >
            {part}
          </span>
        );
      }
      if (part.startsWith('|') && part.endsWith('|')) {
        return (
          <span
            key={i}
            className="text-[11px] font-mono px-1 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 mx-0.5 inline-block"
            title="Escuta ativa (backchanneling)"
          >
            {part}
          </span>
        );
      }
      if (part === '—' || part === '...') {
        return (
          <span key={i} className="text-amber-400 font-bold mx-0.5">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Resolução dos dados de voz e prosódia do turno / orador atual
  const voiceId = currentTurn?.voice_id || currentSpeaker?.voiceId || 'Puck';
  const emotionKey = currentTurn?.emotion || 'thoughtful';
  const emotionMeta = EMOTIONS_MAP[emotionKey] || {
    label: emotionKey,
    ptLabel: emotionKey,
    bg: 'bg-slate-800',
    text: 'text-slate-300',
    border: 'border-slate-700',
    icon: '🎙️',
  };

  const prosody = currentTurn?.prosody || {
    speech_rate: 1.0,
    pre_delay_ms: 120,
    breath_sound: true,
    volume_gain: 1.0,
  };

  // Reproduz amostra de áudio de 3 segundos da voz selecionada para confirmação
  const handleTogglePreviewAudio = async () => {
    if (isPlayingPreview) {
      stopPreview();
      return;
    }

    setPreviewLoading(true);
    setIsConfirmed(false);

    try {
      let audioBase64 = currentTurn?.audioBase64;

      // Se o turno atual ainda não tiver áudio sintetizado, busca amostra rápida de 3 segundos
      if (!audioBase64) {
        const resp = await fetch('/api/preview-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceId,
            speakerName: currentSpeaker?.name || 'Orador',
            language: language || 'pt-BR',
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.audioBase64) {
            audioBase64 = data.audioBase64;
          }
        }
      }

      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (audioBase64) {
        const arrayBuf = base64ToArrayBuffer(audioBase64);
        const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));

        stopPreview();

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(1.0, ctx.currentTime);
        // Suave fade out nos últimos 300ms do corte de 3 segundos
        gainNode.gain.setValueAtTime(1.0, ctx.currentTime + 2.7);
        gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 3.0);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(0);
        source.stop(ctx.currentTime + 3.0);
        previewSourceRef.current = source;

        setIsPlayingPreview(true);
        setPreviewSecondsLeft(3);

        countdownIntervalRef.current = setInterval(() => {
          setPreviewSecondsLeft((prev) => {
            if (prev <= 1) {
              if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        previewTimerRef.current = setTimeout(() => {
          stopPreview();
          setIsConfirmed(true);
          setTimeout(() => setIsConfirmed(false), 2500);
        }, 3000);
      } else {
        // Fallback Web Speech se necessário
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const sampleText = `${currentSpeaker?.name || 'Orador'}. Voz neural confirmada no estúdio.`;
          const utterance = new SpeechSynthesisUtterance(sampleText);
          utterance.lang = language || 'pt-BR';
          utterance.rate = 1.05;
          window.speechSynthesis.speak(utterance);

          setIsPlayingPreview(true);
          setPreviewSecondsLeft(3);

          countdownIntervalRef.current = setInterval(() => {
            setPreviewSecondsLeft((prev) => Math.max(0, prev - 1));
          }, 1000);

          previewTimerRef.current = setTimeout(() => {
            stopPreview();
            setIsConfirmed(true);
            setTimeout(() => setIsConfirmed(false), 2500);
          }, 3000);
        }
      }
    } catch (err) {
      console.warn('Erro na reprodução da amostra:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <aside 
      id="BottomAudioDock"
      aria-label="Controles de Reprodução de Áudio"
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-2xl transition-all shadow-[0_-10px_30px_rgba(0,0,0,0.6)]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
    >
      {/* 1. Scrubber de Progresso Tátil (Ocupa 100% da largura no topo da barra) */}
      <div className="relative w-full h-3 group cursor-pointer -mt-1.5 flex items-center">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Progresso do áudio"
          className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
        />
        {/* Trilho de fundo */}
        <div className="w-full h-1 bg-slate-800 group-hover:h-1.5 transition-all">
          {/* Preenchimento com a cor semântica do orador atual */}
          <div 
            className="h-full transition-all duration-100 ease-out"
            style={{ 
              width: `${progressPercentage}%`,
              backgroundColor: currentSpeaker?.color || '#f59e0b'
            }}
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-1">
        
        {/* Gaveta Expansível com Voice Profile e Transcrição em Tempo Real */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="overflow-hidden mb-3 border-b border-slate-800/80 pb-3"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
                
                {/* Área de Resumo 'Voice Profile' */}
                <div 
                  className="lg:col-span-6 xl:col-span-5 bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-inner flex flex-col justify-between gap-2.5"
                  aria-label="Resumo do Perfil de Voz"
                >
                  {/* Cabeçalho do Perfil de Voz com Tag do Voice ID */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="p-1 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/20">
                        <Sliders className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                          <span>Voice Profile</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({currentSpeaker?.name || 'Orador'})
                          </span>
                        </h4>
                      </div>
                    </div>

                    {/* Tag compacta do Voice ID e Botão Preview Audio */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <div 
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 shrink-0 shadow-sm"
                        title="Identificador de voz neural usado na síntese (Gemini TTS)"
                      >
                        <Tag className="w-3 h-3 text-amber-400" />
                        <span>Voice ID: <strong className="text-white font-semibold">{voiceId}</strong></span>
                      </div>

                      {/* Botão 'Preview Audio' de 3 segundos para confirmar seleção */}
                      <button
                        type="button"
                        onClick={handleTogglePreviewAudio}
                        disabled={previewLoading}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all shadow-sm cursor-pointer select-none border ${
                          isPlayingPreview
                            ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/40 animate-pulse font-semibold'
                            : isConfirmed
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border-slate-700 hover:border-amber-400/50'
                        }`}
                        title="Ouvir amostra de 3 segundos da voz para confirmar seleção"
                        aria-label="Preview Audio da voz selecionada"
                      >
                        {previewLoading ? (
                          <>
                            <Sparkles className="w-3 h-3 animate-spin text-amber-400" />
                            <span>Carregando...</span>
                          </>
                        ) : isPlayingPreview ? (
                          <>
                            <span className="flex items-center gap-0.5 h-3">
                              <span className="w-0.5 h-2 bg-slate-950 animate-pulse" />
                              <span className="w-0.5 h-3 bg-slate-950 animate-pulse delay-75" />
                              <span className="w-0.5 h-1.5 bg-slate-950 animate-pulse delay-150" />
                            </span>
                            <span>Tocando ({previewSecondsLeft}s)</span>
                          </>
                        ) : isConfirmed ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300">Voz Confirmada</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 text-amber-400" />
                            <span>Preview Audio</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Emoção Vocal do Orador no Turno */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 rounded-lg px-2.5 py-1.5 border border-slate-800/60">
                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                      <span>Emoção Vocal:</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${emotionMeta.bg} ${emotionMeta.text} ${emotionMeta.border}`}>
                        <span>{emotionMeta.icon}</span>
                        <span className="capitalize font-semibold">{emotionMeta.label}</span>
                        <span className="text-slate-400 font-normal text-[10px]">({emotionMeta.ptLabel})</span>
                      </span>
                      {currentSpeaker?.archetype && (
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider border border-slate-800 px-1.5 py-0.5 rounded bg-slate-900">
                          {currentSpeaker.archetype}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Configurações Prosódicas (Prosody Settings) */}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>Configurações Prosódicas</span>
                      <span className="text-[10px] font-mono text-slate-500">24kHz PCM</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {/* Ritmo Vocal (Speech Rate) */}
                      <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800 flex flex-col justify-between">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Gauge className="w-3 h-3 text-sky-400" /> Ritmo
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-100 mt-1">
                          {(prosody.speech_rate || 1.0).toFixed(2)}x
                        </span>
                      </div>

                      {/* Pré-Delay / Latência entre falas */}
                      <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800 flex flex-col justify-between">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" /> Pré-Gap
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-100 mt-1">
                          +{prosody.pre_delay_ms ?? 0}ms
                        </span>
                      </div>

                      {/* Respiração Vocal Neural */}
                      <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800 flex flex-col justify-between">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Wind className="w-3 h-3 text-emerald-400" /> Respiração
                        </span>
                        <span className="text-xs font-mono font-semibold text-slate-100 mt-1 flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${prosody.breath_sound ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          {prosody.breath_sound ? 'Ativa' : 'Desat.'}
                        </span>
                      </div>

                      {/* Ganho de Amplitude */}
                      <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800 flex flex-col justify-between">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Volume2 className="w-3 h-3 text-purple-400" /> Ganho
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-100 mt-1">
                          {prosody.volume_gain ? `${Math.round(prosody.volume_gain * 100)}%` : '100%'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Área de Transcrição do Turno Atual */}
                <div className="lg:col-span-6 xl:col-span-7 bg-slate-900/80 rounded-xl p-3 border border-slate-800 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                      Transcrição em Tempo Real ({turnIndex + 1}/{totalTurns})
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                      <span>{currentSpeaker?.roleTitle?.split(' ')[0] || 'Orador'}</span>
                      <span>•</span>
                      <span className="text-slate-400">{formatTime(currentTime)} / {formatTime(duration)}</span>
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 flex-1 overflow-y-auto max-h-24">
                    “{renderProsodicText(currentTurnText || currentTurn?.text)}”
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <span>Síntese de voz com marcadores prosódicos integrados</span>
                    <button
                      type="button"
                      onClick={() => setIsExpanded(false)}
                      className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer font-mono"
                    >
                      <span>Recolher</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. Barra de Controle Principal (Alinhada à Thumb Zone) */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Bloco Esquerdo: Identificador Visual do Orador com borda pulsante de waveform */}
          <div 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2.5 min-w-0 flex-1 max-w-[42%] sm:max-w-xs cursor-pointer select-none py-1 group"
            title={isExpanded ? 'Recolher Voice Profile e Transcrição' : 'Expandir Voice Profile e Transcrição'}
          >
            <div className="relative shrink-0">
              {/* Onda acústica 1 (onda externa expandindo com a amplitude do áudio) */}
              {isPlaying && (
                <motion.span
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  animate={{
                    scale: [1, 1.28, 1.45],
                    opacity: [0.65, 0.3, 0],
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                  style={{
                    border: `1.5px solid ${currentSpeaker?.color || '#f59e0b'}`,
                  }}
                />
              )}

              {/* Onda acústica 2 (onda secundária defasada para criar ritmo de fala natural) */}
              {isPlaying && (
                <motion.span
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  animate={{
                    scale: [1, 1.22, 1.38],
                    opacity: [0.55, 0.2, 0],
                  }}
                  transition={{
                    duration: 1.4,
                    delay: 0.5,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                  style={{
                    border: `1.5px solid ${currentSpeaker?.color || '#f59e0b'}`,
                  }}
                />
              )}

              {/* Avatar do Orador com Borda Pulsante Reativa à Amplitude Sonora */}
              <motion.div 
                className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border font-bold text-sm shadow-inner transition-transform group-active:scale-95"
                animate={
                  isPlaying
                    ? {
                        scale: [1, 1.04, 0.99, 1.07, 1.02, 1],
                        borderColor: [
                          `${currentSpeaker?.color || '#f59e0b'}60`,
                          `${currentSpeaker?.color || '#f59e0b'}ff`,
                          `${currentSpeaker?.color || '#f59e0b'}70`,
                          `${currentSpeaker?.color || '#f59e0b'}ee`,
                          `${currentSpeaker?.color || '#f59e0b'}60`,
                        ],
                        boxShadow: [
                          `0 0 0 0px ${currentSpeaker?.color || '#f59e0b'}00, inset 0 0 4px ${currentSpeaker?.color || '#f59e0b'}20`,
                          `0 0 10px 2px ${currentSpeaker?.color || '#f59e0b'}40, inset 0 0 8px ${currentSpeaker?.color || '#f59e0b'}40`,
                          `0 0 4px 1px ${currentSpeaker?.color || '#f59e0b'}20, inset 0 0 3px ${currentSpeaker?.color || '#f59e0b'}20`,
                          `0 0 14px 3px ${currentSpeaker?.color || '#f59e0b'}50, inset 0 0 10px ${currentSpeaker?.color || '#f59e0b'}50`,
                          `0 0 0 0px ${currentSpeaker?.color || '#f59e0b'}00, inset 0 0 4px ${currentSpeaker?.color || '#f59e0b'}20`,
                        ],
                      }
                    : {
                        scale: 1,
                        borderColor: `${currentSpeaker?.color || '#f59e0b'}40`,
                        boxShadow: `0 0 0 0px transparent`,
                      }
                }
                transition={{
                  duration: 1.4,
                  repeat: isPlaying ? Infinity : 0,
                  ease: 'easeInOut',
                }}
                style={{ 
                  backgroundColor: `${currentSpeaker?.color || '#f59e0b'}15`,
                  color: currentSpeaker?.color || '#f59e0b'
                }}
              >
                {currentSpeaker ? currentSpeaker.name.charAt(0) : 'D'}
                {isPlaying && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                )}
              </motion.div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                  {currentSpeaker?.name || 'DialecticPod'}
                </p>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 shrink-0 hidden sm:inline-flex items-center gap-0.5">
                  {voiceId}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                <span>{currentSpeaker?.roleTitle?.split(' ')[0] || 'Studio'}</span>
                <span>•</span>
                <span className="font-mono text-slate-500">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </p>
            </div>
          </div>

          {/* Bloco Central: Controles de Áudio com Touch Targets Amplos */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Voltar 10s */}
            <button
              type="button"
              onClick={() => handleSkip(-10)}
              aria-label="Voltar 10 segundos"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:text-slate-200 active:scale-90 hover:bg-slate-900 transition-all cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Botão Play/Pause Gigante (Foco Principal do Polegar) */}
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pausar debate' : 'Reproduzir debate'}
              className="flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>

            {/* Avançar 10s */}
            <button
              type="button"
              onClick={() => handleSkip(10)}
              aria-label="Avançar 10 segundos"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:text-slate-200 active:scale-90 hover:bg-slate-900 transition-all cursor-pointer"
            >
              <RotateCw className="w-5 h-5" />
            </button>
          </div>

          {/* Bloco Direito: Botão Seletor de Velocidade (Touch Target 48px) */}
          <div className="flex items-center justify-end gap-1.5 flex-1 max-w-[25%] sm:max-w-xs">
            <button
              type="button"
              onClick={handleCycleSpeed}
              aria-label={`Velocidade atual: ${playbackRate}x. Toque para alterar.`}
              className="flex min-h-[44px] min-w-[44px] sm:min-w-[52px] items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-mono font-bold text-amber-300 hover:border-amber-400/50 hover:bg-slate-850 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <Gauge className="w-3.5 h-3.5 hidden sm:block text-slate-500" />
              <span>{playbackRate.toFixed(2).replace(/\.00$/, '')}x</span>
            </button>

            {/* Mudo (Visível em telas a partir de tablets) */}
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              aria-label={isMuted ? 'Desativar mudo' : 'Ativar mudo'}
              className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-all cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

        </div>
      </div>
    </aside>
  );
};


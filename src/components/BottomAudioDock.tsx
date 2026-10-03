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
  Check,
  Music,
  Download,
  Radio,
  Layers,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SpeakerProfile, DebateTurn, TurnEmotion, LanguageCode, DebateScript } from '../types/debate';
import { 
  getAudioContext, 
  base64ToArrayBuffer, 
  GaplessAudioPlayer, 
  SOUNDTRACK_PRESETS, 
  SoundtrackPreset, 
  SoundtrackConfig 
} from '../utils/audioEngine';

interface BottomAudioDockProps {
  player?: GaplessAudioPlayer;
  script?: DebateScript | null;
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
  player,
  script,
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
  const [activeDrawerTab, setActiveDrawerTab] = useState<'voice' | 'soundtrack'>('voice');
  const [isMuted, setIsMuted] = useState(false);

  // Estado da Trilha Sonora & Auto-Ducking sincronizado com o player
  const [soundtrackConfig, setSoundtrackConfig] = useState<SoundtrackConfig>(
    player?.getState().soundtrack || {
      preset: 'none',
      musicVolume: 0.20,
      duckingEnabled: true,
      duckingDepthDb: -14,
      voiceBoostDb: 3,
    }
  );
  const [isDucking, setIsDucking] = useState<boolean>(player?.getState().isDucking || false);
  const [isExportingMaster, setIsExportingMaster] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados do Preview de Áudio (amostra de 3 segundos para confirmar seleção)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSecondsLeft, setPreviewSecondsLeft] = useState(3);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewTimerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  // Assinar atualizações de estado do player para refletir ducking e configurações
  useEffect(() => {
    if (!player) return;
    const unsub = player.subscribe((state) => {
      setSoundtrackConfig({ ...state.soundtrack });
      setIsDucking(state.isDucking);
      setIsExportingMaster(state.isExportingMaster);
    });
    return () => unsub();
  }, [player]);

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

  // Destaca marcadores prosódicos no texto
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

  // Alteração de Trilha Sonora
  const handleSelectSoundtrack = async (presetId: SoundtrackPreset) => {
    if (presetId === 'custom') {
      fileInputRef.current?.click();
      return;
    }
    if (player) {
      await player.setSoundtrackPreset(presetId);
    }
  };

  // Upload de arquivo de áudio do usuário para trilha de fundo
  const handleCustomAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !player) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      await player.setSoundtrackPreset('custom', audioBuffer, file.name);
    } catch (err) {
      console.error('Falha ao decodificar arquivo customizado:', err);
    }
  };

  // Exportação do Master do Debate Completo com Trilha e Ducking
  const handleExportMasterMix = async () => {
    if (!player) return;
    try {
      setIsExportingMaster(true);
      setExportFeedback('Renderizando Master com Web Audio Offline...');
      const blob = await player.exportMasterMixWav(script?.turns);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanTitle = (script?.title || 'debate').toLowerCase().replace(/[^a-z0-9]/g, '-');
      a.download = `dialecticpod-${cleanTitle}-master-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      setExportFeedback('Master WAV exportado com sucesso!');
      setTimeout(() => setExportFeedback(null), 3500);
    } catch (err: unknown) {
      console.error('Erro na exportação:', err);
      setExportFeedback(err instanceof Error ? err.message : 'Erro ao exportar o master.');
      setTimeout(() => setExportFeedback(null), 4000);
    } finally {
      setIsExportingMaster(false);
    }
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

  const currentPresetMeta = SOUNDTRACK_PRESETS.find((p) => p.id === soundtrackConfig.preset) || SOUNDTRACK_PRESETS[0];

  return (
    <aside 
      id="BottomAudioDock"
      aria-label="Controles de Reprodução de Áudio"
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-2xl transition-all shadow-[0_-10px_30px_rgba(0,0,0,0.6)]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleCustomAudioUpload}
        accept="audio/*"
        className="hidden"
      />

      {/* 1. Scrubber de Progresso Tátil */}
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
        <div className="w-full h-1 bg-slate-800 group-hover:h-1.5 transition-all">
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
        
        {/* Gaveta Expansível com Abas: Voice Profile vs Trilha Sonora & Ducking */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="overflow-hidden mb-3 border-b border-slate-800/80 pb-3"
            >
              {/* Barra de Abas da Gaveta */}
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-3 pt-1">
                <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveDrawerTab('voice')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeDrawerTab === 'voice'
                        ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Voz & Prosódia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDrawerTab('soundtrack')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeDrawerTab === 'soundtrack'
                        ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5 text-amber-400" />
                    <span>Trilha Sonora & Auto-Ducking</span>
                    {soundtrackConfig.preset !== 'none' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {exportFeedback && (
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 animate-fade-in">
                      {exportFeedback}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer font-mono text-xs px-2 py-1 rounded hover:bg-slate-900"
                  >
                    <span>Recolher</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* ABA 1: VOZ & PROSÓDIA */}
              {activeDrawerTab === 'voice' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  {/* Área de Resumo 'Voice Profile' */}
                  <div 
                    className="lg:col-span-6 xl:col-span-5 bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-inner flex flex-col justify-between gap-2.5"
                    aria-label="Resumo do Perfil de Voz"
                  >
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

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <div 
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 shrink-0 shadow-sm"
                        >
                          <Tag className="w-3 h-3 text-amber-400" />
                          <span>Voice ID: <strong className="text-white font-semibold">{voiceId}</strong></span>
                        </div>

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
                        >
                          {previewLoading ? (
                            <span className="animate-spin w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full" />
                          ) : isPlayingPreview ? (
                            <>
                              <Volume2 className="w-3 h-3 text-slate-950 animate-bounce" />
                              <span>{previewSecondsLeft}s</span>
                            </>
                          ) : isConfirmed ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Confirmado</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              <span>Ouvir Voz</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Emoção Vocal do Orador */}
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

                    {/* Configurações Prosódicas */}
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                        <span>Configurações Prosódicas</span>
                        <span className="text-[10px] font-mono text-slate-500">24kHz PCM RIFF</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800 flex flex-col justify-between">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-sky-400" /> Ritmo
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-100 mt-1">
                            {(prosody.speech_rate || 1.0).toFixed(2)}x
                          </span>
                        </div>

                        <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800 flex flex-col justify-between">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" /> Pré-Gap
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-100 mt-1">
                            +{prosody.pre_delay_ms ?? 0}ms
                          </span>
                        </div>

                        <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800 flex flex-col justify-between">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Wind className="w-3 h-3 text-emerald-400" /> Respiração
                          </span>
                          <span className="text-xs font-mono font-semibold text-slate-100 mt-1 flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${prosody.breath_sound ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                            {prosody.breath_sound ? 'Ativa' : 'Desat.'}
                          </span>
                        </div>

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
                      <span>Síntese neural com prosódia e pausas respiratórias</span>
                      <span className="font-mono text-amber-400/80">Turno {turnIndex + 1} de {totalTurns}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: TRILHA SONORA & AUTO-DUCKING */}
              {activeDrawerTab === 'soundtrack' && (
                <div className="space-y-3">
                  {/* Seletor de Soundscapes Procedurais */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Selecione o Soundscape de Fundo
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Procedural Web Audio • Zero Download
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {SOUNDTRACK_PRESETS.map((preset) => {
                        const isSelected = soundtrackConfig.preset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleSelectSoundtrack(preset.id)}
                            className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden group ${
                              isSelected
                                ? 'bg-slate-900 border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50'
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                            }`}
                          >
                            {isSelected && (
                              <div 
                                className="absolute top-0 right-0 w-8 h-8 pointer-events-none opacity-20 rounded-bl-xl"
                                style={{ backgroundColor: preset.color }}
                              />
                            )}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-lg">{preset.icon}</span>
                              {isSelected && (
                                <span className="flex h-2 w-2 relative">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-100 truncate">
                                {preset.ptName.split(' ')[0]} {preset.ptName.split(' ')[1] || ''}
                              </p>
                              <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                                {preset.id === 'custom' && soundtrackConfig.customFileName
                                  ? soundtrackConfig.customFileName
                                  : preset.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Controles de Mixagem & Auto-Ducking */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-inner">
                    {/* Volume da Trilha */}
                    <div className="md:col-span-4 flex flex-col justify-between gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                          Volume da Trilha
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {Math.round(soundtrackConfig.musicVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={soundtrackConfig.musicVolume}
                        onChange={(e) => player?.setSoundtrackVolume(parseFloat(e.target.value))}
                        disabled={soundtrackConfig.preset === 'none'}
                        className="w-full accent-amber-400 cursor-pointer disabled:opacity-40"
                      />
                      <p className="text-[10px] text-slate-400">
                        Ajusta a intensidade da ambiência sonora relativa à voz.
                      </p>
                    </div>

                    {/* Auto-Ducking (Atenuação Dinâmica) */}
                    <div className="md:col-span-4 flex flex-col justify-between gap-1.5 border-t md:border-t-0 md:border-l border-slate-800/80 md:pl-3 pt-2 md:pt-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-sky-400" />
                          Auto-Ducking Dinâmico
                        </span>
                        <button
                          type="button"
                          onClick={() => player?.setDuckingEnabled(!soundtrackConfig.duckingEnabled)}
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded cursor-pointer transition-all border ${
                            soundtrackConfig.duckingEnabled
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {soundtrackConfig.duckingEnabled ? 'ATIVO' : 'DESLIGADO'}
                        </button>
                      </div>

                      {/* Nível de Atenuação */}
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { label: 'Suave', db: -8 },
                          { label: 'Studio', db: -14 },
                          { label: 'Profundo', db: -20 },
                        ].map((lvl) => (
                          <button
                            key={lvl.db}
                            type="button"
                            onClick={() => player?.setDuckingDepth(lvl.db)}
                            disabled={!soundtrackConfig.duckingEnabled}
                            className={`py-1 text-[11px] font-mono rounded border transition-all cursor-pointer ${
                              soundtrackConfig.duckingDepthDb === lvl.db
                                ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                            } disabled:opacity-40`}
                          >
                            {lvl.label} ({lvl.db}dB)
                          </button>
                        ))}
                      </div>

                      {/* Status de Ducking em Tempo Real */}
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className={`w-2 h-2 rounded-full ${isDucking ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`} />
                        <span className={isDucking ? 'text-amber-300 font-semibold' : 'text-slate-500'}>
                          {isDucking ? `Ducking Ativo (${soundtrackConfig.duckingDepthDb}dB)` : 'Trilha em Volume Nominal'}
                        </span>
                      </div>
                    </div>

                    {/* Presença Vocal & Exportação Master */}
                    <div className="md:col-span-4 flex flex-col justify-between gap-2 border-t md:border-t-0 md:border-l border-slate-800/80 md:pl-3 pt-2 md:pt-0">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-purple-400" />
                            Reforço Vocal
                          </span>
                          <span className="text-xs font-mono font-bold text-purple-300">
                            +{soundtrackConfig.voiceBoostDb}dB
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {[0, 3, 6].map((boost) => (
                            <button
                              key={boost}
                              type="button"
                              onClick={() => player?.setVoiceBoost(boost)}
                              className={`py-1 text-[11px] font-mono rounded border transition-all cursor-pointer ${
                                soundtrackConfig.voiceBoostDb === boost
                                  ? 'bg-purple-500 text-white font-bold border-purple-400'
                                  : 'bg-slate-950 text-slate-400 border-slate-800'
                              }`}
                            >
                              +{boost}dB
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Botão Exportar Master Studio */}
                      <button
                        type="button"
                        onClick={handleExportMasterMix}
                        disabled={isExportingMaster}
                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isExportingMaster ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                            <span>Renderizando Master 44.1kHz...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 text-slate-950" />
                            <span>Exportar Master Studio (.wav)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. Barra de Controle Principal (Thumb Zone) */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Bloco Esquerdo: Identificador Visual do Orador e Pílula da Trilha */}
          <div 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2.5 min-w-0 flex-1 max-w-[48%] sm:max-w-xs cursor-pointer select-none py-1 group"
            title={isExpanded ? 'Recolher Painel de Áudio' : 'Expandir Perfil e Trilha Sonora'}
          >
            <div className="relative shrink-0">
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
                      }
                    : {
                        scale: 1,
                        borderColor: `${currentSpeaker?.color || '#f59e0b'}40`,
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
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                  {currentSpeaker?.name || 'DialecticPod'}
                </p>

                {/* Pílula Dinâmica da Trilha Sonora & Ducking */}
                {soundtrackConfig.preset !== 'none' ? (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDrawerTab('soundtrack');
                      setIsExpanded(true);
                    }}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${
                      isDucking
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 ring-1 ring-amber-400/30'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    }`}
                    title={isDucking ? 'Auto-Ducking ativo na fala' : 'Trilha sonora ativa'}
                  >
                    <span>{currentPresetMeta.icon}</span>
                    <span className="truncate max-w-[65px] sm:max-w-none">{currentPresetMeta.ptName.split(' ')[0]}</span>
                    {isDucking && <span className="text-[9px] text-amber-400 font-bold hidden sm:inline">-14dB</span>}
                  </span>
                ) : (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDrawerTab('soundtrack');
                      setIsExpanded(true);
                    }}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-amber-400/30 transition-all"
                  >
                    <Music className="w-2.5 h-2.5 text-slate-500" />
                    <span className="hidden sm:inline">+ Trilha</span>
                  </span>
                )}

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

            {/* Botão Play/Pause Gigante */}
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

          {/* Bloco Direito: Botão Seletor de Velocidade & Ação Master */}
          <div className="flex items-center justify-end gap-1.5 flex-1 max-w-[28%] sm:max-w-xs">
            <button
              type="button"
              onClick={handleCycleSpeed}
              aria-label={`Velocidade atual: ${playbackRate}x. Toque para alterar.`}
              className="flex min-h-[44px] min-w-[44px] sm:min-w-[52px] items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-mono font-bold text-amber-300 hover:border-amber-400/50 hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <Gauge className="w-3.5 h-3.5 hidden sm:block text-slate-500" />
              <span>{playbackRate.toFixed(2).replace(/\.00$/, '')}x</span>
            </button>

            {/* Botão de Exportação Master Rápida no Desktop */}
            <button
              type="button"
              onClick={handleExportMasterMix}
              disabled={isExportingMaster}
              title="Baixar Master de Estúdio (WAV com Trilha e Ducking)"
              aria-label="Baixar Master de Estúdio"
              className="hidden lg:flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-amber-400 hover:border-amber-400/50 hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isExportingMaster ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>

            {/* Mudo */}
            <button
              type="button"
              onClick={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                player?.setVolume(nextMuted ? 0 : 1.0);
              }}
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

import React, { useState, useEffect } from 'react';
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
  Sliders,
  Music,
  Download,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SpeakerProfile, DebateTurn, LanguageCode, DebateScript } from '../types/debate';
import {
  GaplessAudioPlayer,
  SOUNDTRACK_PRESETS,
  SoundtrackConfig,
} from '../utils/audioEngine';
import {
  formatAudioTime,
  resolveEmotionMeta,
  resolveSpeakerAccent,
} from './audio/audioDockShared';
import { CompactAudioPill } from './audio/CompactAudioPill';
import { VoiceProfileDrawerTab } from './audio/VoiceProfileDrawerTab';
import { SoundtrackDrawerTab } from './audio/SoundtrackDrawerTab';
import { useAudioDockActions } from './audio/useAudioDockActions';

interface BottomAudioDockProps {
  player?: GaplessAudioPlayer;
  script?: DebateScript | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (newTime: number) => void;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  currentSpeaker?: SpeakerProfile;
  currentTurn?: DebateTurn;
  currentTurnText?: string;
  turnIndex: number;
  totalTurns: number;
  language?: LanguageCode;
}

const AVAILABLE_RATES = [1.0, 1.25, 1.5, 1.75, 2.0];

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
  const [isCompactPill, setIsCompactPill] = useState(true);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'voice' | 'soundtrack'>('voice');
  const [isMuted, setIsMuted] = useState(false);

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

  useEffect(() => {
    if (!player) return;
    const unsub = player.subscribe((state) => {
      setSoundtrackConfig({ ...state.soundtrack });
      setIsDucking(state.isDucking);
      setIsExportingMaster(state.isExportingMaster);
    });
    return () => unsub();
  }, [player]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const voiceId = currentTurn?.voice_id || currentSpeaker?.voiceId || 'Puck';
  const emotionMeta = resolveEmotionMeta(currentTurn?.emotion || 'thoughtful');
  const speakerAccent = resolveSpeakerAccent(currentSpeaker?.color);

  const prosody = currentTurn?.prosody || {
    speech_rate: 1.0,
    pre_delay_ms: 120,
    breath_sound: true,
    volume_gain: 1.0,
  };

  const actions = useAudioDockActions({
    player,
    script,
    currentSpeaker,
    currentTurn,
    voiceId,
    language,
    soundtrackConfig,
    setIsExportingMaster,
  });

  const handleCycleSpeed = (): void => {
    const currentIndex = AVAILABLE_RATES.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % AVAILABLE_RATES.length;
    onChangePlaybackRate(AVAILABLE_RATES[nextIndex]);
  };

  const handleSkip = (seconds: number): void => {
    const target = Math.min(Math.max(currentTime + seconds, 0), duration || 0);
    onSeek(target);
  };

  const currentPresetMeta =
    SOUNDTRACK_PRESETS.find((p) => p.id === soundtrackConfig.preset) || SOUNDTRACK_PRESETS[0];

  if (isCompactPill && !isExpanded) {
    return (
      <CompactAudioPill
        isPlaying={isPlaying}
        currentSpeaker={currentSpeaker}
        currentTime={currentTime}
        duration={duration}
        progressPercentage={progressPercentage}
        onTogglePlay={onTogglePlay}
        onExpandFullDock={() => setIsCompactPill(false)}
        onOpenSoundtrackDrawer={() => {
          setIsCompactPill(false);
          setActiveDrawerTab('soundtrack');
          setIsExpanded(true);
        }}
      />
    );
  }

  return (
    <aside
      id="BottomAudioDock"
      aria-label="Controles de Reprodução de Áudio"
      className="fixed bottom-0 left-0 right-0 lg:left-[var(--left-sidebar-w)] lg:right-[var(--right-sidebar-w)] z-30 dock-matte transition-all shadow-[0_-10px_30px_rgba(0,0,0,0.6)]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
    >
      <input
        type="file"
        ref={actions.fileInputRef}
        onChange={(e) => void actions.handleCustomAudioUpload(e)}
        accept="audio/*"
        className="hidden"
      />

      {/* 1. Tactile Progress Scrubber */}
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
              backgroundColor: speakerAccent,
            }}
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-1">
        {/* Expandable Drawer: Voice Profile vs Soundtrack & Ducking */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="overflow-hidden mb-3 border-b border-[var(--border-subtle)] pb-3"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-3 pt-1">
                <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-[var(--border-subtle)] shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveDrawerTab('voice')}
                    className={`min-h-11 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold font-sans transition-all cursor-pointer ${
                      activeDrawerTab === 'voice'
                        ? 'btn-matte-primary text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Voz & Prosódia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDrawerTab('soundtrack')}
                    className={`min-h-11 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold font-sans transition-all cursor-pointer ${
                      activeDrawerTab === 'soundtrack'
                        ? 'btn-matte-primary text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5 text-sky-400" />
                    <span>Trilha Sonora & Auto-Ducking</span>
                    {soundtrackConfig.preset !== 'none' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {actions.exportFeedback && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-primary surface-inset-pill px-2.5 py-1 rounded-full border border-[var(--border-subtle)] animate-fade-in">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: 'var(--status-success)' }}
                      />
                      <span>{actions.exportFeedback}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="min-h-11 text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer font-mono text-xs px-3 rounded-lg hover:bg-slate-900"
                  >
                    <span>Recolher</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {activeDrawerTab === 'voice' && (
                <VoiceProfileDrawerTab
                  currentSpeaker={currentSpeaker}
                  currentTurn={currentTurn}
                  currentTurnText={currentTurnText}
                  voiceId={voiceId}
                  emotionMeta={emotionMeta}
                  prosody={prosody}
                  turnIndex={turnIndex}
                  totalTurns={totalTurns}
                  currentTime={currentTime}
                  duration={duration}
                  isPlayingPreview={actions.isPlayingPreview}
                  previewLoading={actions.previewLoading}
                  previewSecondsLeft={actions.previewSecondsLeft}
                  isConfirmed={actions.isConfirmed}
                  onTogglePreviewAudio={() => void actions.handleTogglePreviewAudio()}
                />
              )}

              {activeDrawerTab === 'soundtrack' && (
                <SoundtrackDrawerTab
                  soundtrackConfig={soundtrackConfig}
                  isDucking={isDucking}
                  isExportingMaster={isExportingMaster}
                  onSelectSoundtrack={(presetId) => void actions.handleSelectSoundtrack(presetId)}
                  onChangeSoundtrackVolume={(vol) => player?.setSoundtrackVolume(vol)}
                  onToggleDucking={() => player?.setDuckingEnabled(!soundtrackConfig.duckingEnabled)}
                  onChangeDuckingDepth={(db) => player?.setDuckingDepth(db)}
                  onChangeVoiceBoost={(db) => player?.setVoiceBoost(db)}
                  onExportMasterMix={() => void actions.handleExportMasterMix()}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. Main Control Bar (Thumb Zone) */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left Block: Speaker Drawer Toggle + Soundtrack Shortcut */}
          <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[48%] sm:max-w-xs">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Recolher Painel de Áudio' : 'Expandir Perfil e Trilha Sonora'}
              title={isExpanded ? 'Recolher Painel de Áudio' : 'Expandir Perfil e Trilha Sonora'}
              className="min-h-11 flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer select-none py-1 group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div className="relative shrink-0">
                {isPlaying && (
                  <motion.span
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    animate={{ scale: [1, 1.28, 1.45], opacity: [0.65, 0.3, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                    style={{ border: `1.5px solid ${speakerAccent}` }}
                  />
                )}

                <motion.div
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border font-bold text-sm shadow-inner transition-transform group-active:translate-y-px"
                  animate={isPlaying ? { scale: [1, 1.04, 0.99, 1.07, 1.02, 1] } : { scale: 1 }}
                  transition={{ duration: 1.4, repeat: isPlaying ? Infinity : 0, ease: 'easeInOut' }}
                  style={{
                    borderColor: `color-mix(in oklab, ${speakerAccent} ${isPlaying ? '85%' : '40%'}, transparent)`,
                    backgroundColor: `color-mix(in oklab, ${speakerAccent} 15%, transparent)`,
                    color: speakerAccent,
                  }}
                >
                  {currentSpeaker ? currentSpeaker.name.charAt(0) : 'D'}
                  {isPlaying && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3" aria-hidden="true">
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
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  <span>{currentSpeaker?.roleTitle?.split(' ')[0] || 'Studio'}</span>
                  <span aria-hidden="true">•</span>
                  <span className="font-mono text-slate-500 tabular-nums">
                    {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
                  </span>
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveDrawerTab('soundtrack');
                setIsExpanded(true);
              }}
              aria-label={soundtrackConfig.preset !== 'none' ? 'Configurar trilha sonora ativa' : 'Adicionar trilha sonora'}
              title={
                soundtrackConfig.preset !== 'none'
                  ? isDucking
                    ? 'Auto-Ducking ativo na fala'
                    : 'Trilha sonora ativa'
                  : 'Configurar trilha sonora'
              }
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 min-h-11 rounded-lg text-[10px] font-mono border border-[var(--border-subtle)] transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                soundtrackConfig.preset !== 'none'
                  ? 'card-matte-active text-primary'
                  : 'btn-matte-dark text-secondary hover:text-primary'
              }`}
            >
              {soundtrackConfig.preset !== 'none' && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: isDucking
                      ? 'var(--brand-accent)'
                      : 'var(--status-success)',
                  }}
                />
              )}
              {soundtrackConfig.preset !== 'none' ? (
                <>
                  <span aria-hidden="true">{currentPresetMeta.icon}</span>
                  <span className="truncate max-w-[64px] sm:max-w-none">{currentPresetMeta.ptName.split(' ')[0]}</span>
                  {isDucking && <span className="text-[10px] text-amber-400 font-bold hidden sm:inline">-14dB</span>}
                </>
              ) : (
                <>
                  <Music className="w-3 h-3 text-slate-500" aria-hidden="true" />
                  <span className="hidden sm:inline">+ Trilha</span>
                </>
              )}
            </button>
          </div>

          {/* Center Block: Transport Controls */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => handleSkip(-10)}
                aria-label="Voltar 10 segundos"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:text-white active:translate-y-px hover:bg-slate-900 transition-all cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
                className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl btn-matte-primary text-white shadow-xl ring-1 ring-sky-400/40 active:translate-y-px transition-all cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5 text-white" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSkip(10)}
                aria-label="Avançar 10 segundos"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:text-white active:translate-y-px hover:bg-slate-900 transition-all cursor-pointer"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="min-h-11 flex items-center gap-1.5 px-3 rounded-full bg-slate-900/90 border border-[var(--border-subtle)] text-[10px] font-sans font-medium text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer transition-all active:translate-y-px"
              title="Toque para abrir configurações de sotaque, prosódia e voz"
            >
              <span>{emotionMeta.icon}</span>
              <span className="font-semibold text-sky-300 font-sans">{emotionMeta.ptLabel || 'Natural'}</span>
              <span className="text-slate-400 font-mono">• {currentSpeaker?.name || 'Orador'}</span>
            </button>
          </div>

          {/* Right Block: Speed, Export, Mute, Compact Pill */}
          <div className="flex items-center justify-end gap-1.5 flex-1 max-w-[28%] sm:max-w-xs">
            <button
              type="button"
              onClick={handleCycleSpeed}
              aria-label={`Velocidade atual: ${playbackRate}x. Toque para alterar.`}
              className="flex min-h-11 min-w-11 sm:min-w-[56px] items-center justify-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-slate-900 px-2 py-1 text-xs font-mono font-bold text-slate-200 hover:border-slate-700 hover:bg-slate-800 active:translate-y-px transition-all cursor-pointer shadow-sm"
            >
              <Gauge className="w-3.5 h-3.5 hidden sm:block text-slate-400" />
              <span>{playbackRate.toFixed(2).replace(/\.00$/, '')}x</span>
            </button>

            <button
              type="button"
              onClick={() => void actions.handleExportMasterMix()}
              disabled={isExportingMaster}
              title="Baixar Master de Estúdio (WAV com Trilha e Ducking)"
              aria-label="Baixar Master de Estúdio"
              className="hidden lg:flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-slate-900 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-800 active:translate-y-px transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isExportingMaster ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                player?.setVolume(nextMuted ? 0 : 1.0);
              }}
              aria-label={isMuted ? 'Desativar mudo' : 'Ativar mudo'}
              className="hidden sm:flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-all cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setIsCompactPill(true);
              }}
              title="Recolher para Pílula de Produtor (Linha Animada)"
              className="flex min-h-11 px-3 items-center justify-center rounded-xl btn-matte-dark text-[11px] font-mono text-secondary hover:text-primary cursor-pointer"
            >
              <span>Linha</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

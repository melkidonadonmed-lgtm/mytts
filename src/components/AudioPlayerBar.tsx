import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Download,
  Gauge,
  Activity,
  Layers,
} from 'lucide-react';
import { GaplessAudioPlayer, PlayerState, concatenateWavBuffers } from '../utils/audioEngine';
import { DebateScript } from '../types/debate';

interface AudioPlayerBarProps {
  player: GaplessAudioPlayer;
  script: DebateScript | null;
  onSynthesizeAllTurns: () => void;
  isSynthesizing: boolean;
  synthesizingProgress?: { current: number; total: number };
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  player,
  script,
  onSynthesizeAllTurns,
  isSynthesizing,
  synthesizingProgress,
}) => {
  const [playerState, setPlayerState] = useState<PlayerState>(player.getState());
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Subscribe to player state changes
  useEffect(() => {
    const unsubscribe = player.subscribe((state) => {
      setPlayerState({ ...state });
    });
    return () => unsubscribe();
  }, [player]);

  // Audio Visualizer Canvas animation using AnalyserNode
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = player.getAnalyserNode();
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / 32) - 1.5;
      let x = 0;

      for (let i = 0; i < 32; i++) {
        // Average chunk
        const index = Math.floor((i / 32) * (bufferLength / 2));
        const val = playerState.isPlaying ? dataArray[index] : 8;
        const percent = val / 255;
        const barHeight = Math.max(3, percent * (canvas.height - 4));

        // Amber/gold gradient with subtle cyan tips
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#f59e0b');
        gradient.addColorStop(1, '#38bdf8');

        ctx.fillStyle = playerState.isPlaying ? gradient : '#334155';
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, 2);
        ctx.fill();

        x += barWidth + 1.5;
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [player, playerState.isPlaying]);

  const activeTurn = script?.turns[playerState.currentTurnIndex];
  const activeSpeaker = activeTurn
    ? script?.speakers.find((s) => s.name === activeTurn.speaker) || script?.speakers[0]
    : script?.speakers[0];

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDownloadFullAudio = () => {
    if (!script) return;
    const validTurnAudios = script.turns
      .map((t) => t.audioBase64)
      .filter((b): b is string => Boolean(b));

    if (validTurnAudios.length === 0) return;

    const combinedBlob = concatenateWavBuffers(validTurnAudios);
    const url = URL.createObjectURL(combinedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}-debate.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const speedOptions = [1.0, 1.25, 1.5, 1.75, 2.0];

  const readyTurnsCount = script?.turns.filter((t) => Boolean(t.audioBase64)).length || 0;
  const totalTurnsCount = script?.turns.length || 0;
  const hasAudioReady = readyTurnsCount > 0;

  return (
    <div className="sticky bottom-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 shadow-2xl px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
        {/* Top Mini-Scrubber & Progress */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 tabular-nums w-10 text-right">
            {formatTime(playerState.currentTime)}
          </span>

          <div
            onClick={(e) => {
              if (playerState.duration > 0) {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                player.seek(ratio * playerState.duration);
              }
            }}
            className="relative flex-1 h-2 bg-slate-800 rounded-full cursor-pointer group"
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all"
              style={{
                width: `${
                  playerState.duration > 0
                    ? (playerState.currentTime / playerState.duration) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          <span className="text-xs font-mono text-slate-400 tabular-nums w-10">
            {formatTime(playerState.duration)}
          </span>
        </div>

        {/* Main Controls Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Active Speaker Info & Visualizer */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {activeSpeaker && (
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-slate-900 shadow-md relative transition-transform ${
                    playerState.isPlaying ? 'scale-105 ring-2 ring-amber-400/80' : ''
                  }`}
                  style={{ backgroundColor: activeSpeaker.color || '#38bdf8' }}
                >
                  {activeSpeaker.name.charAt(0)}
                  {playerState.isPlaying && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>

                <div className="flex flex-col min-w-[130px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white tracking-tight">
                      {activeSpeaker.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Turno {playerState.currentTurnIndex + 1}/{totalTurnsCount || 1}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                    {activeTurn ? activeTurn.emotion : 'Aguardando reprodução'}
                  </span>
                </div>
              </div>
            )}

            {/* Live Audio Spectrum */}
            <div className="hidden lg:block w-36 h-7 bg-slate-900/60 rounded px-1 py-0.5 border border-slate-800">
              <canvas ref={canvasRef} width={136} height={24} className="w-full h-full" />
            </div>
          </div>

          {/* Center Playback Engine Controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => player.prevTurn()}
              disabled={!hasAudioReady}
              className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Turno Anterior"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (!hasAudioReady && script) {
                  onSynthesizeAllTurns();
                } else {
                  player.togglePlay();
                }
              }}
              disabled={isSynthesizing}
              className="w-11 h-11 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold flex items-center justify-center transition-transform hover:scale-105 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              title={playerState.isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {playerState.isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => player.nextTurn()}
              disabled={!hasAudioReady}
              className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Próximo Turno"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Synthesize CTA if not synthesized */}
            {!hasAudioReady && (
              <button
                type="button"
                onClick={onSynthesizeAllTurns}
                disabled={isSynthesizing || !script}
                className="ml-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium border border-amber-400/30 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isSynthesizing
                    ? `Sintetizando (${synthesizingProgress?.current || 0}/${synthesizingProgress?.total || totalTurnsCount})...`
                    : 'Sintetizar Áudio dos Turnos'}
                </span>
              </button>
            )}
          </div>

          {/* Right Toolbar: Speed, Volume & Master Export */}
          <div className="flex items-center gap-3">
            {/* Speed Preserving Pitch */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              {speedOptions.map((rate) => {
                const active = playerState.playbackRate === rate;
                return (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => player.setSpeed(rate)}
                    className={`px-1.5 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                );
              })}
            </div>

            {/* Volume */}
            <div className="hidden md:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (isMuted) {
                    player.setVolume(volume);
                    setIsMuted(false);
                  } else {
                    player.setVolume(0);
                    setIsMuted(true);
                  }
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {isMuted || playerState.volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : playerState.volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(false);
                  player.setVolume(val);
                }}
                className="w-16 h-1 bg-slate-800 rounded-lg accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Master WAV Download */}
            <button
              type="button"
              onClick={handleDownloadFullAudio}
              disabled={readyTurnsCount === 0}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Baixar arquivo WAV completo unificado"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Exportar Master</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

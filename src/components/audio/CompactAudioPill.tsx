import React from 'react';
import { Music, Pause, Play, Sliders } from 'lucide-react';
import type { SpeakerProfile } from '../../types/debate';
import { formatAudioTime } from './audioDockShared';

interface CompactAudioPillProps {
  isPlaying: boolean;
  currentSpeaker?: SpeakerProfile;
  currentTime: number;
  duration: number;
  progressPercentage: number;
  onTogglePlay: () => void;
  onExpandFullDock: () => void;
  onOpenSoundtrackDrawer: () => void;
}

export const CompactAudioPill: React.FC<CompactAudioPillProps> = ({
  isPlaying,
  currentSpeaker,
  currentTime,
  duration,
  progressPercentage,
  onTogglePlay,
  onExpandFullDock,
  onOpenSoundtrackDrawer,
}) => {
  return (
    <aside
      id="BottomAudioDock"
      aria-label="Pílula de Produtor e Linha Animada"
      className="fixed bottom-3 left-0 right-0 lg:left-[var(--left-sidebar-w)] lg:right-[var(--right-sidebar-w)] z-30 px-4 pointer-events-none"
    >
      <div className="max-w-3xl mx-auto card-matte rounded-full px-3.5 py-2 shadow-2xl border border-amber-400/30 flex items-center justify-between gap-3 pointer-events-auto">
        <button
          type="button"
          onClick={onTogglePlay}
          className="btn-matte-amber min-h-11 px-4 rounded-full text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          <span>{isPlaying ? 'Pausar' : currentSpeaker?.name || 'Ouvir'}</span>
        </button>

        {/* Animated progress line */}
        <button
          type="button"
          onClick={onExpandFullDock}
          className="flex-1 min-h-11 flex items-center gap-2.5 min-w-0 cursor-pointer text-left"
          title="Expandir Pílula de Produtor (Trilha Sonora, Auto-Ducking e Vozes)"
        >
          <div className="flex-1 h-2 rounded-full surface-inset overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isPlaying
                  ? 'bg-gradient-to-r from-amber-500 via-emerald-400 to-amber-300 animate-pulse'
                  : 'bg-amber-500/70'
              }`}
              style={{ width: `${Math.max(12, progressPercentage)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono tabular-nums text-secondary shrink-0">
            {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
          </span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSoundtrackDrawer}
            className="min-h-11 min-w-11 px-3 rounded-full btn-matte-dark text-[11px] font-semibold text-amber-300 hover:text-primary inline-flex items-center justify-center gap-1 cursor-pointer"
            title="Abrir Mixer de Trilha Sonora & Auto-Ducking"
          >
            <Music className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">+ Trilha</span>
          </button>

          <button
            type="button"
            onClick={onExpandFullDock}
            className="min-h-11 min-w-11 px-3 rounded-full btn-matte-dark text-[11px] font-mono text-secondary hover:text-primary inline-flex items-center justify-center gap-1 cursor-pointer"
            title="Expandir Pílula de Produtor"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Produtor</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

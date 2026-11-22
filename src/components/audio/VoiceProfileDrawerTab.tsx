import React from 'react';
import {
  Check,
  Clock,
  Gauge,
  MessageSquare,
  Sliders,
  Sparkles,
  Tag,
  Volume2,
  Wind,
} from 'lucide-react';
import type { DebateTurn, SpeakerProfile } from '../../types/debate';
import {
  formatAudioTime,
  renderProsodicText,
  type EmotionMeta,
} from './audioDockShared';

interface VoiceProfileDrawerTabProps {
  currentSpeaker?: SpeakerProfile;
  currentTurn?: DebateTurn;
  currentTurnText?: string;
  voiceId: string;
  emotionMeta: EmotionMeta;
  prosody: {
    speech_rate?: number;
    pre_delay_ms?: number;
    breath_sound?: boolean;
    volume_gain?: number;
  };
  turnIndex: number;
  totalTurns: number;
  currentTime: number;
  duration: number;
  isPlayingPreview: boolean;
  previewLoading: boolean;
  previewSecondsLeft: number;
  isConfirmed: boolean;
  onTogglePreviewAudio: () => void;
}

export const VoiceProfileDrawerTab: React.FC<VoiceProfileDrawerTabProps> = ({
  currentSpeaker,
  currentTurn,
  currentTurnText,
  voiceId,
  emotionMeta,
  prosody,
  turnIndex,
  totalTurns,
  currentTime,
  duration,
  isPlayingPreview,
  previewLoading,
  previewSecondsLeft,
  isConfirmed,
  onTogglePreviewAudio,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
      {/* Voice Profile Summary */}
      <div
        className="lg:col-span-6 xl:col-span-5 bg-slate-900/90 rounded-xl p-3 border border-[var(--border-subtle)] shadow-inner flex flex-col justify-between gap-2.5"
        aria-label="Resumo do Perfil de Voz"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
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
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono font-medium surface-inset-pill text-[var(--brand-accent)] border border-[var(--border-subtle)] shrink-0 shadow-sm">
              <Tag className="w-3 h-3 text-[var(--brand-accent)]" />
              <span>
                Voice ID: <strong className="text-primary font-semibold">{voiceId}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={onTogglePreviewAudio}
              disabled={previewLoading}
              className={`min-h-11 inline-flex items-center gap-1.5 px-3 rounded-lg text-[11px] font-medium transition-all shadow-sm cursor-pointer select-none border ${
                isPlayingPreview
                  ? 'btn-matte-amber text-white border-[var(--border-subtle)] animate-pulse font-semibold'
                  : isConfirmed
                  ? 'card-matte-active text-[var(--status-success)] border-[var(--border-subtle)] font-semibold'
                  : 'btn-matte-dark text-primary border-[var(--border-subtle)]'
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

        {/* Vocal Emotion */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 rounded-lg px-2.5 py-1.5 border border-[var(--border-subtle)]">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <span>Emoção Vocal:</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${emotionMeta.bg} ${emotionMeta.text} ${emotionMeta.border}`}
            >
              <span>{emotionMeta.icon}</span>
              <span className="capitalize font-semibold">{emotionMeta.label}</span>
              <span className="text-slate-400 font-normal text-[10px]">
                ({emotionMeta.ptLabel})
              </span>
            </span>
            {currentSpeaker?.archetype && (
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider border border-[var(--border-subtle)] px-1.5 py-0.5 rounded bg-slate-900">
                {currentSpeaker.archetype}
              </span>
            )}
          </div>
        </div>

        {/* Prosody Settings */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
            <span>Configurações Prosódicas</span>
            <span className="text-[10px] font-mono text-slate-500">24kHz PCM RIFF</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <div className="bg-slate-950/80 rounded-lg p-2 border border-[var(--border-subtle)] flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Gauge className="w-3 h-3 text-sky-400" /> Ritmo
              </span>
              <span className="text-xs font-mono font-bold text-slate-100 mt-1">
                {(prosody.speech_rate || 1.0).toFixed(2)}x
              </span>
            </div>

            <div className="bg-slate-950/80 rounded-lg p-2 border border-[var(--border-subtle)] flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> Pré-Gap
              </span>
              <span className="text-xs font-mono font-bold text-slate-100 mt-1">
                +{prosody.pre_delay_ms ?? 0}ms
              </span>
            </div>

            <div className="bg-slate-950/80 rounded-lg p-2 border border-[var(--border-subtle)] flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Wind className="w-3 h-3 text-emerald-400" /> Respiração
              </span>
              <span className="text-xs font-mono font-semibold text-slate-100 mt-1 flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    prosody.breath_sound ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                />
                {prosody.breath_sound ? 'Ativa' : 'Desat.'}
              </span>
            </div>

            <div className="bg-slate-950/80 rounded-lg p-2 border border-[var(--border-subtle)] flex flex-col justify-between">
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

      {/* Live Turn Transcription */}
      <div className="lg:col-span-6 xl:col-span-7 bg-slate-900/80 rounded-xl p-3 border border-[var(--border-subtle)] flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            Transcrição em Tempo Real ({turnIndex + 1}/{totalTurns})
          </span>
          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
            <span>{currentSpeaker?.roleTitle?.split(' ')[0] || 'Orador'}</span>
            <span>•</span>
            <span className="text-slate-400">
              {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
            </span>
          </span>
        </div>

        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans bg-slate-950/70 p-2.5 rounded-lg border border-[var(--border-subtle)] flex-1 overflow-y-auto max-h-24">
          “{renderProsodicText(currentTurnText || currentTurn?.text)}”
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
          <span>Síntese neural com prosódia e pausas respiratórias</span>
          <span className="font-mono text-amber-400/80">
            Turno {turnIndex + 1} de {totalTurns}
          </span>
        </div>
      </div>
    </div>
  );
};

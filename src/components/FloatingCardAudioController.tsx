/**
 * Pílula de Produtor (Producer Pill) — controlador de áudio colapsável
 * com modo Linha Animada (compacto) e modo Estúdio Expandido (scrubber, velocidade e exportação).
 */
import React, { useState } from 'react';
import { GoogleIcon } from './GoogleIcon';

export interface FloatingCardAudioControllerProps {
  selectedLanguage: 'en' | 'it' | 'ja';
  onSelectLanguage: (lang: 'en' | 'it' | 'ja') => void;
  isPlaying: boolean;
  isLoading: boolean;
  isCached?: boolean;
  isCachedByLang?: Record<'en' | 'it' | 'ja', boolean>;
  onTogglePlay: () => void;
  onReplay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  speed: number;
  onChangeSpeed: (speed: number) => void;
  selectedVoice: string;
  cardVoices: Record<'en' | 'it' | 'ja', string>;
  onPlaySequence?: () => void;
  isPlayingSequence?: boolean;
  sequenceStep?: string | null;
  onOpenExport?: () => void;
  onDownloadFocusedWav?: () => void;
}

export const FloatingCardAudioController: React.FC<FloatingCardAudioControllerProps> = ({
  selectedLanguage,
  onSelectLanguage,
  isPlaying,
  isLoading,
  isCached,
  isCachedByLang,
  onTogglePlay,
  onReplay,
  currentTime,
  duration,
  onSeek,
  speed,
  onChangeSpeed,
  selectedVoice,
  cardVoices,
  onPlaySequence,
  isPlayingSequence,
  sequenceStep,
  onOpenExport,
  onDownloadFocusedWav,
}) => {
  // Inicia em modo Pílula Compacta (Linha Animada) para fluidez visual máxima, expandindo sob demanda
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const languageLabels: Record<'en' | 'it' | 'ja', { title: string; flag: string }> = {
    en: { title: 'Inglês', flag: 'EN' },
    it: { title: 'Italiano', flag: 'IT' },
    ja: { title: 'Japonês', flag: 'JA' },
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      data-state={isLoading ? 'loading' : isPlaying ? 'pressed' : 'idle'}
      aria-busy={isLoading}
      className="w-full my-1 transition-all"
    >
      {/* 1. PÍLULA DE PRODUTOR COMPACTA + LINHA ANIMADA (Sempre visível e limpa) */}
      <div
        className={`card-matte px-3 py-2.5 md:py-2 flex flex-col md:flex-row md:items-center justify-between gap-2 transition-all ${
          isExpanded ? 'rounded-t-2xl border-b-0' : 'rounded-2xl md:rounded-full shadow-md'
        }`}
      >
        {/* Linha 1 Mobile / Esquerda Desktop: Botão Play/Pause + Pílulas Rápidas de Idioma */}
        <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-2 min-w-0">
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={isLoading}
            className="btn-matte-amber h-9 px-3.5 rounded-full text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
            title={
              isPlaying
                ? 'Pausar reprodução'
                : `Ouvir ${languageLabels[selectedLanguage].title} (${selectedVoice})`
            }
          >
            {isLoading ? (
              <GoogleIcon name="progress_activity" size={16} className="animate-spin text-white" />
            ) : isPlaying ? (
              <GoogleIcon name="pause" size={16} filled className="text-white" />
            ) : (
              <GoogleIcon name="play_arrow" size={16} filled className="text-white" />
            )}
            <span className="truncate">
              {isLoading
                ? 'Gerando...'
                : isPlaying
                ? 'Pausar'
                : `${languageLabels[selectedLanguage].flag} · ${selectedVoice}`}
            </span>
          </button>

          {/* Seletor Rápido dos 3 Idiomas dentro da Pílula */}
          <div className="inline-flex items-center gap-1 surface-inset p-1 rounded-full shrink-0">
            {(['en', 'it', 'ja'] as const).map((lang) => {
              const isActive = selectedLanguage === lang;
              const meta = languageLabels[lang];
              const vName = cardVoices[lang] || selectedVoice;
              return (
                <button
                  key={lang}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelectLanguage(lang)}
                  className={`btn-compact-touch h-7 px-2.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    isActive
                      ? 'btn-matte-amber text-white shadow-xs'
                      : 'text-secondary hover:text-primary'
                  }`}
                  title={`Selecionar ${meta.title} (${vName})`}
                >
                  <span className="font-mono text-[10px]">{meta.flag}</span>
                  <span className="hidden lg:inline truncate">{vName}</span>
                  {isCachedByLang?.[lang] && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? 'bg-white' : 'bg-emerald-400'
                      }`}
                      title="Cache 0ms pronto"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Linha 2 Mobile / Centro+Direita Desktop: LINHA ANIMADA DE PROGRESSO + AÇÕES */}
        <div className="w-full md:flex-1 flex items-center justify-between gap-2 min-w-0">
          <div className="flex-1 min-w-0 flex items-center gap-2 px-1">
            <div className="relative flex-1 h-2 rounded-full surface-inset overflow-hidden flex items-center">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  isPlaying || isLoading
                    ? 'bg-gradient-to-r from-amber-500 via-emerald-400 to-amber-300 animate-pulse'
                    : 'bg-amber-500/70'
                }`}
                style={{
                  width: `${
                    isPlaying || currentTime > 0 ? Math.max(8, progressPercent) : isCached ? 100 : 22
                  }%`,
                }}
              />
            </div>
            <span className="text-[10px] font-mono tabular-nums text-secondary shrink-0">
              {duration > 0 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : '0:00'}
            </span>
          </div>

          {/* Direita: Trilogia + Botão Expandir/Recolher Pílula */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onPlaySequence && (
              <button
                type="button"
                onClick={onPlaySequence}
                disabled={isLoading}
                title="Tocar os 3 idiomas em sequência (EN → IT → JA)"
                className={`btn-compact-touch h-8 px-2.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-all ${
                  isPlayingSequence
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 animate-pulse font-bold'
                    : 'btn-matte-dark text-secondary hover:text-primary'
                }`}
              >
                <GoogleIcon name="queue_music" size={15} className="text-amber-400" />
                <span className="hidden sm:inline">Trilogia</span>
                {isPlayingSequence && sequenceStep && (
                  <span className="text-[10px] font-mono bg-amber-500 text-white px-1 rounded">
                    {sequenceStep}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded((prev) => !prev)}
              className="btn-compact-touch h-8 px-2.5 rounded-full btn-matte-dark text-[11px] font-mono text-secondary hover:text-primary inline-flex items-center gap-1 cursor-pointer"
              title={isExpanded ? 'Recolher para Linha Animada' : 'Expandir controles de Produtor'}
            >
              <GoogleIcon name={isExpanded ? 'expand_less' : 'tune'} size={15} className="text-amber-400" />
              <span className="hidden sm:inline">{isExpanded ? 'Linha' : 'Produtor'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. GAVETA EXPANDIDA DO PRODUTOR (Scrubber fino, Ritmo, Download WAV e Exportação) */}
      {isExpanded && (
        <div className="card-matte rounded-b-2xl p-3.5 border-t border-slate-800/60 flex flex-col gap-3 animate-in fade-in">
          {/* Scrubber de Precisão */}
          <div className="flex items-center gap-3 w-full">
            <span className="text-[11px] font-mono tabular-nums text-secondary w-9 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <input
              aria-label="Posição de reprodução do áudio"
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={currentTime}
              disabled={duration <= 0}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="slider-matte flex-1"
              style={{
                background: `linear-gradient(to right, #f59e0b ${progressPercent}%, #1e293b ${progressPercent}%)`,
              }}
            />
            <span className="text-[11px] font-mono tabular-nums text-secondary w-9 shrink-0">
              {formatTime(duration)}
            </span>
          </div>

          {/* Controles de Produtor: Replay, WAV, Exportar e Ritmo */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onReplay}
                disabled={duration <= 0}
                className="btn-matte-dark h-8 px-2.5 rounded-xl text-xs text-secondary hover:text-primary inline-flex items-center gap-1 cursor-pointer"
                title="Reiniciar áudio"
              >
                <GoogleIcon name="replay" size={15} />
                <span>Reiniciar</span>
              </button>

              {onDownloadFocusedWav && (
                <button
                  type="button"
                  onClick={onDownloadFocusedWav}
                  className="btn-matte-dark h-8 px-2.5 rounded-xl text-xs text-secondary hover:text-primary inline-flex items-center gap-1 cursor-pointer"
                >
                  <GoogleIcon name="graphic_eq" size={15} className="text-sky-400" />
                  <span>Baixar WAV</span>
                </button>
              )}

              {onOpenExport && (
                <button
                  type="button"
                  onClick={onOpenExport}
                  className="btn-matte-dark h-8 px-3 rounded-xl text-xs text-amber-300 hover:text-primary inline-flex items-center gap-1 cursor-pointer"
                >
                  <GoogleIcon name="download" size={15} className="text-amber-400" />
                  <span>Exportar (CSV / MD / WAV)</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 surface-inset p-1 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-secondary px-1.5">Ritmo:</span>
              {[0.8, 1.0, 1.25, 1.5].map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  onClick={() => onChangeSpeed(s)}
                  className={`btn-compact-touch px-2 py-0.5 text-[11px] rounded-lg font-mono tabular-nums cursor-pointer transition-all ${
                    speed === s
                      ? 'btn-matte-amber text-white font-bold'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

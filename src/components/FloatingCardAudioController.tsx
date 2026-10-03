import React from 'react';
import { GoogleIcon } from './GoogleIcon';
import { GEMINI_VOICES } from '../types/voices';

export interface FloatingCardAudioControllerProps {
  selectedLanguage: 'en' | 'it' | 'ja';
  onSelectLanguage: (lang: 'en' | 'it' | 'ja') => void;
  isPlaying: boolean;
  isLoading: boolean;
  onTogglePlay: () => void;
  onReplay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  speed: number;
  onChangeSpeed: (speed: number) => void;
  selectedVoice: string;
  onChangeVoice: (voice: string) => void;
  onPlaySequence?: () => void;
  isPlayingSequence?: boolean;
  sequenceStep?: string | null;
}

export const FloatingCardAudioController: React.FC<FloatingCardAudioControllerProps> = ({
  selectedLanguage,
  onSelectLanguage,
  isPlaying,
  isLoading,
  onTogglePlay,
  onReplay,
  currentTime,
  duration,
  onSeek,
  speed,
  onChangeSpeed,
  selectedVoice,
  onChangeVoice,
  onPlaySequence,
  isPlayingSequence,
  sequenceStep,
}) => {
  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const languageLabels: Record<'en' | 'it' | 'ja', { title: string; flag: string; badge: string }> = {
    en: { title: 'Inglês', flag: '🇺🇸', badge: 'US Native' },
    it: { title: 'Italiano', flag: '🇮🇹', badge: 'Coloquial' },
    ja: { title: 'Japonês', flag: '🇯🇵', badge: 'Tokyo Std' },
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="w-full dock-matte rounded-2xl p-3 sm:p-4 my-2 transition-all">
      <div className="flex flex-col gap-3">
        
        {/* Linha Superior: Seletor Tátil de Card/Idioma + Status da Voz */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800/80">
          
          {/* Seletor Tátil dos 3 Idiomas em Pills Foscas */}
          <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80">
            {(['en', 'it', 'ja'] as const).map((lang) => {
              const isActive = selectedLanguage === lang;
              const meta = languageLabels[lang];
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onSelectLanguage(lang)}
                  className={`btn-matte px-3 py-1.5 text-xs rounded-lg transition-all ${
                    isActive
                      ? 'btn-matte-amber'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                  title={`Focar áudio em ${meta.title}`}
                >
                  <span className="text-sm leading-none">{meta.flag}</span>
                  <span>{meta.title}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950 shrink-0 ml-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Voz Neural e Modo Trilogia Sequencial Opcional */}
          <div className="flex items-center gap-2">
            
            {/* Seletor de Voz */}
            <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800/80 px-2.5 py-1 rounded-xl text-xs">
              <GoogleIcon name="record_voice_over" size={16} className="text-amber-400/90" />
              <span className="text-slate-400 text-[11px] hidden sm:inline">Voz:</span>
              <select
                value={selectedVoice}
                onChange={(e) => onChangeVoice(e.target.value)}
                className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none cursor-pointer pr-1"
              >
                {GEMINI_VOICES.map((v) => (
                  <option key={v.name} value={v.name} className="bg-slate-900 text-slate-100">
                    {v.name} ({v.gender === 'male' ? 'M' : 'F'})
                  </option>
                ))}
              </select>
            </div>

            {/* Botão de Sequência Trilogia (Opcional, com aviso explícito) */}
            {onPlaySequence && (
              <button
                type="button"
                onClick={onPlaySequence}
                disabled={isLoading}
                title="Tocar os 3 idiomas ordenadamente (Inglês → Italiano → Japonês)"
                className={`btn-matte px-2.5 py-1 text-xs rounded-xl border transition-all ${
                  isPlayingSequence
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 animate-pulse'
                    : 'btn-matte-dark text-slate-300 hover:text-white'
                }`}
              >
                <GoogleIcon name="queue_music" size={16} className="text-amber-400" />
                <span className="hidden md:inline">Ouvir Trilogia (EN→IT→JA)</span>
                {isPlayingSequence && sequenceStep && (
                  <span className="text-[10px] font-mono bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-bold">
                    {sequenceStep}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Linha Central: Barra de Progresso (Scrubber) Tátil */}
        <div className="flex items-center gap-3 w-full">
          <span className="text-[11px] font-mono text-slate-400 w-9 text-right shrink-0">
            {formatTime(currentTime)}
          </span>

          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={currentTime}
              disabled={duration <= 0}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="slider-matte w-full"
              style={{
                background: `linear-gradient(to right, #f59e0b ${progressPercent}%, #1e293b ${progressPercent}%)`,
              }}
              title="Arrastar para buscar posição no áudio"
            />
          </div>

          <span className="text-[11px] font-mono text-slate-500 w-9 shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        {/* Linha Inferior: Controles Principais de Áudio (Play/Pause, Replay, Velocidade) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          
          {/* Lado Esquerdo: Botão Play/Pause Principal + Replay */}
          <div className="flex items-center gap-2">
            
            {/* Botão Play/Pause Grande e Tátil (Apenas Card Focado) */}
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={isLoading}
              className="btn-matte btn-matte-amber h-11 px-5 text-sm rounded-xl font-bold flex items-center gap-2"
              title={isPlaying ? 'Pausar áudio' : `Ouvir ${languageLabels[selectedLanguage].title}`}
            >
              {isLoading ? (
                <>
                  <GoogleIcon name="progress_activity" size={20} className="animate-spin text-slate-950" />
                  <span>Sintetizando...</span>
                </>
              ) : isPlaying ? (
                <>
                  <GoogleIcon name="pause" size={20} filled className="text-slate-950" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <GoogleIcon name="play_arrow" size={20} filled className="text-slate-950" />
                  <span>Ouvir {languageLabels[selectedLanguage].title}</span>
                </>
              )}
            </button>

            {/* Botão Replay Tátil */}
            <button
              type="button"
              onClick={onReplay}
              disabled={duration <= 0}
              className="btn-matte btn-matte-dark h-11 w-11 rounded-xl text-slate-300 hover:text-white"
              title="Reiniciar áudio do início"
            >
              <GoogleIcon name="replay" size={20} />
            </button>
          </div>

          {/* Lado Direito: Seletor Tátil de Velocidade */}
          <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-mono uppercase text-slate-500 px-1 hidden sm:inline">
              Velocidade:
            </span>
            {[0.8, 1.0, 1.25].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChangeSpeed(s)}
                className={`btn-matte px-2.5 py-1 text-xs rounded-lg font-mono transition-all ${
                  speed === s
                    ? 'btn-matte-amber'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

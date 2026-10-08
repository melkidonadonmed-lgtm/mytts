import React from 'react';
import { GoogleIcon } from './GoogleIcon';
import { GEMINI_VOICES } from '../types/voices';

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
  onChangeVoice: (voice: string) => void;
  onPlaySequence?: () => void;
  isPlayingSequence?: boolean;
  sequenceStep?: string | null;
  onOpenExport?: () => void;
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
  onChangeVoice,
  onPlaySequence,
  isPlayingSequence,
  sequenceStep,
  onOpenExport,
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
                      ? 'btn-matte-amber text-white font-bold'
                      : 'text-secondary hover:text-primary hover:bg-slate-500/10'
                  }`}
                  title={`Focar áudio em ${meta.title}`}
                >
                  <span className="text-sm leading-none">{meta.flag}</span>
                  <span>{meta.title}</span>
                  {isCachedByLang?.[lang] && !isActive && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold leading-none" title="Áudio pronto no cache local (0ms)">
                      ⚡
                    </span>
                  )}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-amber-200 shrink-0 ml-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Voz Neural e Modo Trilogia Sequencial Opcional */}
          <div className="flex items-center gap-2">
            
            {/* Seletor de Voz */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-800/80 px-2.5 py-1 rounded-xl text-xs">
              <GoogleIcon name="record_voice_over" size={16} className="text-amber-600 dark:text-amber-400/90" />
              <span className="text-secondary text-[11px] hidden sm:inline">Voz:</span>
              <select
                value={selectedVoice}
                onChange={(e) => onChangeVoice(e.target.value)}
                className="bg-transparent text-primary font-semibold text-xs focus:outline-none cursor-pointer pr-1"
              >
                {GEMINI_VOICES.map((v) => (
                  <option key={v.name} value={v.name} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
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
                    ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 animate-pulse font-bold'
                    : 'btn-matte-dark text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <GoogleIcon name="queue_music" size={16} className="text-amber-600 dark:text-amber-400" />
                <span className="hidden md:inline font-medium">Ouvir Trilogia (EN→IT→JA)</span>
                {isPlayingSequence && sequenceStep && (
                  <span className="text-[10px] font-mono bg-amber-500 text-white px-1.5 py-0.2 rounded font-bold">
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
              className="btn-matte btn-matte-amber h-11 px-5 text-sm rounded-xl font-bold flex items-center gap-2 text-white"
              title={isPlaying ? 'Pausar áudio' : `Ouvir ${languageLabels[selectedLanguage].title}`}
            >
              {isLoading ? (
                <>
                  <GoogleIcon name="progress_activity" size={20} className="animate-spin text-white" />
                  <span>Sintetizando...</span>
                </>
              ) : isPlaying ? (
                <>
                  <GoogleIcon name="pause" size={20} filled className="text-white" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <GoogleIcon name="play_arrow" size={20} filled className="text-white" />
                  <span>Ouvir {languageLabels[selectedLanguage].title}</span>
                  {isCached && (
                    <span className="text-[10px] font-mono bg-white/20 text-white px-1.5 py-0.5 rounded font-bold">
                      ⚡ 0ms
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Botão Replay Tátil */}
            <button
              type="button"
              onClick={onReplay}
              disabled={duration <= 0}
              className="btn-matte btn-matte-dark h-11 w-11 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
              title="Reiniciar áudio do início"
            >
              <GoogleIcon name="replay" size={20} />
            </button>
          </div>

          {/* Lado Direito: Ações de Exportação e Velocidade */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenExport && (
              <button
                type="button"
                onClick={onOpenExport}
                className="btn-matte btn-matte-dark h-9 px-3 rounded-xl text-xs text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-white flex items-center gap-1.5 border border-amber-500/30 hover:border-amber-500/50 transition-all cursor-pointer font-medium"
                title="Exportar Chunks desta interação (Anki, Markdown, JSON ou Deck)"
              >
                <GoogleIcon name="download" size={16} className="text-amber-600 dark:text-amber-400" />
                <span>Exportar Chunks</span>
              </button>
            )}

            {/* Seletor Tátil de Velocidade */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/70 p-1 rounded-xl border border-slate-300 dark:border-slate-800/80">
              <span className="text-[10px] font-mono uppercase text-slate-600 dark:text-slate-500 px-1 hidden sm:inline">
                Velocidade:
              </span>
              {[0.8, 1.0, 1.25, 1.5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChangeSpeed(s)}
                  className={`btn-matte px-2 py-0.5 text-xs rounded-lg font-mono transition-all ${
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

      </div>
    </div>
  );
};

/**
 * Controlador flutuante de áudio por card — sincronizado com a voz exclusiva do card focado.
 */
import React from 'react';
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
    <div data-state="idle" aria-busy={isLoading} className="w-full dock-matte rounded-2xl p-3 sm:p-4 my-2 transition-all">
      <div className="flex flex-col gap-3">
        
        {/* Linha Superior: Seletor de Card em Pílula (#8e8999) + Status Sincronizado da Voz do Card */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800/80">
          
          {/* Seletor Tátil dos 3 Cards mostrando a voz atribuída a cada card */}
          <div className="pill-nav-shell flex items-center gap-1">
            {(['en', 'it', 'ja'] as const).map((lang) => {
              const isActive = selectedLanguage === lang;
              const meta = languageLabels[lang];
              const vName = cardVoices[lang] || selectedVoice;
              return (
                <button
                  key={lang}
                  type="button"
                  data-active={isActive}
                  onClick={() => onSelectLanguage(lang)}
                  className="pill-nav-item px-3 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer btn-anti-squish"
                  title={`Focar card ${meta.title} (Voz: ${vName})`}
                >
                  <span className="text-sm leading-none">{meta.flag}</span>
                  <span>{meta.title}</span>
                  <span className="text-[10px] font-mono opacity-80">· {vName}</span>
                  {isCachedByLang?.[lang] && (
                    <span className="text-[10px] font-mono font-bold leading-none" title="Áudio pronto no cache local (0ms)">
                      ⚡
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Indicador Único Sincronizado + Modo Trilogia Sequencial */}
          <div className="flex items-center gap-2">
            <div
              className="inline-flex items-center gap-1.5 bg-slate-950/60 border border-slate-800/80 px-2.5 py-1 rounded-xl text-xs"
              title="A voz exibida aqui acompanha automaticamente o card selecionado acima"
            >
              <GoogleIcon name="record_voice_over" size={15} className="text-amber-400" />
              <span className="text-secondary text-[11px]">Voz sincronizada do card:</span>
              <strong className="text-primary font-mono text-xs">{selectedVoice}</strong>
            </div>

            {onPlaySequence && (
              <button
                type="button"
                onClick={onPlaySequence}
                disabled={isLoading}
                title="Tocar os 3 cards em sequência respeitando a voz individual de cada card"
                className={`btn-matte px-2.5 py-1 text-xs rounded-xl border transition-all ${
                  isPlayingSequence
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse font-bold'
                    : 'btn-matte-dark text-secondary hover:text-primary'
                }`}
              >
                <GoogleIcon name="queue_music" size={16} className="text-amber-400" />
                <span className="hidden md:inline font-medium">Trilogia (EN→IT→JA)</span>
                {isPlayingSequence && sequenceStep && (
                  <span className="text-[10px] font-mono bg-amber-500 text-white px-1.5 py-0.2 rounded font-bold">
                    {sequenceStep}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Linha Central: Barra de Progresso (Scrubber) Tátil com Tabular-Nums */}
        <div className="flex items-center gap-3 w-full">
          <span className="text-[11px] font-mono tabular-nums text-secondary w-9 text-right shrink-0">
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

          <span className="text-[11px] font-mono tabular-nums text-secondary w-9 shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        {/* Linha Inferior: Controles Principais de Áudio (Play/Pause, Replay, Download WAV, Exportar, Velocidade) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          
          {/* Lado Esquerdo: Botão Play/Pause Principal + Replay */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={isLoading}
              className="btn-matte btn-matte-amber h-11 px-5 text-sm rounded-xl font-bold flex items-center gap-2 text-white"
              title={isPlaying ? 'Pausar áudio' : `Ouvir ${languageLabels[selectedLanguage].title} (${selectedVoice})`}
            >
              {isLoading ? (
                <>
                  <GoogleIcon name="progress_activity" size={20} className="animate-spin text-white" />
                  <span>Sintetizando ({selectedVoice})...</span>
                </>
              ) : isPlaying ? (
                <>
                  <GoogleIcon name="pause" size={20} filled className="text-white" />
                  <span>Pausar ({selectedVoice})</span>
                </>
              ) : (
                <>
                  <GoogleIcon name="play_arrow" size={20} filled className="text-white" />
                  <span>Ouvir {languageLabels[selectedLanguage].title} · {selectedVoice}</span>
                  {isCached && (
                    <span className="text-[10px] font-mono bg-white/20 text-white px-1.5 py-0.5 rounded font-bold">
                      ⚡ 0ms
                    </span>
                  )}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onReplay}
              disabled={duration <= 0}
              className="btn-matte btn-matte-dark h-11 w-11 rounded-xl text-secondary hover:text-primary"
              title="Reiniciar áudio do início"
            >
              <GoogleIcon name="replay" size={20} />
            </button>
          </div>

          {/* Lado Direito: Download WAV, Exportação Multi-Formato e Velocidade */}
          <div className="flex flex-wrap items-center gap-2">
            {onDownloadFocusedWav && (
              <button
                type="button"
                onClick={onDownloadFocusedWav}
                className="btn-matte btn-matte-dark h-9 px-3 rounded-xl text-xs text-secondary hover:text-primary flex items-center gap-1.5 cursor-pointer font-medium"
                title={`Baixar WAV 24kHz do card ${languageLabels[selectedLanguage].title} (${selectedVoice})`}
              >
                <GoogleIcon name="graphic_eq" size={16} className="text-sky-400" />
                <span>Baixar WAV</span>
              </button>
            )}

            {onOpenExport && (
              <button
                type="button"
                onClick={onOpenExport}
                className="btn-matte btn-matte-dark h-9 px-3 rounded-xl text-xs text-amber-300 hover:text-white flex items-center gap-1.5 border border-amber-500/30 hover:border-amber-500/50 transition-all cursor-pointer font-medium"
                title="Exportar Chunks e Áudio desta interação (Anki CSV, Markdown, JSON, WAV ou Deck)"
              >
                <GoogleIcon name="download" size={16} className="text-amber-400" />
                <span>Exportar (CSV / MD / WAV)</span>
              </button>
            )}

            {/* Seletor Tátil de Velocidade */}
            <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
              <span className="text-[10px] font-mono uppercase text-secondary px-1 hidden sm:inline">
                Ritmo:
              </span>
              {[0.8, 1.0, 1.25, 1.5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChangeSpeed(s)}
                  className={`btn-matte px-2 py-0.5 text-xs rounded-lg font-mono tabular-nums transition-all ${
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

import React, { useState } from 'react';
import { AlignedChunk } from '../types/polyglot';
import { GEMINI_VOICES } from '../types/voices';
import { GoogleIcon } from './GoogleIcon';

export interface LanguageColumnCardProps {
  languageCode: 'en' | 'it' | 'ja';
  languageTitle: string;
  flag: string;
  badgeText: string;
  chunks: AlignedChunk[];
  fullText: string;
  hoveredChunkId: number | null;
  onHoverChunk: (id: number | null) => void;
  onClickChunk: (chunkText: string, language: string, event: React.MouseEvent) => void;

  // Seleção do Card e Sincronização de Voz por Card
  isSelected: boolean;
  onSelectCard: () => void;
  cardVoice: string;
  onChangeCardVoice: (voiceId: string) => void;
  isPlayingCard?: boolean;
  isLoadingCard?: boolean;
  isCached?: boolean;
  onTogglePlayCard?: () => void;
  onDownloadCardWav?: () => void;
}

export const LanguageColumnCard: React.FC<LanguageColumnCardProps> = ({
  languageCode,
  languageTitle,
  flag,
  badgeText,
  chunks,
  fullText,
  hoveredChunkId,
  onHoverChunk,
  onClickChunk,
  isSelected,
  onSelectCard,
  cardVoice,
  onChangeCardVoice,
  isPlayingCard = false,
  isLoadingCard = false,
  isCached = false,
  onTogglePlayCard,
  onDownloadCardWav,
}) => {
  const [copiedFull, setCopiedFull] = useState(false);

  const handleCopyFull = (e: React.MouseEvent): void => {
    e.stopPropagation();
    navigator.clipboard.writeText(fullText);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 1800);
  };

  const getLanguageTag = (code: 'en' | 'it' | 'ja'): string => {
    if (code === 'en') return 'en-US';
    if (code === 'it') return 'it-IT';
    if (code === 'ja') return 'ja-JP';
    return 'en-US';
  };

  return (
    <div
      data-state={isSelected ? 'pressed' : 'idle'}
      aria-busy={isLoadingCard}
      onClick={onSelectCard}
      className={`group flex-1 flex flex-col rounded-2xl overflow-hidden cursor-pointer ${
        isSelected ? 'card-matte-active' : 'card-matte'
      }`}
    >
      {/* 1. Cabeçalho Minimalista com Seletor de Voz Direto no Card */}
      <div className="px-3.5 py-2.5 bg-slate-950/60 border-b border-slate-800/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-lg select-none inline-block transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3"
            role="img"
            aria-label={languageTitle}
          >
            {flag}
          </span>
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-bold text-primary font-display tracking-tight">
              {languageTitle}
            </h3>
            <span className="text-[10px] font-mono font-medium text-secondary bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-800">
              {badgeText}
            </span>
          </div>
        </div>

        {/* Controles Diretos do Card: Seletor de Voz + Play + Download WAV + Copiar */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Seletor de Voz Exclusivo deste Card (sincroniza com a voz global ao focar/trocar) */}
          <label
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] transition-all cursor-pointer ${
              isSelected
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-200 font-bold'
                : 'bg-slate-900/90 border-slate-800 text-secondary hover:text-primary hover:border-slate-600'
            }`}
            title="Escolher voz neural para este card (sincroniza com o controle global)"
          >
            <GoogleIcon name="record_voice_over" size={14} className="text-amber-400 shrink-0" />
            <select
              aria-label={`Voz do card ${languageTitle}`}
              value={cardVoice}
              onChange={(e) => onChangeCardVoice(e.target.value)}
              className="bg-transparent text-primary font-semibold text-[11px] focus:outline-none cursor-pointer"
            >
              {GEMINI_VOICES.map((v) => (
                <option
                  key={v.id}
                  value={v.id}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {v.name} ({v.gender === 'male' ? 'M' : 'F'})
                </option>
              ))}
            </select>
          </label>

          {/* Botão Ouvir / Pausar Direto no Card */}
          {onTogglePlayCard && (
            <button
              type="button"
              onClick={onTogglePlayCard}
              disabled={isLoadingCard}
              title={isPlayingCard ? `Pausar ${languageTitle}` : `Ouvir ${languageTitle} com voz ${cardVoice}`}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer btn-anti-squish ${
                isPlayingCard
                  ? 'btn-matte-amber text-white shadow-sm'
                  : 'btn-matte-dark text-secondary hover:text-primary'
              }`}
            >
              {isLoadingCard ? (
                <GoogleIcon name="progress_activity" size={14} className="animate-spin text-amber-400" />
              ) : isPlayingCard ? (
                <GoogleIcon name="pause" size={14} filled className="text-white" />
              ) : (
                <GoogleIcon name="play_arrow" size={14} filled className="text-amber-400" />
              )}
              <span className="font-mono text-[10px]">{isCached ? '⚡' : 'Ouvir'}</span>
            </button>
          )}

          {/* Botão Baixar WAV Direto do Card */}
          {onDownloadCardWav && (
            <button
              type="button"
              onClick={onDownloadCardWav}
              title={`Baixar áudio WAV 24kHz deste card (${languageTitle} · ${cardVoice})`}
              className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <GoogleIcon name="download" size={15} />
            </button>
          )}

          {/* Botão Copiar */}
          <button
            type="button"
            onClick={handleCopyFull}
            title="Copiar texto completo deste idioma"
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            {copiedFull ? (
              <GoogleIcon name="check" size={15} className="text-emerald-400" />
            ) : (
              <GoogleIcon name="content_copy" size={15} />
            )}
          </button>
        </div>
      </div>

      {/* 2. Corpo Editorial Nítido com Chunks Interativos */}
      <div className="p-4 flex-1 flex flex-col justify-between text-[14.5px] leading-[1.68] select-text gap-3">
        <div className="flex flex-wrap gap-x-1 gap-y-1.5 items-baseline">
          {chunks.map((chunk) => {
            const chunkText =
              languageCode === 'en' ? chunk.en : languageCode === 'it' ? chunk.it : chunk.ja;
            const isHovered = hoveredChunkId === chunk.id;

            return (
              <span
                key={chunk.id}
                onMouseEnter={() => onHoverChunk(chunk.id)}
                onMouseLeave={() => onHoverChunk(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onClickChunk(chunkText, getLanguageTag(languageCode), e);
                }}
                title="Clique para ouvir esta frase ou criar flashcard"
                className={`inline-block cursor-pointer rounded-lg px-1.5 py-0.5 transition-all duration-200 relative ${
                  isHovered
                    ? '-translate-y-0.5 bg-amber-100 text-amber-950 dark:bg-amber-400/25 dark:text-amber-100 font-semibold ring-1 ring-amber-400/60 shadow-sm'
                    : isSelected
                    ? 'text-primary font-medium hover:bg-white/10'
                    : 'text-primary font-medium hover:bg-white/10'
                }`}
              >
                <span>{chunkText}</span>
                {languageCode === 'ja' && chunk.jaPronunciation && (
                  <span className="block text-[11px] font-mono text-amber-800 dark:text-amber-300 -mt-0.5 tracking-tight pointer-events-none select-none font-semibold">
                    {chunk.jaPronunciation}
                  </span>
                )}
              </span>
            );
          })}
        </div>

        {/* Rodapé Sutil de Status de Foco e Voz Sincronizada */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/40 text-[11px] font-mono font-medium text-secondary">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full transition-transform duration-200 group-hover:scale-125 ${
                isSelected ? 'bg-amber-400 animate-pulse' : 'bg-slate-400/60'
              }`}
            />
            <span>{isSelected ? `Card Ativo · Voz ${cardVoice}` : `Voz do card: ${cardVoice}`}</span>
          </span>
          {isCached && (
            <span className="text-emerald-400 font-semibold" title="Áudio em cache local 0ms">
              ⚡ Cache 0ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

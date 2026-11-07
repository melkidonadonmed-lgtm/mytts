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
      className={`group flex-1 flex flex-col rounded-2xl overflow-hidden ${
        isPlayingCard
          ? 'card-matte-active ring-2 ring-amber-400/60'
          : isSelected
          ? 'card-matte-active'
          : 'card-matte'
      }`}
    >
      {/* 1. Cabeçalho Estruturado com Espaçamento Amplo e Zero Colisão */}
      <div className="px-4 py-3 surface-inset border-b border-slate-800/60 flex flex-col gap-2">
        {/* Linha 1: Identificação do Idioma + Ações Rápidas (Download WAV & Copiar) */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSelectCard}
            aria-pressed={isSelected}
            title={`Selecionar coluna de ${languageTitle}`}
            className="chunk-inline-btn flex items-center gap-2 min-w-0 text-left cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            <span
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 select-none"
              aria-hidden="true"
            >
              {flag}
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-primary font-display tracking-tight truncate">
              {languageTitle}
            </h3>
            <span className="text-[10px] font-mono font-medium text-secondary px-2 py-0.5 rounded-md border border-slate-700/50 shrink-0">
              {badgeText}
            </span>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {onDownloadCardWav && (
              <button
                type="button"
                onClick={onDownloadCardWav}
                title={`Baixar áudio WAV 24kHz deste card (${languageTitle} · ${cardVoice})`}
                className="btn-compact-touch p-1.5 rounded-lg text-secondary hover:text-primary transition-colors cursor-pointer"
              >
                <GoogleIcon name="download" size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyFull}
              title="Copiar texto completo deste idioma"
              className="btn-compact-touch p-1.5 rounded-lg text-secondary hover:text-primary transition-colors cursor-pointer"
            >
              {copiedFull ? (
                <GoogleIcon name="check" size={15} className="text-emerald-400" />
              ) : (
                <GoogleIcon name="content_copy" size={15} />
              )}
            </button>
          </div>
        </div>

        {/* Linha 2: Seletor de Voz Neural Exclusivo do Card + Botão Ouvir/Pausar */}
        <div className="flex items-center justify-between gap-2">
          <label
            className={`flex-1 min-w-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border text-[11px] transition-all cursor-pointer ${
              isSelected
                ? 'bg-amber-500/15 border-amber-400/50 text-primary font-bold'
                : 'btn-matte-dark text-secondary hover:text-primary'
            }`}
            title="Escolher voz neural para este card (sincroniza com o controle global)"
          >
            <GoogleIcon name="record_voice_over" size={14} className="text-amber-400 shrink-0" />
            <select
              id={`card-voice-${languageCode}`}
              name={`cardVoice_${languageCode}`}
              aria-label={`Voz do card ${languageTitle}`}
              value={cardVoice}
              onChange={(e) => {
                onChangeCardVoice(e.target.value);
              }}
              className="w-full bg-transparent text-primary font-semibold text-[11px] focus:outline-none cursor-pointer truncate"
            >
              {GEMINI_VOICES.map((v) => (
                <option
                  key={v.id}
                  value={v.id}
                  className="bg-slate-900 text-slate-100"
                >
                  {v.name} ({v.gender === 'male' ? 'M' : 'F'})
                </option>
              ))}
            </select>
          </label>

          {onTogglePlayCard && (
            <button
              type="button"
              onClick={() => {
                onTogglePlayCard();
              }}
              disabled={isLoadingCard}
              title={isPlayingCard ? `Pausar ${languageTitle}` : `Ouvir ${languageTitle} com voz ${cardVoice}`}
              className={`btn-compact-touch h-8 px-3.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 btn-anti-squish ${
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
              <span className="font-mono tabular-nums text-[10px]">
                {isPlayingCard ? 'Tocando' : isCached ? '0ms' : 'Ouvir'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Corpo Editorial Nítido com Respiro Generoso e Chunks Reativos */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between text-[15px] leading-[1.72] select-text gap-4">
        <div
          lang={getLanguageTag(languageCode)}
          className="flex flex-wrap gap-x-1.5 gap-y-2 items-baseline"
        >
          {chunks.map((chunk) => {
            const chunkText =
              languageCode === 'en' ? chunk.en : languageCode === 'it' ? chunk.it : chunk.ja;
            const isHovered = hoveredChunkId === chunk.id;

            return (
              <button
                type="button"
                key={chunk.id}
                onMouseEnter={() => onHoverChunk(chunk.id)}
                onMouseLeave={() => onHoverChunk(null)}
                onFocus={() => onHoverChunk(chunk.id)}
                onBlur={() => onHoverChunk(null)}
                onClick={(e) => {
                  onSelectCard();
                  onClickChunk(chunkText, getLanguageTag(languageCode), e);
                }}
                title="Clique para ouvir esta frase ou criar flashcard"
                className={`chunk-inline-btn text-left inline-block cursor-pointer rounded-xl px-2 py-1 transition-all duration-150 relative ${
                  isHovered
                    ? 'bg-amber-400/25 text-primary font-semibold ring-1 ring-amber-400/70 shadow-sm -translate-y-[1px]'
                    : 'text-primary font-medium hover:bg-white/10'
                }`}
              >
                <span>{chunkText}</span>
                {languageCode === 'ja' && chunk.jaPronunciation && (
                  <span className="block text-[11px] font-mono text-amber-300 mt-0.5 tracking-tight pointer-events-none select-none font-semibold">
                    {chunk.jaPronunciation}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Rodapé Sutil de Status de Foco e Voz Sincronizada */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/50 text-[11px] font-mono tabular-nums font-medium text-secondary">
          <button
            type="button"
            onClick={onSelectCard}
            className="btn-compact-touch flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors"
          >
            <span
              className={`w-2 h-2 rounded-full transition-transform duration-200 ${
                isPlayingCard
                  ? 'bg-emerald-400 animate-ping'
                  : isSelected
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-slate-400/60'
              }`}
            />
            <span>{isSelected ? `Card Ativo · Voz ${cardVoice}` : `Voz do card: ${cardVoice}`}</span>
          </button>
          {isCached && (
            <span className="text-emerald-400 font-semibold" title="Áudio em cache local 0ms">
              CACHE 0ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

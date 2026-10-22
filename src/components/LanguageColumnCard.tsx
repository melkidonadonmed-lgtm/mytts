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
      {/* 1. Cabeçalho Estruturado em 2 Linhas (Zero Colisão em Colunas 1/3) */}
      <div className="px-3.5 py-2.5 bg-slate-950/60 border-b border-slate-800/70 flex flex-col gap-2">
        {/* Linha 1: Identificação do Idioma + Ações Rápidas (Download WAV & Copiar) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0 select-none"
              aria-label={languageTitle}
            >
              {flag}
            </span>
            <h3 className="text-xs font-bold text-primary font-display tracking-tight truncate">
              {languageTitle}
            </h3>
            <span className="text-[10px] font-mono font-medium text-secondary bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-800 shrink-0">
              {badgeText}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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

        {/* Linha 2: Seletor de Voz Neural Exclusivo do Card + Botão Ouvir/Pausar */}
        <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
          <label
            className={`flex-1 min-w-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] transition-all cursor-pointer ${
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
              className="w-full bg-transparent text-primary font-semibold text-[11px] focus:outline-none cursor-pointer truncate"
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
              className={`h-7 px-3 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 btn-anti-squish ${
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
              <span className="font-mono tabular-nums text-[10px]">{isCached ? '0ms' : 'Ouvir'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Corpo Editorial Nítido com Chunks Interativos (Zero Deslocamento Subpixel) */}
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
                className={`inline-block cursor-pointer rounded-lg px-1.5 py-0.5 transition-colors duration-150 relative ${
                  isHovered
                    ? 'bg-amber-100 text-amber-950 dark:bg-amber-400/25 dark:text-amber-100 font-semibold ring-1 ring-amber-400/60 shadow-sm'
                    : isSelected
                    ? 'text-primary font-medium hover:bg-white/10'
                    : 'text-primary font-medium hover:bg-white/10'
                }`}
              >
                <span>{chunkText}</span>
                {languageCode === 'ja' && chunk.jaPronunciation && (
                  <span className="block text-[11px] font-mono text-amber-800 dark:text-amber-300 mt-0.5 tracking-tight pointer-events-none select-none font-semibold">
                    {chunk.jaPronunciation}
                  </span>
                )}
              </span>
            );
          })}
        </div>

        {/* Rodapé Sutil de Status de Foco e Voz Sincronizada */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/40 text-[11px] font-mono tabular-nums font-medium text-secondary">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full transition-transform duration-200 ${
                isSelected ? 'bg-amber-400 animate-pulse' : 'bg-slate-400/60'
              }`}
            />
            <span>{isSelected ? `Card Ativo · Voz ${cardVoice}` : `Voz do card: ${cardVoice}`}</span>
          </span>
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

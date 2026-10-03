import React, { useState } from 'react';
import { AlignedChunk } from '../types/polyglot';
import { GoogleIcon } from './GoogleIcon';

export interface LanguageColumnCardProps {
  languageCode: 'en' | 'it' | 'ja';
  languageTitle: string;
  flag: string;
  badgeText: string;
  chunks: AlignedChunk[];
  fullText: string;
  hoveredChunkId: number | null;
  isSelected: boolean;
  onSelectCard: () => void;
  onHoverChunk: (id: number | null) => void;
  onClickChunk: (chunkText: string, language: string, event: React.MouseEvent) => void;
}

export const LanguageColumnCard: React.FC<LanguageColumnCardProps> = ({
  languageCode,
  languageTitle,
  flag,
  badgeText,
  chunks,
  fullText,
  hoveredChunkId,
  isSelected,
  onSelectCard,
  onHoverChunk,
  onClickChunk,
}) => {
  const [copiedFull, setCopiedFull] = useState(false);

  const handleCopyFull = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fullText);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 1500);
  };

  const getLanguageTag = (code: string) => {
    if (code === 'it') return 'it-IT';
    if (code === 'ja') return 'ja-JP';
    return 'en-US';
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Selecionar coluna de ${languageTitle}`}
      onClick={onSelectCard}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectCard();
        }
      }}
      className={`flex-1 flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
        isSelected
          ? 'card-matte-active'
          : 'card-matte hover:border-zinc-700/80 opacity-90 hover:opacity-100'
      }`}
    >
      {/* 1. Cabeçalho Minimalista e Tátil */}
      <div className="px-4 py-3 bg-zinc-950/60 border-b border-zinc-800/70 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl select-none" role="img" aria-label={languageTitle}>
            {flag}
          </span>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-zinc-100 font-display">
              {languageTitle}
            </h3>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
              {badgeText}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Badge de Seleção / Foco */}
          {isSelected ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Focado</span>
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono hidden sm:inline">
              Clique para focar
            </span>
          )}

          {/* Botão Copiar */}
          <button
            type="button"
            onClick={handleCopyFull}
            title="Copiar texto completo deste idioma"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 transition-colors cursor-pointer"
          >
            {copiedFull ? (
              <GoogleIcon name="check" size={16} className="text-emerald-400" />
            ) : (
              <GoogleIcon name="content_copy" size={16} />
            )}
          </button>
        </div>
      </div>

      {/* 2. Corpo Editorial com Chunks Interativos */}
      <div className="p-4 flex-1 flex flex-col justify-start text-sm leading-relaxed select-text">
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
                className={`cursor-pointer rounded-md px-1.5 py-0.5 transition-all duration-150 relative ${
                  isHovered
                    ? 'bg-amber-400/20 text-amber-200 font-semibold ring-1 ring-amber-400/40 shadow-sm'
                    : isSelected
                    ? 'text-zinc-100 hover:bg-zinc-800/70'
                    : 'text-zinc-300 hover:bg-zinc-800/60'
                }`}
              >
                <span>{chunkText}</span>
                {languageCode === 'ja' && chunk.jaPronunciation && (
                  <span className="block text-[10px] font-mono text-amber-400/80 -mt-0.5 tracking-tight pointer-events-none select-none">
                    {chunk.jaPronunciation}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

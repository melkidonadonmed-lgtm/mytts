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
  isCached?: boolean;
  onPlayAccent?: () => void;
  isPlayingAccent?: boolean;
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
  isCached,
  onPlayAccent,
  isPlayingAccent,
  onSelectCard,
  onHoverChunk,
  onClickChunk,
}) => {
  const [copiedFull, setCopiedFull] = useState(false);

  const handleCopyFull = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fullText).catch((e) => console.warn('Clipboard indisponível:', e));
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
      onClick={onSelectCard}
      className={`flex-1 flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'card-matte-active'
          : 'card-matte hover:border-slate-700/80 opacity-90 hover:opacity-100'
      }`}
    >
      {/* 1. Cabeçalho Minimalista e Tátil */}
      <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800/70 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl select-none" role="img" aria-label={languageTitle}>
            {flag}
          </span>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-100 font-display">
              {languageTitle}
            </h3>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
              {badgeText}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Badge de Cache Local 0ms */}
          {isCached && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-1.5 py-0.5 rounded-md"
              title="Áudio persistido no cache local IndexedDB (0ms de latência)"
            >
              <span>⚡ 0ms</span>
            </span>
          )}

          {/* Badge de Seleção / Foco */}
          {isSelected ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Focado</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 hover:text-slate-300 font-mono hidden sm:inline">
              Clique para focar
            </span>
          )}

          {/* Botão Reproduzir com Sotaque (Card Inteiro) */}
          {onPlayAccent && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlayAccent();
              }}
              title={
                isPlayingAccent
                  ? 'Pausar áudio com sotaque nativo'
                  : 'Reproduzir frase inteira com sotaque nativo autêntico'
              }
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isPlayingAccent
                  ? 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 animate-pulse'
                  : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
              }`}
            >
              <GoogleIcon name={isPlayingAccent ? 'pause' : 'record_voice_over'} size={16} />
            </button>
          )}

          {/* Botão Copiar */}
          <button
            type="button"
            onClick={handleCopyFull}
            title="Copiar texto completo deste idioma"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
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
                    ? 'text-slate-100 hover:bg-slate-800/70'
                    : 'text-slate-300 hover:bg-slate-800/60'
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

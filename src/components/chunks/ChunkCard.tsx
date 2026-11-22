import React from 'react';
import {
  Volume2,
  RotateCcw,
  Sparkles,
  Pause,
  Copy,
  Check,
  BookOpen,
  Trash2,
  Loader2,
} from 'lucide-react';
import type { ChunkItem } from '../../types/chunks';

export interface ChunkCardProps {
  item: ChunkItem;
  isSpeaking: boolean;
  isDrilling: boolean;
  isCached: boolean;
  isLoadingNeural: boolean;
  isCopied: boolean;
  isAddedFlashcard: boolean;
  onSendToFlashcard: (item: ChunkItem) => void;
  onDeleteCustomChunk: (id: string) => void;
  onCopy: (text: string, id: string) => void;
  onSpeakNeural: (text: string, id: string) => void;
  onSpeakNative: (text: string, id: string) => void;
  onToggleLoopDrill: (text: string, id: string) => void;
}

export const ChunkCard: React.FC<ChunkCardProps> = ({
  item,
  isSpeaking,
  isDrilling,
  isCached,
  isLoadingNeural,
  isCopied,
  isAddedFlashcard,
  onSendToFlashcard,
  onDeleteCustomChunk,
  onCopy,
  onSpeakNeural,
  onSpeakNative,
  onToggleLoopDrill,
}) => (
  <article
    className={`relative rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between gap-3 ${
      isDrilling
        ? 'border-amber-400/70 bg-gradient-to-b from-amber-500/10 to-slate-900/90 shadow-lg shadow-amber-500/10'
        : 'border-[var(--border-subtle)] bg-slate-900/60 hover:border-[var(--border-control)]'
    }`}
  >
    <div>
      {/* Cabeçalho do Card */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md border border-[var(--border-subtle)]">
            {item.context}
          </span>
          {isCached && (
            <span
              className="text-[9px] font-mono tabular-nums font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/25 flex items-center gap-0.5"
              title="Áudio persistido no cache local IndexedDB (0ms de latência)"
            >
              <span>CACHE 0ms</span>
            </span>
          )}
          {item.isCustom && (
            <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
              Salvo na Nuvem
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSendToFlashcard(item)}
            className={`min-h-11 px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              isAddedFlashcard
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-950 hover:bg-amber-500/15 text-amber-300 border-[var(--border-subtle)] hover:border-amber-500/35'
            }`}
            title="Enviar este bloco para a Área de Estudo (Flashcards Deck)"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isAddedFlashcard ? 'No Baralho!' : '+ Flashcard'}</span>
          </button>
          {item.isCustom && (
            <button
              type="button"
              onClick={() => onDeleteCustomChunk(item.id)}
              className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors rounded-lg cursor-pointer"
              title="Remover chunk salvo"
              aria-label="Remover chunk salvo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onCopy(item.chunk, item.id)}
            className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors rounded-lg cursor-pointer"
            aria-label="Copiar chunk"
            title="Copiar texto"
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Frase / Expressão Nativa em Destaque */}
      <h2 className="text-lg font-bold text-slate-100 tracking-tight leading-snug mb-1">
        {item.chunk}
      </h2>

      {/* Guia Fonético */}
      {item.pronunciationHint && (
        <p className="text-xs font-mono text-amber-400/80 mb-2 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>/{item.pronunciationHint}/</span>
        </p>
      )}

      {/* Equivalência da Vida Real & Explicação */}
      <div className="bg-slate-950/60 rounded-xl p-3 border border-[var(--border-subtle)] space-y-1">
        <p className="text-xs font-bold text-emerald-300">→ {item.literalOrNuance}</p>
        <p className="text-xs text-slate-400 leading-relaxed">{item.meaning}</p>
      </div>
    </div>

    {/* Barra de Ação de Áudio */}
    <div className="grid grid-cols-12 gap-2">
      <button
        type="button"
        disabled={isLoadingNeural}
        onClick={() => onSpeakNeural(item.chunk, item.id)}
        title="Ouvir com voz neural hiper-realista do Gemini (respiração e tom natural)"
        className={`col-span-6 min-h-11 flex items-center justify-center gap-1.5 rounded-xl active:translate-y-px transition-all text-xs font-bold cursor-pointer border shadow-sm ${
          isCached
            ? 'bg-gradient-to-r from-emerald-500/15 to-amber-500/15 hover:from-emerald-500/25 hover:to-amber-500/25 text-emerald-300 border-emerald-500/40'
            : 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 border-amber-500/40'
        }`}
      >
        {isLoadingNeural ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Sintetizando...</span>
          </>
        ) : (
          <>
            <Sparkles
              className={`w-3.5 h-3.5 ${isCached ? 'text-emerald-400' : 'text-amber-400'}`}
            />
            <span>{isSpeaking ? 'Tocando...' : isCached ? 'Neural (0ms)' : 'Voz Neural IA'}</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => onSpeakNative(item.chunk, item.id)}
        title="Síntese rápida local do navegador"
        className="col-span-3 min-h-11 flex items-center justify-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 active:translate-y-px transition-all text-xs font-semibold cursor-pointer border border-[var(--border-control)]"
      >
        <Volume2 className="w-3.5 h-3.5 text-slate-400" />
        <span>Nativo</span>
      </button>

      <button
        type="button"
        onClick={() => onToggleLoopDrill(item.chunk, item.id)}
        title="Repetição contínua para treinar fala"
        className={`col-span-3 min-h-11 flex items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-all active:translate-y-px cursor-pointer ${
          isDrilling
            ? 'border-amber-400 bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20'
            : 'border-[var(--border-subtle)] bg-slate-950 text-slate-400 hover:text-slate-200 hover:border-[var(--border-control)]'
        }`}
      >
        {isDrilling ? (
          <>
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>Parar</span>
          </>
        ) : (
          <>
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Drill</span>
          </>
        )}
      </button>
    </div>
  </article>
);

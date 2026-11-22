import React from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';

export interface ChunkGeneratorModalProps {
  isOpen: boolean;
  inputText: string;
  isGenerating: boolean;
  generateError: string | null;
  onChangeInputText: (val: string) => void;
  onClose: () => void;
  onGenerate: () => void;
}

export const ChunkGeneratorModal: React.FC<ChunkGeneratorModalProps> = ({
  isOpen,
  inputText,
  isGenerating,
  generateError,
  onChangeInputText,
  onClose,
  onGenerate,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generator-modal-title"
        className="w-full max-w-lg bg-slate-900 border border-[var(--border-control)] rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 id="generator-modal-title" className="text-sm font-bold text-slate-100">
              Gerador de Chunks de Bolso (Gemini 3.8)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Cole uma intenção informal (ex:{' '}
          <em>&quot;como pedir desculpas sem parecer muito formal&quot;</em>) ou cole um trecho de
          notícia/podcast para extrair os chunks mais coloquiais.
        </p>

        <textarea
          autoFocus
          value={inputText}
          onChange={(e) => onChangeInputText(e.target.value)}
          placeholder="Digite uma situação ou cole o parágrafo..."
          rows={4}
          className="w-full bg-slate-950 border border-[var(--border-control)] rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
        />

        {generateError && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
            {generateError}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-11 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isGenerating || !inputText.trim()}
            onClick={onGenerate}
            className="flex-1 min-h-11 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extraindo...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-current" />
                <span>Gerar 3 Chunks</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

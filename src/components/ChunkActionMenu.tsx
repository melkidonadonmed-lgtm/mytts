import React, { useEffect, useRef } from 'react';
import { Volume2, Sparkles, Copy, Check, Loader2, X } from 'lucide-react';

interface ChunkActionMenuProps {
  chunkText: string;
  language: string;
  position: { top: number; left: number };
  onClose: () => void;
  onPlayChunkAudio: (text: string, language: string) => Promise<void>;
  onCreateFlashcard: (chunkText: string, language: string) => Promise<void>;
  isPlaying: boolean;
  isGeneratingCard: boolean;
}

export const ChunkActionMenu: React.FC<ChunkActionMenuProps> = ({
  chunkText,
  language,
  position,
  onClose,
  onPlayChunkAudio,
  onCreateFlashcard,
  isPlaying,
  isGeneratingCard,
}) => {
  const [copied, setCopied] = React.useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Fechar ao pressionar Escape ou clicar fora
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(chunkText);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1200);
  };

  return (
    <div
      ref={menuRef}
      style={{
        top: `${Math.max(10, position.top)}px`,
        left: `${Math.max(10, Math.min(window.innerWidth - 300, position.left))}px`,
      }}
      className="fixed z-50 bg-slate-900 border border-slate-700/80 rounded-2xl p-2 shadow-2xl shadow-black/60 flex flex-col gap-1.5 min-w-[240px] max-w-[320px] animate-in fade-in zoom-in-95 duration-150"
      role="dialog"
      aria-label="Ações para o trecho de texto"
    >
      {/* Cabeçalho do Trecho */}
      <div className="flex items-center justify-between px-2 pt-1 pb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
        <span className="truncate font-medium text-slate-200">"{chunkText}"</span>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer ml-1"
          aria-label="Fechar menu"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 1. Botão Ouvir Frase */}
      <button
        onClick={() => onPlayChunkAudio(chunkText, language)}
        disabled={isPlaying}
        className="w-full min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-95"
      >
        {isPlaying ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span className="text-amber-300">Reproduzindo...</span>
          </>
        ) : (
          <>
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Ouvir Frase com Sotaque</span>
          </>
        )}
      </button>

      {/* 2. Botão Criar Flashcard com IA */}
      <button
        onClick={() => onCreateFlashcard(chunkText, language)}
        disabled={isGeneratingCard}
        className="w-full min-h-[36px] px-2.5 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95"
      >
        {isGeneratingCard ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Gerando Card via Gemini 3.8...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-current" />
            <span>Criar Flashcard para o Deck</span>
          </>
        )}
      </button>

      {/* 3. Botão Copiar */}
      <button
        onClick={handleCopy}
        className="w-full min-h-[32px] px-2.5 py-1 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-medium flex items-center gap-2 transition-colors cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-300">Copiado para a área de transferência!</span>
          </>
        ) : (
          <>
            <Copy className="w-3 h-3 text-slate-500" />
            <span>Copiar Expressão</span>
          </>
        )}
      </button>
    </div>
  );
};

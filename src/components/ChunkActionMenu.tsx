import React, { useEffect, useRef } from 'react';
import { GoogleIcon } from './GoogleIcon';

export interface ChunkActionMenuProps {
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
      className="fixed z-50 dock-matte rounded-2xl p-2.5 flex flex-col gap-1.5 min-w-[250px] max-w-[320px] animate-in fade-in zoom-in-95 duration-150"
      role="dialog"
      aria-label="Ações para o trecho de texto"
    >
      {/* Cabeçalho do Trecho */}
      <div className="flex items-center justify-between px-2 pt-0.5 pb-2 border-b border-zinc-800 text-[11px] text-zinc-400">
        <span className="truncate font-medium text-zinc-200">"{chunkText}"</span>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer ml-1 rounded-md hover:bg-zinc-800"
          aria-label="Fechar menu"
        >
          <GoogleIcon name="close" size={16} />
        </button>
      </div>

      {/* 1. Botão Ouvir Frase */}
      <button
        type="button"
        onClick={() => onPlayChunkAudio(chunkText, language)}
        disabled={isPlaying}
        className="btn-matte btn-matte-dark w-full min-h-[38px] px-3 py-2 text-xs text-zinc-200 justify-start"
      >
        {isPlaying ? (
          <>
            <GoogleIcon name="progress_activity" size={18} className="animate-spin text-amber-400" />
            <span className="text-amber-300">Reproduzindo...</span>
          </>
        ) : (
          <>
            <GoogleIcon name="volume_up" size={18} className="text-amber-400" />
            <span>Ouvir Frase com Sotaque</span>
          </>
        )}
      </button>

      {/* 2. Botão Criar Flashcard com IA */}
      <button
        type="button"
        onClick={() => onCreateFlashcard(chunkText, language)}
        disabled={isGeneratingCard}
        className="btn-matte btn-matte-amber w-full min-h-[38px] px-3 py-2 text-xs font-bold text-zinc-950 justify-start"
      >
        {isGeneratingCard ? (
          <>
            <GoogleIcon name="progress_activity" size={18} className="animate-spin text-zinc-950" />
            <span>Gerando Card via Gemini 3.8...</span>
          </>
        ) : (
          <>
            <GoogleIcon name="auto_awesome" size={18} filled className="text-zinc-950" />
            <span>Criar Flashcard para o Deck</span>
          </>
        )}
      </button>

      {/* 3. Botão Copiar */}
      <button
        type="button"
        onClick={handleCopy}
        className="btn-matte w-full min-h-[32px] px-3 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/80 text-[11px] justify-start"
      >
        {copied ? (
          <>
            <GoogleIcon name="check" size={16} className="text-emerald-400" />
            <span className="text-emerald-300 font-medium">Copiado para a área de transferência!</span>
          </>
        ) : (
          <>
            <GoogleIcon name="content_copy" size={16} className="text-zinc-500" />
            <span>Copiar Expressão</span>
          </>
        )}
      </button>
    </div>
  );
};

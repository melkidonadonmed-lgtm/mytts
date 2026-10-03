import React from 'react';
import { FlashcardItem } from '../types/polyglot';
import { downloadFlashcardsCsv } from '../utils/csvExporter';
import { GoogleIcon } from './GoogleIcon';

export interface FlashcardDeckDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cards: FlashcardItem[];
  onDeleteCard: (id: string) => void;
  onClearDeck: () => void;
  onPlayCardAudio?: (text: string, language: string) => void;
}

export const FlashcardDeckDrawer: React.FC<FlashcardDeckDrawerProps> = ({
  isOpen,
  onClose,
  cards,
  onDeleteCard,
  onClearDeck,
  onPlayCardAudio,
}) => {
  if (!isOpen) return null;

  const handleExport = () => {
    if (cards.length === 0) return;
    downloadFlashcardsCsv(cards);
  };

  const getLanguageFlag = (lang: string) => {
    if (lang.includes('it')) return '🇮🇹';
    if (lang.includes('ja')) return '🇯🇵';
    return '🇺🇸';
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Meu Deck de Flashcards"
        className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250"
      >
        {/* 1. Cabeçalho da Gaveta */}
        <div className="p-4 bg-zinc-950 border-b border-zinc-850 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center text-amber-400">
              <GoogleIcon name="style" size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2 font-display">
                <span>Meu Deck de Flashcards</span>
                <span className="text-[11px] font-mono bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">
                  {cards.length}
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">Cards pedagógicos com Gemini 3.8 Flash</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 transition-colors cursor-pointer"
            aria-label="Fechar gaveta"
          >
            <GoogleIcon name="close" size={20} />
          </button>
        </div>

        {/* 2. Lista de Flashcards */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {cards.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800 rounded-2xl">
              <GoogleIcon name="menu_book" size={36} className="text-zinc-600 mb-3" />
              <p className="text-xs font-bold text-zinc-300">Nenhum flashcard gerado ainda</p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-[240px]">
                No chat poliglota, clique sobre qualquer frase ou selecione um trecho e escolha "Criar Flashcard".
              </p>
            </div>
          ) : (
            cards.map((card) => (
              <div
                key={card.id}
                className="card-matte rounded-2xl p-4 flex flex-col gap-2.5 hover:border-zinc-700 transition-colors"
              >
                {/* Topo do Card */}
                <div className="flex items-center justify-between">
                  <span className="text-xs flex items-center gap-1.5 font-semibold text-zinc-300">
                    <span className="text-base">{getLanguageFlag(card.language)}</span>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                      {card.language}
                    </span>
                  </span>

                  <div className="flex items-center gap-1">
                    {onPlayCardAudio && (
                      <button
                        type="button"
                        onClick={() => onPlayCardAudio(card.front, card.language)}
                        title="Ouvir pronúncia"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <GoogleIcon name="volume_up" size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteCard(card.id)}
                      title="Excluir card"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <GoogleIcon name="delete" size={16} />
                    </button>
                  </div>
                </div>

                {/* Frente (Original) */}
                <h3 className="text-sm font-bold text-amber-200">{card.front}</h3>

                {/* Pronúncia Fonética */}
                {card.pronunciation && (
                  <p className="text-[11px] font-mono text-amber-400/80 -mt-1">
                    🗣️ {card.pronunciation}
                  </p>
                )}

                {/* Verso (Tradução e Nuance) */}
                <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800/80 space-y-1">
                  <p className="text-xs font-semibold text-emerald-300">→ {card.back}</p>
                  {card.nuance && (
                    <p className="text-[11px] text-zinc-400 leading-snug">{card.nuance}</p>
                  )}
                </div>

                {/* Exemplo de Uso */}
                {card.example && (
                  <div className="text-[11px] text-zinc-400 italic pt-1 border-t border-zinc-850">
                    <p className="text-zinc-300">"{card.example}"</p>
                    {card.exampleTranslation && (
                      <p className="text-zinc-500 not-italic">{card.exampleTranslation}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 3. Rodapé com Botão de Exportação CSV */}
        {cards.length > 0 && (
          <div className="p-4 bg-zinc-950 border-t border-zinc-850 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="btn-matte btn-matte-amber w-full min-h-[44px] text-xs font-bold text-zinc-950"
            >
              <GoogleIcon name="download" size={18} filled className="text-zinc-950" />
              <span>Exportar {cards.length} Cards para Anki / Notion (CSV)</span>
            </button>

            <button
              type="button"
              onClick={onClearDeck}
              className="w-full py-1 text-center text-[11px] text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Limpar todo o deck
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

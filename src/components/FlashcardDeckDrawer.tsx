import React from 'react';
import { X, Download, Trash2, BookOpen, Sparkles, Volume2 } from 'lucide-react';
import { FlashcardItem } from '../types/polyglot';
import { downloadFlashcardsCsv } from '../utils/csvExporter';

interface FlashcardDeckDrawerProps {
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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Meu Deck de Flashcards"
        className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250"
      >
        {/* 1. Cabeçalho da Gaveta */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Meu Deck de Flashcards</span>
                <span className="text-[11px] font-mono bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.2 rounded-full font-bold">
                  {cards.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Cards gerados com Gemini 3.8 Flash</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Fechar gaveta"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Lista de Flashcards */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {cards.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl">
              <BookOpen className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-xs font-bold text-slate-300">Nenhum flashcard gerado ainda</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-[240px]">
                No chat poliglota, clique sobre qualquer frase ou selecione um trecho e escolha "Criar Flashcard".
              </p>
            </div>
          ) : (
            cards.map((card) => (
              <div
                key={card.id}
                className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2 hover:border-slate-750 transition-colors"
              >
                {/* Topo do Card */}
                <div className="flex items-center justify-between">
                  <span className="text-xs flex items-center gap-1.5 font-semibold text-slate-300">
                    <span>{getLanguageFlag(card.language)}</span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      {card.language}
                    </span>
                  </span>

                  <div className="flex items-center gap-1">
                    {onPlayCardAudio && (
                      <button
                        onClick={() => onPlayCardAudio(card.front, card.language)}
                        title="Ouvir pronúncia"
                        className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteCard(card.id)}
                      title="Excluir card"
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
                <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80 space-y-1">
                  <p className="text-xs font-semibold text-emerald-300">→ {card.back}</p>
                  {card.nuance && (
                    <p className="text-[11px] text-slate-400 leading-snug">{card.nuance}</p>
                  )}
                </div>

                {/* Exemplo de Uso */}
                {card.example && (
                  <div className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-850">
                    <p className="text-slate-300">"{card.example}"</p>
                    {card.exampleTranslation && (
                      <p className="text-slate-500 not-italic">{card.exampleTranslation}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 3. Rodapé com Botão de Exportação CSV */}
        {cards.length > 0 && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col gap-2">
            <button
              onClick={handleExport}
              className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Exportar {cards.length} Cards para Anki / Notion (CSV)</span>
            </button>

            <button
              onClick={onClearDeck}
              className="w-full py-1 text-center text-[11px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Limpar todo o deck
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

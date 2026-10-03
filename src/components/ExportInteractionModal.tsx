import React, { useState, useEffect } from 'react';
import { PolyglotMessage, FlashcardItem } from '../types/polyglot';
import { GoogleIcon } from './GoogleIcon';
import {
  generateInteractionAnkiCsv,
  generateInteractionMarkdown,
  generateInteractionJson,
  convertInteractionToFlashcards,
  triggerFileDownload,
} from '../utils/interactionExporter';

export type ExportFormat = 'anki-csv' | 'markdown' | 'json' | 'deck';

export interface ExportInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: PolyglotMessage | null;
  onAddCardsToDeck: (cards: FlashcardItem[]) => void;
  onShowToast: (msg: string) => void;
}

export const ExportInteractionModal: React.FC<ExportInteractionModalProps> = ({
  isOpen,
  onClose,
  message,
  onAddCardsToDeck,
  onShowToast,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('anki-csv');

  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !message) return null;

  const totalChunks = message.chunks.length;

  const handleConfirmExport = () => {
    const timestampStr = new Date(message.timestamp).toISOString().slice(0, 10);
    const sanitizedTitle = message.userPrompt.slice(0, 24).replace(/[^a-zA-Z0-9]/g, '_');

    switch (selectedFormat) {
      case 'anki-csv': {
        const csvContent = generateInteractionAnkiCsv(message);
        triggerFileDownload(
          csvContent,
          `mytts-anki-${sanitizedTitle}-${timestampStr}.csv`,
          'text/csv;charset=utf-8;'
        );
        onShowToast(`Arquivo Anki (.csv) de ${totalChunks} chunks exportado com sucesso!`);
        break;
      }
      case 'markdown': {
        const mdContent = generateInteractionMarkdown(message);
        triggerFileDownload(
          mdContent,
          `mytts-chunks-${sanitizedTitle}-${timestampStr}.md`,
          'text/markdown;charset=utf-8;'
        );
        onShowToast(`Tabela Markdown de estudo exportada com sucesso!`);
        break;
      }
      case 'json': {
        const jsonContent = generateInteractionJson(message);
        triggerFileDownload(
          jsonContent,
          `mytts-interaction-${sanitizedTitle}-${timestampStr}.json`,
          'application/json;charset=utf-8;'
        );
        onShowToast(`Arquivo JSON estruturado exportado com sucesso!`);
        break;
      }
      case 'deck': {
        const newCards = convertInteractionToFlashcards(message);
        onAddCardsToDeck(newCards);
        onShowToast(`${newCards.length} Flashcards (EN/IT/JA) adicionados ao seu Deck local!`);
        break;
      }
    }

    onClose();
  };

  const exportOptions: {
    id: ExportFormat;
    title: string;
    icon: string;
    badge: string;
    desc: string;
  }[] = [
    {
      id: 'anki-csv',
      title: 'Flashcards Anki (.csv)',
      icon: 'style',
      badge: 'Recomendado',
      desc: 'Delimitador ponto e vírgula, codificação UTF-8 BOM, colunas de frente, verso, rōmaji e frases de contexto.',
    },
    {
      id: 'markdown',
      title: 'Tabela de Estudo Markdown (.md)',
      icon: 'article',
      badge: 'Obsidian / Notion',
      desc: 'Tabela comparativa limpa com os chunks em inglês, italiano e japonês com rōmaji, pronta para suas notas.',
    },
    {
      id: 'deck',
      title: 'Salvar Direto no Meu Deck',
      icon: 'bookmark_add',
      badge: 'Sem Arquivo',
      desc: `Injeta automaticamente ${totalChunks * 3} cartões (EN, IT e JA) no deck interno do MyTTS para treino imediato.`,
    },
    {
      id: 'json',
      title: 'Estrutura JSON Completa (.json)',
      icon: 'code',
      badge: 'Desenvolvedor',
      desc: 'Exporta os blocos, frases integrais e timestamps em formato JSON estruturado para integrações ou backup.',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col gap-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <GoogleIcon name="download" size={22} />
            </div>
            <div>
              <h2 id="modal-export-title" className="text-base sm:text-lg font-bold text-white font-display">
                Exportar Fast Chunks da Interação
              </h2>
              <p className="text-xs text-slate-400">
                Selecione o formato para salvar os blocos lexicais e traduções
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label="Fechar janela"
          >
            <GoogleIcon name="close" size={20} />
          </button>
        </div>

        {/* Resumo da Interação Selecionada */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400 uppercase font-semibold">Frase de Origem:</span>
            <span className="text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
              {totalChunks} {totalChunks === 1 ? 'bloco lexical' : 'blocos lexicais'}
            </span>
          </div>
          <p className="text-xs text-slate-200 line-clamp-2 italic font-serif">
            "{message.userPrompt}"
          </p>
        </div>

        {/* Opções de Formato de Exportação */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Como você deseja exportar?
          </span>

          <div className="grid grid-cols-1 gap-2">
            {exportOptions.map((opt) => {
              const isSelected = selectedFormat === opt.id;
              return (
                <div
                  key={opt.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedFormat(opt.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedFormat(opt.id);
                    }
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left outline-none ${
                    isSelected
                      ? 'bg-amber-400/10 border-amber-400/70 shadow-md shadow-amber-400/10 ring-1 ring-amber-400/30'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/80'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : 'bg-slate-900 border border-slate-800 text-slate-300'
                      }`}
                    >
                      <GoogleIcon name={opt.icon} size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-100">
                          {opt.title}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md font-semibold ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                        {opt.desc}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-slate-950" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmExport}
            className="btn-matte btn-matte-amber px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-400/20 active:scale-95 transition-all cursor-pointer"
          >
            <GoogleIcon
              name={selectedFormat === 'deck' ? 'bookmark_add' : 'download'}
              size={18}
              filled
              className="text-slate-950"
            />
            <span>
              {selectedFormat === 'deck' ? 'Adicionar ao Deck' : 'Confirmar e Baixar'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

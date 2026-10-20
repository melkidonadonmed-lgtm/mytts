/**
 * Modal de exportação de interação poliglota com Preview Ao Vivo do formato e exportação WAV 24kHz.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { PolyglotMessage, FlashcardItem } from '../types/polyglot';
import { GoogleIcon } from './GoogleIcon';
import {
  generateInteractionAnkiCsv,
  generateInteractionMarkdown,
  generateInteractionJson,
  convertInteractionToFlashcards,
  triggerFileDownload,
} from '../utils/interactionExporter';

export type ExportFormat = 'anki-csv' | 'markdown' | 'json' | 'wav-trilogy' | 'deck';

export interface ExportInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: PolyglotMessage | null;
  cardVoices?: Record<'en' | 'it' | 'ja', string>;
  onAddCardsToDeck: (cards: FlashcardItem[]) => void;
  onExportTrilogyWav?: (message: PolyglotMessage) => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const ExportInteractionModal: React.FC<ExportInteractionModalProps> = ({
  isOpen,
  onClose,
  message,
  cardVoices = { en: 'Puck', it: 'Kore', ja: 'Aoede' },
  onAddCardsToDeck,
  onExportTrilogyWav,
  onShowToast,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('anki-csv');
  const [isExportingWav, setIsExportingWav] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const messageWithVoices: PolyglotMessage | null = useMemo(() => {
    if (!message) return null;
    return {
      ...message,
      cardVoices: message.cardVoices || cardVoices,
    };
  }, [message, cardVoices]);

  const previewContent = useMemo(() => {
    if (!messageWithVoices) return '';
    switch (selectedFormat) {
      case 'anki-csv':
        return generateInteractionAnkiCsv(messageWithVoices).replace(/^\uFEFF/, '');
      case 'markdown':
        return generateInteractionMarkdown(messageWithVoices);
      case 'json':
        return generateInteractionJson(messageWithVoices);
      case 'wav-trilogy':
        return [
          `RIFF WAVE PCM 16-bit · 24.000 Hz Mono (Cabeçalho Canônico de 44 Bytes)`,
          `-------------------------------------------------------------------`,
          `Faixa 1 [🇺🇸 Inglês   · Voz ${messageWithVoices.cardVoices?.en || 'Puck'}]: "${messageWithVoices.fullText.en}"`,
          `Faixa 2 [🇮🇹 Italiano · Voz ${messageWithVoices.cardVoices?.it || 'Kore'}]: "${messageWithVoices.fullText.it}"`,
          `Faixa 3 [🇯🇵 Japonês  · Voz ${messageWithVoices.cardVoices?.ja || 'Aoede'}]: "${messageWithVoices.fullText.ja}"`,
        ].join('\n');
      case 'deck': {
        const cards = convertInteractionToFlashcards(messageWithVoices);
        return cards
          .map((c, idx) => `[Card ${idx + 1} · ${c.language}] Frente: "${c.front}" → Verso: "${c.back}"`)
          .join('\n');
      }
    }
  }, [messageWithVoices, selectedFormat]);

  if (!isOpen || !messageWithVoices) return null;

  const totalChunks = messageWithVoices.chunks.length;

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(previewContent).catch((err) => console.warn('Clipboard error:', err));
    setCopiedPreview(true);
    onShowToast('Prévia do formato copiada para a área de transferência!');
    setTimeout(() => setCopiedPreview(false), 1800);
  };

  const handleConfirmExport = async () => {
    const timestampStr = new Date(messageWithVoices.timestamp).toISOString().slice(0, 10);
    const sanitizedTitle = messageWithVoices.userPrompt.slice(0, 24).replace(/[^a-zA-Z0-9]/g, '_');

    switch (selectedFormat) {
      case 'anki-csv': {
        const csvContent = generateInteractionAnkiCsv(messageWithVoices);
        triggerFileDownload(
          csvContent,
          `mytts-anki-${sanitizedTitle}-${timestampStr}.csv`,
          'text/csv;charset=utf-8;'
        );
        onShowToast(`Arquivo Anki (.csv) de ${totalChunks} chunks exportado com sucesso!`);
        onClose();
        break;
      }
      case 'markdown': {
        const mdContent = generateInteractionMarkdown(messageWithVoices);
        triggerFileDownload(
          mdContent,
          `mytts-chunks-${sanitizedTitle}-${timestampStr}.md`,
          'text/markdown;charset=utf-8;'
        );
        onShowToast(`Tabela Markdown de estudo exportada com sucesso!`);
        onClose();
        break;
      }
      case 'json': {
        const jsonContent = generateInteractionJson(messageWithVoices);
        triggerFileDownload(
          jsonContent,
          `mytts-interaction-${sanitizedTitle}-${timestampStr}.json`,
          'application/json;charset=utf-8;'
        );
        onShowToast(`Arquivo JSON estruturado exportado com sucesso!`);
        onClose();
        break;
      }
      case 'wav-trilogy': {
        if (onExportTrilogyWav) {
          setIsExportingWav(true);
          try {
            await onExportTrilogyWav(messageWithVoices);
            onClose();
          } finally {
            setIsExportingWav(false);
          }
        }
        break;
      }
      case 'deck': {
        const newCards = convertInteractionToFlashcards(messageWithVoices);
        onAddCardsToDeck(newCards);
        onShowToast(`${newCards.length} Flashcards (EN/IT/JA) adicionados ao seu Deck local!`);
        onClose();
        break;
      }
    }
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
      badge: 'UTF-8 BOM · ;',
      desc: 'Colunas higienizadas (Inglês, Tradução PT-BR, Italiano, Japonês Kanji, Rōmaji e Tríade de Contexto).',
    },
    {
      id: 'markdown',
      title: 'Tabela de Estudo Markdown (.md)',
      icon: 'article',
      badge: 'Obsidian / Notion',
      desc: 'Tabela comparativa com as vozes selecionadas por card, frases completas e blocos lexicais.',
    },
    {
      id: 'wav-trilogy',
      title: 'Áudio Master da Trilogia (.wav)',
      icon: 'graphic_eq',
      badge: '24kHz PCM RIFF',
      desc: `Concatena o áudio neural dos 3 cards (${cardVoices.en} → ${cardVoices.it} → ${cardVoices.ja}) em um único WAV.`,
    },
    {
      id: 'deck',
      title: 'Salvar Direto no Meu Deck',
      icon: 'bookmark_add',
      badge: 'Treino Local',
      desc: `Adiciona ${totalChunks * 3} cartões (EN, IT e JA) ao Deck interno do MyTTS sem baixar arquivo.`,
    },
    {
      id: 'json',
      title: 'Estrutura JSON Completa (.json)',
      icon: 'code',
      badge: 'Schema v2',
      desc: 'Exporta chunks, frases integrais, vozes de cada card e timestamps para integrações.',
    },
  ];

  return (
    <div
      data-state="idle"
      aria-busy={isExportingWav}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl card-matte rounded-3xl p-5 sm:p-6 shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col gap-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <GoogleIcon name="download" size={22} />
            </div>
            <div>
              <h2 id="modal-export-title" className="text-base sm:text-lg font-bold text-primary font-display">
                Exportar Interação &amp; Inspecionar Formato
              </h2>
              <p className="text-xs text-secondary">
                Verifique a estrutura exata do formato abaixo antes de baixar ou copiar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-secondary hover:text-primary hover:bg-slate-800/60 cursor-pointer transition-colors"
            aria-label="Fechar janela"
          >
            <GoogleIcon name="close" size={20} />
          </button>
        </div>

        {/* Opções de Formato de Exportação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {exportOptions.map((opt) => {
            const isSelected = selectedFormat === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedFormat(opt.id)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-2.5 text-left ${
                  isSelected
                    ? 'card-matte-active'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? 'btn-matte-amber text-white shadow-sm'
                        : 'bg-slate-900 border border-slate-800 text-secondary'
                    }`}
                  >
                    <GoogleIcon name={opt.icon} size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-primary">
                        {opt.title}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-amber-300 border border-slate-800 font-semibold">
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-secondary leading-snug mt-0.5 line-clamp-2">
                      {opt.desc}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Prévia Ao Vivo do Formato de Exportação */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-secondary font-semibold">
              Prévia do Formato Gerado ({selectedFormat.toUpperCase()} · {totalChunks} chunks)
            </span>
            <button
              type="button"
              onClick={handleCopyPreview}
              className="text-[11px] font-mono text-amber-300 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <GoogleIcon name={copiedPreview ? 'check' : 'content_copy'} size={14} />
              <span>{copiedPreview ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>
          <pre className="p-3 rounded-xl input-sunken text-[11px] font-mono tabular-nums text-primary overflow-x-auto max-h-40 leading-relaxed whitespace-pre">
            {previewContent}
          </pre>
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isExportingWav}
            onClick={handleConfirmExport}
            className="btn-matte btn-matte-amber px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-lg active:translate-y-px transition-all cursor-pointer disabled:opacity-50"
          >
            <GoogleIcon
              name={
                isExportingWav
                  ? 'progress_activity'
                  : selectedFormat === 'deck'
                  ? 'bookmark_add'
                  : 'download'
              }
              size={18}
              filled={!isExportingWav}
              className={isExportingWav ? 'animate-spin text-white' : 'text-white'}
            />
            <span>
              {isExportingWav
                ? 'Sintetizando e Concatenando WAV...'
                : selectedFormat === 'deck'
                ? 'Adicionar ao Deck'
                : selectedFormat === 'wav-trilogy'
                ? 'Baixar WAV da Trilogia'
                : 'Confirmar e Baixar Arquivo'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

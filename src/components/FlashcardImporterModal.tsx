import React, { useEffect, useRef, useState } from 'react';
import { GoogleIcon } from './GoogleIcon';
import {
  parseFlashcardsInput,
  candidatesToFlashcardItems,
  type ParsedFlashcardCandidate,
} from '../utils/flashcardParser';
import type { FlashcardItem } from '../types/polyglot';

interface FlashcardImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (cards: FlashcardItem[]) => void;
  defaultVoiceId?: string;
}

const SAMPLE_MARKDOWN = `| Frente (Expressão) | Verso (Significado PT-BR) | Contexto / Pronúncia | Idioma |
| --- | --- | --- | --- |
| Break the ice | Quebrar o gelo / iniciar conversa | Let's play a quick game to break the ice. | EN |
| In bocca al lupo! | Boa sorte! (lit. na boca do lobo) | Crepi il lupo! Grazie mille! | IT |
| お疲れ様です (Otsukaresama desu) | Bom trabalho / Obrigado pelo esforço | Expressão essencial no cotidiano japonês | JA |`;

const SAMPLE_CSV = `front;back;context;lang
"Hit the nail on the head";"Acertar em cheio / ir direto ao ponto";"You really hit the nail on the head with that diagnosis.";"EN"
"Non vedo l'ora";"Mal posso esperar / Estou ansioso";"Non vedo l'ora di visitare Roma quest'estate.";"IT"
"よろしくお願いします (Yoroshiku onegaishimasu)";"Conto com você / Prazer em conhecê-lo";"Usado ao iniciar colaborações ou apresentações";"JA"`;

export const FlashcardImporterModal: React.FC<FlashcardImporterModalProps> = ({
  isOpen,
  onClose,
  onImport,
  defaultVoiceId,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rawInput, setRawInput] = useState('');
  const [deckName, setDeckName] = useState('Baralho Poliglota');
  const [defaultLanguage, setDefaultLanguage] = useState<'EN' | 'IT' | 'JA'>('EN');
  const [detectedFormat, setDetectedFormat] = useState<string>('markdown');
  const [candidates, setCandidates] = useState<ParsedFlashcardCandidate[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Sincroniza estado nativo do <dialog>
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', 'true');
        }
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Re-analisa automaticamente quando o texto ou idioma padrão mudam
  useEffect(() => {
    if (!rawInput.trim()) {
      setCandidates([]);
      setWarnings([]);
      return;
    }
    const result = parseFlashcardsInput(rawInput, { deckName });
    setDetectedFormat(result.detectedFormat);
    setCandidates(result.cards);
    setWarnings(result.warnings);
  }, [rawInput, defaultLanguage, deckName]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || e.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const clickedInDialog =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!clickedInDialog) {
      onClose();
    }
  };

  const handleFileLoad = async (file: File) => {
    if (file.size > 1_000_000) {
      setWarnings(['O arquivo excede o limite de 1 MB. Divida o baralho em partes menores.']);
      return;
    }
    try {
      const text = await file.text();
      setUploadedFileName(file.name);
      setRawInput(text);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler o arquivo selecionado.';
      setWarnings([msg]);
    }
  };

  const handleUpdateCandidate = (
    idx: number,
    field: keyof ParsedFlashcardCandidate,
    value: string
  ) => {
    setCandidates((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveCandidate = (idx: number) => {
    setCandidates((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmImport = () => {
    const valid = candidates.filter((c) => c.front.trim().length > 0);
    if (valid.length === 0) return;
    const items = candidatesToFlashcardItems(valid, deckName).map((item) => ({
      ...item,
      voiceId: defaultVoiceId || item.voiceId,
    }));
    onImport(items);
    setRawInput('');
    setCandidates([]);
    setUploadedFileName(null);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="flashcard-importer-title"
      onClose={onClose}
      onClick={handleBackdropClick}
      className="m-auto w-[calc(100%-1.5rem)] max-w-4xl rounded-3xl bg-slate-950 text-slate-100 border border-slate-800 shadow-2xl p-0 backdrop:bg-black/75 open:flex open:flex-col overflow-hidden max-h-[90dvh]"
    >
      {/* Cabeçalho */}
      <div className="px-6 py-4 border-b border-slate-800/90 flex items-center justify-between bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl btn-matte-amber flex items-center justify-center text-white shadow-lg shadow-amber-500/20 shrink-0">
            <GoogleIcon name="upload_file" size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="flashcard-importer-title"
                className="text-base font-extrabold text-white font-display tracking-tight"
              >
                Importação Rápida de Flashcards
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                JSON · CSV Anki · Markdown · HTML
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Arraste um arquivo ou cole diretamente (Ctrl + V) para gerar cartões sincronizados com o TTS
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar importador de flashcards"
          className="btn-compact-touch p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          <GoogleIcon name="close" size={18} />
        </button>
      </div>

      {/* Corpo Rolável */}
      <div className="p-6 space-y-5 overflow-y-auto flex-1">
        {/* Linha de Configuração do Baralho e Idioma Padrão */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label
              htmlFor="flashcard-deck-name-input"
              className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1"
            >
              Nome do Baralho (Deck)
            </label>
            <input
              id="flashcard-deck-name-input"
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="Ex.: Inglês · Expressões Clínicas"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1">
              Idioma Padrão (Fallback)
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['EN', 'IT', 'JA'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setDefaultLanguage(lang)}
                  className={`py-2 rounded-xl text-xs font-mono font-bold border transition-colors cursor-pointer ${
                    defaultLanguage === lang
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dropzone + Textarea de Colagem Instantânea */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFileLoad(file);
          }}
          className={`p-4 rounded-2xl border-2 border-dashed transition-colors space-y-3 ${
            isDragging
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-slate-800 bg-slate-900/40'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv,.tsv,.md,.txt,.html"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileLoad(file);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <GoogleIcon name="upload_file" size={15} className="text-amber-400" />
                <span>Selecionar Arquivo (.json, .csv, .md, .html)</span>
              </button>
              {uploadedFileName && (
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {uploadedFileName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setUploadedFileName(null);
                  setRawInput(SAMPLE_MARKDOWN);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-semibold cursor-pointer"
              >
                Exemplo Markdown
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadedFileName(null);
                  setRawInput(SAMPLE_CSV);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-semibold cursor-pointer"
              >
                Exemplo CSV Anki
              </button>
              {rawInput && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFileName(null);
                    setRawInput('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/25 text-[11px] font-semibold cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          <textarea
            id="flashcard-raw-paste-textarea"
            rows={5}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Cole aqui (Ctrl + V) sua tabela Markdown, lista 'Frente :: Verso', pares 'Q: / A:', CSV/TSV do Anki ou JSON de flashcards..."
            className="w-full p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 resize-y"
          />
        </div>

        {/* Avisos de Parser */}
        {warnings.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="flex items-center gap-1.5">
                <GoogleIcon name="warning" size={15} className="text-amber-400 shrink-0" />
                <span>{w}</span>
              </p>
            ))}
          </div>
        )}

        {/* Tabela de Pré-Visualização Editável */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-white font-display">
                Pré-visualização Mapeada
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 tabular-nums">
                {candidates.length} {candidates.length === 1 ? 'card detectado' : 'cards detectados'}
              </span>
              {rawInput.trim() && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                  Formato: {detectedFormat}
                </span>
              )}
            </div>
          </div>

          {candidates.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center text-xs text-slate-400">
              Nenhum card mapeado ainda. Cole texto acima, arraste um arquivo ou clique em{' '}
              <strong className="text-amber-300">Exemplo Markdown</strong> para testar.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-900/90 text-[10px] font-mono uppercase text-slate-400 sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-3 border-b border-slate-800 w-10">#</th>
                    <th className="py-2 px-3 border-b border-slate-800">
                      Frente (Expressão / Idioma Alvo)
                    </th>
                    <th className="py-2 px-3 border-b border-slate-800">
                      Verso (Significado / Tradução)
                    </th>
                    <th className="py-2 px-3 border-b border-slate-800">Contexto / Nota</th>
                    <th className="py-2 px-3 border-b border-slate-800 w-20">Idioma</th>
                    <th className="py-2 px-2 border-b border-slate-800 w-10 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 bg-slate-950/60">
                  {candidates.map((cand, index) => (
                    <tr key={index} className="hover:bg-slate-900/40">
                      <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500 tabular-nums">
                        {index + 1}
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={cand.front}
                          onChange={(e) => handleUpdateCandidate(index, 'front', e.target.value)}
                          aria-label={`Frente do card ${index + 1}`}
                          className="w-full px-2 py-1 rounded bg-slate-900/80 border border-slate-800 text-xs text-white focus:border-amber-500/50 focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={cand.back}
                          onChange={(e) => handleUpdateCandidate(index, 'back', e.target.value)}
                          aria-label={`Verso do card ${index + 1}`}
                          className="w-full px-2 py-1 rounded bg-slate-900/80 border border-slate-800 text-xs text-slate-200 focus:border-amber-500/50 focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={cand.context}
                          onChange={(e) => handleUpdateCandidate(index, 'context', e.target.value)}
                          aria-label={`Contexto do card ${index + 1}`}
                          className="w-full px-2 py-1 rounded bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 focus:border-amber-500/50 focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <select
                          value={cand.language}
                          onChange={(e) =>
                            handleUpdateCandidate(index, 'language', e.target.value)
                          }
                          aria-label={`Idioma do card ${index + 1}`}
                          className="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono font-bold text-amber-300 focus:outline-none"
                        >
                          <option value="en-US">EN</option>
                          <option value="it-IT">IT</option>
                          <option value="ja-JP">JA</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveCandidate(index)}
                          aria-label={`Remover card ${index + 1}`}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <GoogleIcon name="delete" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé com Ação de Confirmação */}
      <div className="px-6 py-4 border-t border-slate-800/90 bg-slate-900/60 flex items-center justify-between shrink-0">
        <span className="text-[11px] text-slate-400">
          Os flashcards serão salvos localmente e sincronizados na nuvem (southamerica-east1).
        </span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={candidates.length === 0}
            onClick={handleConfirmImport}
            className="px-4 py-2 rounded-xl btn-matte-amber text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <GoogleIcon name="check" size={16} />
            <span className="tabular-nums">
              Importar {candidates.length} {candidates.length === 1 ? 'Flashcard' : 'Flashcards'}
            </span>
          </button>
        </div>
      </div>
    </dialog>
  );
};

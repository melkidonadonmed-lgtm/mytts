/**
 * Seção de ingestão de documento base (estados de UI: vazio, carregando, sucesso e erro).
 */
import React, { useState } from 'react';
import { 
  FileText, 
  UploadCloud, 
  Sparkles, 
  ArrowRight, 
  Trash2, 
  FileCheck2,
  Clock,
  BookOpen
} from 'lucide-react';
import { SAMPLE_DOCUMENTS } from '../data/sampleDebates';
import { LanguageCode } from '../types/debate';
import { requestExtractTextJson } from '../services/apiClient';

interface DocumentInputSectionProps {
  currentLanguage: LanguageCode;
  textInput: string;
  onChangeText: (text: string) => void;
  onGenerateDebate: () => void;
  isGenerating: boolean;
}

export const DocumentInputSection: React.FC<DocumentInputSectionProps> = ({
  currentLanguage,
  textInput,
  onChangeText,
  onGenerateDebate,
  isGenerating,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Filtra o exemplo recomendado para o idioma selecionado
  const sampleForCurrentLang = SAMPLE_DOCUMENTS.find((d) => d.language === currentLanguage) || SAMPLE_DOCUMENTS[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setUploadError(null);

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string)?.split(',')[1];
        if (!base64Data) {
          setUploadError('Falha ao codificar arquivo PDF.');
          return;
        }
        try {
          const data = await requestExtractTextJson({
            fileData: base64Data,
            mimeType: 'application/pdf',
            fileName: file.name,
          });
          if (data.ok && data.success && data.text) {
            onChangeText(data.text);
          } else {
            setUploadError(data.error || 'Falha ao extrair texto do PDF.');
          }
        } catch (err: unknown) {
          setUploadError(err instanceof Error ? err.message : 'Erro ao processar PDF.');
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        onChangeText(content);
      };
      reader.onerror = () => setUploadError('Erro ao ler arquivo local.');
      reader.readAsText(file);
    }
  };

  const wordCount = textInput.trim().split(/\s+/).filter(Boolean).length;
  const estimatedDebateMinutes = Math.max(1, Math.ceil(wordCount / 130));

  return (
    <section 
      aria-label="Área de Ingestão de Documentos"
      className="w-full rounded-2xl card-matte p-4 sm:p-6 flex flex-col gap-4"
      data-state="idle"
      aria-busy="false"
    >
      {/* 1. Alternador de Modo de Entrada (Touch Target de 44px) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl surface-inset p-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`min-h-[40px] flex items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'paste'
                ? 'btn-matte-amber text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Colar Texto</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`min-h-[40px] flex items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'btn-matte-amber text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Subir Arquivo</span>
          </button>
        </div>

        {/* Botão de Exemplo Rápido (1-Tap Preset) */}
        <button
          type="button"
          onClick={() => {
            onChangeText(sampleForCurrentLang.content);
            setUploadedFileName(null);
            setUploadError(null);
          }}
          className="min-h-[40px] flex items-center justify-center sm:justify-start gap-1.5 rounded-xl btn-matte-dark px-3 py-2 text-xs font-medium text-secondary hover:text-primary transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="truncate">Usar ensaio de teste ({sampleForCurrentLang.language})</span>
        </button>
      </div>

      {/* 2. Área Central de Input */}
      {activeTab === 'paste' ? (
        <div className="relative">
          <textarea
            value={textInput}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder="Cole aqui o texto, artigo, ensaio ou conversa para renderizar em áudio..."
            rows={5}
            className="w-full rounded-xl input-sunken p-3.5 text-sm text-primary placeholder-slate-400 focus:outline-none transition-all resize-y leading-relaxed font-sans"
          />
          {textInput && (
            <button
              type="button"
              onClick={() => onChangeText('')}
              aria-label="Limpar texto"
              className="absolute right-3 top-3 p-1.5 rounded-lg btn-matte-dark text-secondary hover:text-rose-400 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <label className="relative flex flex-col items-center justify-center min-h-[120px] rounded-xl border-2 border-dashed border-slate-700 hover:border-amber-400/50 surface-inset p-6 text-center transition-all cursor-pointer group">
          <input
            type="file"
            accept=".pdf,.txt,.md,.json"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 mb-2">
            <UploadCloud className="w-6 h-6" />
          </div>
          {uploadedFileName ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <FileCheck2 className="w-4 h-4" />
              <span>{uploadedFileName}</span>
            </div>
          ) : (
            <>
              <p className="text-xs sm:text-sm font-semibold text-primary">
                Toque para selecionar documento
              </p>
              <p className="text-[11px] text-secondary mt-0.5">
                Suporta PDF, TXT, Markdown (.md) ou relatórios em texto puro
              </p>
            </>
          )}
          {uploadError && (
            <p className="text-[11px] text-rose-400 mt-2">{uploadError}</p>
          )}
        </label>
      )}

      {/* 3. Rodapé com Metadados e Ação Primária Ampla */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3 text-xs text-secondary font-mono tabular-nums">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            {wordCount} palavras
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            ~{estimatedDebateMinutes} min
          </span>
        </div>

        <button
          type="button"
          onClick={onGenerateDebate}
          disabled={!textInput.trim() || isGenerating}
          className="min-h-[48px] w-full sm:w-auto px-6 rounded-xl btn-matte-amber text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          {isGenerating ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Roteirizando Conversa...</span>
            </>
          ) : (
            <>
              <span>Renderizar Conversa em Áudio</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </section>
  );
};

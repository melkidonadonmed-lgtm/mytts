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

  // Filtra o exemplo recomendado para o idioma selecionado
  const sampleForCurrentLang = SAMPLE_DOCUMENTS.find((d) => d.language === currentLanguage) || SAMPLE_DOCUMENTS[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        onChangeText(content);
      };
      reader.readAsText(file);
    }
  };

  const wordCount = textInput.trim().split(/\s+/).filter(Boolean).length;
  const estimatedDebateMinutes = Math.max(1, Math.ceil(wordCount / 130));

  return (
    <section 
      aria-label="Área de Ingestão de Documentos"
      className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-6 backdrop-blur-xl shadow-xl flex flex-col gap-4"
    >
      {/* 1. Alternador de Modo de Entrada (Touch Target de 44px) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`min-h-[44px] flex items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'paste'
                ? 'bg-amber-400/10 border border-amber-400/40 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Colar Texto</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`min-h-[44px] flex items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-amber-400/10 border border-amber-400/40 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
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
          }}
          className="min-h-[44px] flex items-center justify-center sm:justify-start gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-all cursor-pointer"
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
            placeholder="Cole aqui o texto, artigo, ensaio acadêmico ou relatório para converter em debate dialético..."
            rows={7}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-base md:text-sm text-slate-100 placeholder-slate-600 focus:border-amber-400/80 focus:outline-none focus:ring-1 focus:ring-amber-400/80 transition-all resize-y leading-relaxed font-sans"
          />
          {textInput && (
            <button
              type="button"
              onClick={() => onChangeText('')}
              aria-label="Limpar texto"
              className="absolute right-3 top-3 p-1.5 rounded-lg bg-slate-900/80 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <label className="relative flex flex-col items-center justify-center min-h-[180px] rounded-xl border-2 border-dashed border-slate-800 hover:border-amber-400/50 bg-slate-950/50 p-6 text-center transition-all cursor-pointer group">
          <input
            type="file"
            accept=".txt,.md,.json"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 mb-2 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-6 h-6" />
          </div>
          {uploadedFileName ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <FileCheck2 className="w-4 h-4" />
              <span>{uploadedFileName}</span>
            </div>
          ) : (
            <>
              <p className="text-xs sm:text-sm font-semibold text-slate-200">
                Toque para selecionar documento
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Suporta TXT, Markdown (.md) ou relatórios em texto puro
              </p>
            </>
          )}
        </label>
      )}

      {/* 3. Rodapé com Metadados e Ação Primária Ampla */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            {wordCount} palavras
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            ~{estimatedDebateMinutes} min de debate
          </span>
        </div>

        {/* Botão de Geração com Altura Ergonômica de 50px */}
        <button
          type="button"
          onClick={onGenerateDebate}
          disabled={!textInput.trim() || isGenerating}
          className="min-h-[50px] w-full sm:w-auto px-6 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          {isGenerating ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
              <span>Roteirizando Dialética...</span>
            </>
          ) : (
            <>
              <span>Gerar Debate em Áudio</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </section>
  );
};

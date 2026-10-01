import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Check, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { SAMPLE_DOCUMENTS } from '../data/sampleDebates';
import { LanguageCode } from '../types/debate';

interface DocumentIngestionProps {
  documentText: string;
  onTextChange: (text: string) => void;
  selectedLanguage: LanguageCode;
  onLanguageSelect: (lang: LanguageCode) => void;
  onGenerateDebate: () => void;
  isGenerating: boolean;
  uploadedFileName?: string;
  setUploadedFileName: (name: string | undefined) => void;
}

export const DocumentIngestion: React.FC<DocumentIngestionProps> = ({
  documentText,
  onTextChange,
  selectedLanguage,
  onLanguageSelect,
  onGenerateDebate,
  isGenerating,
  uploadedFileName,
  setUploadedFileName,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = documentText.trim() ? documentText.trim().split(/\s+/).length : 0;
  const charCount = documentText.length;

  const handleFileProcess = async (file: File) => {
    setExtractError(null);
    setUploadedFileName(file.name);

    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const text = await file.text();
      onTextChange(text);
      return;
    }

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        setIsExtracting(true);
        const reader = new FileReader();
        reader.onload = async () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          const resp = await fetch('/api/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: base64,
              fileName: file.name,
              mimeType: 'application/pdf',
            }),
          });
          const data = await resp.json();
          if (data.text) {
            onTextChange(data.text);
          } else {
            setExtractError(data.error || 'Falha ao processar PDF.');
          }
          setIsExtracting(false);
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        setExtractError('Erro de leitura do arquivo PDF.');
        setIsExtracting(false);
      }
      return;
    }

    // Default plain text reader
    try {
      const text = await file.text();
      onTextChange(text);
    } catch (e) {
      setExtractError('Formato não suportado diretamente. Cole o texto no campo.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleLoadSample = (sampleId: string) => {
    const sample = SAMPLE_DOCUMENTS.find((s) => s.id === sampleId);
    if (sample) {
      onTextChange(sample.content);
      onLanguageSelect(sample.language);
      setUploadedFileName(sample.title);
      setExtractError(null);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header zone with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Ingestão de Conteúdo e Documentos</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Insira o texto bruto, faça upload de PDF/TXT ou selecione um ensaio temático.
          </p>
        </div>

        {/* Clean metadata without pill boxes */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
          <span>{wordCount} palavras</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>{charCount} caracteres</span>
          {uploadedFileName && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-amber-400/90 truncate max-w-[140px]">{uploadedFileName}</span>
            </>
          )}
        </div>
      </div>

      {/* Preset quick samples */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-slate-400">Carregar Amostras Editoriais Prontas:</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {SAMPLE_DOCUMENTS.map((sample) => {
            const isSelected = uploadedFileName === sample.title;
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleLoadSample(sample.id)}
                className={`text-left p-2.5 rounded-lg border text-xs transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-amber-400/60 bg-amber-500/10 text-amber-200'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-400">
                    {sample.category}
                  </span>
                  <span className="text-[10px] text-slate-500">{sample.readTime}</span>
                </div>
                <div className="font-medium line-clamp-2 leading-relaxed">{sample.title}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload Zone & Textarea */}
      <div className="relative">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative rounded-lg border transition-all ${
            isDragging
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-slate-800 bg-slate-950/60 focus-within:border-amber-400/70'
          }`}
        >
          <textarea
            value={documentText}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Cole o artigo, tese, relatório financeiro ou documento de discussão aqui (em Português, Inglês, Italiano ou Japonês)..."
            rows={7}
            className="w-full bg-transparent p-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none resize-y leading-relaxed font-sans"
          />

          {/* Bottom toolbar inside textarea */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800/80 bg-slate-950/80 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf,.docx,.csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileProcess(e.target.files[0]);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting}
                className="flex items-center gap-1.5 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-amber-400" />
                <span>{isExtracting ? 'Extraindo...' : 'Upload Arquivo (PDF / TXT / MD)'}</span>
              </button>
            </div>

            {documentText && (
              <button
                type="button"
                onClick={() => {
                  onTextChange('');
                  setUploadedFileName(undefined);
                }}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                Limpar Texto
              </button>
            )}
          </div>
        </div>

        {extractError && (
          <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{extractError}</span>
          </div>
        )}
      </div>

      {/* Primary Action Button */}
      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={onGenerateDebate}
          disabled={isGenerating || !documentText.trim()}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              <span>Gerando Roteiro Dialético...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Gerar Roteiro de Debate</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

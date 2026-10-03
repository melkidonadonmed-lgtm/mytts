import React, { useState } from 'react';
import { User, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { PolyglotMessage } from '../types/polyglot';
import { LanguageColumnCard } from './LanguageColumnCard';
import { ChunkActionMenu } from './ChunkActionMenu';

interface ParallelMessageBlockProps {
  message: PolyglotMessage;
  onPlayChunkAudio: (text: string, language: string) => Promise<void>;
  onPlayFullText: (text: string, language: string, voiceId: string, speed: number) => Promise<void>;
  onCreateFlashcard: (chunkText: string, language: string) => Promise<void>;
  playingAudioKey: string | null;
  generatingCardKey: string | null;
}

export const ParallelMessageBlock: React.FC<ParallelMessageBlockProps> = ({
  message,
  onPlayChunkAudio,
  onPlayFullText,
  onCreateFlashcard,
  playingAudioKey,
  generatingCardKey,
}) => {
  const [hoveredChunkId, setHoveredChunkId] = useState<number | null>(null);
  const [activeMenu, setActiveMenu] = useState<{
    chunkText: string;
    language: string;
    position: { top: number; left: number };
  } | null>(null);

  const handleClickChunk = (chunkText: string, language: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveMenu({
      chunkText,
      language,
      position: {
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
      },
    });
  };

  return (
    <div className="flex flex-col gap-3 py-4 border-b border-slate-800/60 last:border-0">
      
      {/* 1. Entrada / Pergunta do Usuário */}
      <div className="flex items-start gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 max-w-3xl">
        <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
          <User className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-slate-300">Você</span>
            <span className="text-[10px] font-mono text-slate-500">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
            {message.userPrompt}
          </p>
        </div>
      </div>

      {/* 2. Resposta em 3 Colunas Paralelas (Multi-Pane) */}
      {message.status === 'loading' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6 bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl animate-pulse">
          {['Inglês', 'Italiano', 'Japonês'].map((lang, idx) => (
            <div key={idx} className="h-44 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              <span>Alinhando chunks em {lang}...</span>
            </div>
          ))}
        </div>
      )}

      {message.status === 'error' && (
        <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{message.error || 'Falha ao processar os chunks paralelos desta mensagem.'}</span>
        </div>
      )}

      {message.status === 'ready' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          
          {/* Coluna 🇺🇸 Inglês */}
          <LanguageColumnCard
            languageCode="en"
            languageTitle="Inglês"
            flag="🇺🇸"
            badgeText="Global / US"
            chunks={message.chunks}
            fullText={message.fullText.en}
            hoveredChunkId={hoveredChunkId}
            onHoverChunk={setHoveredChunkId}
            onClickChunk={handleClickChunk}
            onPlayFullText={onPlayFullText}
            isPlayingFull={playingAudioKey === `${message.id}-en-full`}
          />

          {/* Coluna 🇮🇹 Italiano */}
          <LanguageColumnCard
            languageCode="it"
            languageTitle="Italiano"
            flag="🇮🇹"
            badgeText="Coloquial"
            chunks={message.chunks}
            fullText={message.fullText.it}
            hoveredChunkId={hoveredChunkId}
            onHoverChunk={setHoveredChunkId}
            onClickChunk={handleClickChunk}
            onPlayFullText={onPlayFullText}
            isPlayingFull={playingAudioKey === `${message.id}-it-full`}
          />

          {/* Coluna 🇯🇵 Japonês */}
          <LanguageColumnCard
            languageCode="ja"
            languageTitle="Japonês"
            flag="🇯🇵"
            badgeText="Tokyo Standard"
            chunks={message.chunks}
            fullText={message.fullText.ja}
            hoveredChunkId={hoveredChunkId}
            onHoverChunk={setHoveredChunkId}
            onClickChunk={handleClickChunk}
            onPlayFullText={onPlayFullText}
            isPlayingFull={playingAudioKey === `${message.id}-ja-full`}
          />
        </div>
      )}

      {/* Menu Flutuante Tátil para o Chunk Clicado */}
      {activeMenu && (
        <ChunkActionMenu
          chunkText={activeMenu.chunkText}
          language={activeMenu.language}
          position={activeMenu.position}
          onClose={() => setActiveMenu(null)}
          onPlayChunkAudio={async (text, lang) => {
            await onPlayChunkAudio(text, lang);
          }}
          onCreateFlashcard={async (chunkText, lang) => {
            await onCreateFlashcard(chunkText, lang);
            setActiveMenu(null);
          }}
          isPlaying={playingAudioKey === activeMenu.chunkText}
          isGeneratingCard={generatingCardKey === activeMenu.chunkText}
        />
      )}
    </div>
  );
};

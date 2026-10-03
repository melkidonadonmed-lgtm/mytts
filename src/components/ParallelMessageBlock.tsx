import React, { useState } from 'react';
import { PolyglotMessage } from '../types/polyglot';
import { LanguageColumnCard } from './LanguageColumnCard';
import { ChunkActionMenu } from './ChunkActionMenu';
import { FloatingCardAudioController } from './FloatingCardAudioController';
import { GoogleIcon } from './GoogleIcon';

export interface ParallelMessageBlockProps {
  message: PolyglotMessage;
  onPlayChunkAudio: (text: string, language: string) => Promise<void>;
  onCreateFlashcard: (chunkText: string, language: string) => Promise<void>;
  playingAudioKey: string | null;
  generatingCardKey: string | null;

  // Controle de Áudio Flutuante por Bloco/Card
  selectedLanguage: 'en' | 'it' | 'ja';
  onSelectLanguage: (lang: 'en' | 'it' | 'ja') => void;
  isPlaying: boolean;
  isLoading: boolean;
  onTogglePlay: (lang: 'en' | 'it' | 'ja') => void;
  onReplay: (lang: 'en' | 'it' | 'ja') => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  speed: number;
  onChangeSpeed: (speed: number) => void;
  voiceByLang: Record<'en' | 'it' | 'ja', string>;
  onChangeVoice: (lang: 'en' | 'it' | 'ja', voice: string) => void;
  onPlaySequence: () => void;
  isPlayingSequence: boolean;
  sequenceStep: string | null;
}

export const ParallelMessageBlock: React.FC<ParallelMessageBlockProps> = ({
  message,
  onPlayChunkAudio,
  onCreateFlashcard,
  playingAudioKey,
  generatingCardKey,
  selectedLanguage,
  onSelectLanguage,
  isPlaying,
  isLoading,
  onTogglePlay,
  onReplay,
  currentTime,
  duration,
  onSeek,
  speed,
  onChangeSpeed,
  voiceByLang,
  onChangeVoice,
  onPlaySequence,
  isPlayingSequence,
  sequenceStep,
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
    <div className="flex flex-col gap-3 py-4 border-b border-slate-800/80 last:border-0">
      
      {/* 1. Entrada / Pergunta do Usuário (Design Matte Limpo) */}
      <div className="flex items-start gap-3 card-matte rounded-2xl p-4 max-w-3xl">
        <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
          <GoogleIcon name="person" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-slate-300 font-display">Você</span>
            <span className="text-[10px] font-mono text-slate-500">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
            {message.userPrompt}
          </p>
        </div>
      </div>

      {/* 2. Loading State */}
      {message.status === 'loading' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6 card-matte rounded-2xl animate-pulse">
          {['Inglês', 'Italiano', 'Japonês'].map((lang, idx) => (
            <div key={idx} className="h-40 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2.5 text-slate-400 text-xs">
              <GoogleIcon name="progress_activity" size={24} className="animate-spin text-amber-400" />
              <span>Alinhando chunks em {lang}...</span>
            </div>
          ))}
        </div>
      )}

      {/* 3. Error State */}
      {message.status === 'error' && (
        <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2.5">
          <GoogleIcon name="error" size={20} className="text-rose-400 shrink-0" />
          <span>{message.error || 'Falha ao processar os chunks paralelos desta mensagem.'}</span>
        </div>
      )}

      {/* 4. Canvas dos 3 Cards Paralelos (Multi-Pane) */}
      {message.status === 'ready' && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-stretch">
            
            {/* Coluna 🇺🇸 Inglês */}
            <LanguageColumnCard
              languageCode="en"
              languageTitle="Inglês"
              flag="🇺🇸"
              badgeText="US Native"
              chunks={message.chunks}
              fullText={message.fullText.en}
              hoveredChunkId={hoveredChunkId}
              isSelected={selectedLanguage === 'en'}
              onSelectCard={() => onSelectLanguage('en')}
              onHoverChunk={setHoveredChunkId}
              onClickChunk={handleClickChunk}
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
              isSelected={selectedLanguage === 'it'}
              onSelectCard={() => onSelectLanguage('it')}
              onHoverChunk={setHoveredChunkId}
              onClickChunk={handleClickChunk}
            />

            {/* Coluna 🇯🇵 Japonês */}
            <LanguageColumnCard
              languageCode="ja"
              languageTitle="Japonês"
              flag="🇯🇵"
              badgeText="Tokyo Std"
              chunks={message.chunks}
              fullText={message.fullText.ja}
              hoveredChunkId={hoveredChunkId}
              isSelected={selectedLanguage === 'ja'}
              onSelectCard={() => onSelectLanguage('ja')}
              onHoverChunk={setHoveredChunkId}
              onClickChunk={handleClickChunk}
            />
          </div>

          {/* 5. Controlador de Áudio Flutuante Posicionado Logo Abaixo dos Cards */}
          <FloatingCardAudioController
            selectedLanguage={selectedLanguage}
            onSelectLanguage={onSelectLanguage}
            isPlaying={isPlaying}
            isLoading={isLoading}
            onTogglePlay={() => onTogglePlay(selectedLanguage)}
            onReplay={() => onReplay(selectedLanguage)}
            currentTime={currentTime}
            duration={duration}
            onSeek={onSeek}
            speed={speed}
            onChangeSpeed={onChangeSpeed}
            selectedVoice={voiceByLang[selectedLanguage]}
            onChangeVoice={(v) => onChangeVoice(selectedLanguage, v)}
            onPlaySequence={onPlaySequence}
            isPlayingSequence={isPlayingSequence}
            sequenceStep={sequenceStep}
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

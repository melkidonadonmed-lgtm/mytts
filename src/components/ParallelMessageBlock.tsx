/**
 * Bloco de mensagem paralela trilingue com voz individual por card e sincronização global.
 */
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

  // Controle de Áudio e Voz por Card (sincronizado com Voz Global)
  selectedLanguage: 'en' | 'it' | 'ja';
  onSelectLanguage: (lang: 'en' | 'it' | 'ja') => void;
  isPlaying: boolean;
  isLoading: boolean;
  playingLangForThisMsg?: 'en' | 'it' | 'ja' | null;
  isCachedByLang?: Record<'en' | 'it' | 'ja', boolean>;
  onTogglePlay: (lang: 'en' | 'it' | 'ja') => void;
  onReplay: (lang: 'en' | 'it' | 'ja') => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  speed: number;
  onChangeSpeed: (speed: number) => void;
  cardVoices: Record<'en' | 'it' | 'ja', string>;
  onChangeCardVoice: (lang: 'en' | 'it' | 'ja', voice: string) => void;
  onDownloadCardWav?: (lang: 'en' | 'it' | 'ja') => void;
  onPlaySequence: () => void;
  isPlayingSequence: boolean;
  sequenceStep: string | null;
  onOpenExport?: (message: PolyglotMessage) => void;
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
  playingLangForThisMsg,
  isCachedByLang,
  onTogglePlay,
  onReplay,
  currentTime,
  duration,
  onSeek,
  speed,
  onChangeSpeed,
  cardVoices,
  onChangeCardVoice,
  onDownloadCardWav,
  onPlaySequence,
  isPlayingSequence,
  sequenceStep,
  onOpenExport,
}) => {
  const [hoveredChunkId, setHoveredChunkId] = useState<number | null>(null);
  const [activeMenu, setActiveMenu] = useState<{
    chunkText: string;
    language: string;
    position: { top: number; left: number };
  } | null>(null);

  const handleClickChunk = (chunkText: string, language: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const menuHeight = 178;
    const menuWidth = 285;
    // Posicionamento relativo à viewport (fixed) com flip automático acima se próximo ao dock inferior
    const shouldFlipUp = rect.bottom + menuHeight + 90 > viewportHeight;
    const safeTop = shouldFlipUp
      ? Math.max(16, rect.top - menuHeight - 8)
      : Math.max(16, rect.bottom + 8);
    const safeLeft = Math.max(16, Math.min(viewportWidth - menuWidth - 16, rect.left));

    setActiveMenu({
      chunkText,
      language,
      position: {
        top: safeTop,
        left: safeLeft,
      },
    });
  };

  return (
    <div data-state="idle" aria-busy={message.status === 'loading'} className="flex flex-col gap-3 py-4 border-b border-slate-800/80 last:border-0">
      
      {/* 1. Entrada / Pergunta do Usuário (Design Matte Limpo) */}
      <div className="flex items-start gap-3 card-matte rounded-2xl p-4 max-w-3xl">
        <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
          <GoogleIcon name="person" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-primary font-display">Você</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tabular-nums text-secondary">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {message.status === 'ready' && onOpenExport && (
                <button
                  type="button"
                  onClick={() => onOpenExport(message)}
                  className="btn-matte btn-matte-dark px-2.5 py-0.5 text-[11px] text-amber-300 hover:text-white rounded-lg flex items-center gap-1 border border-amber-400/20 hover:border-amber-400/40 transition-all cursor-pointer"
                  title="Exportar Fast Chunks e Áudio desta interação (Anki CSV, Markdown, JSON, WAV ou Deck)"
                >
                  <GoogleIcon name="download" size={13} className="text-amber-400" />
                  <span>Exportar Chunks / WAV</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-xs sm:text-sm text-primary whitespace-pre-wrap leading-relaxed prose-measure">
            {message.userPrompt}
          </p>
        </div>
      </div>

      {/* 2. Loading State */}
      {message.status === 'loading' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6 card-matte rounded-2xl animate-pulse">
          {['Inglês', 'Italiano', 'Japonês'].map((lang, idx) => (
            <div key={idx} className="h-40 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2.5 text-secondary text-xs">
              <GoogleIcon name="progress_activity" size={24} className="animate-spin text-amber-400" />
              <span>Alinhando chunks em {lang}...</span>
            </div>
          ))}
        </div>
      )}

      {/* 3. Error State */}
      {message.status === 'error' && (
        <div role="alert" className="bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2.5">
          <GoogleIcon name="error" size={20} className="text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{message.error || 'Falha ao processar os chunks paralelos desta mensagem.'}</span>
        </div>
      )}

      {/* 4. Canvas dos 3 Cards Paralelos com Voz Independente por Card */}
      {message.status === 'ready' && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-stretch">
            
            {/* Coluna EN Inglês */}
            <LanguageColumnCard
              languageCode="en"
              languageTitle="Inglês"
              flag="EN"
              badgeText="US Native"
              chunks={message.chunks}
              fullText={message.fullText.en}
              hoveredChunkId={hoveredChunkId}
              isSelected={selectedLanguage === 'en'}
              isCached={isCachedByLang?.en}
              cardVoice={cardVoices.en}
              onChangeCardVoice={(v) => onChangeCardVoice('en', v)}
              isPlayingCard={isPlaying && playingLangForThisMsg === 'en'}
              isLoadingCard={isLoading && playingLangForThisMsg === 'en'}
              onTogglePlayCard={() => onTogglePlay('en')}
              onDownloadCardWav={onDownloadCardWav ? () => onDownloadCardWav('en') : undefined}
              onSelectCard={() => onSelectLanguage('en')}
              onHoverChunk={setHoveredChunkId}
              onClickChunk={handleClickChunk}
            />

            {/* Coluna IT Italiano */}
            <LanguageColumnCard
              languageCode="it"
              languageTitle="Italiano"
              flag="IT"
              badgeText="Coloquial"
              chunks={message.chunks}
              fullText={message.fullText.it}
              hoveredChunkId={hoveredChunkId}
              isSelected={selectedLanguage === 'it'}
              isCached={isCachedByLang?.it}
              cardVoice={cardVoices.it}
              onChangeCardVoice={(v) => onChangeCardVoice('it', v)}
              isPlayingCard={isPlaying && playingLangForThisMsg === 'it'}
              isLoadingCard={isLoading && playingLangForThisMsg === 'it'}
              onTogglePlayCard={() => onTogglePlay('it')}
              onDownloadCardWav={onDownloadCardWav ? () => onDownloadCardWav('it') : undefined}
              onSelectCard={() => onSelectLanguage('it')}
              onHoverChunk={setHoveredChunkId}
              onClickChunk={handleClickChunk}
            />

            {/* Coluna JA Japonês */}
            <LanguageColumnCard
              languageCode="ja"
              languageTitle="Japonês"
              flag="JA"
              badgeText="Tokyo Std"
              chunks={message.chunks}
              fullText={message.fullText.ja}
              hoveredChunkId={hoveredChunkId}
              isSelected={selectedLanguage === 'ja'}
              isCached={isCachedByLang?.ja}
              cardVoice={cardVoices.ja}
              onChangeCardVoice={(v) => onChangeCardVoice('ja', v)}
              isPlayingCard={isPlaying && playingLangForThisMsg === 'ja'}
              isLoadingCard={isLoading && playingLangForThisMsg === 'ja'}
              onTogglePlayCard={() => onTogglePlay('ja')}
              onDownloadCardWav={onDownloadCardWav ? () => onDownloadCardWav('ja') : undefined}
              onSelectCard={() => onSelectLanguage('ja')}
              onHoverChunk={setHoveredChunkId}
              onClickChunk={handleClickChunk}
            />
          </div>

          {/* 5. Controlador de Áudio Flutuante Sincronizado com o Card Focado */}
          <FloatingCardAudioController
            selectedLanguage={selectedLanguage}
            onSelectLanguage={onSelectLanguage}
            isPlaying={isPlaying}
            isLoading={isLoading}
            isCached={isCachedByLang?.[selectedLanguage]}
            isCachedByLang={isCachedByLang}
            onTogglePlay={() => onTogglePlay(selectedLanguage)}
            onReplay={() => onReplay(selectedLanguage)}
            currentTime={currentTime}
            duration={duration}
            onSeek={onSeek}
            speed={speed}
            onChangeSpeed={onChangeSpeed}
            selectedVoice={cardVoices[selectedLanguage]}
            cardVoices={cardVoices}
            onPlaySequence={onPlaySequence}
            isPlayingSequence={isPlayingSequence}
            sequenceStep={sequenceStep}
            onOpenExport={onOpenExport ? () => onOpenExport(message) : undefined}
            onDownloadFocusedWav={onDownloadCardWav ? () => onDownloadCardWav(selectedLanguage) : undefined}
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

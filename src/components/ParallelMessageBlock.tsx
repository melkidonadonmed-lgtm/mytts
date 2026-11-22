/**
 * Bloco de mensagem paralela trilingue com voz individual por card,
 * resposta do Agente Gemini (Busca Web / YouTube / Tutor Live) e sincronização global.
 */
import React, { useState } from 'react';
import {
  PolyglotMessage,
  YoutubePostLinkAction,
  YoutubeClipRange,
} from '../types/polyglot';
import type { StudioRenderMode } from '../types/debate';
import { LanguageColumnCard } from './LanguageColumnCard';
import { ChunkActionMenu } from './ChunkActionMenu';
import { FloatingCardAudioController } from './FloatingCardAudioController';
import { GoogleIcon } from './GoogleIcon';
import { Globe, Video, Sparkles, Plus } from 'lucide-react';
import { AgentContextCard } from './polyglot/AgentContextCard';

export interface ParallelMessageBlockProps {
  message: PolyglotMessage;
  onPlayChunkAudio: (text: string, language: string, voiceId?: string) => Promise<void>;
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
  onSendToCreationStudio?: (text: string, mode: StudioRenderMode) => void;
  onExecuteYoutubePostLinkAction?: (
    messageId: string,
    youtubeUrl: string,
    action: YoutubePostLinkAction,
    clipRange?: YoutubeClipRange
  ) => void;
}

const STUDIO_PICKER_OPTIONS = [
  { id: 'podcast', label: 'Podcast de Estúdio', icon: 'podcasts' },
  { id: 'debate', label: 'Debate Dialético', icon: 'forum' },
  { id: 'bar_chat', label: 'Conversa de Bar', icon: 'local_cafe' },
  { id: 'dinner', label: 'Mesa de Jantar', icon: 'restaurant' },
  { id: 'solo', label: 'Leitura Solo (1 Voz)', icon: 'headphones' },
] as const;

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
  onSendToCreationStudio,
  onExecuteYoutubePostLinkAction,
}) => {
  const [hoveredChunkId, setHoveredChunkId] = useState<number | null>(null);
  const [isStudioPickerOpen, setIsStudioPickerOpen] = useState(false);
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
    const shouldFlipUp = rect.bottom + menuHeight + 90 > viewportHeight;
    const safeTop = shouldFlipUp
      ? Math.max(16, rect.top - menuHeight - 8)
      : Math.max(16, rect.bottom + 8);
    const safeLeft = Math.max(16, Math.min(viewportWidth - menuWidth - 16, rect.left));

    setActiveMenu({
      chunkText,
      language,
      position: { top: safeTop, left: safeLeft },
    });
  };

  const buildTextForStudio = (): string => {
    const parts = [message.userPrompt];
    if (message.agentReplyPtBr) parts.push(message.agentReplyPtBr);
    if (message.fullText.en) parts.push(`EN: ${message.fullText.en}`);
    if (message.fullText.it) parts.push(`IT: ${message.fullText.it}`);
    return parts.join('\n\n');
  };

  return (
    <div
      aria-busy={message.status === 'loading'}
      className="flex flex-col gap-3.5 pb-6 border-b border-[var(--border-subtle)] last:border-b-0 transition-all"
    >
      {/* 1. Cabeçalho Fluido do Turno do Usuário */}
      <div className="flex items-start gap-3 px-1">
        <div className="w-8 h-8 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
          <GoogleIcon name="person" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary font-display">Você</span>
              {message.originMode === 'youtube' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  <Video className="w-3 h-3 text-rose-400" />
                  <span>YouTube</span>
                </span>
              )}
              {message.originMode === 'web_search' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  <Globe className="w-3 h-3 text-sky-400" />
                  <span>Google Search</span>
                </span>
              )}
              {message.originMode === 'live_agent' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>Gemini Live</span>
                </span>
              )}
              <span className="text-[10px] font-mono tabular-nums text-secondary">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {message.status === 'ready' && (
              <div className="relative flex items-center gap-1.5 shrink-0">
                {onSendToCreationStudio && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsStudioPickerOpen((prev) => !prev)}
                      className="btn-compact-touch btn-matte-dark min-h-11 px-3.5 py-1.5 text-[11px] font-semibold text-amber-300 hover:text-primary rounded-full inline-flex items-center gap-1.5 cursor-pointer transition-all"
                      title="Enviar este conteúdo para o Estúdio de Criação (Debate, Podcast, Conversa de Bar, Jantar ou Solo)"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Estúdio de Criação</span>
                    </button>

                    {isStudioPickerOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl card-matte p-1.5 shadow-2xl border border-[var(--border-control)] z-40 flex flex-col gap-1">
                        {STUDIO_PICKER_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setIsStudioPickerOpen(false);
                              onSendToCreationStudio(buildTextForStudio(), opt.id);
                            }}
                            className="btn-compact-touch min-h-11 px-3 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-amber-500/15 flex items-center gap-2 text-left cursor-pointer"
                          >
                            <GoogleIcon name={opt.icon} size={15} className="text-amber-400" />
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {onOpenExport && (
                  <button
                    type="button"
                    onClick={() => onOpenExport(message)}
                    className="btn-compact-touch btn-matte-dark min-h-11 px-3.5 py-1.5 text-[11px] text-secondary hover:text-primary rounded-full inline-flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Exportar Chunks e Áudio desta interação (Anki CSV, Markdown, JSON, WAV ou Deck)"
                  >
                    <GoogleIcon name="download" size={14} className="text-amber-400" />
                    <span>Exportar</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="text-xs sm:text-sm text-primary whitespace-pre-wrap leading-relaxed prose-measure font-medium">
            {message.userPrompt}
          </p>
        </div>
      </div>

      {/* 1.5 Resposta Contextual do Agente Gemini */}
      <AgentContextCard
        message={message}
        onSendToCreationStudio={onSendToCreationStudio}
        onExecuteYoutubePostLinkAction={onExecuteYoutubePostLinkAction}
      />

      {/* 2. Loading State */}
      {message.status === 'loading' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 p-6 card-matte rounded-2xl animate-pulse">
          {['Inglês', 'Italiano', 'Japonês'].map((lang, idx) => (
            <div
              key={idx}
              className="h-44 surface-inset border border-[var(--border-subtle)] rounded-xl flex flex-col items-center justify-center gap-2.5 text-secondary text-xs"
            >
              <GoogleIcon name="progress_activity" size={24} className="animate-spin text-amber-400" />
              <span>Alinhando chunks em {lang}...</span>
            </div>
          ))}
        </div>
      )}

      {/* 3. Error State */}
      {message.status === 'error' && (
        <div
          role="alert"
          className="surface-inset border border-[var(--border-control)] text-[var(--status-danger)] p-4 rounded-xl text-xs flex items-center gap-2.5"
        >
          <GoogleIcon name="error" size={20} className="text-[var(--status-danger)] shrink-0" />
          <span>{message.error || 'Falha ao processar os chunks paralelos desta mensagem.'}</span>
        </div>
      )}

      {/* 4. Canvas dos 3 Cards Paralelos com Container Query Responsiva */}
      {message.status === 'ready' && (
        <div className="@container flex flex-col gap-3 min-w-0">
          <div className="grid grid-cols-1 @min-[720px]:grid-cols-3 gap-4 lg:gap-5 items-stretch">
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
            onDownloadFocusedWav={
              onDownloadCardWav ? () => onDownloadCardWav(selectedLanguage) : undefined
            }
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
            const langKey: 'en' | 'it' | 'ja' = lang.startsWith('it')
              ? 'it'
              : lang.startsWith('ja')
              ? 'ja'
              : 'en';
            await onPlayChunkAudio(text, lang, cardVoices[langKey]);
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

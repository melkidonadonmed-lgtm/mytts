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
import { Globe, Video, Sparkles, ExternalLink, Plus, Play } from 'lucide-react';
import { normalizeYoutubeVideo } from '../utils/youtubeHelper';

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
  const [showYoutubeEmbed, setShowYoutubeEmbed] = useState<boolean>(
    () => Boolean(message.awaitingYoutubeIntent)
  );
  const [clipStart, setClipStart] = useState(message.youtubeClipRange?.start || '');
  const [clipEnd, setClipEnd] = useState(message.youtubeClipRange?.end || '');
  const resolvedYoutubeId =
    message.youtubeMeta?.videoId ||
    (message.youtubeUrl ? normalizeYoutubeVideo(message.youtubeUrl)?.videoId : undefined);
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
      position: {
        top: safeTop,
        left: safeLeft,
      },
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
      data-state="idle"
      aria-busy={message.status === 'loading'}
      className="flex flex-col gap-3.5 pb-6 border-b border-slate-800/40 last:border-b-0 transition-all"
    >
      {/* 1. Cabeçalho Fluido do Turno do Usuário (Sem caixa pesada empilhada) */}
      <div className="flex items-start gap-3 px-1">
        <div className="w-7 h-7 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
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
                      className="btn-compact-touch btn-matte-dark h-7 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 hover:text-primary rounded-full inline-flex items-center gap-1 cursor-pointer transition-all"
                      title="Enviar este conteúdo para o Estúdio de Criação (Debate, Podcast, Conversa de Bar, Jantar ou Solo)"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Estúdio de Criação</span>
                    </button>

                    {isStudioPickerOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl card-matte p-1.5 shadow-2xl border border-amber-400/30 z-40 flex flex-col gap-1">
                        {(
                          [
                            { id: 'podcast', label: 'Podcast de Estúdio', icon: 'podcasts' },
                            { id: 'debate', label: 'Debate Dialético', icon: 'forum' },
                            { id: 'bar_chat', label: 'Conversa de Bar', icon: 'local_cafe' },
                            { id: 'dinner', label: 'Mesa de Jantar', icon: 'restaurant' },
                            { id: 'solo', label: 'Leitura Solo (1 Voz)', icon: 'headphones' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setIsStudioPickerOpen(false);
                              onSendToCreationStudio(buildTextForStudio(), opt.id);
                            }}
                            className="btn-compact-touch px-2.5 py-1.5 rounded-xl text-xs font-semibold text-primary hover:bg-amber-500/15 flex items-center gap-2 text-left cursor-pointer"
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
                    className="btn-compact-touch btn-matte-dark h-7 px-2.5 py-0.5 text-[11px] text-secondary hover:text-primary rounded-full inline-flex items-center gap-1 transition-all cursor-pointer"
                    title="Exportar Chunks e Áudio desta interação (Anki CSV, Markdown, JSON, WAV ou Deck)"
                  >
                    <GoogleIcon name="download" size={13} className="text-amber-400" />
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

      {/* 1.5 Resposta Contextual do Agente Gemini (Quando gerado por YouTube, Busca Web ou Tutor Live) */}
      {(message.agentReplyPtBr ||
        message.youtubeUrl ||
        (message.youtubeSearchResults && message.youtubeSearchResults.length > 0) ||
        (message.sources && message.sources.length > 0)) && (
        <div className="rounded-2xl card-matte border border-amber-500/30 p-3.5 flex flex-col gap-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {message.awaitingYoutubeIntent
                  ? 'Vídeo Carregado — Escolha o que Deseja Fazer'
                  : message.youtubeAction === 'translate_video'
                  ? 'Tradução & Transcrição da Fala do Vídeo (EN · IT · JA)'
                  : message.youtubeAction === 'extract_expressions'
                  ? 'Expressões Nativas & Flashcards Extraídos do Vídeo'
                  : message.originMode === 'youtube'
                  ? 'Resumo & Conversa Baseada no Vídeo do YouTube'
                  : message.originMode === 'web_search'
                  ? 'Resposta do Agente com Busca Web & Catálogo YouTube'
                  : 'Explicação do Agente Tutor Poliglota'}
              </span>
            </div>

            {message.youtubeUrl && (
              <div className="flex items-center gap-1.5">
                {resolvedYoutubeId && (
                  <button
                    type="button"
                    onClick={() => setShowYoutubeEmbed((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-amber-300 hover:text-primary surface-inset px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3 text-amber-400" />
                    <span>{showYoutubeEmbed ? 'Ocultar Player' : 'Assistir no App'}</span>
                  </button>
                )}
                <a
                  href={message.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 rounded-xl transition-colors"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>YouTube</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Metadados + Player Embarcado do YouTube */}
          {message.youtubeMeta && (
            <div className="flex items-center gap-2.5 p-2 rounded-xl surface-inset">
              <img
                src={message.youtubeMeta.thumbnailUrl}
                alt={message.youtubeMeta.title}
                className="w-16 h-10 rounded-lg object-cover border border-rose-500/30 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-primary truncate">
                  {message.youtubeMeta.title}
                </p>
                {message.youtubeMeta.authorName && (
                  <p className="text-[10px] font-mono text-secondary truncate">
                    Canal: {message.youtubeMeta.authorName}
                  </p>
                )}
              </div>
            </div>
          )}

          {showYoutubeEmbed && resolvedYoutubeId && (
            <div className="w-full aspect-video max-h-[320px] rounded-xl overflow-hidden border border-slate-700/70 bg-black">
              <iframe
                title={message.youtubeMeta?.title || 'Player do YouTube'}
                src={`https://www.youtube-nocookie.com/embed/${resolvedYoutubeId}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {message.agentReplyPtBr && (
            <p className="text-xs sm:text-sm text-primary whitespace-pre-wrap leading-relaxed">
              {message.agentReplyPtBr}
            </p>
          )}

          {/* Barra Interativa de Ação Pós-Link do YouTube (No próprio Card da mensagem) */}
          {message.youtubeUrl && onExecuteYoutubePostLinkAction && (
            <div
              className={`rounded-xl p-2.5 flex flex-col gap-2 border ${
                message.awaitingYoutubeIntent
                  ? 'bg-amber-500/10 border-amber-400/50'
                  : 'surface-inset border-white/[0.06]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-amber-300">
                  {message.awaitingYoutubeIntent
                    ? 'Escolha como processar este vídeo:'
                    : 'Executar outra ação neste vídeo:'}
                </span>
                <div className="flex items-center gap-1 text-[10px] font-mono text-secondary">
                  <span>Trecho opcional:</span>
                  <input
                    id={`clip-start-${message.id}`}
                    name="clipStart"
                    aria-label="Minuto inicial"
                    type="text"
                    value={clipStart}
                    onChange={(e) => setClipStart(e.target.value)}
                    placeholder="00:00"
                    className="w-12 px-1.5 py-0.5 rounded input-sunken text-[10px] text-primary text-center focus:outline-none"
                  />
                  <span>a</span>
                  <input
                    id={`clip-end-${message.id}`}
                    name="clipEnd"
                    aria-label="Minuto final"
                    type="text"
                    value={clipEnd}
                    onChange={(e) => setClipEnd(e.target.value)}
                    placeholder="Fim"
                    className="w-12 px-1.5 py-0.5 rounded input-sunken text-[10px] text-primary text-center focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={message.status === 'loading'}
                  onClick={() =>
                    onExecuteYoutubePostLinkAction(
                      message.id,
                      message.youtubeUrl!,
                      'translate_video',
                      clipStart.trim() || clipEnd.trim()
                        ? { start: clipStart.trim() || undefined, end: clipEnd.trim() || undefined }
                        : undefined
                    )
                  }
                  className="px-3 py-1.5 rounded-xl btn-matte-amber text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  1. Traduzir Fala do Vídeo (3 Idiomas)
                </button>
                <button
                  type="button"
                  disabled={message.status === 'loading'}
                  onClick={() =>
                    onExecuteYoutubePostLinkAction(
                      message.id,
                      message.youtubeUrl!,
                      'summary_dialogue',
                      clipStart.trim() || clipEnd.trim()
                        ? { start: clipStart.trim() || undefined, end: clipEnd.trim() || undefined }
                        : undefined
                    )
                  }
                  className="px-3 py-1.5 rounded-xl btn-matte-dark text-primary text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  2. Resumo + Diálogo de Estudo
                </button>
                <button
                  type="button"
                  disabled={message.status === 'loading'}
                  onClick={() =>
                    onExecuteYoutubePostLinkAction(
                      message.id,
                      message.youtubeUrl!,
                      'extract_expressions',
                      clipStart.trim() || clipEnd.trim()
                        ? { start: clipStart.trim() || undefined, end: clipEnd.trim() || undefined }
                        : undefined
                    )
                  }
                  className="px-3 py-1.5 rounded-xl btn-matte-dark text-amber-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  3. Extrair Expressões & Flashcards
                </button>
                {onSendToCreationStudio && (
                  <button
                    type="button"
                    onClick={() =>
                      onSendToCreationStudio(
                        `${message.youtubeUrl}\nTítulo: ${message.youtubeMeta?.title || 'Vídeo do YouTube'}\n${message.agentReplyPtBr || ''}`,
                        'podcast'
                      )
                    }
                    className="px-3 py-1.5 rounded-xl btn-matte-dark text-emerald-300 text-xs font-semibold cursor-pointer"
                  >
                    4. + Criar Podcast / Debate (2 Vozes)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Galeria de Vídeos Encontrados no YouTube (Quando o usuário buscou um tema no YouTube) */}
          {message.youtubeSearchResults && message.youtubeSearchResults.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/50">
              <span className="text-[10px] font-mono uppercase tracking-wider text-rose-300 font-bold flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-rose-400" />
                <span>Vídeos Encontrados no YouTube (Clique para Traduzir, Resumir ou Criar Podcast):</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.youtubeSearchResults.map((yt) => (
                  <div
                    key={yt.videoId}
                    className="rounded-xl surface-inset p-2 flex flex-col justify-between gap-2 border border-white/[0.06]"
                  >
                    <div className="flex items-start gap-2.5">
                      <img
                        src={yt.thumbnailUrl}
                        alt={yt.title}
                        className="w-20 h-12 rounded-lg object-cover border border-rose-500/30 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <a
                          href={yt.canonicalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-primary hover:text-amber-300 line-clamp-2 leading-snug"
                        >
                          {yt.title}
                        </a>
                        <p className="text-[10px] font-mono text-secondary truncate mt-0.5">
                          {yt.authorName || 'YouTube'}
                          {yt.durationHint ? ` · ${yt.durationHint}` : ''}
                        </p>
                      </div>
                    </div>

                    {onExecuteYoutubePostLinkAction && (
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-white/[0.05]">
                        <button
                          type="button"
                          onClick={() =>
                            onExecuteYoutubePostLinkAction(
                              message.id,
                              yt.canonicalUrl,
                              'translate_video'
                            )
                          }
                          className="px-2 py-0.5 rounded-lg btn-matte-amber text-white text-[10px] font-bold cursor-pointer"
                        >
                          Traduzir Fala
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onExecuteYoutubePostLinkAction(
                              message.id,
                              yt.canonicalUrl,
                              'summary_dialogue'
                            )
                          }
                          className="px-2 py-0.5 rounded-lg btn-matte-dark text-primary text-[10px] font-semibold cursor-pointer"
                        >
                          Resumo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onExecuteYoutubePostLinkAction(
                              message.id,
                              yt.canonicalUrl,
                              'extract_expressions'
                            )
                          }
                          className="px-2 py-0.5 rounded-lg btn-matte-dark text-amber-300 text-[10px] font-semibold cursor-pointer"
                        >
                          Flashcards
                        </button>
                        {onSendToCreationStudio && (
                          <button
                            type="button"
                            onClick={() =>
                              onSendToCreationStudio(
                                `${yt.canonicalUrl}\nTítulo: ${yt.title}\nCanal: ${yt.authorName || 'YouTube'}`,
                                'podcast'
                              )
                            }
                            className="px-2 py-0.5 rounded-lg btn-matte-dark text-emerald-300 text-[10px] font-semibold cursor-pointer"
                          >
                            + Podcast
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {message.sources && message.sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/50">
              <span className="text-[10px] font-mono uppercase tracking-wider text-secondary mr-1">
                Fontes:
              </span>
              {message.sources.map((src, i) => (
                <a
                  key={i}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-lg surface-inset text-sky-300 hover:text-primary transition-colors truncate max-w-[260px]"
                  title={src.title}
                >
                  <Globe className="w-3 h-3 shrink-0" />
                  <span className="truncate">{src.title}</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-75" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Loading State */}
      {message.status === 'loading' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 p-6 card-matte rounded-2xl animate-pulse">
          {['Inglês', 'Italiano', 'Japonês'].map((lang, idx) => (
            <div
              key={idx}
              className="h-44 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2.5 text-secondary text-xs"
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
          className="bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2.5"
        >
          <GoogleIcon name="error" size={20} className="text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{message.error || 'Falha ao processar os chunks paralelos desta mensagem.'}</span>
        </div>
      )}

      {/* 4. Canvas dos 3 Cards Paralelos com Enquadramento Amplo e Espaçamento Confortável */}
      {message.status === 'ready' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-stretch">
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

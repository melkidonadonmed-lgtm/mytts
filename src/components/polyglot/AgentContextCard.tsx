import React, { useState } from 'react';
import {
  PolyglotMessage,
  YoutubePostLinkAction,
  YoutubeClipRange,
} from '../../types/polyglot';
import type { StudioRenderMode } from '../../types/debate';
import { Globe, Video, Sparkles, ExternalLink, Play } from 'lucide-react';
import { normalizeYoutubeVideo } from '../../utils/youtubeHelper';

export interface AgentContextCardProps {
  message: PolyglotMessage;
  onSendToCreationStudio?: (text: string, mode: StudioRenderMode) => void;
  onExecuteYoutubePostLinkAction?: (
    messageId: string,
    youtubeUrl: string,
    action: YoutubePostLinkAction,
    clipRange?: YoutubeClipRange
  ) => void;
}

export const AgentContextCard: React.FC<AgentContextCardProps> = ({
  message,
  onSendToCreationStudio,
  onExecuteYoutubePostLinkAction,
}) => {
  const [showYoutubeEmbed, setShowYoutubeEmbed] = useState<boolean>(() =>
    Boolean(message.awaitingYoutubeIntent)
  );
  const [clipStart, setClipStart] = useState(message.youtubeClipRange?.start || '');
  const [clipEnd, setClipEnd] = useState(message.youtubeClipRange?.end || '');
  const [failedThumbs, setFailedThumbs] = useState<Record<string, true>>({});

  const resolvedYoutubeId =
    message.youtubeMeta?.videoId ||
    (message.youtubeUrl ? normalizeYoutubeVideo(message.youtubeUrl)?.videoId : undefined);

  const hasContent =
    Boolean(message.agentReplyPtBr) ||
    Boolean(message.youtubeUrl) ||
    Boolean(message.youtubeSearchResults && message.youtubeSearchResults.length > 0) ||
    Boolean(message.sources && message.sources.length > 0);

  if (!hasContent) return null;

  const buildClipRange = (): YoutubeClipRange | undefined =>
    clipStart.trim() || clipEnd.trim()
      ? { start: clipStart.trim() || undefined, end: clipEnd.trim() || undefined }
      : undefined;

  return (
    <div className="rounded-2xl card-matte border border-[var(--border-control)] p-3.5 flex flex-col gap-3 shadow-sm">
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
                className="min-h-11 inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-amber-300 hover:text-primary surface-inset border border-[var(--border-subtle)] px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-amber-400" />
                <span>{showYoutubeEmbed ? 'Ocultar Player' : 'Assistir no App'}</span>
              </button>
            )}
            <a
              href={message.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/15 border border-rose-500/30 px-3 py-1.5 rounded-xl transition-colors"
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
        <div className="flex items-center gap-2.5 p-2 rounded-xl surface-inset border border-[var(--border-subtle)]">
          {!failedThumbs[message.youtubeMeta.thumbnailUrl] ? (
            <img
              src={message.youtubeMeta.thumbnailUrl}
              alt={message.youtubeMeta.title}
              width={64}
              height={40}
              loading="lazy"
              decoding="async"
              onError={() =>
                setFailedThumbs((prev) => ({
                  ...prev,
                  [message.youtubeMeta!.thumbnailUrl]: true,
                }))
              }
              className="w-16 h-10 rounded-lg object-cover border border-rose-500/30 shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="w-16 h-10 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <span className="text-[10px] font-mono font-bold text-rose-300">YT</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-primary truncate">{message.youtubeMeta.title}</p>
            {message.youtubeMeta.authorName && (
              <p className="text-[10px] font-mono text-secondary truncate">
                Canal: {message.youtubeMeta.authorName}
              </p>
            )}
          </div>
        </div>
      )}

      {showYoutubeEmbed && resolvedYoutubeId && (
        <div className="w-full aspect-video max-h-[320px] rounded-xl overflow-hidden border border-[var(--border-control)] bg-slate-950">
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

      {/* Barra Interativa de Ação Pós-Link do YouTube */}
      {message.youtubeUrl && onExecuteYoutubePostLinkAction && (
        <div
          className={`rounded-xl p-2.5 flex flex-col gap-2 border ${
            message.awaitingYoutubeIntent
              ? 'bg-amber-500/10 border-amber-400/50'
              : 'surface-inset border-[var(--border-subtle)]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-300">
              {message.awaitingYoutubeIntent
                ? 'Escolha como processar este vídeo:'
                : 'Executar outra ação neste vídeo:'}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-secondary">
              <span>Trecho opcional:</span>
              <input
                id={`clip-start-${message.id}`}
                name="clipStart"
                aria-label="Minuto inicial"
                type="text"
                value={clipStart}
                onChange={(e) => setClipStart(e.target.value)}
                placeholder="00:00"
                className="min-h-11 w-14 px-2 py-1 rounded input-sunken text-xs text-primary text-center focus:outline-none"
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
                className="min-h-11 w-14 px-2 py-1 rounded input-sunken text-xs text-primary text-center focus:outline-none"
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
                  buildClipRange()
                )
              }
              className="min-h-11 px-3.5 py-2 rounded-xl btn-matte-amber text-white text-xs font-bold cursor-pointer disabled:opacity-50"
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
                  buildClipRange()
                )
              }
              className="min-h-11 px-3.5 py-2 rounded-xl btn-matte-dark text-primary text-xs font-semibold cursor-pointer disabled:opacity-50"
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
                  buildClipRange()
                )
              }
              className="min-h-11 px-3.5 py-2 rounded-xl btn-matte-dark text-amber-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
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
                className="min-h-11 px-3.5 py-2 rounded-xl btn-matte-dark text-emerald-300 text-xs font-semibold cursor-pointer"
              >
                4. + Criar Podcast / Debate (2 Vozes)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Galeria de Vídeos Encontrados no YouTube */}
      {message.youtubeSearchResults && message.youtubeSearchResults.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-rose-300 font-bold flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-rose-400" />
            <span>
              Vídeos Encontrados no YouTube (Clique para Traduzir, Resumir ou Criar Podcast):
            </span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {message.youtubeSearchResults.map((yt) => (
              <div
                key={yt.videoId}
                className="rounded-xl surface-inset p-2.5 flex flex-col justify-between gap-2 border border-[var(--border-subtle)]"
              >
                <div className="flex items-start gap-2.5">
                  {!failedThumbs[yt.thumbnailUrl] ? (
                    <img
                      src={yt.thumbnailUrl}
                      alt={yt.title}
                      width={80}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      onError={() =>
                        setFailedThumbs((prev) => ({
                          ...prev,
                          [yt.thumbnailUrl]: true,
                        }))
                      }
                      className="w-20 h-12 rounded-lg object-cover border border-rose-500/30 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="w-20 h-12 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <span className="text-[10px] font-mono font-bold text-rose-300">YT</span>
                    </div>
                  )}
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
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() =>
                        onExecuteYoutubePostLinkAction(
                          message.id,
                          yt.canonicalUrl,
                          'translate_video'
                        )
                      }
                      className="min-h-11 px-3 py-1.5 rounded-lg btn-matte-amber text-white text-[11px] font-bold cursor-pointer"
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
                      className="min-h-11 px-3 py-1.5 rounded-lg btn-matte-dark text-primary text-[11px] font-semibold cursor-pointer"
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
                      className="min-h-11 px-3 py-1.5 rounded-lg btn-matte-dark text-amber-300 text-[11px] font-semibold cursor-pointer"
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
                        className="min-h-11 px-3 py-1.5 rounded-lg btn-matte-dark text-emerald-300 text-[11px] font-semibold cursor-pointer"
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
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-secondary mr-1">
            Fontes:
          </span>
          {message.sources.map((src, i) => (
            <a
              key={i}
              href={src.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg surface-inset border border-[var(--border-subtle)] text-sky-300 hover:text-primary transition-colors truncate max-w-[260px]"
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
  );
};

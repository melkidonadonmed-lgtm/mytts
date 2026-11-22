import React from 'react';
import { Video } from 'lucide-react';
import type { YoutubePostLinkAction, YoutubeVideoMetadata } from '../../types/polyglot';
import type { StudioRenderMode } from '../../types/debate';
import type { DockMode } from '../AgentInputDock';

export interface DockYoutubePreviewCardProps {
  detectedYoutubeUrl: string;
  previewYoutubeMeta: YoutubeVideoMetadata | null;
  failedThumbUrl: string | null;
  onThumbError: (url: string) => void;
  clipStart: string;
  clipEnd: string;
  onClipStartChange: (val: string) => void;
  onClipEndChange: (val: string) => void;
  onSubmitAction: (
    overrideText: string,
    overrideMode: DockMode,
    overrideYoutubeAction: YoutubePostLinkAction
  ) => void;
  onSendToCreationStudio?: (text: string, renderMode: StudioRenderMode) => void;
}

export const DockYoutubePreviewCard: React.FC<DockYoutubePreviewCardProps> = ({
  detectedYoutubeUrl,
  previewYoutubeMeta,
  failedThumbUrl,
  onThumbError,
  clipStart,
  clipEnd,
  onClipStartChange,
  onClipEndChange,
  onSubmitAction,
  onSendToCreationStudio,
}) => (
  <div className="rounded-2xl card-matte border border-[var(--border-control)] p-3 flex flex-col gap-2.5 shadow-lg">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        {previewYoutubeMeta?.thumbnailUrl &&
        failedThumbUrl !== previewYoutubeMeta.thumbnailUrl ? (
          <img
            src={previewYoutubeMeta.thumbnailUrl}
            alt={previewYoutubeMeta.title}
            width={48}
            height={32}
            loading="lazy"
            decoding="async"
            onError={() => onThumbError(previewYoutubeMeta.thumbnailUrl)}
            className="w-12 h-8 rounded-lg object-cover border border-rose-500/30 shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-9 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
            <Video className="w-4 h-4 text-rose-400" />
          </div>
        )}
        <div className="min-w-0">
          <span className="text-xs font-bold text-primary block truncate">
            {previewYoutubeMeta?.title || 'Vídeo do YouTube detectado'}
          </span>
          <span className="text-[10px] font-mono text-rose-300 block truncate">
            {previewYoutubeMeta?.authorName
              ? `${previewYoutubeMeta.authorName} · ${detectedYoutubeUrl}`
              : detectedYoutubeUrl}
          </span>
        </div>
      </div>

      {/* Intervalo opcional de tempo */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-secondary">
        <span>Trecho:</span>
        <input
          id="yt-clip-start"
          name="clipStart"
          aria-label="Minuto inicial opcional"
          type="text"
          value={clipStart}
          onChange={(e) => onClipStartChange(e.target.value)}
          placeholder="00:00"
          className="min-h-11 w-14 px-2 py-1 rounded input-sunken text-xs text-primary text-center focus:outline-none"
        />
        <span>até</span>
        <input
          id="yt-clip-end"
          name="clipEnd"
          aria-label="Minuto final opcional"
          type="text"
          value={clipEnd}
          onChange={(e) => onClipEndChange(e.target.value)}
          placeholder="Fim"
          className="min-h-11 w-14 px-2 py-1 rounded input-sunken text-xs text-primary text-center focus:outline-none"
        />
      </div>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
        O que fazer com o link:
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() =>
            onSubmitAction(
              `Traduza e transcreva a fala do vídeo do YouTube ${detectedYoutubeUrl} nos 3 idiomas.`,
              'search_youtube',
              'translate_video'
            )
          }
          className="min-h-11 px-3 py-1.5 rounded-full btn-matte-amber text-white text-[11px] font-bold cursor-pointer"
          title="Transcrever e traduzir a fala real do vídeo nos 3 idiomas (EN, IT, JA)"
        >
          Traduzir Fala (3 Idiomas)
        </button>
        <button
          type="button"
          onClick={() =>
            onSubmitAction(
              `Faça um resumo completo em português e crie um diálogo prático sobre o vídeo ${detectedYoutubeUrl}.`,
              'search_youtube',
              'summary_dialogue'
            )
          }
          className="min-h-11 px-3 py-1.5 rounded-full btn-matte-dark text-primary text-[11px] font-semibold cursor-pointer"
          title="Resumo em Português + conversa prática nos 3 idiomas"
        >
          Resumo + Diálogo
        </button>
        <button
          type="button"
          onClick={() =>
            onSubmitAction(
              `Extraia as melhores expressões nativas e flashcards do vídeo ${detectedYoutubeUrl}.`,
              'search_youtube',
              'extract_expressions'
            )
          }
          className="min-h-11 px-3 py-1.5 rounded-full btn-matte-dark text-amber-300 text-[11px] font-semibold cursor-pointer"
          title="Extrair expressões nativas do vídeo e salvar Flashcards no Deck"
        >
          Extrair Flashcards
        </button>
        {onSendToCreationStudio && (
          <button
            type="button"
            onClick={() =>
              onSendToCreationStudio(
                `${detectedYoutubeUrl}\nTítulo: ${previewYoutubeMeta?.title || 'Vídeo do YouTube'}\nCanal: ${previewYoutubeMeta?.authorName || 'YouTube'}`,
                'podcast'
              )
            }
            className="min-h-11 px-3 py-1.5 rounded-full btn-matte-dark text-emerald-300 text-[11px] font-semibold cursor-pointer"
            title="Transformar este vídeo em um Podcast ou Debate com 2 vozes no Estúdio de Criação"
          >
            + Podcast 2 Vozes
          </button>
        )}
      </div>
    </div>
  </div>
);

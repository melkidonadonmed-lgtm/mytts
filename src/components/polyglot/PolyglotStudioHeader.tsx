import React from 'react';
import { GoogleIcon } from '../GoogleIcon';
import type { LangKey } from './polyglotConstants';

export interface PolyglotStudioHeaderProps {
  currentFocusedVoice: string;
  defaultVoiceByLang: Record<LangKey, string>;
  deckCount: number;
  onNewConversation: () => void;
  onOpenStudy: () => void;
  onOpenVoicesConfigTab?: () => void;
}

export const PolyglotStudioHeader: React.FC<PolyglotStudioHeaderProps> = ({
  currentFocusedVoice,
  defaultVoiceByLang,
  deckCount,
  onNewConversation,
  onOpenStudy,
  onOpenVoicesConfigTab,
}) => (
  <div className="lg:sticky lg:top-0 z-20 w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 pt-2">
    <header className="dock-matte rounded-2xl border border-[var(--border-subtle)] px-3 sm:px-5 py-2.5 sm:py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
            <GoogleIcon name="translate" size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-bold text-primary font-display truncate">
                Chat Poliglota Multimodal
              </h1>
              <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                EN • IT • JA
              </span>
            </div>
            <p className="text-[11px] text-secondary leading-snug mt-0.5 line-clamp-1 sm:line-clamp-none">
              Voz por card · Sincronizado com o card focado ({currentFocusedVoice})
            </p>
          </div>
        </div>

        {/* Botões Mobile de Nova Conversa e Deck */}
        <div className="xl:hidden flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onNewConversation}
            className="btn-matte btn-matte-dark btn-compact-touch min-h-11 px-3 py-1.5 text-xs text-primary font-medium cursor-pointer inline-flex items-center gap-1"
            title="Iniciar nova conversa limpa"
          >
            <GoogleIcon name="add" size={15} className="text-amber-400" />
            <span>Nova</span>
          </button>
          <button
            type="button"
            onClick={onOpenStudy}
            className="btn-matte btn-matte-dark btn-compact-touch min-h-11 px-3 py-1.5 text-xs text-primary font-medium cursor-pointer inline-flex items-center gap-1.5"
            title="Abrir Área de Estudo (Flashcards)"
          >
            <GoogleIcon name="school" size={15} className="text-amber-400" />
            <span>Deck</span>
            <span className="bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums">
              {deckCount}
            </span>
          </button>
        </div>
      </div>

      {/* Barra de Ações Rápidas: Configurar Vozes + Nova Conversa + Área de Estudo */}
      <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2 w-full xl:w-auto">
        {onOpenVoicesConfigTab && (
          <button
            type="button"
            onClick={onOpenVoicesConfigTab}
            className="btn-matte btn-matte-dark min-h-11 px-3.5 py-1.5 rounded-xl text-xs text-secondary hover:text-primary font-medium cursor-pointer inline-flex items-center gap-1.5 transition-colors border border-[var(--border-subtle)] hover:border-amber-500/40"
            title="Configurar vozes favoritas no Catálogo de Vozes"
          >
            <GoogleIcon name="record_voice_over" size={15} className="text-amber-400" />
            <span className="font-mono text-[11px] text-primary">
              Vozes: {defaultVoiceByLang.en} · {defaultVoiceByLang.it} · {defaultVoiceByLang.ja}
            </span>
          </button>
        )}

        <div className="hidden xl:flex items-center gap-1.5">
          <button
            type="button"
            onClick={onNewConversation}
            className="btn-matte btn-matte-dark min-h-11 px-3.5 py-1.5 text-xs text-primary font-medium cursor-pointer flex items-center gap-1.5"
            title="Iniciar Nova Conversa Limpa"
          >
            <GoogleIcon name="add" size={16} className="text-amber-400" />
            <span>Nova Conversa</span>
          </button>

          <button
            type="button"
            onClick={onOpenStudy}
            className="btn-matte btn-matte-dark min-h-11 px-3.5 py-1.5 text-xs text-primary font-medium cursor-pointer flex items-center gap-1.5"
            title="Abrir Área de Estudo (Flashcards Deck)"
          >
            <GoogleIcon name="school" size={16} className="text-amber-400" />
            <span>Área de Estudo</span>
            <span className="bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums">
              {deckCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  </div>
);

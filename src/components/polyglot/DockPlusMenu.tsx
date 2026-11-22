import React from 'react';
import { GoogleIcon } from '../GoogleIcon';
import { Globe, Sparkles, Radio, Headphones } from 'lucide-react';
import type { StudioRenderMode } from '../../types/debate';
import type { DockMode } from '../AgentInputDock';

export interface DockPlusMenuProps {
  dockMode: DockMode;
  enableWebSearch: boolean;
  hasInputText: boolean;
  onSendToCreationStudio?: (renderMode: StudioRenderMode) => void;
  onSelectTranslate: () => void;
  onSelectLiveTutor: () => void;
  onSelectPractice: () => void;
  onSelectSearchYoutube: () => void;
  onTriggerFilePicker: () => void;
}

const STUDIO_RENDER_SERVICES: {
  id: StudioRenderMode;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { id: 'solo', label: 'Leitura Solo', icon: 'headphones', desc: 'Narração 1 voz no Estúdio' },
  { id: 'debate', label: 'Debate Dialético', icon: 'forum', desc: '2 vozes em embate de ideias' },
  { id: 'podcast', label: 'Podcast de Estúdio', icon: 'podcasts', desc: '2 hosts conversando' },
  { id: 'bar_chat', label: 'Conversa de Bar', icon: 'local_cafe', desc: 'Papo descontraído entre amigos' },
  { id: 'dinner', label: 'Mesa de Jantar', icon: 'restaurant', desc: 'Conversa acolhedora em família' },
];

export const DockPlusMenu: React.FC<DockPlusMenuProps> = ({
  dockMode,
  enableWebSearch,
  hasInputText,
  onSendToCreationStudio,
  onSelectTranslate,
  onSelectLiveTutor,
  onSelectPractice,
  onSelectSearchYoutube,
  onTriggerFilePicker,
}) => (
  <div
    role="menu"
    aria-label="Selecionar serviço do chat ou enviar para o Estúdio de Criação"
    className="absolute bottom-full left-0 mb-2.5 w-full sm:w-[420px] max-h-[72dvh] overflow-y-auto overscroll-contain rounded-2xl card-matte p-3 shadow-2xl border border-[var(--border-control)] z-50 flex flex-col gap-3 animate-in fade-in"
  >
    {/* Seção 1: Enviar Texto / Conversa para o Estúdio de Criação */}
    {onSendToCreationStudio && (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
            <Headphones className="w-3 h-3" />
            <span>Enviar para o Estúdio de Criação</span>
          </span>
          <span className="text-[10px] font-mono text-secondary">
            {hasInputText ? 'Usa o texto digitado' : 'Usa a conversa atual'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {STUDIO_RENDER_SERVICES.map((srv) => (
            <button
              key={srv.id}
              type="button"
              role="menuitem"
              onClick={() => onSendToCreationStudio(srv.id)}
              className="min-h-11 p-2.5 rounded-xl btn-matte-dark hover:border-amber-400/40 text-left flex items-center gap-2 cursor-pointer transition-all"
            >
              <GoogleIcon name={srv.icon} size={16} className="text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-primary block truncate">{srv.label}</span>
                <span className="text-[10px] text-secondary block truncate">{srv.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Seção 2: Modo / Serviço do Chat LLM */}
    <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
      <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-bold px-1">
        Modo do Agente no Chat
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          role="menuitem"
          onClick={onSelectTranslate}
          className={`min-h-11 p-2.5 rounded-xl text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
            dockMode === 'translate' && !enableWebSearch
              ? 'card-matte-active text-primary'
              : 'btn-matte-dark text-secondary hover:text-primary'
          }`}
        >
          <GoogleIcon name="translate" size={15} className="text-amber-400 shrink-0" />
          <span className="truncate">Tradução 3 Idiomas</span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={onSelectLiveTutor}
          className={`min-h-11 p-2.5 rounded-xl text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
            dockMode === 'live_tutor'
              ? 'card-matte-active text-primary'
              : 'btn-matte-dark text-secondary hover:text-primary'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">Agente Tutor Live</span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={onSelectPractice}
          className={`min-h-11 p-2.5 rounded-xl text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
            dockMode === 'practice'
              ? 'card-matte-active text-primary'
              : 'btn-matte-dark text-secondary hover:text-primary'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate">Parceiro de Conversa</span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={onSelectSearchYoutube}
          className={`min-h-11 p-2.5 rounded-xl text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
            enableWebSearch || dockMode === 'search_youtube'
              ? 'card-matte-active text-primary'
              : 'btn-matte-dark text-secondary hover:text-primary'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">Busca Web &amp; YouTube</span>
        </button>
      </div>
    </div>

    {/* Seção 3: Anexar Documento */}
    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
      <button
        type="button"
        role="menuitem"
        onClick={onTriggerFilePicker}
        className="w-full min-h-11 py-2 px-3 rounded-xl btn-matte-dark text-xs font-bold text-primary flex items-center justify-center gap-2 cursor-pointer"
      >
        <GoogleIcon name="attach_file" size={16} className="text-amber-400" />
        <span>Anexar Arquivo (PDF, TXT ou Markdown)</span>
      </button>
    </div>
  </div>
);

import React, { useEffect } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { UserSessionPopover } from './UserSessionPopover';
import type { SoftUIThemePreset } from '../types';

export type AppTab =
  | 'polyglot'
  | 'voices'
  | 'chunks'
  | 'study'
  | 'architecture';

interface SidebarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  isOpenMobile: boolean;
  onToggleMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenAuthModal?: () => void;
  flashcardCount?: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  activePreset?: SoftUIThemePreset;
  onSelectPreset?: (preset: SoftUIThemePreset) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onToggleMobile,
  isCollapsed = false,
  onToggleCollapse,
  onOpenCommandPalette,
  onOpenAuthModal,
  flashcardCount = 0,
  theme = 'dark',
  onToggleTheme,
  activePreset = 'obsidian',
  onSelectPreset,
}) => {
  // No drawer mobile (< 1024px), sempre exibimos o modo expandido completo
  const effectiveCollapsed = Boolean(isCollapsed) && !isOpenMobile;

  const navItems: Array<{
    id: AppTab;
    label: string;
    badge: string;
    iconName: string;
    description: string;
  }> = [
    {
      id: 'polyglot',
      label: 'Chat Poliglota',
      badge: 'Principal',
      iconName: 'translate',
      description: 'EN, IT & JA · Voz + YouTube + Live',
    },
    {
      id: 'voices',
      label: 'Configuração de Vozes',
      badge: 'Estúdio & Vozes',
      iconName: 'record_voice_over',
      description: 'Catálogo, Leitura Solo & Debate 2x',
    },
    {
      id: 'chunks',
      label: 'FastChunks',
      badge: 'Treino',
      iconName: 'bolt',
      description: 'Blocos coloquiais e shadowing loop',
    },
    {
      id: 'study',
      label: 'Área de Estudo',
      badge: flashcardCount > 0 ? `${flashcardCount} Cards` : 'Flashcards',
      iconName: 'school',
      description: 'Importação rápida e repetição com TTS',
    },
  ];

  // Suporte a tecla Escape e bloqueio de rolagem do body quando o drawer mobile está aberto
  useEffect(() => {
    if (!isOpenMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onToggleMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpenMobile, onToggleMobile]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <button
          type="button"
          aria-label="Fechar menu lateral"
          onClick={onToggleMobile}
          className="fixed inset-0 z-40 bg-black/80 lg:hidden cursor-pointer"
        />
      )}

      {/* Sidebar Container (Expandido 280px <-> Icon Rail 68px no Desktop) */}
      <aside
        data-state="idle"
        data-collapsed={effectiveCollapsed ? 'true' : 'false'}
        aria-busy="false"
        className={`fixed top-0 bottom-0 left-0 z-50 h-dvh max-h-dvh bg-slate-950 border-r border-slate-800 flex flex-col transition-[width,transform] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] lg:translate-x-0 w-[280px] ${
          effectiveCollapsed ? 'lg:w-[68px]' : 'lg:w-[280px]'
        } ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand Header Compacto + Gatilho Rail Mode */}
        <div
          className={`h-14 border-b border-slate-800 flex items-center shrink-0 ${
            effectiveCollapsed ? 'px-2 justify-center' : 'px-3.5 justify-between'
          }`}
        >
          {!effectiveCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
              <div className="w-8 h-8 rounded-xl btn-matte-amber flex items-center justify-center text-white font-bold shadow-md shadow-amber-500/20 shrink-0">
                <GoogleIcon name="auto_awesome" size={18} filled className="text-white" />
              </div>
              <div className="min-w-0 overflow-hidden whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-primary font-display">
                    MyTTS
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                    Studio
                  </span>
                </div>
                <p className="text-[10px] text-secondary font-medium truncate">
                  São Paulo · southamerica-east1
                </p>
              </div>
            </div>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={
                effectiveCollapsed
                  ? 'Expandir barra lateral (Ctrl + B)'
                  : 'Recolher barra lateral para modo compacto (Ctrl + B)'
              }
              title={
                effectiveCollapsed
                  ? 'Expandir barra lateral (Ctrl + B)'
                  : 'Recolher barra lateral (Ctrl + B)'
              }
              className={`rail-tooltip-host hidden lg:flex items-center justify-center rounded-xl text-secondary hover:text-primary hover:bg-slate-800/70 transition-colors cursor-pointer shrink-0 ${
                effectiveCollapsed
                  ? 'w-10 h-10 border border-slate-800 bg-slate-900/80'
                  : 'p-1.5'
              }`}
            >
              <GoogleIcon
                name={effectiveCollapsed ? 'panel_left_open' : 'panel_left_close'}
                size={18}
              />
              {effectiveCollapsed && (
                <span className="rail-tooltip">Expandir Menu (Ctrl+B)</span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMobile}
            className="btn-compact-touch p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-slate-900 lg:hidden cursor-pointer shrink-0"
            aria-label="Fechar navegação"
          >
            <GoogleIcon name="close" size={18} />
          </button>
        </div>

        {/* Corpo de Navegação + Voz Sincronizada + Busca Rápida */}
        <div
          className={`flex-1 ${
            effectiveCollapsed
              ? 'overflow-visible px-2 py-3 flex flex-col items-center space-y-2'
              : 'overflow-y-auto overscroll-contain px-3 py-2.5 space-y-2.5'
          }`}
        >
          {/* 1. Módulos de Navegação Principal */}
          <nav
            aria-label="Navegação principal"
            className={effectiveCollapsed ? 'w-full flex flex-col items-center space-y-1.5' : 'space-y-1'}
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              if (effectiveCollapsed) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={`${item.label} (${item.badge})`}
                    title={`${item.label} (${item.badge})`}
                    onClick={() => onSelectTab(item.id)}
                    className={`rail-tooltip-host relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                      isActive
                        ? 'card-matte-active text-amber-400 shadow-md shadow-amber-950/30'
                        : 'text-secondary hover:text-primary hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div
                      id={isActive ? 'sidebar-active-tracker' : undefined}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        isActive
                          ? 'btn-matte-amber text-white font-bold'
                          : 'bg-slate-900/90 text-secondary border border-slate-800/80'
                      }`}
                    >
                      <GoogleIcon
                        name={item.iconName}
                        size={18}
                        filled={isActive}
                        className={isActive ? 'text-white' : undefined}
                      />
                    </div>
                    {item.id === 'study' && flashcardCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 font-mono text-[9px] font-extrabold flex items-center justify-center tabular-nums shadow">
                        {flashcardCount > 99 ? '99+' : flashcardCount}
                      </span>
                    )}
                    <span className="rail-tooltip">
                      {item.label} · <span className="text-amber-400 font-mono">{item.badge}</span>
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (isOpenMobile) onToggleMobile();
                  }}
                  className={`btn-matte w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-colors overflow-hidden ${
                    isActive
                      ? 'card-matte-active'
                      : 'text-secondary hover:text-primary hover:bg-slate-500/10 border border-transparent'
                  }`}
                >
                  <div
                    id={isActive ? 'sidebar-active-tracker' : undefined}
                    className={`mt-0.5 p-1.5 rounded-xl transition-colors shrink-0 ${
                      isActive
                        ? 'surface-inset btn-matte-amber text-white font-bold shadow-md shadow-amber-900/20'
                        : 'bg-slate-900 text-secondary border border-slate-800'
                    }`}
                  >
                    <GoogleIcon
                      name={item.iconName}
                      size={17}
                      filled={isActive}
                      className={isActive ? 'text-white' : undefined}
                    />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-bold font-display truncate ${
                          isActive ? 'text-primary font-extrabold' : 'text-primary'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors shrink-0 tabular-nums ${
                          isActive
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold'
                            : 'bg-white/[0.04] text-secondary border-white/[0.08]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-secondary mt-0.5 truncate">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* 3. Botão de Busca Rápida (Ctrl + K) */}
          {onOpenCommandPalette &&
            (effectiveCollapsed ? (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                aria-label="Busca Rápida (Ctrl + K)"
                title="Busca Rápida (Ctrl + K)"
                className="rail-tooltip-host w-11 h-11 rounded-xl btn-matte-dark flex items-center justify-center text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <GoogleIcon name="search" size={17} />
                <span className="rail-tooltip">
                  Busca Rápida · <kbd className="font-mono text-amber-400">Ctrl K</kbd>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onOpenCommandPalette();
                  if (isOpenMobile) onToggleMobile();
                }}
                className="btn-compact-touch w-full px-3 py-2 rounded-xl btn-matte-dark flex items-center justify-between text-xs transition-colors cursor-pointer overflow-hidden whitespace-nowrap"
              >
                <div className="flex items-center gap-2">
                  <GoogleIcon name="search" size={15} className="text-amber-400" />
                  <span className="font-medium text-secondary">Busca Rápida</span>
                </div>
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded">Ctrl K</kbd>
              </button>
            ))}
        </div>

        {/* Rodapé Fixo: Card de Sessão + Popover de Conta e Preferências (Temas Desacoplados) */}
        <div
          className={`border-t border-slate-800 shrink-0 ${
            effectiveCollapsed ? 'p-2 flex justify-center' : 'p-2.5'
          }`}
        >
          <UserSessionPopover
            isCollapsed={effectiveCollapsed}
            onOpenAuthModal={() => {
              onOpenAuthModal?.();
              if (isOpenMobile) onToggleMobile();
            }}
            theme={theme}
            onToggleTheme={onToggleTheme}
            activePreset={activePreset}
            onSelectPreset={onSelectPreset}
            onSelectArchitecture={() => {
              onSelectTab('architecture');
              if (isOpenMobile) onToggleMobile();
            }}
          />
        </div>
      </aside>
    </>
  );
};

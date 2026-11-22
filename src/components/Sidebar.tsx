import React, { useEffect, useMemo } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { UserSessionPopover } from './UserSessionPopover';
import type { SoftUIThemePreset } from '../types';
import {
  getSidebarNavGroups,
  type AppTab,
  type StudySubTab,
  type VoiceConfigSubTab,
} from '../utils/navigationOrganizer';

export type { AppTab };

interface SidebarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  voiceSubTab?: VoiceConfigSubTab;
  studySubTab?: StudySubTab;
  onNavigate?: (tab: AppTab, subTab?: VoiceConfigSubTab | StudySubTab) => void;
  isOpenMobile: boolean;
  onToggleMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenAuthModal?: () => void;
  isHistoryOpen?: boolean;
  historyCount?: number;
  onToggleHistory?: () => void;
  flashcardCount?: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  activePreset?: SoftUIThemePreset;
  onSelectPreset?: (preset: SoftUIThemePreset) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  voiceSubTab = 'catalog',
  studySubTab = 'decks',
  onNavigate,
  isOpenMobile,
  onToggleMobile,
  isCollapsed = false,
  onToggleCollapse,
  onOpenCommandPalette,
  onOpenAuthModal,
  isHistoryOpen = false,
  historyCount = 0,
  onToggleHistory,
  flashcardCount = 0,
  theme = 'dark',
  onToggleTheme,
  activePreset = 'obsidian',
  onSelectPreset,
}) => {
  // No drawer mobile (< 1024px), sempre exibimos o modo expandido completo
  const effectiveCollapsed = Boolean(isCollapsed) && !isOpenMobile;

  const navGroups = useMemo(
    () => getSidebarNavGroups({ flashcardCount }),
    [flashcardCount]
  );

  const navigateTo = (tab: AppTab, subTab?: VoiceConfigSubTab | StudySubTab) => {
    if (onNavigate) {
      onNavigate(tab, subTab);
    } else {
      onSelectTab(tab);
    }
    if (isOpenMobile) onToggleMobile();
  };

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
          className="fixed inset-0 z-40 bg-slate-950/80 lg:hidden cursor-pointer"
        />
      )}

      {/* Sidebar Container (Expandido 280px <-> Icon Rail 68px no Desktop) */}
      <aside
        data-collapsed={effectiveCollapsed ? 'true' : 'false'}
        className={`fixed top-0 bottom-0 left-0 z-50 h-dvh max-h-dvh surface-flat border-r border-[var(--border-subtle)] flex flex-col transition-[width,transform] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] lg:translate-x-0 w-[280px] ${
          effectiveCollapsed ? 'lg:w-[68px]' : 'lg:w-[280px]'
        } ${
          isOpenMobile
            ? 'translate-x-0 visible pointer-events-auto'
            : '-translate-x-full invisible pointer-events-none lg:visible lg:pointer-events-auto'
        }`}
      >
        {/* Brand Header Compacto + Gatilho Rail Mode */}
        <div
          className={`h-14 border-b border-[var(--border-subtle)] flex items-center shrink-0 ${
            effectiveCollapsed ? 'px-2 justify-center' : 'px-3.5 justify-between'
          }`}
        >
          {!effectiveCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
              <div className="w-8 h-8 rounded-xl btn-matte-amber flex items-center justify-center text-white font-bold shadow-sm shrink-0">
                <GoogleIcon name="auto_awesome" size={18} filled className="text-white" />
              </div>
              <div className="min-w-0 overflow-hidden whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-primary font-display">
                    MyTTS
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md surface-inset-pill border border-[var(--border-subtle)] text-amber-400 font-semibold tracking-wide">
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
              className={`rail-tooltip-host hidden lg:flex items-center justify-center min-h-11 min-w-11 w-11 h-11 rounded-xl text-secondary hover:text-primary transition-colors cursor-pointer shrink-0 ${
                effectiveCollapsed
                  ? 'btn-matte-dark'
                  : 'hover:bg-white/[0.06]'
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
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-secondary hover:text-primary lg:hidden cursor-pointer shrink-0"
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
          {/* 1. Módulos de Navegação Principal Organizados por Grupo */}
          <nav
            aria-label="Principal"
            className={effectiveCollapsed ? 'w-full flex flex-col items-center space-y-2' : 'space-y-3'}
          >
            {navGroups.map((group) => (
              <div
                key={group.id}
                className={effectiveCollapsed ? 'w-full flex flex-col items-center space-y-1.5' : 'space-y-1'}
              >
                {!effectiveCollapsed && (
                  <div className="px-2 pt-1 flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-bold">
                      {group.label}
                    </span>
                  </div>
                )}

                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  if (effectiveCollapsed) {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={`${item.label} (${item.badge}) · ${item.shortcutHint}`}
                        title={`${item.label} (${item.badge}) · ${item.shortcutHint}`}
                        onClick={() => navigateTo(item.id)}
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
                              : 'surface-inset text-secondary border border-[var(--border-subtle)]'
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
                          {item.label} · <span className="text-amber-400 font-mono">{item.shortcutHint}</span>
                        </span>
                      </button>
                    );
                  }

                  const activeSubId =
                    item.id === 'voices' ? voiceSubTab : item.id === 'study' ? studySubTab : null;

                  return (
                    <div key={item.id} className="space-y-1">
                      <button
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => navigateTo(item.id)}
                        className={`btn-matte min-h-11 w-full flex items-start gap-2 p-2 rounded-xl text-left transition-colors overflow-hidden ${
                          isActive
                            ? 'card-matte-active'
                            : 'text-secondary hover:text-primary hover:bg-white/[0.04] border border-transparent'
                        }`}
                      >
                        <div
                          id={isActive ? 'sidebar-active-tracker' : undefined}
                          className={`mt-0.5 p-1.5 rounded-xl transition-colors shrink-0 ${
                            isActive
                              ? 'btn-matte-amber text-white font-bold shadow-sm'
                              : 'surface-inset text-secondary border border-[var(--border-subtle)]'
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
                              className={`text-[9px] font-mono px-1 py-0.5 rounded-md border transition-colors shrink-0 tabular-nums ${
                                isActive
                                  ? 'surface-inset-pill text-amber-400 border-[var(--border-subtle)] font-semibold'
                                  : 'surface-inset-pill text-secondary border-[var(--border-subtle)]'
                              }`}
                            >
                              {item.badge}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p className="text-[11px] text-secondary truncate">{item.description}</p>
                            <kbd className="text-[9px] font-mono text-secondary/70 shrink-0">
                              {item.shortcutHint}
                            </kbd>
                          </div>
                        </div>
                      </button>

                      {/* Sub-Árvore Contextual para o Módulo Ativo (Vozes ou Área de Estudo) */}
                      {isActive && item.subItems && item.subItems.length > 0 && (
                        <div
                          role="group"
                          aria-label={`Sub-módulos de ${item.label}`}
                          className="border-l border-[var(--border-subtle)] ml-4 pl-2.5 mt-1 space-y-1"
                        >
                          {item.subItems.map((sub) => {
                            const isSubActive = activeSubId === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                aria-current={isSubActive ? 'page' : undefined}
                                onClick={() => navigateTo(item.id, sub.id)}
                                className={`min-h-11 w-full px-2.5 py-1 rounded-lg text-xs flex items-center justify-between gap-1.5 transition-colors cursor-pointer ${
                                  isSubActive
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/35 font-bold'
                                    : 'text-secondary hover:text-primary hover:bg-white/[0.04] border border-transparent'
                                }`}
                              >
                                <span className="flex items-center gap-1.5 min-w-0 truncate">
                                  <GoogleIcon
                                    name={sub.iconName}
                                    size={14}
                                    filled={isSubActive}
                                    className={isSubActive ? 'text-amber-400' : undefined}
                                  />
                                  <span className="truncate">{sub.label}</span>
                                </span>
                                <span className="text-[10px] font-mono opacity-80 tabular-nums shrink-0">
                                  {sub.badge}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* 2. Utilitários Rápidos: Busca Rápida (Ctrl + K) e Histórico (Ctrl + H) */}
          <div
            className={
              effectiveCollapsed
                ? 'w-full flex flex-col items-center space-y-1.5 pt-1 border-t border-[var(--border-subtle)]'
                : 'space-y-1.5 pt-2 border-t border-[var(--border-subtle)]'
            }
          >
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
                  className="min-h-11 w-full px-3 py-2 rounded-xl btn-matte-dark flex items-center justify-between text-xs transition-colors cursor-pointer overflow-hidden whitespace-nowrap"
                >
                  <div className="flex items-center gap-2">
                    <GoogleIcon name="search" size={15} className="text-amber-400" />
                    <span className="font-medium text-secondary">Busca Rápida</span>
                  </div>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded">Ctrl K</kbd>
                </button>
              ))}

            {onToggleHistory &&
              (effectiveCollapsed ? (
                <button
                  type="button"
                  onClick={onToggleHistory}
                  aria-expanded={isHistoryOpen}
                  aria-label="Alternar Histórico & Sessões (Ctrl + H)"
                  title="Alternar Histórico & Sessões (Ctrl + H)"
                  className={`rail-tooltip-host relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                    isHistoryOpen
                      ? 'card-matte-active text-amber-400'
                      : 'btn-matte-dark text-secondary hover:text-primary'
                  }`}
                >
                  <GoogleIcon name="history" size={17} className="text-amber-400" />
                  {historyCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-slate-800 border border-amber-500/40 text-amber-300 font-mono text-[9px] font-extrabold flex items-center justify-center tabular-nums">
                      {historyCount > 99 ? '99+' : historyCount}
                    </span>
                  )}
                  <span className="rail-tooltip">
                    Histórico &amp; Sessões · <kbd className="font-mono text-amber-400">Ctrl H</kbd>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onToggleHistory();
                    if (isOpenMobile) onToggleMobile();
                  }}
                  aria-expanded={isHistoryOpen}
                  className={`min-h-11 w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer overflow-hidden whitespace-nowrap border ${
                    isHistoryOpen
                      ? 'card-matte-active text-amber-300 border-amber-500/35'
                      : 'btn-matte-dark text-secondary hover:text-primary border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GoogleIcon name="history" size={15} className="text-amber-400 shrink-0" />
                    <span className="font-medium truncate">Histórico &amp; Sessões</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {historyCount > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded surface-inset-pill text-amber-400 tabular-nums">
                        {historyCount}
                      </span>
                    )}
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded">Ctrl H</kbd>
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* Rodapé Fixo: Card de Sessão + Popover de Conta e Preferências (Temas Desacoplados) */}
        <div
          className={`border-t border-[var(--border-subtle)] shrink-0 ${
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

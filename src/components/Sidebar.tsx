import React, { useEffect } from 'react';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { GoogleIcon } from './GoogleIcon';
import { GoogleAuthWidget } from './GoogleAuthWidget';
import { EXTERNAL_LINKS } from '../config/constants';
import { SOFT_UI_PRESETS } from '../config/tokens';
import type { SoftUIThemePreset } from '../types';

export type AppTab = 'polyglot' | 'reader' | 'debate' | 'chunks' | 'voices' | 'architecture';

interface SidebarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  selectedVoice: VoiceProfile;
  onSelectVoice?: (voice: VoiceProfile) => void;
  isOpenMobile: boolean;
  onToggleMobile: () => void;
  onOpenVoiceLibrary: () => void;
  onOpenCommandPalette?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  activePreset?: SoftUIThemePreset;
  onSelectPreset?: (preset: SoftUIThemePreset) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  selectedVoice,
  onSelectVoice,
  isOpenMobile,
  onToggleMobile,
  onOpenVoiceLibrary,
  onOpenCommandPalette,
  theme = 'dark',
  onToggleTheme,
  activePreset = 'obsidian',
  onSelectPreset,
}) => {
  const navItems = [
    {
      id: 'polyglot' as AppTab,
      label: 'Chat Poliglota',
      badge: 'Principal',
      iconName: 'translate',
      description: 'EN, IT & JA · Voz + YouTube + Live',
    },
    {
      id: 'reader' as AppTab,
      label: 'Estúdio de Criação',
      badge: 'Solo & 2x',
      iconName: 'headphones',
      description: 'Leitura Solo & Conversa 2 Vozes',
    },
    {
      id: 'debate' as AppTab,
      label: 'Estúdio de Debate',
      badge: '2 Vozes',
      iconName: 'group',
      description: 'Roteiro dialético com voz por turno',
    },
    {
      id: 'chunks' as AppTab,
      label: 'FastChunks',
      badge: 'Treino',
      iconName: 'bolt',
      description: 'Blocos coloquiais e shadowing loop',
    },
    {
      id: 'voices' as AppTab,
      label: 'Biblioteca de Vozes',
      badge: '5 Timbres',
      iconName: 'record_voice_over',
      description: 'Catálogo e audição de amostras',
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

      {/* Sidebar Container */}
      <aside
        data-state="idle"
        aria-busy="false"
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 h-dvh max-h-dvh bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header Compacto */}
        <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl btn-matte-amber flex items-center justify-center text-white font-bold shadow-md shadow-amber-500/20 shrink-0">
              <GoogleIcon name="auto_awesome" size={18} filled className="text-white" />
            </div>
            <div className="min-w-0">
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

          <button
            type="button"
            onClick={onToggleMobile}
            className="btn-compact-touch p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-slate-900 lg:hidden cursor-pointer shrink-0"
            aria-label="Fechar navegação"
          >
            <GoogleIcon name="close" size={18} />
          </button>
        </div>

        {/* Corpo Unificado Rolável (Navegação Principal no Topo + Voz Sincronizada + Busca + Conta Google) */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 space-y-2.5">
          {/* 1. Navigation Items (Camada 1: Navegação Global sempre visível no topo sem cortes) */}
          <nav aria-label="Navegação principal" className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (isOpenMobile) onToggleMobile();
                  }}
                  className={`btn-matte w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-colors ${
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-bold font-display truncate ${
                          isActive ? 'text-primary font-extrabold' : 'text-primary'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors shrink-0 ${
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

          {/* 2. Voz Sincronizada (Reflete o Card Focado e permite troca rápida) */}
          <div className="p-2.5 rounded-2xl card-matte">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider font-mono">
                Voz Sincronizada (Card Ativo)
              </span>
              <button
                type="button"
                onClick={() => {
                  onOpenVoiceLibrary();
                  if (isOpenMobile) onToggleMobile();
                }}
                className="btn-compact-touch text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <span>Catálogo</span>
                <GoogleIcon name="chevron_right" size={15} />
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-xl bg-gradient-to-tr ${selectedVoice.avatarColor} flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0`}
              >
                {selectedVoice.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                {onSelectVoice ? (
                  <select
                    id="sidebar-global-voice-select"
                    name="globalVoice"
                    aria-label="Voz global sincronizada com o card focado"
                    value={selectedVoice.id}
                    onChange={(e) => {
                      const found = GEMINI_VOICES.find((v) => v.id === e.target.value);
                      if (found) onSelectVoice(found);
                    }}
                    className="w-full bg-transparent text-xs font-bold text-primary font-display focus:outline-none cursor-pointer"
                  >
                    {GEMINI_VOICES.map((v) => (
                      <option
                        key={v.id}
                        value={v.id}
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      >
                        {v.name} · {v.archetype}
                      </option>
                    ))}
                  </select>
                ) : (
                  <h3 className="text-xs font-bold text-primary truncate font-display">
                    {selectedVoice.name}
                  </h3>
                )}
                <p className="text-[10px] text-secondary truncate">
                  Muda automaticamente com o card focado
                </p>
              </div>
            </div>
          </div>

          {/* 3. Botão de Busca Rápida (Ctrl + K) */}
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={() => {
                onOpenCommandPalette();
                if (isOpenMobile) onToggleMobile();
              }}
              className="btn-compact-touch w-full px-3 py-2 rounded-xl btn-matte-dark flex items-center justify-between text-xs transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <GoogleIcon name="search" size={15} className="text-amber-400" />
                <span className="font-medium text-secondary">Busca Rápida</span>
              </div>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded">Ctrl K</kbd>
            </button>
          )}

          {/* 4. Conta Google (Sincronização de Histórico Familiar) */}
          <div>
            <GoogleAuthWidget />
          </div>
        </div>

        {/* Status e Footer Compacto da Sidebar */}
        <div className="p-2.5 border-t border-slate-800 space-y-1.5 shrink-0">
          {onSelectPreset && (
            <div
              role="radiogroup"
              aria-label="Selecionar Preset de Tema Minimalista"
              className="p-1.5 rounded-xl surface-inset space-y-1"
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-semibold">
                  Tema Minimalista
                </span>
                <span className="text-[10px] font-mono font-bold text-primary">
                  {SOFT_UI_PRESETS[activePreset].label}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(Object.keys(SOFT_UI_PRESETS) as SoftUIThemePreset[]).map((presetKey) => {
                  const presetObj = SOFT_UI_PRESETS[presetKey];
                  const isSelected = activePreset === presetKey;
                  return (
                    <button
                      key={presetKey}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => onSelectPreset(presetKey)}
                      className={`btn-compact-touch min-h-[36px] px-1 py-1 rounded-lg text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer btn-anti-squish ${
                        isSelected
                          ? 'card-matte-active text-primary font-bold'
                          : 'text-secondary hover:text-primary'
                      }`}
                      title={`Aplicar tema ${presetObj.label} (${
                        presetObj.mode === 'dark' ? 'Cinza/Escuro' : 'Claro Moderno'
                      })`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-white/25 shadow-xs shrink-0"
                        style={{ backgroundColor: presetObj.canvas }}
                      />
                      <span className="truncate max-w-full">{presetObj.label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alternador de Tema Binário */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="btn-compact-touch w-full min-h-[38px] px-3 py-1.5 rounded-xl btn-matte-dark flex items-center justify-between text-xs font-semibold cursor-pointer transition-colors active:translate-y-px"
              title="Alternar entre Cinza Studio (Escuro) e Ad Lucem (Claro Moderno)"
            >
              <div className="flex items-center gap-2">
                <GoogleIcon
                  name={theme === 'dark' ? 'light_mode' : 'dark_mode'}
                  size={16}
                  className="text-amber-400"
                />
                <span className="font-sans font-bold">
                  {theme === 'dark' ? 'Modo Claro Moderno' : 'Modo Cinza Studio'}
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-secondary">
                {theme === 'dark' ? 'Ad Lucem' : 'Cinza'}
              </span>
            </button>
          )}

          {/* Links e Info */}
          <div className="flex items-center justify-between text-xs text-secondary px-1 pt-0.5">
            <button
              type="button"
              onClick={() => onSelectTab('architecture')}
              className="btn-compact-touch flex items-center gap-1 hover:text-primary transition-colors cursor-pointer text-[11px]"
            >
              <GoogleIcon name="terminal" size={15} />
              <span>Arquitetura</span>
            </button>
            <a
              href={EXTERNAL_LINKS.GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors text-[11px]"
            >
              <GoogleIcon name="code" size={15} />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </aside>
    </>
  );
};

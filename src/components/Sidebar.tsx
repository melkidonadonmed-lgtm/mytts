import React from 'react';
import { VoiceProfile } from '../types/voices';
import { GoogleIcon } from './GoogleIcon';
import { EXTERNAL_LINKS } from '../config/constants';
import { SOFT_UI_PRESETS } from '../config/tokens';
import type { SoftUIThemePreset } from '../types';

export type AppTab = 'reader' | 'polyglot' | 'mic' | 'debate' | 'chunks' | 'voices' | 'architecture';

interface SidebarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  selectedVoice: VoiceProfile;
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
  isOpenMobile,
  onToggleMobile,
  onOpenVoiceLibrary,
  onOpenCommandPalette,
  theme = 'dark',
  onToggleTheme,
  activePreset = 'obsidian',
  onSelectPreset,
}) => {
  const navItems: { id: AppTab; label: string; badge: string; iconName: string; description: string }[] = [
    {
      id: 'reader',
      label: 'Estúdio de Criação',
      badge: 'Principal',
      iconName: 'headphones',
      description: 'Leitura Solo & Debate 2 Vozes',
    },
    {
      id: 'polyglot',
      label: 'Chat Poliglota',
      badge: '3 Línguas',
      iconName: 'translate',
      description: 'EN, IT & JA com Áudio e Fast Chunks',
    },
    {
      id: 'mic',
      label: 'Microfone & Ditado',
      badge: 'Ao Vivo',
      iconName: 'mic',
      description: 'Gravar fala e transcrever com IA',
    },
    {
      id: 'debate',
      label: 'Estúdio de Debate',
      badge: '2 Vozes',
      iconName: 'group',
      description: 'Roteiro dialético e embate de ideias',
    },
    {
      id: 'chunks',
      label: 'FastChunks',
      badge: 'Treino',
      iconName: 'bolt',
      description: 'Blocos coloquiais e shadowing loop',
    },
    {
      id: 'voices',
      label: 'Biblioteca de Vozes',
      badge: '5 Timbres',
      iconName: 'record_voice_over',
      description: 'Catálogo e audição de amostras',
    },
  ];

  const activeNavIndex = Math.max(
    0,
    navItems.findIndex((item) => item.id === activeTab)
  );

  return (
    <>
      {isOpenMobile && (
        <div
          onClick={onToggleMobile}
          className="fixed inset-0 z-40 bg-black/75 lg:hidden"
        />
      )}

      <aside
        data-state="idle"
        aria-busy="false"
        aria-label="Navegação Principal"
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 surface-canvas flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl surface-inset flex items-center justify-center font-bold">
              <GoogleIcon name="auto_awesome" size={20} filled className="text-sky-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-primary font-display">
                  MyTTS
                </span>
                <span className="badge-soft font-mono">
                  Studio
                </span>
              </div>
              <p className="text-xs text-secondary font-medium">Áudio Neural com Emoção</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleMobile}
            className="ui-btn-tactile p-2 rounded-xl lg:hidden"
            aria-label="Fechar navegação"
          >
            <GoogleIcon name="close" size={20} />
          </button>
        </div>

        {/* Voz Ativa em Destaque (Card Tátil 135°) */}
        <div className="p-3.5 mx-3 mt-2 rounded-2xl ui-card-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider font-mono">
              Voz Ativa
            </span>
            <button
              type="button"
              onClick={() => {
                onOpenVoiceLibrary();
                if (isOpenMobile) onToggleMobile();
              }}
              className="text-xs font-bold flex items-center gap-0.5 cursor-pointer"
              style={{ color: 'var(--accent-point)' }}
            >
              <span>Trocar</span>
              <GoogleIcon name="chevron_right" size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl surface-inset flex items-center justify-center text-primary font-bold text-xs">
              {selectedVoice.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-primary truncate font-display">
                {selectedVoice.name}
              </h3>
              <p className="text-xs text-secondary truncate">
                {selectedVoice.archetype}
              </p>
            </div>
          </div>
        </div>

        {/* Botão de Busca Rápida (Ctrl + K) */}
        {onOpenCommandPalette && (
          <div className="px-3 mt-3">
            <button
              type="button"
              onClick={() => {
                onOpenCommandPalette();
                if (isOpenMobile) onToggleMobile();
              }}
              className="w-full px-3.5 py-2.5 surface-inset-pill flex items-center justify-between text-xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <GoogleIcon name="search" size={16} />
                <span className="font-medium text-secondary">Busca Rápida</span>
              </div>
              <kbd className="text-xs font-mono px-2 py-0.5 rounded surface-flat text-secondary">
                Ctrl+K
              </kbd>
            </button>
          </div>
        )}

        {/* Navigation Items com Companion Sliding Tracker (#sidebar-active-tracker) */}
        <nav className="relative flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div
            id="sidebar-active-tracker"
            style={{
              transform: `translateY(${activeNavIndex * 62}px)`,
            }}
          />
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
                className={`relative z-10 w-full h-[56px] flex items-center gap-3 px-3 rounded-xl text-left transition-all cursor-pointer ${
                  isActive ? 'text-primary font-bold' : 'text-secondary hover:text-primary'
                }`}
              >
                <div className="p-2 rounded-xl surface-flat flex items-center justify-center shrink-0">
                  <GoogleIcon name={item.iconName} size={18} filled={isActive} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold font-display truncate text-primary">
                      {item.label}
                    </span>
                    <span className="badge-soft font-mono">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs text-secondary truncate">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Status e Footer da Sidebar */}
        <div className="p-3 space-y-2.5">
          {onSelectPreset && (
            <div
              role="radiogroup"
              aria-label="Selecionar Preset de Tema Tátil"
              className="p-2.5 rounded-2xl surface-inset space-y-2"
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-mono uppercase tracking-wider text-secondary font-semibold">
                  Tema Soft UI
                </span>
                <span className="text-xs font-mono font-bold text-primary">
                  {SOFT_UI_PRESETS[activePreset].label}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
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
                      className={`min-h-[44px] px-1.5 py-1 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer btn-anti-squish ${
                        isSelected
                          ? 'ui-card-soft text-primary font-bold'
                          : 'text-secondary hover:text-primary'
                      }`}
                      title={`Aplicar tema ${presetObj.label} (${presetObj.mode === 'dark' ? 'Escuro' : 'Claro'})`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: presetObj.accentPoint }}
                      />
                      <span>{presetObj.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="ui-btn-tactile w-full flex items-center justify-between text-xs"
              title="Alternar entre Modo Claro e Modo Escuro"
            >
              <div className="flex items-center gap-2">
                <GoogleIcon
                  name={theme === 'dark' ? 'light_mode' : 'dark_mode'}
                  size={18}
                />
                <span className="font-sans font-bold">
                  {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                </span>
              </div>
              <span className="badge-soft font-mono">
                {theme === 'dark' ? 'Sol' : 'Noite'}
              </span>
            </button>
          )}

          {/* Status do Modelo */}
          <div className="activity-row text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-secondary font-mono">Gemini 3.1 TTS</span>
            </div>
            <span className="badge-soft font-mono">
              Cloud Run
            </span>
          </div>

          {/* Links e Info */}
          <div className="flex items-center justify-between text-xs text-secondary px-1">
            <button
              type="button"
              onClick={() => onSelectTab('architecture')}
              className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer text-xs"
            >
              <GoogleIcon name="terminal" size={16} />
              <span>Arquitetura</span>
            </button>
            <a
              href={EXTERNAL_LINKS.GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors text-xs"
            >
              <GoogleIcon name="code" size={16} />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </aside>
    </>
  );
};

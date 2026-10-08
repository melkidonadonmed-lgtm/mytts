import React from 'react';
import { VoiceProfile } from '../types/voices';
import { GoogleIcon } from './GoogleIcon';

export type AppTab = 'reader' | 'polyglot' | 'mic' | 'voices' | 'architecture';

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
}) => {
  const navItems = [
    {
      id: 'reader' as AppTab,
      label: 'Estúdio de Criação',
      badge: 'Principal',
      iconName: 'headphones',
      description: 'Leitura Solo & Debate 2 Vozes',
    },
    {
      id: 'polyglot' as AppTab,
      label: 'Chat Poliglota',
      badge: '3 Línguas',
      iconName: 'translate',
      description: 'EN, IT & JA com Áudio e Fast Chunks',
    },
    {
      id: 'mic' as AppTab,
      label: 'Microfone & Ditado',
      badge: 'Ao Vivo',
      iconName: 'mic',
      description: 'Gravar fala e transcrever com IA',
    },
    {
      id: 'voices' as AppTab,
      label: 'Biblioteca de Vozes',
      badge: '5 Timbres',
      iconName: 'record_voice_over',
      description: 'Catálogo e audição de amostras',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onToggleMobile}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl btn-matte-amber flex items-center justify-center text-white font-bold shadow-md shadow-amber-500/20">
              <GoogleIcon name="auto_awesome" size={20} filled className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white font-display">
                  MyTTS
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold">
                  Studio
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Áudio Neural com Emoção</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 lg:hidden cursor-pointer"
            aria-label="Fechar navegação"
          >
            <GoogleIcon name="close" size={20} />
          </button>
        </div>

        {/* Voz Ativa em Destaque (Card Rápido Mate) */}
        <div className="p-3.5 mx-3 mt-3.5 rounded-2xl card-matte">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono">
              Voz Ativa
            </span>
            <button
              type="button"
              onClick={() => {
                onOpenVoiceLibrary();
                if (isOpenMobile) onToggleMobile();
              }}
              className="text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <span>Trocar</span>
              <GoogleIcon name="chevron_right" size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${selectedVoice.avatarColor} flex items-center justify-center text-white font-bold text-xs shadow-sm`}
            >
              {selectedVoice.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-primary truncate font-display">
                {selectedVoice.name}
              </h3>
              <p className="text-[11px] text-secondary truncate">
                {selectedVoice.archetype}
              </p>
            </div>
          </div>
        </div>

        {/* Botão de Busca Rápida (Ctrl + K) */}
        {onOpenCommandPalette && (
          <div className="px-3 mt-2">
            <button
              type="button"
              onClick={() => {
                onOpenCommandPalette();
                if (isOpenMobile) onToggleMobile();
              }}
              className="w-full px-3 py-2 rounded-xl btn-matte-dark flex items-center justify-between text-xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <GoogleIcon name="search" size={16} className="text-amber-500 dark:text-amber-400" />
                <span className="font-medium text-secondary">Busca Rápida</span>
              </div>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded">
                Ctrl K
              </kbd>
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  if (isOpenMobile) onToggleMobile();
                }}
                className={`btn-matte w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                  isActive
                    ? 'card-matte-active'
                    : 'text-secondary hover:text-primary hover:bg-slate-500/10 border border-transparent'
                }`}
              >
                <div
                  className={`mt-0.5 p-2 rounded-xl transition-colors ${
                    isActive
                      ? 'btn-matte-amber text-white font-bold shadow-md shadow-amber-900/20'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-800'
                  }`}
                >
                  <GoogleIcon name={item.iconName} size={18} filled={isActive} className={isActive ? 'text-white' : undefined} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold font-display ${isActive ? 'text-amber-800 dark:text-white font-extrabold' : 'text-primary'}`}>
                      {item.label}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                        isActive
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 font-bold'
                          : 'bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-white/[0.08]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-secondary mt-0.5 truncate">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Status e Footer da Sidebar */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* Alternador de Tema Binário (Dark / Light) */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-full min-h-[38px] px-3 py-2 rounded-xl btn-matte-dark flex items-center justify-between text-xs font-semibold cursor-pointer transition-all active:translate-y-px"
              title="Alternar entre Modo Claro e Modo Escuro"
            >
              <div className="flex items-center gap-2">
                <GoogleIcon
                  name={theme === 'dark' ? 'light_mode' : 'dark_mode'}
                  size={18}
                  className="text-amber-400"
                />
                <span className="font-sans font-bold">
                  {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                {theme === 'dark' ? 'Ativar Sol' : 'Ativar Noite'}
              </span>
            </button>
          )}

          {/* Status do Modelo */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-mono">Gemini 3.1 Flash TTS</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.2 rounded border border-emerald-400/20">
              Cloud Run
            </span>
          </div>

          {/* Links e Info */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <button
              type="button"
              onClick={() => onSelectTab('architecture')}
              className="flex items-center gap-1 hover:text-slate-300 transition-colors cursor-pointer text-[11px]"
            >
              <GoogleIcon name="terminal" size={16} />
              <span>Arquitetura</span>
            </button>
            <a
              href="https://github.com/melkidonadonmed-lgtm/mytts"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-slate-300 transition-colors text-[11px]"
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

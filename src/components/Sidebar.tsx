import React from 'react';
import { VoiceProfile } from '../types/voices';
import { GoogleIcon } from './GoogleIcon';

export type AppTab = 'reader' | 'polyglot' | 'mic' | 'debate' | 'voices' | 'architecture';

interface SidebarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  selectedVoice: VoiceProfile;
  isOpenMobile: boolean;
  onToggleMobile: () => void;
  onOpenVoiceLibrary: () => void;
  onOpenCommandPalette?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  selectedVoice,
  isOpenMobile,
  onToggleMobile,
  onOpenVoiceLibrary,
  onOpenCommandPalette,
}) => {
  const navItems = [
    {
      id: 'reader' as AppTab,
      label: 'Estúdio de Criação',
      badge: 'Principal',
      badgeColor: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
      iconName: 'headphones',
      description: 'Leitura Solo & Debate 2 Vozes',
    },
    {
      id: 'polyglot' as AppTab,
      label: 'Chat Poliglota',
      badge: '3 Línguas & Chunks',
      badgeColor: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
      iconName: 'translate',
      description: 'EN, IT & JA com Áudio e Fast Chunks',
    },
    {
      id: 'mic' as AppTab,
      label: 'Microfone & Ditado',
      badge: 'Ao Vivo',
      badgeColor: 'bg-rose-400/10 text-rose-300 border-rose-400/20',
      iconName: 'mic',
      description: 'Gravar fala e transcrever com IA',
    },
    {
      id: 'debate' as AppTab,
      label: 'Estúdio de Debate',
      badge: '2 Vozes',
      badgeColor: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
      iconName: 'group',
      description: 'Discussão dialética antagônica',
    },
    {
      id: 'voices' as AppTab,
      label: 'Biblioteca de Vozes',
      badge: '5 Timbres',
      badgeColor: 'bg-purple-400/10 text-purple-300 border-purple-400/20',
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
            <div className="w-9 h-9 rounded-xl btn-matte-amber flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/20">
              <GoogleIcon name="auto_awesome" size={20} filled className="text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white font-display">
                  MyTTS
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/20 font-semibold">
                  Studio
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Áudio Neural com Emoção</p>
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
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Voz Ativa
            </span>
            <button
              type="button"
              onClick={() => {
                onOpenVoiceLibrary();
                if (isOpenMobile) onToggleMobile();
              }}
              className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-0.5 cursor-pointer"
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
              <h3 className="text-xs font-bold text-slate-100 truncate font-display">
                {selectedVoice.name}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
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
              className="w-full px-3 py-2 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-between text-xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <GoogleIcon name="search" size={16} className="text-amber-400" />
                <span className="font-medium">Busca Rápida</span>
              </div>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
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
                    ? 'card-matte-active text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <div
                  className={`mt-0.5 p-1.5 rounded-lg ${
                    isActive ? 'btn-matte-amber text-slate-950 font-bold' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  <GoogleIcon name={item.iconName} size={18} filled={isActive} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold font-display ${isActive ? 'text-white' : 'text-slate-200'}`}>
                      {item.label}
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Status e Footer da Sidebar */}
        <div className="p-3 border-t border-slate-800 space-y-2">
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

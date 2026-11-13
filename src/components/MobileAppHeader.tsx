import React from 'react';
import { GoogleIcon } from './GoogleIcon';
import type { AppTab } from './Sidebar';
import type { VoiceProfile } from '../types/voices';

interface MobileAppHeaderProps {
  activeTab: AppTab;
  selectedVoice: VoiceProfile;
  onOpenMobileSidebar: () => void;
  onOpenCommandPalette: () => void;
  onToggleHistorySidebar: () => void;
  onNavigateTab: (tab: AppTab) => void;
  historyCount?: number;
}

export const MobileAppHeader: React.FC<MobileAppHeaderProps> = ({
  activeTab,
  selectedVoice,
  onOpenMobileSidebar,
  onOpenCommandPalette,
  onToggleHistorySidebar,
  onNavigateTab,
  historyCount = 0,
}) => {
  return (
    <header className="px-2.5 sm:px-4 py-1.5 border-b border-slate-800/80 dock-matte !rounded-t-none !rounded-b-2xl flex flex-col gap-1.5 lg:hidden sticky top-0 z-30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="btn-compact-touch p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer shrink-0"
            aria-label="Abrir menu de navegação"
          >
            <GoogleIcon name="menu" size={19} />
          </button>
          <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5 truncate">
            <span>MyTTS</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
              Studio
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Abrir busca rápida e paleta de comandos"
            className="btn-compact-touch p-2 sm:px-2.5 sm:py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
            title="Abrir Paleta de Comandos (Ctrl+K)"
          >
            <GoogleIcon name="search" size={16} className="text-amber-400" />
            <span className="hidden sm:inline">Ctrl+K</span>
          </button>

          <button
            type="button"
            onClick={onToggleHistorySidebar}
            aria-label="Abrir gaveta de histórico de sessões"
            className="btn-compact-touch p-2 sm:px-2.5 sm:py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
            title="Abrir Histórico & Sessões (Ctrl+H)"
          >
            <GoogleIcon name="history" size={16} className="text-amber-400" />
            {historyCount > 0 && (
              <span className="text-[10px] font-mono text-amber-300 tabular-nums">
                {historyCount}
              </span>
            )}
          </button>

          <div
            className={`w-6 h-6 rounded-md bg-gradient-to-tr ${selectedVoice.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}
          >
            {selectedVoice.name[0]}
          </div>
        </div>
      </div>

      {/* Navegação Horizontal Rápida no Mobile (4 Módulos Principais) */}
      <nav
        aria-label="Navegação rápida mobile"
        className="pill-nav-shell grid grid-cols-4 items-center gap-0.5 p-1 w-full overflow-hidden"
      >
        {(
          [
            { id: 'polyglot', label: 'Poliglota', shortLabel: 'Chat' },
            { id: 'voices', label: 'Vozes', shortLabel: 'Vozes' },
            { id: 'chunks', label: 'Chunks', shortLabel: 'Chunks' },
            { id: 'study', label: 'Estudo', shortLabel: 'Estudo' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            data-active={activeTab === item.id}
            aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => onNavigateTab(item.id)}
            className="pill-nav-item min-h-9 px-1 sm:px-2 py-1 text-[10px] sm:text-xs font-semibold whitespace-nowrap cursor-pointer flex items-center justify-center text-center min-w-0"
          >
            <span className="sm:hidden truncate">{item.shortLabel}</span>
            <span className="hidden sm:inline truncate">{item.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
};

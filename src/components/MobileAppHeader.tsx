import React from 'react';
import { GoogleIcon } from './GoogleIcon';
import type { AppTab, StudySubTab, VoiceConfigSubTab } from '../utils/navigationOrganizer';
import type { VoiceProfile } from '../types/voices';

interface MobileAppHeaderProps {
  activeTab: AppTab;
  voiceSubTab?: VoiceConfigSubTab;
  studySubTab?: StudySubTab;
  flashcardCount?: number;
  selectedVoice: VoiceProfile;
  onOpenMobileSidebar: () => void;
  onOpenCommandPalette: () => void;
  onToggleHistorySidebar: () => void;
  onNavigateTab: (tab: AppTab, subTab?: VoiceConfigSubTab | StudySubTab) => void;
  historyCount?: number;
}

const VOICE_MOBILE_SUBS: Array<{ id: VoiceConfigSubTab; label: string; icon: string }> = [
  { id: 'catalog', label: 'Catálogo', icon: 'tune' },
  { id: 'solo', label: 'Solo 1x', icon: 'headphones' },
  { id: 'debate', label: 'Debate 2x', icon: 'forum' },
];

const STUDY_MOBILE_SUBS: Array<{ id: StudySubTab; label: string; icon: string }> = [
  { id: 'decks', label: 'Baralhos', icon: 'style' },
  { id: 'review', label: 'Estudar', icon: 'auto_awesome' },
  { id: 'create', label: 'Criar', icon: 'add' },
];

export const MobileAppHeader: React.FC<MobileAppHeaderProps> = ({
  activeTab,
  voiceSubTab = 'catalog',
  studySubTab = 'decks',
  flashcardCount = 0,
  selectedVoice,
  onOpenMobileSidebar,
  onOpenCommandPalette,
  onToggleHistorySidebar,
  onNavigateTab,
  historyCount = 0,
}) => {
  return (
    <header className="px-2.5 sm:px-4 py-1.5 border-b border-[var(--border-subtle)] dock-matte !rounded-t-none !rounded-b-2xl flex flex-col gap-1.5 lg:hidden sticky top-0 z-30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="btn-compact-touch min-h-[40px] min-w-[40px] p-2 rounded-xl btn-matte-dark text-secondary hover:text-primary cursor-pointer shrink-0 inline-flex items-center justify-center"
            aria-label="Abrir menu de navegação"
          >
            <GoogleIcon name="menu" size={19} />
          </button>
          <span className="font-extrabold text-sm tracking-tight text-primary flex items-center gap-1.5 truncate">
            <span>MyTTS</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md surface-inset-pill border border-[var(--border-subtle)] text-amber-400 font-semibold tracking-wide">
              Studio
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Abrir busca rápida e paleta de comandos"
            className="btn-compact-touch min-h-[40px] min-w-[40px] px-2.5 py-1 rounded-xl btn-matte-dark text-xs font-mono text-secondary hover:text-primary inline-flex items-center justify-center gap-1 cursor-pointer"
            title="Abrir Paleta de Comandos (Ctrl+K)"
          >
            <GoogleIcon name="search" size={16} className="text-amber-400" />
            <span className="hidden sm:inline">Ctrl+K</span>
          </button>

          <button
            type="button"
            onClick={onToggleHistorySidebar}
            aria-label="Abrir gaveta de histórico de sessões"
            className="btn-compact-touch min-h-[40px] min-w-[40px] px-2.5 py-1 rounded-xl btn-matte-dark text-xs font-mono text-secondary hover:text-primary inline-flex items-center justify-center gap-1 cursor-pointer"
            title="Abrir Histórico & Sessões (Ctrl+H)"
          >
            <GoogleIcon name="history" size={16} className="text-amber-400" />
            {historyCount > 0 && (
              <span className="text-[10px] font-mono text-amber-400 tabular-nums">
                {historyCount}
              </span>
            )}
          </button>

          <div
            className={`w-7 h-7 rounded-md bg-gradient-to-tr ${selectedVoice.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}
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
            { id: 'polyglot', label: 'Poliglota', shortLabel: 'Chat', icon: 'translate' },
            { id: 'voices', label: 'Vozes', shortLabel: 'Vozes', icon: 'record_voice_over' },
            { id: 'chunks', label: 'Chunks', shortLabel: 'Chunks', icon: 'bolt' },
            { id: 'study', label: 'Estudo', shortLabel: 'Estudo', icon: 'school' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            data-active={activeTab === item.id}
            aria-current={activeTab === item.id ? 'page' : undefined}
            aria-label={
              item.id === 'study' && flashcardCount > 0
                ? `${item.label} (${flashcardCount} cards)`
                : item.label
            }
            onClick={() => onNavigateTab(item.id)}
            className="pill-nav-item min-h-[40px] px-1 sm:px-2 py-1 text-[10px] sm:text-xs font-semibold whitespace-nowrap cursor-pointer flex items-center justify-center gap-1 text-center min-w-0"
          >
            <GoogleIcon name={item.icon} size={14} filled={activeTab === item.id} />
            <span aria-hidden="true" className="sm:hidden truncate">{item.shortLabel}</span>
            <span aria-hidden="true" className="hidden sm:inline truncate">{item.label}</span>
            {item.id === 'study' && flashcardCount > 0 && (
              <span
                aria-hidden="true"
                className="hidden sm:inline-flex px-1 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[9px] tabular-nums"
              >
                {flashcardCount > 99 ? '99+' : flashcardCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Faixa Contextual de Sub-Módulos (1-Toque em Vozes ou Estudo) */}
      {(activeTab === 'voices' || activeTab === 'study') && (
        <div
          role="group"
          aria-label={
            activeTab === 'voices'
              ? 'Sub-módulos de Configuração de Vozes'
              : 'Sub-módulos da Área de Estudo'
          }
          className="grid grid-cols-3 gap-1 pt-0.5"
        >
          {activeTab === 'voices'
            ? VOICE_MOBILE_SUBS.map((sub) => {
                const isSubActive = voiceSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    aria-pressed={isSubActive}
                    onClick={() => onNavigateTab('voices', sub.id)}
                    className={`min-h-[40px] px-2 py-1 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                      isSubActive
                        ? 'card-matte-active text-amber-300 border-amber-500/40'
                        : 'surface-inset text-secondary hover:text-primary border-[var(--border-subtle)]'
                    }`}
                  >
                    <GoogleIcon name={sub.icon} size={14} filled={isSubActive} />
                    <span className="truncate">{sub.label}</span>
                  </button>
                );
              })
            : STUDY_MOBILE_SUBS.map((sub) => {
                const isSubActive = studySubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    aria-pressed={isSubActive}
                    onClick={() => onNavigateTab('study', sub.id)}
                    className={`min-h-[40px] px-2 py-1 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                      isSubActive
                        ? 'card-matte-active text-amber-300 border-amber-500/40'
                        : 'surface-inset text-secondary hover:text-primary border-[var(--border-subtle)]'
                    }`}
                  >
                    <GoogleIcon name={sub.icon} size={14} filled={isSubActive} />
                    <span className="truncate">{sub.label}</span>
                  </button>
                );
              })}
        </div>
      )}
    </header>
  );
};

import React from 'react';
import type {
  AppTab,
  BreadcrumbSegment,
  StudySubTab,
  VoiceConfigSubTab,
} from '../../utils/navigationOrganizer';
import type { VoiceProfile } from '../../types/voices';
import { GoogleIcon } from '../GoogleIcon';

interface WorkspaceBreadcrumbBarProps {
  activeTab: AppTab;
  voiceConfigSubTab: VoiceConfigSubTab;
  studySubTab: StudySubTab;
  breadcrumbTrail: BreadcrumbSegment[];
  selectedVoice: VoiceProfile;
  isRightHistoryOpen: boolean;
  historyCount: number;
  onNavigateTab: (
    tab: AppTab | 'reader' | 'debate',
    subTab?: VoiceConfigSubTab | StudySubTab
  ) => void;
  onToggleRightHistory: () => void;
}

export const WorkspaceBreadcrumbBar: React.FC<WorkspaceBreadcrumbBarProps> = ({
  activeTab,
  voiceConfigSubTab,
  studySubTab,
  breadcrumbTrail,
  selectedVoice,
  isRightHistoryOpen,
  historyCount,
  onNavigateTab,
  onToggleRightHistory,
}) => {
  return (
    <nav
      aria-label="Trilha"
      className="hidden sm:flex w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 pt-3 pb-1 items-center justify-between gap-3 text-xs text-secondary"
    >
      <ol role="list" className="breadcrumb-list">
        {breadcrumbTrail.map((seg) => (
          <li key={seg.id}>
            <button
              type="button"
              aria-current={seg.isCurrent ? 'page' : undefined}
              onClick={() => onNavigateTab(seg.tab, seg.voiceSubTab ?? seg.studySubTab)}
              className={`min-h-11 px-1.5 inline-flex items-center transition-colors cursor-pointer ${
                seg.isCurrent
                  ? 'text-primary font-semibold'
                  : 'hover:text-primary font-medium underline-offset-4 hover:underline'
              }`}
            >
              {seg.label}
            </button>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-2.5 shrink-0">
        {activeTab === 'voices' && (
          <div
            role="group"
            aria-label="Atalho de sub-módulos de vozes"
            className="hidden xl:flex items-center gap-1 p-0.5 rounded-xl surface-inset border border-[var(--border-subtle)]"
          >
            {(
              [
                { id: 'catalog', label: 'Catálogo' },
                { id: 'solo', label: 'Solo' },
                { id: 'debate', label: 'Debate' },
              ] as const
            ).map((sub) => (
              <button
                key={sub.id}
                type="button"
                aria-pressed={voiceConfigSubTab === sub.id}
                onClick={() => onNavigateTab('voices', sub.id)}
                className={`min-h-11 px-3 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  voiceConfigSubTab === sub.id
                    ? 'card-matte-active text-amber-300'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'study' && (
          <div
            role="group"
            aria-label="Atalho de sub-módulos de estudo"
            className="hidden xl:flex items-center gap-1 p-0.5 rounded-xl surface-inset border border-[var(--border-subtle)]"
          >
            {(
              [
                { id: 'decks', label: 'Baralhos' },
                { id: 'review', label: 'Estudar' },
                { id: 'create', label: 'Criar' },
              ] as const
            ).map((sub) => (
              <button
                key={sub.id}
                type="button"
                aria-pressed={studySubTab === sub.id}
                onClick={() => onNavigateTab('study', sub.id)}
                className={`min-h-11 px-3 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  studySubTab === sub.id
                    ? 'card-matte-active text-amber-300'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        <span className="font-mono text-xs text-secondary hidden md:inline tabular-nums">
          Voz Ativa: <strong className="text-primary">{selectedVoice.name}</strong>
        </span>
        <button
          type="button"
          onClick={onToggleRightHistory}
          aria-expanded={isRightHistoryOpen}
          aria-label="Alternar barra lateral direita de histórico (Ctrl + H)"
          title="Alternar Histórico & Linha do Tempo de Sessões (Ctrl + H)"
          className={`min-h-11 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
            isRightHistoryOpen
              ? 'card-matte-active text-amber-400 border-[var(--border-subtle)]'
              : 'btn-matte-dark text-secondary hover:text-primary border-[var(--border-subtle)]'
          }`}
        >
          <GoogleIcon
            name={isRightHistoryOpen ? 'panel_right_close' : 'history'}
            size={15}
            className="text-amber-400"
          />
          <span>Histórico</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded surface-inset-pill text-amber-400 tabular-nums">
            {historyCount}
          </span>
        </button>
      </div>
    </nav>
  );
};

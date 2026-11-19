/** Pure navigation organizer for breadcrumbs, sidebar groups, shortcuts, and WAI-ARIA tablists. */

export type AppTab = 'polyglot' | 'voices' | 'chunks' | 'study' | 'architecture';
export type VoiceConfigSubTab = 'catalog' | 'solo' | 'debate';
export type StudySubTab = 'decks' | 'review' | 'create';

export interface BreadcrumbSegment {
  id: string;
  label: string;
  shortLabel: string;
  tab: AppTab;
  voiceSubTab?: VoiceConfigSubTab;
  studySubTab?: StudySubTab;
  isCurrent: boolean;
}

export interface SidebarSubItem {
  id: VoiceConfigSubTab | StudySubTab;
  label: string;
  badge: string;
  iconName: string;
}

export interface SidebarNavItem {
  id: AppTab;
  label: string;
  shortLabel: string;
  badge: string;
  shortcutHint: string;
  iconName: string;
  description: string;
  group: 'studio' | 'retention';
  subItems?: SidebarSubItem[];
}

export interface SidebarNavGroup {
  id: 'studio' | 'retention';
  label: string;
  items: SidebarNavItem[];
}

export interface ResolvedNavigationTarget {
  tab: AppTab;
  voiceSubTab?: VoiceConfigSubTab;
  studySubTab?: StudySubTab;
}

const VALID_APP_TABS = new Set<AppTab>(['polyglot', 'voices', 'chunks', 'study', 'architecture']);
const VOICE_SUB_TABS: readonly VoiceConfigSubTab[] = ['catalog', 'solo', 'debate'];
const STUDY_SUB_TABS: readonly StudySubTab[] = ['decks', 'review', 'create'];

const TAB_LABELS: Record<AppTab, { label: string; shortLabel: string }> = {
  polyglot: { label: 'Chat Poliglota Multimodal', shortLabel: 'Chat Poliglota' },
  voices: { label: 'Configuração de Vozes', shortLabel: 'Vozes' },
  chunks: { label: 'FastChunks (Treino Lexical)', shortLabel: 'FastChunks' },
  study: { label: 'Área de Estudo & Flashcards', shortLabel: 'Estudo' },
  architecture: { label: 'Arquitetura & Governança', shortLabel: 'Arquitetura' },
};

const VOICE_SUB_LABELS: Record<VoiceConfigSubTab, { label: string; shortLabel: string }> = {
  catalog: { label: 'Catálogo & Favoritas', shortLabel: 'Catálogo' },
  solo: { label: 'Leitura Solo (1 Voz)', shortLabel: 'Solo 1x' },
  debate: { label: 'Debate & Diálogo (2 Vozes)', shortLabel: 'Debate 2x' },
};

const STUDY_SUB_LABELS: Record<StudySubTab, { label: string; shortLabel: string }> = {
  decks: { label: 'Baralhos & Visão Geral', shortLabel: 'Baralhos' },
  review: { label: 'Estudar (Fila SRS)', shortLabel: 'Estudar' },
  create: { label: 'Criar & Gerenciar', shortLabel: 'Criar' },
};

/** Normalizes legacy route aliases and validates sub-tab targets safely. */
export function resolveNavigationTarget(rawTab: string, subTab?: string): ResolvedNavigationTarget {
  if (rawTab === 'reader') return { tab: 'voices', voiceSubTab: 'solo' };
  if (rawTab === 'debate') return { tab: 'voices', voiceSubTab: 'debate' };

  const tab: AppTab = VALID_APP_TABS.has(rawTab as AppTab) ? (rawTab as AppTab) : 'polyglot';
  if (tab === 'voices' && subTab && VOICE_SUB_TABS.includes(subTab as VoiceConfigSubTab)) {
    return { tab, voiceSubTab: subTab as VoiceConfigSubTab };
  }
  if (tab === 'study' && subTab && STUDY_SUB_TABS.includes(subTab as StudySubTab)) {
    return { tab, studySubTab: subTab as StudySubTab };
  }
  return { tab };
}

/** Builds a 2- or 3-level hierarchical breadcrumb trail for the active workspace view. */
export function buildBreadcrumbTrail(params: {
  activeTab: AppTab;
  voiceSubTab: VoiceConfigSubTab;
  studySubTab: StudySubTab;
}): BreadcrumbSegment[] {
  const { activeTab, voiceSubTab, studySubTab } = params;
  const hasSubLevel = activeTab === 'voices' || activeTab === 'study';
  const trail: BreadcrumbSegment[] = [
    { id: 'root', label: 'MyTTS Studio', shortLabel: 'MyTTS', tab: 'polyglot', isCurrent: false },
    {
      id: `tab-${activeTab}`,
      label: TAB_LABELS[activeTab].label,
      shortLabel: TAB_LABELS[activeTab].shortLabel,
      tab: activeTab,
      voiceSubTab: activeTab === 'voices' ? 'catalog' : undefined,
      studySubTab: activeTab === 'study' ? 'decks' : undefined,
      isCurrent: !hasSubLevel,
    },
  ];

  if (activeTab === 'voices') {
    trail.push({
      id: `sub-voices-${voiceSubTab}`,
      label: VOICE_SUB_LABELS[voiceSubTab].label,
      shortLabel: VOICE_SUB_LABELS[voiceSubTab].shortLabel,
      tab: 'voices',
      voiceSubTab,
      isCurrent: true,
    });
  } else if (activeTab === 'study') {
    trail.push({
      id: `sub-study-${studySubTab}`,
      label: STUDY_SUB_LABELS[studySubTab].label,
      shortLabel: STUDY_SUB_LABELS[studySubTab].shortLabel,
      tab: 'study',
      studySubTab,
      isCurrent: true,
    });
  }
  return trail;
}

/** Returns grouped primary navigation items and contextual sub-routes for the sidebar. */
export function getSidebarNavGroups(params: {
  flashcardCount: number;
  dueCount?: number;
}): SidebarNavGroup[] {
  const { flashcardCount, dueCount = 0 } = params;
  return [
    {
      id: 'studio',
      label: 'Estúdios de Voz & IA',
      items: [
        {
          id: 'polyglot', label: 'Chat Poliglota', shortLabel: 'Chat', badge: 'Principal',
          shortcutHint: 'Alt+1', iconName: 'translate', group: 'studio',
          description: 'EN, IT & JA · Voz + YouTube + Live',
        },
        {
          id: 'voices', label: 'Configuração de Vozes', shortLabel: 'Vozes', badge: 'Estúdio',
          shortcutHint: 'Alt+2', iconName: 'record_voice_over', group: 'studio',
          description: 'Catálogo, Leitura Solo & Debate 2x',
          subItems: [
            { id: 'catalog', label: 'Catálogo & Favoritas', badge: '5', iconName: 'tune' },
            { id: 'solo', label: 'Leitura Solo (1 Voz)', badge: '1x', iconName: 'headphones' },
            { id: 'debate', label: 'Debate & Diálogo', badge: '2x', iconName: 'forum' },
          ],
        },
      ],
    },
    {
      id: 'retention',
      label: 'Treino & Retenção',
      items: [
        {
          id: 'chunks', label: 'FastChunks', shortLabel: 'Chunks', badge: 'Treino',
          shortcutHint: 'Alt+3', iconName: 'bolt', group: 'retention',
          description: 'Blocos coloquiais e shadowing loop',
        },
        {
          id: 'study', label: 'Área de Estudo', shortLabel: 'Estudo',
          badge: flashcardCount > 0 ? `${flashcardCount} Cards` : 'Flashcards',
          shortcutHint: 'Alt+4', iconName: 'school', group: 'retention',
          description: 'Importação e repetição com TTS',
          subItems: [
            { id: 'decks', label: 'Baralhos & Visão Geral', badge: 'Mapa', iconName: 'style' },
            { id: 'review', label: 'Estudar (Fila SRS)', badge: dueCount > 0 ? `${dueCount}` : 'SRS', iconName: 'auto_awesome' },
            { id: 'create', label: 'Criar & Gerenciar', badge: '+', iconName: 'add' },
          ],
        },
      ],
    },
  ];
}

/** Resolves Alt+1..Alt+4 shortcuts while ignoring editable form inputs. */
export function resolveShortcutNavigation(input: {
  altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean;
  key: string; targetTagName?: string; isContentEditable?: boolean;
}): ResolvedNavigationTarget | null {
  if (!input.altKey || input.ctrlKey || input.metaKey || input.shiftKey) return null;
  const tag = (input.targetTagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || input.isContentEditable) return null;
  if (input.key === '1') return { tab: 'polyglot' };
  if (input.key === '2') return { tab: 'voices', voiceSubTab: 'catalog' };
  if (input.key === '3') return { tab: 'chunks' };
  if (input.key === '4') return { tab: 'study', studySubTab: 'decks' };
  return null;
}

/** Computes next circular tab index for WAI-ARIA tablist arrow/Home/End navigation. */
export function computeNextTablistIndex(currentIndex: number, total: number, key: string): number | null {
  if (total <= 0) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (currentIndex + 1) % total;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (currentIndex - 1 + total) % total;
  if (key === 'Home') return 0;
  if (key === 'End') return total - 1;
  return null;
}

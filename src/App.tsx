import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { VoiceConfigWorkspace } from './components/VoiceConfigWorkspace';
import { PolyglotChatStudio } from './components/PolyglotChatStudio';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { FastChunkAudioApp } from './components/FastChunkAudioApp';
import { StudyArenaView } from './components/StudyArenaView';
import { HistorySidebar } from './components/HistorySidebar';
import { AuthModal } from './components/AuthModal';
import { MobileAppHeader } from './components/MobileAppHeader';
import { BottomAudioDock } from './components/BottomAudioDock';
import { ArchitectureModal } from './components/ArchitectureModal';
import { WorkspaceBreadcrumbBar } from './components/app/WorkspaceBreadcrumbBar';
import {
  buildBreadcrumbTrail,
  resolveNavigationTarget,
  resolveShortcutNavigation,
  type AppTab,
  type StudySubTab,
  type VoiceConfigSubTab,
} from './utils/navigationOrganizer';
import type { DebateScript, LanguageCode, StudioRenderMode } from './types/debate';
import type { UnifiedHistoryItem } from './types/polyglot';
import { VoiceProfile, GEMINI_VOICES } from './types/voices';
import {
  persistBrowserState,
  readBrowserState,
  readFavoriteVoicesByLanguage,
  saveFavoriteVoicesByLanguage,
} from './services/polyglotClient';
import { GoogleIcon } from './components/GoogleIcon';
import { useThemeManager } from './hooks/useThemeManager';
import { useAppHistory } from './hooks/useAppHistory';
import { useDebateStudio } from './hooks/useDebateStudio';

// Main orchestrator for MyTTS Studio (3 Responsive Columns: Rail Sidebar + Central Canvas + History Sidebar)
export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('polyglot');
  const [voiceConfigSubTab, setVoiceConfigSubTab] = useState<VoiceConfigSubTab>('catalog');
  const [studySubTab, setStudySubTab] = useState<StudySubTab>('decks');
  const [favoriteVoicesByLang, setFavoriteVoicesByLang] = useState<Record<'en' | 'it' | 'ja', string>>(() =>
    readFavoriteVoicesByLanguage()
  );
  const [studioRenderMode, setStudioRenderMode] = useState<StudioRenderMode>('solo');
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile>(GEMINI_VOICES[0]); // Puck default
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(() => {
    return readBrowserState('mytts_sidebar_collapsed') === 'true';
  });
  const [isRightHistoryOpen, setIsRightHistoryOpen] = useState<boolean>(() => {
    return readBrowserState('mytts_history_open') === 'true';
  });

  const { activePreset, theme, handleSelectPreset, handleToggleBinaryTheme } = useThemeManager();
  const history = useAppHistory();
  const debate = useDebateStudio({
    userId: history.userSession.uid,
    selectedVoice,
    onSelectVoice: setSelectedVoice,
  });

  const mainCanvasRef = useRef<HTMLElement | null>(null);

  const handleToggleLeftSidebar = useCallback(() => {
    setIsLeftSidebarCollapsed((prev) => {
      const next = !prev;
      persistBrowserState('mytts_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  const handleToggleRightHistory = useCallback(() => {
    setIsRightHistoryOpen((prev) => {
      const next = !prev;
      persistBrowserState('mytts_history_open', String(next));
      // Responsive rule (< 1440px): opening right history collapses left sidebar to Icon Rail (68px)
      if (next && typeof window !== 'undefined' && window.innerWidth < 1440) {
        setIsLeftSidebarCollapsed(true);
        persistBrowserState('mytts_sidebar_collapsed', 'true');
      }
      return next;
    });
  }, []);

  const handleChangeFavoriteVoice = useCallback((lang: 'en' | 'it' | 'ja', voiceId: string) => {
    setFavoriteVoicesByLang((prev) => {
      const next = { ...prev, [lang]: voiceId };
      saveFavoriteVoicesByLanguage(next);
      window.dispatchEvent(new CustomEvent('mytts-favorite-voices-changed', { detail: next }));
      return next;
    });
  }, []);

  const handleNavigateTab = useCallback(
    (tab: AppTab | 'reader' | 'debate', subTab?: VoiceConfigSubTab | StudySubTab): void => {
      const resolved = resolveNavigationTarget(tab, subTab);
      const targetTab = resolved.tab;
      if (resolved.voiceSubTab) {
        setVoiceConfigSubTab(resolved.voiceSubTab);
      }
      if (resolved.studySubTab) {
        setStudySubTab(resolved.studySubTab);
      }

      if (debate.isPlaying && (targetTab !== 'voices' || resolved.voiceSubTab === 'solo')) {
        debate.player.pause();
      }
      const docWithTransition = document as Document & {
        startViewTransition?: (cb: () => void) => { finished?: Promise<void> };
      };
      if (docWithTransition.startViewTransition) {
        const transition = docWithTransition.startViewTransition(() => setActiveTab(targetTab));
        if (transition && transition.finished) {
          transition.finished
            .then(() => {
              window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
              mainCanvasRef.current?.focus({ preventScroll: true });
            })
            .catch((err: unknown) => {
              console.debug(
                '[Navigation] ViewTransition interrompida:',
                err instanceof Error ? err.message : String(err)
              );
            });
        } else {
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
            mainCanvasRef.current?.focus({ preventScroll: true });
          }, 50);
        }
      } else {
        setActiveTab(targetTab);
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
          mainCanvasRef.current?.focus({ preventScroll: true });
        }, 0);
      }
    },
    [debate.isPlaying, debate.player]
  );

  // Global keyboard shortcuts (Ctrl+K, Ctrl+B, Ctrl+H, Alt+1..4)
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleLeftSidebar();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleToggleRightHistory();
        return;
      }
      const targetEl = e.target as HTMLElement | null;
      const shortcutTarget = resolveShortcutNavigation({
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        key: e.key,
        targetTagName: targetEl?.tagName,
        isContentEditable: targetEl?.isContentEditable,
      });
      if (shortcutTarget) {
        e.preventDefault();
        handleNavigateTab(
          shortcutTarget.tab,
          shortcutTarget.voiceSubTab ?? shortcutTarget.studySubTab
        );
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', onGlobalKeyDown);
    };
  }, [handleToggleLeftSidebar, handleToggleRightHistory, handleNavigateTab]);

  const breadcrumbTrail = useMemo(
    () =>
      buildBreadcrumbTrail({
        activeTab,
        voiceSubTab: voiceConfigSubTab,
        studySubTab,
      }),
    [activeTab, voiceConfigSubTab, studySubTab]
  );

  const handleSelectHistoryItem = useCallback(
    (item: UnifiedHistoryItem) => {
      if (item.kind === 'chat') {
        history.setSelectedConversationId(item.id);
        handleNavigateTab('polyglot');
      } else if (item.kind === 'debate_tts' && item.debateSession) {
        const restoredTurns = item.debateSession.turns.map((t) => ({
          turn: t.turn,
          speaker: t.speaker,
          voice_id: t.voice_id,
          text: t.text,
          clean_text: t.clean_text || t.text.replace(/<[^>]+>/g, '').trim(),
          emotion: (t.emotion || 'thoughtful') as DebateScript['turns'][number]['emotion'],
          prosody: {
            speech_rate: t.speech_rate || 1.0,
            pre_delay_ms: t.pre_delay_ms || 250,
            breath_sound: true,
          },
          audioStatus: 'idle' as const,
        }));
        debate.setScript((prev) => ({
          ...prev,
          title: item.debateSession!.title,
          topicSummary: item.debateSession!.documentPreview || prev.topicSummary,
          language: item.debateSession!.language as LanguageCode,
          turns: restoredTurns,
        }));
        handleNavigateTab('voices', 'debate');
      } else if (item.kind === 'flashcards') {
        history.setSelectedStudyCardId(item.id);
        handleNavigateTab('study');
      }
    },
    [debate, handleNavigateTab, history]
  );

  return (
    <div
      data-state="idle"
      aria-busy={debate.isGenerating || debate.isSynthesizing}
      style={
        {
          '--left-sidebar-w': isLeftSidebarCollapsed ? '68px' : '280px',
          '--right-sidebar-w': isRightHistoryOpen ? '320px' : '0px',
        } as React.CSSProperties
      }
      className="min-h-screen surface-canvas text-primary flex flex-col lg:flex-row font-sans selection:bg-[var(--accent-soft-bg)] selection:text-[var(--text-primary)]"
    >
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo principal
      </a>

      {/* 1. Left Collapsible Sidebar (280px <-> 68px Icon Rail Mode + Account Popover) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleNavigateTab}
        voiceSubTab={voiceConfigSubTab}
        studySubTab={studySubTab}
        onNavigate={handleNavigateTab}
        isOpenMobile={isMobileSidebarOpen}
        onToggleMobile={() => setIsMobileSidebarOpen((prev) => !prev)}
        isCollapsed={isLeftSidebarCollapsed}
        onToggleCollapse={handleToggleLeftSidebar}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        isHistoryOpen={isRightHistoryOpen}
        historyCount={history.unifiedHistoryItems.length}
        onToggleHistory={handleToggleRightHistory}
        flashcardCount={history.flashcards.length}
        theme={theme}
        onToggleTheme={handleToggleBinaryTheme}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
      />

      {/* 2. Central Workspace (Coupled to dynamic widths of both Sidebars) */}
      <div className="flex-1 flex flex-col lg:pl-[var(--left-sidebar-w)] lg:pr-[var(--right-sidebar-w)] transition-[padding] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] min-h-screen min-w-0 max-w-full overflow-x-clip">
        <MobileAppHeader
          activeTab={activeTab}
          voiceSubTab={voiceConfigSubTab}
          studySubTab={studySubTab}
          flashcardCount={history.flashcards.length}
          selectedVoice={selectedVoice}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onToggleHistorySidebar={handleToggleRightHistory}
          onNavigateTab={handleNavigateTab}
          historyCount={history.unifiedHistoryItems.length}
        />

        {/* Global Error Banner */}
        {debate.globalError && (
          <div className="max-w-4xl mx-auto w-full px-4 pt-4" role="alert">
            <div className="surface-raised border border-[var(--border-subtle)] text-primary px-4 py-2.5 rounded-xl text-xs flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2">
                <GoogleIcon
                  name="error"
                  size={16}
                  className="text-[var(--status-danger)] shrink-0"
                />
                <span>{debate.globalError}</span>
              </div>
              <button
                type="button"
                onClick={() => debate.setGlobalError(null)}
                className="min-h-11 px-3 rounded-lg text-[var(--status-danger)] hover:text-primary font-mono text-xs cursor-pointer transition-colors"
              >
                dispensar
              </button>
            </div>
          </div>
        )}

        {/* 3. Module Content Canvas (Canonical max-w-[1440px] ruler) */}
        <main
          id="main-content"
          ref={mainCanvasRef}
          tabIndex={-1}
          className="flex-1 flex flex-col outline-none"
        >
          <WorkspaceBreadcrumbBar
            activeTab={activeTab}
            voiceConfigSubTab={voiceConfigSubTab}
            studySubTab={studySubTab}
            breadcrumbTrail={breadcrumbTrail}
            selectedVoice={selectedVoice}
            isRightHistoryOpen={isRightHistoryOpen}
            historyCount={history.unifiedHistoryItems.length}
            onNavigateTab={handleNavigateTab}
            onToggleRightHistory={handleToggleRightHistory}
          />

          {/* Module 1: Polyglot Multimodal Chat (EN, IT, JA) */}
          <div
            hidden={activeTab !== 'polyglot'}
            aria-hidden={activeTab !== 'polyglot'}
            inert={activeTab !== 'polyglot'}
            className={activeTab === 'polyglot' ? 'contents' : 'hidden'}
          >
            <PolyglotChatStudio
              globalVoice={selectedVoice}
              onSyncGlobalVoice={setSelectedVoice}
              selectedConversationId={history.selectedConversationId}
              newConversationSignal={history.newConversationSignal}
              onConversationsChanged={history.handleConversationsChanged}
              onOpenStudyTab={() => handleNavigateTab('study')}
              onOpenVoicesConfigTab={() => handleNavigateTab('voices', 'catalog')}
              favoriteVoicesByLang={favoriteVoicesByLang}
              onSendToCreationStudio={(textToRender, renderMode) => {
                if (textToRender) {
                  debate.setDocumentText(textToRender);
                }
                setStudioRenderMode(renderMode);
                if (renderMode === 'solo') {
                  handleNavigateTab('voices', 'solo');
                } else {
                  debate.setConfig((prev) => ({ ...prev, format: renderMode }));
                  handleNavigateTab('voices', 'debate');
                }
              }}
            />
          </div>

          {/* Module 2: Voice Config Workspace (Catalog & Favorites + Solo Studio + Debate) */}
          {activeTab === 'voices' && (
            <VoiceConfigWorkspace
              activeSubTab={voiceConfigSubTab}
              onChangeSubTab={setVoiceConfigSubTab}
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoice}
              favoriteVoicesByLang={favoriteVoicesByLang}
              onChangeFavoriteVoice={handleChangeFavoriteVoice}
              text={debate.documentText}
              onChangeText={debate.setDocumentText}
              player={debate.player}
              isPlaying={debate.isPlaying}
              playerCurrentTurn={debate.playerCurrentTurn}
              script={debate.script}
              setScript={debate.setScript}
              debateConfig={debate.config}
              onChangeDebateConfig={debate.handleUpdateDebateConfig}
              studioRenderMode={studioRenderMode}
              onChangeStudioRenderMode={setStudioRenderMode}
              onGenerateDebate={debate.handleGenerateDebateWithCustomSpeakers}
              isGeneratingDebate={debate.isGenerating}
              isSynthesizingDebate={debate.isSynthesizing}
              onSynthesizeSingleTurn={debate.handleSynthesizeSingleTurn}
              onPlayTurn={debate.handlePlayDebateTurn}
              onUpdateTurnText={debate.handleUpdateTurnText}
              onUpdateTurnVoice={debate.handleUpdateTurnVoice}
              onOpenPolyglotTab={() => handleNavigateTab('polyglot')}
            />
          )}

          {/* Module 3: FastChunks (Lexical Audio Training) */}
          {activeTab === 'chunks' && (
            <FastChunkAudioApp
              onOpenStudyTab={() => handleNavigateTab('study')}
              onOpenPolyglotTab={() => handleNavigateTab('polyglot')}
              flashcardCount={history.flashcards.length}
            />
          )}

          {/* Module 4: Study Arena & Flashcards Deck */}
          {activeTab === 'study' && (
            <StudyArenaView
              selectedVoice={selectedVoice}
              initialCardId={history.selectedStudyCardId}
              activeSubTab={studySubTab}
              onChangeSubTab={setStudySubTab}
              onOpenPolyglotTab={() => handleNavigateTab('polyglot')}
              onOpenChunksTab={() => handleNavigateTab('chunks')}
            />
          )}
        </main>

        {/* Bottom Audio Dock (Displayed when active script exists in Voices tab) */}
        {activeTab === 'voices' &&
          (voiceConfigSubTab === 'debate' || Boolean(debate.script?.turns?.length)) && (
            <BottomAudioDock
              player={debate.player}
              script={debate.script}
              isPlaying={debate.isPlaying}
              onTogglePlay={() => {
                const ready = debate.script?.turns.filter((t) => Boolean(t.audioBase64)).length || 0;
                if (ready === 0 && debate.script) {
                  void debate.handlePlayDebateTurn(debate.playerCurrentTurn);
                } else {
                  debate.player.togglePlay();
                }
              }}
              currentTime={debate.currentTime}
              duration={debate.duration}
              onSeek={(t) => debate.player.seek(t)}
              playbackRate={debate.playbackRate}
              onChangePlaybackRate={(r) => debate.player.setSpeed(r)}
              currentSpeaker={debate.activeSpeaker}
              currentTurn={debate.activeTurn}
              currentTurnText={debate.activeTurn?.text}
              turnIndex={debate.playerCurrentTurn}
              totalTurns={debate.script?.turns.length || 0}
              language={debate.config.language}
            />
          )}
      </div>

      {/* 4. Right Collapsible History Sidebar (320px <-> 0px) */}
      <HistorySidebar
        isOpen={isRightHistoryOpen}
        onClose={() => {
          setIsRightHistoryOpen(false);
          persistBrowserState('mytts_history_open', 'false');
        }}
        items={history.unifiedHistoryItems}
        activeConversationId={history.activeConversationId}
        isCloudSynced={history.userSession.isGoogleAuthenticated}
        onSelectHistoryItem={handleSelectHistoryItem}
        onNewConversation={() => {
          history.setSelectedConversationId(null);
          history.setNewConversationSignal((prev) => prev + 1);
          handleNavigateTab('polyglot');
        }}
        onTogglePin={history.handleTogglePinHistoryItem}
        onRenameItem={history.handleRenameHistoryItem}
        onDeleteItem={history.handleDeleteHistoryItem}
        onClearUnpinned={history.handleClearUnpinnedHistory}
      />

      {/* 5. Unified Google Login / Session / TTS Diagnostics Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Architecture & Inspection Modal */}
      {activeTab === 'architecture' && (
        <ArchitectureModal onClose={() => handleNavigateTab('polyglot')} />
      )}

      {/* Tactile Command Palette Modal (Ctrl + K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={handleNavigateTab}
        onSelectVoice={(v) => setSelectedVoice(v)}
        currentVoice={selectedVoice}
        onToggleLeftSidebar={handleToggleLeftSidebar}
        onToggleRightHistory={handleToggleRightHistory}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        historyItems={history.unifiedHistoryItems}
        onSelectHistoryItem={handleSelectHistoryItem}
      />
    </div>
  );
}

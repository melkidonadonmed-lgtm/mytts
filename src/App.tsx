import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sidebar, AppTab } from './components/Sidebar';
import { VoiceConfigWorkspace, VoiceConfigSubTab } from './components/VoiceConfigWorkspace';
import { PolyglotChatStudio } from './components/PolyglotChatStudio';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { FastChunkAudioApp } from './components/FastChunkAudioApp';
import { StudyArenaView } from './components/StudyArenaView';
import { HistorySidebar } from './components/HistorySidebar';
import { AuthModal } from './components/AuthModal';
import { MobileAppHeader } from './components/MobileAppHeader';
import { BottomAudioDock } from './components/BottomAudioDock';
import { ArchitectureModal } from './components/ArchitectureModal';
import {
  ConversationFormat,
  DebateConfig,
  DebateScript,
  LanguageCode,
  SpeakerProfile,
  StudioRenderMode,
} from './types/debate';
import type {
  FlashcardItem,
  SavedConversation,
  SavedDebateSession,
  UnifiedHistoryItem,
} from './types/polyglot';
import { LANGUAGE_OPTIONS, SAMPLE_DOCUMENTS, INITIAL_PRESET_SCRIPTS } from './data/sampleDebates';
import { GaplessAudioPlayer } from './utils/audioEngine';
import { speakBrowserFallback, stopBrowserSpeech } from './utils/audio';
import { VoiceProfile, GEMINI_VOICES } from './types/voices';
import { requestDebateScript } from './services/apiClient';
import { generateAudioCacheKey, synthesizeWithCache } from './utils/audioCache';
import {
  persistBrowserState,
  readBrowserState,
  requestListUserConversations,
  requestSaveUserConversation,
  requestDeleteUserConversation,
  requestClearUnpinnedConversations,
  readFavoriteVoicesByLanguage,
  saveFavoriteVoicesByLanguage,
} from './services/polyglotClient';
import {
  readFlashcardDeck,
  subscribeFlashcardDeck,
  deleteFlashcardFromDeck,
} from './services/flashcardDeckStorage';
import {
  readDebateSessions,
  subscribeSessionHistory,
  saveDebateSessionFromScript,
  togglePinDebateSession,
  renameDebateSession,
  deleteDebateSession,
  clearUnpinnedDebateSessions,
  buildUnifiedHistoryItems,
} from './services/sessionHistoryStorage';
import { getActiveSession, subscribeAuthChanges } from './services/authService';
import { SOFT_UI_PRESETS, normalizeThemePreset } from './config/tokens';
import type { SoftUIThemePreset } from './types';
import { GoogleIcon } from './components/GoogleIcon';

const TAB_BREADCRUMB_LABELS: Record<AppTab, string> = {
  polyglot: 'Chat Poliglota Multimodal',
  voices: 'Configuração de Vozes',
  chunks: 'FastChunks (Treino Lexical)',
  study: 'Área de Estudo & Flashcards Deck',
  architecture: 'Arquitetura & Governança',
};

// Orquestrador principal do MyTTS Studio (3 Colunas Responsivas: Rail Sidebar + Canvas Central + History Sidebar)
export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('polyglot');
  const [voiceConfigSubTab, setVoiceConfigSubTab] = useState<VoiceConfigSubTab>('catalog');
  const [favoriteVoicesByLang, setFavoriteVoicesByLang] = useState<Record<'en' | 'it' | 'ja', string>>(() =>
    readFavoriteVoicesByLanguage()
  );
  const [studioRenderMode, setStudioRenderMode] = useState<StudioRenderMode>('solo');
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile>(GEMINI_VOICES[0]); // Puck default
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Estados Colapsáveis Independentes (Sidebar Esquerda 280px <-> 68px e Histórico Direito 320px <-> 0px)
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(() => {
    return readBrowserState('mytts_sidebar_collapsed') === 'true';
  });
  const [isRightHistoryOpen, setIsRightHistoryOpen] = useState<boolean>(() => {
    return readBrowserState('mytts_history_open') === 'true';
  });

  // Dados Globais para a HistorySidebar e Contadores
  const [userSession, setUserSession] = useState(() => getActiveSession());
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newConversationSignal, setNewConversationSignal] = useState<number>(0);
  const [debateSessions, setDebateSessions] = useState<SavedDebateSession[]>(() =>
    readDebateSessions()
  );
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>(() => readFlashcardDeck());
  const [selectedStudyCardId, setSelectedStudyCardId] = useState<string | null>(null);

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
      // Regra responsiva (< 1440px): abrir o histórico direito recolhe automaticamente a sidebar esquerda para Icon Rail (68px)
      if (next && typeof window !== 'undefined' && window.innerWidth < 1440) {
        setIsLeftSidebarCollapsed(true);
        persistBrowserState('mytts_sidebar_collapsed', 'true');
      }
      return next;
    });
  }, []);

  // Sincroniza Flashcards, Sessões de Debate e Conversas
  useEffect(() => {
    setFlashcards(readFlashcardDeck());
    const unsubFlash = subscribeFlashcardDeck(setFlashcards);
    const unsubDebate = subscribeSessionHistory(() => {
      setDebateSessions(readDebateSessions());
    });
    const unsubAuth = subscribeAuthChanges((nextSession) => {
      setUserSession(nextSession);
      setDebateSessions(readDebateSessions(nextSession.uid));
      void requestListUserConversations().then(setConversations);
    });
    void requestListUserConversations().then(setConversations);
    return () => {
      unsubFlash();
      unsubDebate();
      unsubAuth();
    };
  }, []);

  const unifiedHistoryItems = useMemo(() => {
    void flashcards.length;
    return buildUnifiedHistoryItems(conversations, debateSessions, userSession.uid);
  }, [conversations, debateSessions, flashcards.length, userSession.uid]);

  // Preset Soft UI Fosco (obsidian: Escuro Fosco | slate: Claro Fosco) + Tema Binário sincronizado
  const [activePreset, setActivePreset] = useState<SoftUIThemePreset>(() => {
    const savedPreset = readBrowserState('mytts_preset');
    if (savedPreset) {
      return normalizeThemePreset(savedPreset);
    }
    const savedTheme = readBrowserState('mytts_theme');
    return savedTheme === 'light' ? 'slate' : 'obsidian';
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = readBrowserState('mytts_theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    const savedPreset = readBrowserState('mytts_preset');
    return normalizeThemePreset(savedPreset) === 'slate' ? 'light' : 'dark';
  });

  const handleSelectPreset = (nextPreset: SoftUIThemePreset): void => {
    const normalized = normalizeThemePreset(nextPreset);
    setActivePreset(normalized);
    setTheme(SOFT_UI_PRESETS[normalized].mode);
  };

  const handleToggleBinaryTheme = (): void => {
    if (theme === 'dark') {
      setActivePreset('slate');
      setTheme('light');
    } else {
      setActivePreset('obsidian');
      setTheme('dark');
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-preset', activePreset);
    document.body.setAttribute('data-preset', activePreset);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    const metaColor = document.querySelector('meta[name="color-scheme"]');
    if (metaColor) {
      metaColor.setAttribute('content', theme);
    }
    persistBrowserState('mytts_theme', theme);
    persistBrowserState('mytts_preset', activePreset);
  }, [theme, activePreset]);

  // Listener para sincronizar tema e atalhos globais (Ctrl+K, Ctrl+B, Ctrl+H)
  useEffect(() => {
    const syncThemeFromStorage = () => {
      const savedPreset = readBrowserState('mytts_preset');
      const normalizedPreset = normalizeThemePreset(savedPreset);
      setActivePreset(normalizedPreset);

      const saved = readBrowserState('mytts_theme');
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
      } else {
        setTheme(SOFT_UI_PRESETS[normalizedPreset].mode);
      }
    };
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleLeftSidebar();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleToggleRightHistory();
      }
    };
    window.addEventListener('storage', syncThemeFromStorage);
    window.addEventListener('mytts-theme-change', syncThemeFromStorage);
    window.addEventListener('mytts-theme-changed', syncThemeFromStorage);
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => {
      window.removeEventListener('storage', syncThemeFromStorage);
      window.removeEventListener('mytts-theme-change', syncThemeFromStorage);
      window.removeEventListener('mytts-theme-changed', syncThemeFromStorage);
      window.removeEventListener('keydown', onGlobalKeyDown);
    };
  }, [handleToggleLeftSidebar, handleToggleRightHistory]);

  // Debate Studio State
  const [documentText, setDocumentText] = useState<string>(SAMPLE_DOCUMENTS[0].content);
  const [config, setConfig] = useState<DebateConfig>({
    language: 'pt-BR',
    audienceLevel: 'intermediate',
    tensionIntensity: 'provocative',
    speakers: LANGUAGE_OPTIONS[0].defaultSpeakers,
    maxTurns: 6,
  });

  const [script, setScript] = useState<DebateScript>(INITIAL_PRESET_SCRIPTS['pt-BR']);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Singleton Gapless Audio Player instance para o estúdio dialético
  const player = useMemo(() => new GaplessAudioPlayer(), []);
  const [playerCurrentTurn, setPlayerCurrentTurn] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Assinatura do player
  useEffect(() => {
    const unsub = player.subscribe((state) => {
      setPlayerCurrentTurn(state.currentTurnIndex);
      setIsPlaying(state.isPlaying);
      setCurrentTime(state.currentTime);
      setDuration(state.duration);
      setPlaybackRate(state.playbackRate);
    });
    return () => unsub();
  }, [player]);

  // Sincroniza a voz global com o turno de debate em foco quando estiver tocando
  useEffect(() => {
    if (!isPlaying) return;
    const turnVoiceId = script?.turns?.[playerCurrentTurn]?.voice_id;
    if (!turnVoiceId) return;
    const matched = GEMINI_VOICES.find((v) => v.id === turnVoiceId);
    if (matched && matched.id !== selectedVoice.id) {
      setSelectedVoice(matched);
    }
  }, [playerCurrentTurn, isPlaying, script, selectedVoice.id]);

  const syncTurnsToPlayer = (updatedScript: DebateScript): void => {
    const readyTurns = updatedScript.turns
      .filter((t) => Boolean(t.audioBase64))
      .map((t) => ({
        turnNumber: t.turn,
        audioBase64: t.audioBase64!,
        preDelayMs: t.prosody.pre_delay_ms,
      }));

    if (readyTurns.length > 0) {
      player.setTurns(readyTurns);
    }
  };

  const synthesizeTurns = async (targetScript: DebateScript): Promise<void> => {
    setIsSynthesizing(true);
    setGlobalError(null);

    const updatedTurns = [...targetScript.turns];
    const CONCURRENCY = 2;

    for (let batchStart = 0; batchStart < targetScript.turns.length; batchStart += CONCURRENCY) {
      const batchIndices = Array.from(
        { length: Math.min(CONCURRENCY, targetScript.turns.length - batchStart) },
        (_, offset) => batchStart + offset
      );

      await Promise.all(
        batchIndices.map(async (i) => {
          const turn = targetScript.turns[i];
          try {
            const cacheKey = generateAudioCacheKey({
              type: 'turn',
              text: turn.text || turn.clean_text || '',
              language: targetScript.language,
              voiceId: turn.voice_id,
              speed: turn.prosody?.speech_rate || 1.0,
              emotion: turn.emotion || 'thoughtful',
            });

            const cachedOrFresh = await synthesizeWithCache({
              endpoint: '/api/synthesize-turn',
              body: {
                turn,
                speakerName: turn.speaker,
                voiceId: turn.voice_id,
                language: targetScript.language,
              },
              cacheKey,
              metadata: {
                language: targetScript.language,
                voiceId: turn.voice_id,
                speed: turn.prosody?.speech_rate || 1.0,
                emotion: turn.emotion || 'thoughtful',
              },
            });

            updatedTurns[i] = {
              ...turn,
              audioBase64: cachedOrFresh.audioBase64,
              audioDurationSec: cachedOrFresh.durationSec,
              audioStatus: 'ready',
            };
          } catch (e: unknown) {
            console.warn(`Turn ${turn.turn} synthesis error:`, e);
            updatedTurns[i] = {
              ...turn,
              audioStatus: 'error',
              errorMessage: e instanceof Error ? e.message : 'Erro na síntese do turno.',
            };
          }
        })
      );

      const intermediateScript = { ...targetScript, turns: [...updatedTurns] };
      setScript(intermediateScript);
      syncTurnsToPlayer(intermediateScript);
    }

    setIsSynthesizing(false);
  };

  // Geração de Conversa / Debate (Unificada para Debate, Podcast, Conversa de Bar e Mesa de Jantar)
  const handleGenerateDebateWithCustomSpeakers = async (
    customSpeakers: [SpeakerProfile, SpeakerProfile] = config.speakers,
    tensionIntensity: 'friendly' | 'balanced' | 'provocative' | 'reflective' = config.tensionIntensity,
    format: ConversationFormat = config.format || 'debate',
    language: LanguageCode = config.language
  ): Promise<void> => {
    setIsGenerating(true);
    setGlobalError(null);
    try {
      const data = await requestDebateScript({
        documentText,
        language,
        audienceLevel: config.audienceLevel,
        tensionIntensity,
        format,
        speakers: customSpeakers,
        maxTurns: config.maxTurns,
      });

      if (!data.ok || !data.success || !data.script) {
        throw new Error(data.error || 'Falha na geração do roteiro.');
      }

      setScript(data.script);
      saveDebateSessionFromScript(data.script, { format, documentText, userId: userSession.uid });
      await synthesizeTurns(data.script);
    } catch (err: unknown) {
      console.error(err);
      setGlobalError(err instanceof Error ? err.message : 'Erro ao gerar o debate dialético.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSynthesizeSingleTurn = async (turnIndex: number): Promise<void> => {
    const turn = script.turns[turnIndex];
    try {
      const cacheKey = generateAudioCacheKey({
        type: 'turn',
        text: turn.text || turn.clean_text || '',
        language: script.language,
        voiceId: turn.voice_id,
        speed: turn.prosody?.speech_rate || 1.0,
        emotion: turn.emotion || 'thoughtful',
      });

      const cachedOrFresh = await synthesizeWithCache({
        endpoint: '/api/synthesize-turn',
        body: {
          turn,
          speakerName: turn.speaker,
          voiceId: turn.voice_id,
          language: script.language,
        },
        cacheKey,
        bypassCache: true,
        metadata: {
          language: script.language,
          voiceId: turn.voice_id,
          speed: turn.prosody?.speech_rate || 1.0,
          emotion: turn.emotion || 'thoughtful',
        },
      });

      const updatedTurns = [...script.turns];
      updatedTurns[turnIndex] = {
        ...turn,
        audioBase64: cachedOrFresh.audioBase64,
        audioDurationSec: cachedOrFresh.durationSec,
        audioStatus: 'ready',
      };
      const updatedScript = { ...script, turns: updatedTurns };
      setScript(updatedScript);
      syncTurnsToPlayer(updatedScript);
    } catch (e: unknown) {
      setGlobalError(e instanceof Error ? e.message : 'Erro ao sintetizar áudio do turno.');
      speakBrowserFallback(turn.clean_text || turn.text, {
        lang: script.language || 'pt-BR',
        rate: turn.prosody?.speech_rate || 1.0,
        voiceId: turn.voice_id,
      });
    }
  };

  const handlePlayDebateTurn = async (
    turnIndex: number,
    overrideVoiceId?: string
  ): Promise<void> => {
    const rawTurn = script.turns[turnIndex];
    if (!rawTurn) return;
    const turn = overrideVoiceId
      ? { ...rawTurn, voice_id: overrideVoiceId, audioBase64: undefined }
      : rawTurn;
    stopBrowserSpeech();
    setPlayerCurrentTurn(turnIndex);

    if (turn.audioBase64) {
      const readyTurns = script.turns.filter((t) => Boolean(t.audioBase64));
      const readyIdx = readyTurns.findIndex((t) => t.turn === turn.turn);
      await player.play(readyIdx >= 0 ? readyIdx : 0);
      return;
    }

    try {
      const cacheKey = generateAudioCacheKey({
        type: 'turn',
        text: turn.text || turn.clean_text || '',
        language: script.language,
        voiceId: turn.voice_id,
        speed: turn.prosody?.speech_rate || 1.0,
        emotion: turn.emotion || 'thoughtful',
      });

      const cachedOrFresh = await synthesizeWithCache({
        endpoint: '/api/synthesize-turn',
        body: {
          turn,
          speakerName: turn.speaker,
          voiceId: turn.voice_id,
          language: script.language,
        },
        cacheKey,
        metadata: {
          language: script.language,
          voiceId: turn.voice_id,
          speed: turn.prosody?.speech_rate || 1.0,
          emotion: turn.emotion || 'thoughtful',
        },
      });

      const updatedTurns = [...script.turns];
      updatedTurns[turnIndex] = {
        ...turn,
        audioBase64: cachedOrFresh.audioBase64,
        audioDurationSec: cachedOrFresh.durationSec,
        audioStatus: 'ready',
      };
      const updatedScript = { ...script, turns: updatedTurns };
      setScript(updatedScript);
      syncTurnsToPlayer(updatedScript);

      const readyTurns = updatedTurns.filter((t) => Boolean(t.audioBase64));
      const readyIdx = readyTurns.findIndex((t) => t.turn === turn.turn);
      await player.play(readyIdx >= 0 ? readyIdx : 0);
    } catch (e: unknown) {
      setGlobalError(e instanceof Error ? e.message : 'Erro ao sintetizar turno (usando voz local do navegador).');
      speakBrowserFallback(turn.clean_text || turn.text, {
        lang: script.language || 'pt-BR',
        rate: turn.prosody?.speech_rate || 1.0,
        voiceId: turn.voice_id,
      });
    }
  };

  const handleUpdateTurnText = (turnIndex: number, newText: string): void => {
    const updatedTurns = [...script.turns];
    updatedTurns[turnIndex] = {
      ...updatedTurns[turnIndex],
      text: newText,
      clean_text: newText.replace(/<[^>]+>/g, '').replace(/\|[^|]+\|/g, '').trim(),
      audioBase64: undefined,
      audioStatus: 'idle',
    };
    setScript({ ...script, turns: updatedTurns });
  };

  const handleUpdateTurnVoice = (turnIndex: number, newVoiceId: string): void => {
    const updatedTurns = [...script.turns];
    updatedTurns[turnIndex] = {
      ...updatedTurns[turnIndex],
      voice_id: newVoiceId,
      audioBase64: undefined,
      audioStatus: 'idle',
    };
    setScript({ ...script, turns: updatedTurns });

    const matchedVoice = GEMINI_VOICES.find((v) => v.id === newVoiceId);
    if (matchedVoice) {
      setSelectedVoice(matchedVoice);
    }
    void handlePlayDebateTurn(turnIndex, newVoiceId);
  };

  const handleUpdateDebateConfig = (nextConfig: DebateConfig): void => {
    setConfig(nextConfig);
    setScript((prev) => {
      if (!prev || !prev.turns) return prev;
      const oldSpk0Name = prev.speakers[0]?.name;
      const oldSpk1Name = prev.speakers[1]?.name;
      const nextSpeakers: [SpeakerProfile, SpeakerProfile] = [
        {
          ...(prev.speakers[0] || nextConfig.speakers[0]),
          name: nextConfig.speakers[0].name,
          voiceId: nextConfig.speakers[0].voiceId,
          roleTitle: nextConfig.speakers[0].roleTitle,
        },
        {
          ...(prev.speakers[1] || nextConfig.speakers[1]),
          name: nextConfig.speakers[1].name,
          voiceId: nextConfig.speakers[1].voiceId,
          roleTitle: nextConfig.speakers[1].roleTitle,
        },
      ];
      const updatedTurns = prev.turns.map((t, idx) => {
        const isSpeaker0 =
          t.speaker === oldSpk0Name || (t.speaker !== oldSpk1Name && idx % 2 === 0);
        const targetSpk = isSpeaker0 ? nextSpeakers[0] : nextSpeakers[1];
        const voiceChanged = t.voice_id !== targetSpk.voiceId;
        return {
          ...t,
          speaker: targetSpk.name,
          voice_id: targetSpk.voiceId,
          audioBase64: voiceChanged ? undefined : t.audioBase64,
          audioStatus: voiceChanged ? ('idle' as const) : t.audioStatus,
        };
      });
      return {
        ...prev,
        language: nextConfig.language,
        speakers: nextSpeakers,
        turns: updatedTurns,
      };
    });
  };

  const mainCanvasRef = useRef<HTMLElement | null>(null);
  const activeTurn = script?.turns[playerCurrentTurn];
  const activeSpeaker = activeTurn
    ? script?.speakers.find((s) => s.name === activeTurn.speaker) || script?.speakers[0]
    : script?.speakers[0];

  const handleChangeFavoriteVoice = useCallback((lang: 'en' | 'it' | 'ja', voiceId: string) => {
    setFavoriteVoicesByLang((prev) => {
      const next = { ...prev, [lang]: voiceId };
      saveFavoriteVoicesByLanguage(next);
      window.dispatchEvent(new CustomEvent('mytts-favorite-voices-changed', { detail: next }));
      return next;
    });
  }, []);

  const handleNavigateTab = useCallback(
    (tab: AppTab | 'reader' | 'debate', subTab?: VoiceConfigSubTab): void => {
      let targetTab: AppTab = 'polyglot';
      if (tab === 'reader') {
        targetTab = 'voices';
        setVoiceConfigSubTab('solo');
      } else if (tab === 'debate') {
        targetTab = 'voices';
        setVoiceConfigSubTab('debate');
      } else {
        targetTab = tab;
        if (tab === 'voices' && subTab) {
          setVoiceConfigSubTab(subTab);
        }
      }

      if (isPlaying && (targetTab !== 'voices' || subTab === 'solo')) {
        player.pause();
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
            .catch(() => {});
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
    [isPlaying, player]
  );

  // Handlers da HistorySidebar Direita
  const handleConversationsChanged = useCallback(
    (nextConvs: SavedConversation[], activeId: string) => {
      setConversations(nextConvs);
      setActiveConversationId(activeId);
    },
    []
  );

  const handleSelectHistoryItem = useCallback(
    (item: UnifiedHistoryItem) => {
      if (item.kind === 'chat') {
        setSelectedConversationId(item.id);
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
        setScript((prev) => ({
          ...prev,
          title: item.debateSession!.title,
          topicSummary: item.debateSession!.documentPreview || prev.topicSummary,
          language: item.debateSession!.language as LanguageCode,
          turns: restoredTurns,
        }));
        handleNavigateTab('voices', 'debate');
      } else if (item.kind === 'flashcards') {
        setSelectedStudyCardId(item.id);
        handleNavigateTab('study');
      }
    },
    [handleNavigateTab]
  );

  const handleTogglePinHistoryItem = useCallback(async (item: UnifiedHistoryItem) => {
    if (item.kind === 'chat' && item.conversation) {
      const updated: SavedConversation = {
        ...item.conversation,
        pinned: !item.conversation.pinned,
      };
      const saved = await requestSaveUserConversation(updated);
      if (saved) {
        setConversations((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      }
    } else if (item.kind === 'debate_tts') {
      togglePinDebateSession(item.id);
    }
  }, []);

  const handleRenameHistoryItem = useCallback(
    async (item: UnifiedHistoryItem, newTitle: string) => {
      if (item.kind === 'chat' && item.conversation) {
        const updated: SavedConversation = {
          ...item.conversation,
          title: newTitle,
          customTitle: true,
        };
        const saved = await requestSaveUserConversation(updated);
        if (saved) {
          setConversations((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        }
      } else if (item.kind === 'debate_tts') {
        renameDebateSession(item.id, newTitle);
      }
    },
    []
  );

  const handleDeleteHistoryItem = useCallback(async (item: UnifiedHistoryItem) => {
    if (item.kind === 'chat') {
      const ok = await requestDeleteUserConversation(item.id);
      if (ok) {
        setConversations((prev) => prev.filter((c) => c.id !== item.id));
      }
    } else if (item.kind === 'debate_tts') {
      deleteDebateSession(item.id);
    } else if (item.kind === 'flashcards') {
      deleteFlashcardFromDeck(item.id);
    }
  }, []);

  const handleClearUnpinnedHistory = useCallback(async () => {
    await requestClearUnpinnedConversations();
    const nextConvs = await requestListUserConversations();
    setConversations(nextConvs);
    clearUnpinnedDebateSessions();
  }, []);

  return (
    <div
      data-state="idle"
      aria-busy={isGenerating || isSynthesizing}
      style={
        {
          '--left-sidebar-w': isLeftSidebarCollapsed ? '68px' : '280px',
          '--right-sidebar-w': isRightHistoryOpen ? '320px' : '0px',
        } as React.CSSProperties
      }
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-amber-500/20 selection:text-amber-200"
    >
      {/* 1. Sidebar Esquerda Colapsável (280px <-> 68px Icon Rail Mode + Popover de Conta) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleNavigateTab}
        selectedVoice={selectedVoice}
        onSelectVoice={setSelectedVoice}
        isOpenMobile={isMobileSidebarOpen}
        onToggleMobile={() => setIsMobileSidebarOpen((prev) => !prev)}
        isCollapsed={isLeftSidebarCollapsed}
        onToggleCollapse={handleToggleLeftSidebar}
        onOpenVoiceLibrary={() => handleNavigateTab('voices', 'catalog')}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        flashcardCount={flashcards.length}
        theme={theme}
        onToggleTheme={handleToggleBinaryTheme}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
      />

      {/* 2. Área de Trabalho Central (Acoplada às larguras dinâmicas das 2 Sidebars) */}
      <div className="flex-1 flex flex-col lg:pl-[var(--left-sidebar-w)] lg:pr-[var(--right-sidebar-w)] transition-[padding] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] min-h-screen min-w-0 max-w-full overflow-x-clip">
        <MobileAppHeader
          activeTab={activeTab}
          selectedVoice={selectedVoice}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onToggleHistorySidebar={handleToggleRightHistory}
          onNavigateTab={handleNavigateTab}
          historyCount={unifiedHistoryItems.length}
        />

        {/* Banner de Erro Global */}
        {globalError && (
          <div className="max-w-4xl mx-auto w-full px-4 pt-4" role="alert">
            <div className="bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <GoogleIcon name="error" size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{globalError}</span>
              </div>
              <button
                type="button"
                onClick={() => setGlobalError(null)}
                className="text-rose-700 hover:text-rose-900 dark:text-rose-400 dark:hover:text-white font-mono text-xs cursor-pointer"
              >
                dispensar
              </button>
            </div>
          </div>
        )}

        {/* 3. Canvas de Conteúdo por Módulo (Alinhado à Régua Canônica max-w-[1440px]) */}
        <main ref={mainCanvasRef} tabIndex={-1} className="flex-1 flex flex-col outline-none">
          <nav
            aria-label="Caminho de navegação"
            className="hidden sm:flex w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 pt-3 pb-1 items-center justify-between text-xs text-secondary"
          >
            <ol role="list" className="breadcrumb-list">
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigateTab('polyglot')}
                  className="hover:text-primary transition-colors cursor-pointer font-medium"
                >
                  MyTTS Studio
                </button>
              </li>
              <li aria-current="page" className="text-primary font-semibold">
                {TAB_BREADCRUMB_LABELS[activeTab]}
              </li>
            </ol>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-secondary hidden md:inline tabular-nums">
                Voz Ativa: <strong className="text-primary">{selectedVoice.name}</strong>
              </span>
              <button
                type="button"
                onClick={handleToggleRightHistory}
                aria-expanded={isRightHistoryOpen}
                aria-label="Alternar barra lateral direita de histórico (Ctrl + H)"
                title="Alternar Histórico & Linha do Tempo de Sessões (Ctrl + H)"
                className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isRightHistoryOpen
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'btn-matte-dark text-secondary hover:text-primary border-slate-800'
                }`}
              >
                <GoogleIcon
                  name={isRightHistoryOpen ? 'panel_right_close' : 'history'}
                  size={15}
                  className="text-amber-400"
                />
                <span>Histórico</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 tabular-nums">
                  {unifiedHistoryItems.length}
                </span>
              </button>
            </div>
          </nav>

          {/* Módulo Principal (#1): Chat Poliglota Multimodal (EN, IT, JA) */}
          <div
            hidden={activeTab !== 'polyglot'}
            aria-hidden={activeTab !== 'polyglot'}
            className={activeTab === 'polyglot' ? 'contents' : 'hidden'}
          >
            <PolyglotChatStudio
              globalVoice={selectedVoice}
              onSyncGlobalVoice={setSelectedVoice}
              selectedConversationId={selectedConversationId}
              newConversationSignal={newConversationSignal}
              onConversationsChanged={handleConversationsChanged}
              onOpenStudyTab={() => handleNavigateTab('study')}
              onOpenVoicesConfigTab={() => handleNavigateTab('voices', 'catalog')}
              favoriteVoicesByLang={favoriteVoicesByLang}
              onSendToCreationStudio={(textToRender, renderMode) => {
                if (textToRender) {
                  setDocumentText(textToRender);
                }
                setStudioRenderMode(renderMode);
                if (renderMode === 'solo') {
                  handleNavigateTab('voices', 'solo');
                } else {
                  setConfig((prev) => ({ ...prev, format: renderMode }));
                  handleNavigateTab('voices', 'debate');
                }
              }}
            />
          </div>

          {/* Módulo 2: Configuração de Vozes (Catálogo & Favoritas + Estúdio Solo + Debate/Conversa) */}
          {activeTab === 'voices' && (
            <VoiceConfigWorkspace
              activeSubTab={voiceConfigSubTab}
              onChangeSubTab={setVoiceConfigSubTab}
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoice}
              favoriteVoicesByLang={favoriteVoicesByLang}
              onChangeFavoriteVoice={handleChangeFavoriteVoice}
              text={documentText}
              onChangeText={setDocumentText}
              player={player}
              isPlaying={isPlaying}
              playerCurrentTurn={playerCurrentTurn}
              script={script}
              setScript={setScript}
              debateConfig={config}
              onChangeDebateConfig={handleUpdateDebateConfig}
              studioRenderMode={studioRenderMode}
              onChangeStudioRenderMode={setStudioRenderMode}
              onGenerateDebate={handleGenerateDebateWithCustomSpeakers}
              isGeneratingDebate={isGenerating}
              isSynthesizingDebate={isSynthesizing}
              onSynthesizeSingleTurn={handleSynthesizeSingleTurn}
              onPlayTurn={handlePlayDebateTurn}
              onUpdateTurnText={handleUpdateTurnText}
              onUpdateTurnVoice={handleUpdateTurnVoice}
              onOpenPolyglotTab={() => handleNavigateTab('polyglot')}
            />
          )}

          {/* Módulo 3: FastChunks (Treinamento Lexical de Idiomas) */}
          {activeTab === 'chunks' && <FastChunkAudioApp />}

          {/* Módulo 4: Área de Estudo & Flashcards Deck (Zero-Friction Import + Arena 3D TTS) */}
          {activeTab === 'study' && (
            <StudyArenaView
              selectedVoice={selectedVoice}
              initialCardId={selectedStudyCardId}
            />
          )}
        </main>

        {/* Dock de Áudio Inferior (Exibido com roteiro ativo na aba Configuração de Vozes) */}
        {activeTab === 'voices' && (voiceConfigSubTab === 'debate' || Boolean(script?.turns?.length)) && (
          <BottomAudioDock
            player={player}
            script={script}
            isPlaying={isPlaying}
            onTogglePlay={() => {
              const ready = script?.turns.filter((t) => Boolean(t.audioBase64)).length || 0;
              if (ready === 0 && script) {
                handlePlayDebateTurn(playerCurrentTurn);
              } else {
                player.togglePlay();
              }
            }}
            currentTime={currentTime}
            duration={duration}
            onSeek={(t) => player.seek(t)}
            playbackRate={playbackRate}
            onChangePlaybackRate={(r) => player.setSpeed(r)}
            currentSpeaker={activeSpeaker}
            currentTurn={activeTurn}
            currentTurnText={activeTurn?.text}
            turnIndex={playerCurrentTurn}
            totalTurns={script?.turns.length || 0}
            language={config.language}
          />
        )}
      </div>

      {/* 4. Sidebar Direita Colapsável de Histórico e Linha do Tempo de Sessões (320px <-> 0px) */}
      <HistorySidebar
        isOpen={isRightHistoryOpen}
        onClose={() => {
          setIsRightHistoryOpen(false);
          persistBrowserState('mytts_history_open', 'false');
        }}
        items={unifiedHistoryItems}
        activeConversationId={activeConversationId}
        isCloudSynced={userSession.isGoogleAuthenticated}
        onSelectHistoryItem={handleSelectHistoryItem}
        onNewConversation={() => {
          setSelectedConversationId(null);
          setNewConversationSignal((prev) => prev + 1);
          handleNavigateTab('polyglot');
        }}
        onTogglePin={handleTogglePinHistoryItem}
        onRenameItem={handleRenameHistoryItem}
        onDeleteItem={handleDeleteHistoryItem}
        onClearUnpinned={handleClearUnpinnedHistory}
      />

      {/* 5. Modal Unificado de Login Google / Sessão / Diagnóstico TTS */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Modal de Arquitetura e Inspeção */}
      {activeTab === 'architecture' && (
        <ArchitectureModal onClose={() => setActiveTab('polyglot')} />
      )}

      {/* Command Palette Modal Tátil (Ctrl + K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={handleNavigateTab}
        onSelectVoice={(v) => setSelectedVoice(v)}
        currentVoice={selectedVoice}
        onToggleLeftSidebar={handleToggleLeftSidebar}
        onToggleRightHistory={handleToggleRightHistory}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        historyItems={unifiedHistoryItems}
        onSelectHistoryItem={handleSelectHistoryItem}
      />
    </div>
  );
}

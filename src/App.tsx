import { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar, AppTab } from './components/Sidebar';
import { StudioWorkspace } from './components/StudioWorkspace';
import { PolyglotChatStudio } from './components/PolyglotChatStudio';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { VoiceLibrary } from './components/VoiceLibraryModal';
import { DocumentInputSection } from './components/DocumentInputSection';
import { DebateConfigPanel } from './components/DebateConfigPanel';
import { ScriptViewer } from './components/ScriptViewer';
import { FastChunkAudioApp } from './components/FastChunkAudioApp';
import { BottomAudioDock } from './components/BottomAudioDock';
import { ArchitectureModal } from './components/ArchitectureModal';
import { DebateConfig, DebateScript, SpeakerProfile } from './types/debate';
import { LANGUAGE_OPTIONS, SAMPLE_DOCUMENTS, INITIAL_PRESET_SCRIPTS } from './data/sampleDebates';
import { GaplessAudioPlayer } from './utils/audioEngine';
import { VoiceProfile, GEMINI_VOICES } from './types/voices';
import { requestDebateScript } from './services/apiClient';
import { generateAudioCacheKey, synthesizeWithCache } from './utils/audioCache';
import { persistBrowserState, readBrowserState } from './services/polyglotClient';
import { SOFT_UI_PRESETS } from './config/tokens';
import type { SoftUIThemePreset } from './types';
import { AlertCircle, Menu } from 'lucide-react';

// Orquestrador principal do MyTTS Studio (Chat Poliglota como página principal e sincronização global de voz por Card)
export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('polyglot');
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile>(GEMINI_VOICES[0]); // Puck default
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Preset Soft UI v4.5 (obsidian | slate | moss | sapphire) + Tema Binário sincronizado
  const [activePreset, setActivePreset] = useState<SoftUIThemePreset>(() => {
    const savedPreset = readBrowserState('mytts_preset') as SoftUIThemePreset | null;
    if (savedPreset && savedPreset in SOFT_UI_PRESETS) {
      return savedPreset;
    }
    const savedTheme = readBrowserState('mytts_theme');
    return savedTheme === 'light' ? 'slate' : 'obsidian';
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = readBrowserState('mytts_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  const handleSelectPreset = (nextPreset: SoftUIThemePreset): void => {
    setActivePreset(nextPreset);
    setTheme(SOFT_UI_PRESETS[nextPreset].mode);
  };

  const handleToggleBinaryTheme = (): void => {
    if (theme === 'dark') {
      const nextLightPreset = activePreset === 'obsidian' ? 'slate' : activePreset;
      setActivePreset(nextLightPreset);
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
    persistBrowserState('mytts_theme', theme);
    persistBrowserState('mytts_preset', activePreset);
  }, [theme, activePreset]);

  // Listener para sincronizar tema e atalho global Ctrl + K / Cmd + K
  useEffect(() => {
    const syncThemeFromStorage = () => {
      const saved = readBrowserState('mytts_theme');
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
      }
      const savedPreset = readBrowserState('mytts_preset') as SoftUIThemePreset | null;
      if (savedPreset && savedPreset in SOFT_UI_PRESETS) {
        setActivePreset(savedPreset);
      }
    };
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('storage', syncThemeFromStorage);
    window.addEventListener('mytts-theme-change', syncThemeFromStorage);
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => {
      window.removeEventListener('storage', syncThemeFromStorage);
      window.removeEventListener('mytts-theme-change', syncThemeFromStorage);
      window.removeEventListener('keydown', onGlobalKeyDown);
    };
  }, []);

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
              text: turn.clean_text || turn.text,
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

  // Geração de Debate Dialético (Unificada para Custom Speakers ou Config Padrão)
  const handleGenerateDebateWithCustomSpeakers = async (
    customSpeakers: [SpeakerProfile, SpeakerProfile] = config.speakers,
    tensionIntensity: 'friendly' | 'balanced' | 'provocative' | 'reflective' = config.tensionIntensity
  ): Promise<void> => {
    setIsGenerating(true);
    setGlobalError(null);
    try {
      const data = await requestDebateScript({
        documentText,
        language: config.language,
        audienceLevel: config.audienceLevel,
        tensionIntensity,
        speakers: customSpeakers,
        maxTurns: config.maxTurns,
      });

      if (!data.ok || !data.success || !data.script) {
        throw new Error(data.error || 'Falha na geração do roteiro.');
      }

      setScript(data.script);
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
        text: turn.clean_text || turn.text,
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
    } catch (e: unknown) {
      setGlobalError(e instanceof Error ? e.message : 'Erro ao sintetizar áudio do turno.');
    }
  };

  const handleUpdateTurnText = (turnIndex: number, newText: string): void => {
    const updatedTurns = [...script.turns];
    updatedTurns[turnIndex] = {
      ...updatedTurns[turnIndex],
      text: newText,
      clean_text: newText.replace(/<[^>]+>/g, '').replace(/\|[^|]+\|/g, '').trim(),
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
  };

  const mainCanvasRef = useRef<HTMLElement | null>(null);
  const activeTurn = script?.turns[playerCurrentTurn];
  const activeSpeaker = activeTurn
    ? script?.speakers.find((s) => s.name === activeTurn.speaker) || script?.speakers[0]
    : script?.speakers[0];

  const handleNavigateTab = (tab: AppTab): void => {
    if (isPlaying && tab === 'reader') {
      player.pause();
    }
    const docWithTransition = document as Document & {
      startViewTransition?: (cb: () => void) => { finished?: Promise<void> };
    };
    if (docWithTransition.startViewTransition) {
      const transition = docWithTransition.startViewTransition(() => setActiveTab(tab));
      if (transition && transition.finished) {
        transition.finished.then(() => {
          mainCanvasRef.current?.focus({ preventScroll: true });
        }).catch(() => {});
      } else {
        setTimeout(() => mainCanvasRef.current?.focus({ preventScroll: true }), 50);
      }
    } else {
      setActiveTab(tab);
      setTimeout(() => mainCanvasRef.current?.focus({ preventScroll: true }), 0);
    }
  };

  return (
    <div
      data-state="idle"
      aria-busy={isGenerating || isSynthesizing}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-amber-500/20 selection:text-amber-200"
    >
      
      {/* 1. Sidebar Persistente Minimalista (Cinza Monolítico / Ad Lucem) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleNavigateTab}
        selectedVoice={selectedVoice}
        onSelectVoice={setSelectedVoice}
        isOpenMobile={isMobileSidebarOpen}
        onToggleMobile={() => setIsMobileSidebarOpen((prev) => !prev)}
        onOpenVoiceLibrary={() => handleNavigateTab('voices')}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleBinaryTheme}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
      />

      {/* 2. Área de Trabalho Principal (com margem para sidebar no desktop) */}
      <div className="flex-1 flex flex-col lg:pl-72 min-h-screen">
        
        {/* Header Mobile com Hamburger e Atalho Rápido de Abas */}
        <header className="px-4 py-2.5 border-b border-slate-800/80 dock-matte flex flex-col gap-2 lg:hidden sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                <span>MyTTS</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                  Studio
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer"
                title="Abrir Paleta de Comandos (Ctrl+K)"
              >
                Ctrl+K
              </button>
              <div
                className={`w-6 h-6 rounded-md bg-gradient-to-tr ${selectedVoice.avatarColor} flex items-center justify-center text-white text-[10px] font-bold`}
              >
                {selectedVoice.name[0]}
              </div>
              <span className="text-xs font-bold text-slate-300 font-mono">
                {selectedVoice.name}
              </span>
            </div>
          </div>

          {/* Navegação Horizontal Rápida no Mobile */}
          <nav aria-label="Navegação rápida mobile" className="pill-nav-shell flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'polyglot', label: 'Poliglota' },
                { id: 'reader', label: 'Estúdio' },
                { id: 'debate', label: 'Debate (2)' },
                { id: 'chunks', label: 'FastChunks' },
                { id: 'voices', label: 'Vozes' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                data-active={activeTab === item.id}
                onClick={() => handleNavigateTab(item.id)}
                className="pill-nav-item px-3 py-1 text-[11px] font-semibold whitespace-nowrap cursor-pointer shrink-0"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        {/* Banner de Erro Global */}
        {globalError && (
          <div className="max-w-4xl mx-auto w-full px-4 pt-4" role="alert">
            <div className="bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{globalError}</span>
              </div>
              <button
                onClick={() => setGlobalError(null)}
                className="text-rose-700 hover:text-rose-900 dark:text-rose-400 dark:hover:text-white font-mono text-[11px] cursor-pointer"
              >
                dispensar
              </button>
            </div>
          </div>
        )}

        {/* 3. Canvas de Conteúdo por Módulo */}
        <main ref={mainCanvasRef} tabIndex={-1} className="flex-1 flex flex-col outline-none">
          {/* Módulo Principal (#1): Chat Poliglota Multimodal (EN, IT, JA) com atalho Mic/Live API */}
          {activeTab === 'polyglot' && (
            <PolyglotChatStudio
              globalVoice={selectedVoice}
              onSyncGlobalVoice={setSelectedVoice}
            />
          )}

          {/* Módulo 2: Central de Criação Unificada (Solo + Debate) */}
          {activeTab === 'reader' && (
            <StudioWorkspace
              text={documentText}
              onChangeText={setDocumentText}
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoice}
              player={player}
              isPlaying={isPlaying}
              playerCurrentTurn={playerCurrentTurn}
              script={script}
              setScript={setScript}
              onGenerateDebate={handleGenerateDebateWithCustomSpeakers}
              isGeneratingDebate={isGenerating}
              isSynthesizingDebate={isSynthesizing}
              onSynthesizeSingleTurn={handleSynthesizeSingleTurn}
              onUpdateTurnText={handleUpdateTurnText}
              onUpdateTurnVoice={handleUpdateTurnVoice}
            />
          )}

          {/* Módulo 3: Estúdio de Debate com 2 Vozes */}
          {activeTab === 'debate' && (
            <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-36 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    Estúdio de Debate Dialético (2 Vozes)
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Crie discussões estimulantes e embates de ideias a partir de documentos.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Dual Speaker TTS (Kore &amp; Puck)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <DocumentInputSection
                    currentLanguage={config.language}
                    textInput={documentText}
                    onChangeText={setDocumentText}
                    onGenerateDebate={() => handleGenerateDebateWithCustomSpeakers()}
                    isGenerating={isGenerating}
                  />
                  <DebateConfigPanel config={config} onChangeConfig={setConfig} />
                </div>

                <div className="lg:col-span-7 flex flex-col gap-4">
                  <ScriptViewer
                    script={script}
                    currentTurnIndex={playerCurrentTurn}
                    isPlaying={isPlaying}
                    onPlayTurn={(idx) => player.play(idx)}
                    onSynthesizeTurn={handleSynthesizeSingleTurn}
                    onUpdateTurnText={handleUpdateTurnText}
                    onUpdateTurnVoice={handleUpdateTurnVoice}
                    isSynthesizing={isSynthesizing}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Módulo 4: FastChunks (Treinamento Lexical de Idiomas) */}
          {activeTab === 'chunks' && (
            <FastChunkAudioApp />
          )}

          {/* Módulo 5: Biblioteca de Vozes Neurais */}
          {activeTab === 'voices' && (
            <VoiceLibrary
              selectedVoice={selectedVoice}
              onSelectVoice={(v) => {
                setSelectedVoice(v);
                setActiveTab('polyglot');
              }}
            />
          )}

        </main>

        {/* Dock de Áudio Inferior (Exibido com roteiro ativo no Leitor ou Debate) */}
        {(activeTab === 'debate' || (Boolean(script?.turns?.length) && activeTab === 'reader')) && (
          <BottomAudioDock
            player={player}
            script={script}
            isPlaying={isPlaying}
            onTogglePlay={() => {
              const ready = script?.turns.filter((t) => Boolean(t.audioBase64)).length || 0;
              if (ready === 0 && script) {
                synthesizeTurns(script);
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

      {/* Modal de Arquitetura e Inspeção */}
      {activeTab === 'architecture' && (
        <ArchitectureModal onClose={() => setActiveTab('polyglot')} />
      )}

      {/* Command Palette Modal Tátil (Ctrl + K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={(tab) => {
          const docWithTransition = document as Document & {
            startViewTransition?: (cb: () => void) => void;
          };
          if (docWithTransition.startViewTransition) {
            docWithTransition.startViewTransition(() => setActiveTab(tab));
          } else {
            setActiveTab(tab);
          }
        }}
        onSelectVoice={(v) => setSelectedVoice(v)}
        currentVoice={selectedVoice}
      />
    </div>
  );
}

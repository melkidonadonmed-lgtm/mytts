import { useState, useEffect, useMemo } from 'react';
import { Sidebar, AppTab } from './components/Sidebar';
import { StudioWorkspace } from './components/StudioWorkspace';
import { PolyglotChatStudio } from './components/PolyglotChatStudio';
import { LiveVoiceMic } from './components/LiveVoiceMic';
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


export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('reader');
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

  const synthesizeTurnItem = async (
    turn: DebateScript['turns'][number],
    language: string
  ): Promise<{ audioBase64: string; durationSec?: number }> => {
    const cacheKey = generateAudioCacheKey({
      type: 'turn',
      text: `${turn.speaker}:${turn.text}`,
      language,
      voiceId: turn.voice_id,
      speed: turn.prosody?.speech_rate ?? 1.0,
      emotion: turn.emotion,
    });

    const result = await synthesizeWithCache({
      endpoint: '/api/synthesize-turn',
      body: {
        turn,
        speakerName: turn.speaker,
        voiceId: turn.voice_id,
        language,
      },
      cacheKey,
      metadata: {
        language,
        voiceId: turn.voice_id,
        speed: turn.prosody?.speech_rate ?? 1.0,
        emotion: turn.emotion,
      },
    });

    return {
      audioBase64: result.audioBase64,
      durationSec: result.durationSec,
    };
  };

  const synthesizeTurns = async (targetScript: DebateScript): Promise<void> => {
    setIsSynthesizing(true);
    setGlobalError(null);

    const updatedTurns = [...targetScript.turns];
    const concurrency = 2;
    let nextIndex = 0;

    const runWorker = async (): Promise<void> => {
      while (nextIndex < targetScript.turns.length) {
        const i = nextIndex++;
        const turn = targetScript.turns[i];
        try {
          const data = await synthesizeTurnItem(turn, targetScript.language);
          updatedTurns[i] = {
            ...turn,
            audioBase64: data.audioBase64,
            audioDurationSec: data.durationSec,
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

        const intermediateScript = { ...targetScript, turns: [...updatedTurns] };
        setScript(intermediateScript);
        syncTurnsToPlayer(intermediateScript);
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, targetScript.turns.length) },
      () => runWorker()
    );
    await Promise.all(workers);

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
      const data = await synthesizeTurnItem(turn, script.language);
      const updatedTurns = [...script.turns];
      updatedTurns[turnIndex] = {
        ...turn,
        audioBase64: data.audioBase64,
        audioDurationSec: data.durationSec,
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

  const activeTurn = script?.turns[playerCurrentTurn];
  const activeSpeaker = activeTurn
    ? script?.speakers.find((s) => s.name === activeTurn.speaker) || script?.speakers[0]
    : script?.speakers[0];

  return (
    <div data-state="idle" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-amber-500/20 selection:text-amber-200">
      
      {/* 1. Sidebar Persistente Estilo ElevenLabs */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (isPlaying && tab === 'reader') {
            player.pause();
          }
          const docWithTransition = document as Document & {
            startViewTransition?: (cb: () => void) => void;
          };
          if (docWithTransition.startViewTransition) {
            docWithTransition.startViewTransition(() => setActiveTab(tab));
          } else {
            setActiveTab(tab);
          }
        }}
        selectedVoice={selectedVoice}
        isOpenMobile={isMobileSidebarOpen}
        onToggleMobile={() => setIsMobileSidebarOpen((prev) => !prev)}
        onOpenVoiceLibrary={() => setActiveTab('voices')}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleBinaryTheme}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
      />

      {/* 2. Área de Trabalho Principal (com margem para sidebar no desktop) */}
      <div className="flex-1 flex flex-col lg:pl-72 min-h-screen">
        
        {/* Header Mobile com Hamburger */}
        <header className="h-14 px-4 border-b  bg-slate-950 flex items-center justify-between lg:hidden sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg bg-slate-900 border  text-slate-300 hover:text-white cursor-pointer"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>MyTTS</span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border  font-semibold">
                Studio
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-md surface-inset ${selectedVoice.avatarColor} flex items-center justify-center text-white text-xs font-bold`}
            >
              {selectedVoice.name[0]}
            </div>
            <span className="text-xs font-bold text-slate-300 font-mono">
              {selectedVoice.name}
            </span>
          </div>
        </header>

        {/* Banner de Erro Global */}
        {globalError && (
          <div className="max-w-4xl mx-auto w-full px-4 pt-4">
            <div className="bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{globalError}</span>
              </div>
              <button
                onClick={() => setGlobalError(null)}
                className="text-rose-700 hover:text-rose-900 dark:text-rose-400 dark:hover:text-white font-mono text-xs cursor-pointer"
              >
                dispensar
              </button>
            </div>
          </div>
        )}

        {/* 3. Canvas de Conteúdo por Módulo */}
        <main className="flex-1 flex flex-col">
          {/* Módulo 1: Central de Criação Unificada (Solo + Debate) */}
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
            />
          )}

          {/* Módulo 2: Chat Poliglota Multimodal (EN, IT, JA) */}
          {activeTab === 'polyglot' && (
            <PolyglotChatStudio />
          )}

          {/* Módulo 3: Ditado & Microfone ao Vivo */}
          {activeTab === 'mic' && (
            <LiveVoiceMic
              selectedVoice={selectedVoice}
              onSendToReader={(transcribedText) => {
                setDocumentText((prev) => (prev.trim() ? `${prev.trim()}\n\n${transcribedText}` : transcribedText));
                setActiveTab('reader');
              }}
            />
          )}

          {/* Módulo 4: Estúdio de Debate com 2 Vozes */}
          {activeTab === 'debate' && (
            <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-36 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    Estúdio de Debate Dialético (2 Vozes)
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Crie discussões estimulantes e embates de ideias a partir de documentos.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-400/10 border  px-2.5 py-1 rounded-xl">
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
                    isSynthesizing={isSynthesizing}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Módulo 5: FastChunks (Treinamento Lexical de Idiomas) */}
          {activeTab === 'chunks' && (
            <FastChunkAudioApp />
          )}

          {/* Módulo 6: Biblioteca de Vozes Neurais */}
          {activeTab === 'voices' && (
            <VoiceLibrary
              selectedVoice={selectedVoice}
              onSelectVoice={(v) => {
                setSelectedVoice(v);
                setActiveTab('reader');
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
        <ArchitectureModal onClose={() => setActiveTab('reader')} />
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


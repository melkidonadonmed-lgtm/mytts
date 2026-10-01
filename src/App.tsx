import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar, AppTab } from './components/Sidebar';
import { QuickReader } from './components/QuickReader';
import { LiveVoiceMic } from './components/LiveVoiceMic';
import { VoiceLibrary } from './components/VoiceLibraryModal';
import { FastChunkAudioApp } from './components/FastChunkAudioApp';
import { DocumentInputSection } from './components/DocumentInputSection';
import { DebateConfigPanel } from './components/DebateConfigPanel';
import { ScriptViewer } from './components/ScriptViewer';
import { BottomAudioDock } from './components/BottomAudioDock';
import { ArchitectureModal } from './components/ArchitectureModal';
import { DebateConfig, DebateScript } from './types/debate';
import { LANGUAGE_OPTIONS, SAMPLE_DOCUMENTS, INITIAL_PRESET_SCRIPTS } from './data/sampleDebates';
import { GaplessAudioPlayer } from './utils/audioEngine';
import { VoiceProfile, GEMINI_VOICES } from './types/voices';
import { AlertCircle, Menu } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('reader');
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile>(GEMINI_VOICES[0]); // Puck default
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

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

  const syncTurnsToPlayer = (updatedScript: DebateScript) => {
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

  // Geração de Debate Dialético
  const handleGenerateDebate = async () => {
    setIsGenerating(true);
    setGlobalError(null);
    try {
      const resp = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText,
          language: config.language,
          audienceLevel: config.audienceLevel,
          tensionIntensity: config.tensionIntensity,
          speakers: config.speakers,
          maxTurns: config.maxTurns,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Falha na geração do roteiro.');
      }

      setScript(data.script);
      await synthesizeTurns(data.script);
    } catch (err: any) {
      console.error(err);
      setGlobalError(err.message || 'Erro ao gerar o debate dialético.');
    } finally {
      setIsGenerating(false);
    }
  };

  const synthesizeTurns = async (targetScript: DebateScript) => {
    setIsSynthesizing(true);
    setGlobalError(null);

    const updatedTurns = [...targetScript.turns];

    for (let i = 0; i < targetScript.turns.length; i++) {
      const turn = targetScript.turns[i];
      try {
        const resp = await fetch('/api/synthesize-turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            turn,
            speakerName: turn.speaker,
            voiceId: turn.voice_id,
            language: targetScript.language,
          }),
        });

        const data = await resp.json();
        if (data.success && data.audioBase64) {
          updatedTurns[i] = {
            ...turn,
            audioBase64: data.audioBase64,
            audioDurationSec: data.durationSec,
            audioStatus: 'ready',
          };
        } else {
          updatedTurns[i] = {
            ...turn,
            audioStatus: 'error',
            errorMessage: data.error,
          };
        }
      } catch (e: any) {
        console.warn(`Turn ${turn.turn} synthesis error:`, e);
        updatedTurns[i] = {
          ...turn,
          audioStatus: 'error',
          errorMessage: e.message,
        };
      }

      const intermediateScript = { ...targetScript, turns: [...updatedTurns] };
      setScript(intermediateScript);
      syncTurnsToPlayer(intermediateScript);
    }

    setIsSynthesizing(false);
  };

  const handleSynthesizeSingleTurn = async (turnIndex: number) => {
    const turn = script.turns[turnIndex];
    try {
      const resp = await fetch('/api/synthesize-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turn,
          speakerName: turn.speaker,
          voiceId: turn.voice_id,
          language: script.language,
        }),
      });

      const data = await resp.json();
      if (data.success && data.audioBase64) {
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
      } else {
        throw new Error(data.error || 'Falha ao sintetizar turno.');
      }
    } catch (e: any) {
      setGlobalError(e.message || 'Erro ao sintetizar áudio do turno.');
    }
  };

  const handleUpdateTurnText = (turnIndex: number, newText: string) => {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-amber-500/20 selection:text-amber-200">
      
      {/* 1. Sidebar Persistente Estilo ElevenLabs */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (isPlaying && (tab === 'reader' || tab === 'fastchunks')) {
            player.pause();
          }
          if ((document as any).startViewTransition) {
            (document as any).startViewTransition(() => setActiveTab(tab));
          } else {
            setActiveTab(tab);
          }
        }}
        selectedVoice={selectedVoice}
        isOpenMobile={isMobileSidebarOpen}
        onToggleMobile={() => setIsMobileSidebarOpen((prev) => !prev)}
        onOpenVoiceLibrary={() => setActiveTab('voices')}
      />

      {/* 2. Área de Trabalho Principal (com margem para sidebar no desktop) */}
      <div className="flex-1 flex flex-col lg:pl-72 min-h-screen">
        
        {/* Header Mobile com Hamburger */}
        <header className="h-14 px-4 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between lg:hidden sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>MyTTS</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-semibold">
                Studio
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-md bg-gradient-to-tr ${selectedVoice.avatarColor} flex items-center justify-center text-white text-[10px] font-bold`}
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
            <div className="bg-rose-950/80 border border-rose-800 text-rose-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{globalError}</span>
              </div>
              <button
                onClick={() => setGlobalError(null)}
                className="text-rose-400 hover:text-white font-mono text-[11px] cursor-pointer"
              >
                dispensar
              </button>
            </div>
          </div>
        )}

        {/* 3. Canvas de Conteúdo por Módulo */}
        <main className="flex-1 flex flex-col">
          {/* Módulo 1: Leitor & Síntese Rápida (Home / Speechify Style) */}
          {activeTab === 'reader' && (
            <QuickReader
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoice}
              onNavigateToMic={() => setActiveTab('mic')}
            />
          )}

          {/* Módulo 2: Ditado & Microfone ao Vivo */}
          {activeTab === 'mic' && (
            <LiveVoiceMic
              selectedVoice={selectedVoice}
              onSendToReader={(transcribedText) => {
                setActiveTab('reader');
              }}
            />
          )}

          {/* Módulo 3: Biblioteca de Vozes Neurais */}
          {activeTab === 'voices' && (
            <VoiceLibrary
              selectedVoice={selectedVoice}
              onSelectVoice={(v) => {
                setSelectedVoice(v);
                setActiveTab('reader');
              }}
            />
          )}

          {/* Módulo 4: Estúdio de Debate com 2 Vozes */}
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
                  <span>Dual Speaker TTS (Kore & Puck)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <DocumentInputSection
                    currentLanguage={config.language}
                    textInput={documentText}
                    onChangeText={setDocumentText}
                    onGenerateDebate={handleGenerateDebate}
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

          {/* Módulo 5: FastChunks (Treino de Idiomas) */}
          {activeTab === 'fastchunks' && (
            <FastChunkAudioApp />
          )}
        </main>

        {/* Dock de Áudio Inferior (Exibido no modo Debate) */}
        {activeTab === 'debate' && (
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
    </div>
  );
}

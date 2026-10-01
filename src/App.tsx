import React, { useState, useEffect, useMemo } from 'react';
import { TopBar } from './components/TopBar';
import { DocumentInputSection } from './components/DocumentInputSection';
import { DebateConfigPanel } from './components/DebateConfigPanel';
import { ScriptViewer } from './components/ScriptViewer';
import { BottomAudioDock } from './components/BottomAudioDock';
import { ArchitectureModal } from './components/ArchitectureModal';
import { DebateConfig, DebateScript } from './types/debate';
import { LANGUAGE_OPTIONS, SAMPLE_DOCUMENTS, INITIAL_PRESET_SCRIPTS } from './data/sampleDebates';
import { GaplessAudioPlayer } from './utils/audioEngine';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'architecture' | 'docs'>('studio');
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
  const [synthesizingProgress, setSynthesizingProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Singleton Gapless Audio Player instance
  const player = useMemo(() => new GaplessAudioPlayer(), []);
  const [playerCurrentTurn, setPlayerCurrentTurn] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Subscribe to player state changes
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

  // When script turns with audio change, sync into player
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

  // Generate Script from Text/Document
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
      // Auto-trigger speech synthesis for the fresh script
      await synthesizeTurns(data.script);
    } catch (err: any) {
      console.error(err);
      setGlobalError(err.message || 'Erro ao gerar o debate dialético.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Synthesize audio for all turns
  const synthesizeTurns = async (targetScript: DebateScript) => {
    setIsSynthesizing(true);
    setSynthesizingProgress({ current: 0, total: targetScript.turns.length });
    setGlobalError(null);

    const updatedTurns = [...targetScript.turns];
    let completedCount = 0;

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

      completedCount++;
      setSynthesizingProgress({ current: completedCount, total: targetScript.turns.length });

      // Update script state incrementally so user sees progress
      const intermediateScript = { ...targetScript, turns: [...updatedTurns] };
      setScript(intermediateScript);
      syncTurnsToPlayer(intermediateScript);
    }

    setIsSynthesizing(false);
  };

  // Synthesize single turn
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

  const handlePlayTurn = (turnIndex: number) => {
    player.play(turnIndex);
  };

  const handleTogglePlay = () => {
    const readyTurnsCount = script?.turns.filter((t) => Boolean(t.audioBase64)).length || 0;
    if (readyTurnsCount === 0 && script) {
      synthesizeTurns(script);
    } else {
      player.togglePlay();
    }
  };

  const handleSeek = (newTime: number) => {
    player.seek(newTime);
  };

  const handleChangePlaybackRate = (rate: number) => {
    player.setSpeed(rate);
  };

  const activeTurn = script?.turns[playerCurrentTurn];
  const activeSpeaker = activeTurn
    ? script?.speakers.find((s) => s.name === activeTurn.speaker) || script?.speakers[0]
    : script?.speakers[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Bar with Strict Contract */}
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewDebate={() => {
          setDocumentText('');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isSynthesizing={isSynthesizing}
      />

      {/* Global Error Banner if any */}
      {globalError && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 px-4 py-2.5 rounded-lg text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
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

      {/* Main Container with Ergonomic pb-32 to protect against bottom dock overlap */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-36 flex flex-col gap-6">
        {/* Sub-header Kicker and Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-900">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>Roteirizador Dialético & Estúdio de Voz Neural</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Conversão de ensaios e relatórios em debates hiper-realistas com controle prosódico e reprodução contínua Web Audio.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Gemini 3.8 Flash TTS</span>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span>Web Audio 24kHz</span>
          </div>
        </div>

        {/* 2-Column Responsive Layout: Inputs on Left, Debate on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (5 cols): Mobile-First Ingestion & Parameters */}
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

          {/* Right Column (7 cols): Script Viewer & Audio Turns */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <ScriptViewer
              script={script}
              currentTurnIndex={playerCurrentTurn}
              isPlaying={isPlaying}
              onPlayTurn={handlePlayTurn}
              onSynthesizeTurn={handleSynthesizeSingleTurn}
              onUpdateTurnText={handleUpdateTurnText}
              isSynthesizing={isSynthesizing}
            />
          </div>
        </div>
      </main>

      {/* Dock de Áudio Fixo no Rodapé (Spotify-inspired Bottom Audio Dock) */}
      <BottomAudioDock
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        playbackRate={playbackRate}
        onChangePlaybackRate={handleChangePlaybackRate}
        currentSpeaker={activeSpeaker}
        currentTurn={activeTurn}
        currentTurnText={activeTurn?.text}
        turnIndex={playerCurrentTurn}
        totalTurns={script?.turns.length || 0}
        language={config.language}
      />

      {/* Architecture & Engineering Inspection Modal */}
      {(activeTab === 'architecture' || activeTab === 'docs') && (
        <ArchitectureModal onClose={() => setActiveTab('studio')} />
      )}
    </div>
  );
}

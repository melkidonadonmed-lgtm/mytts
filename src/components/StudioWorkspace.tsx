import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Download,
  Sparkles,
  Volume2,
  Loader2,
  AlertCircle,
  Headphones,
  Users,
  Zap,
} from 'lucide-react';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { DebateScript, SpeakerProfile } from '../types/debate';
import { GaplessAudioPlayer } from '../utils/audioEngine';
import { base64ToBlobUrl, revokeAudioUrl } from '../utils/audio';
import { VoiceCardGrid } from './VoiceCardGrid';
import { StudioTextEditor } from './StudioTextEditor';
import { ScriptViewer } from './ScriptViewer';

export type StudioMode = 'solo' | 'debate';
export type CalibrationPreset = 'natural' | 'storytelling' | 'technical' | 'spontaneous';

interface StudioWorkspaceProps {
  text: string;
  onChangeText: (text: string) => void;
  selectedVoice: VoiceProfile;
  onSelectVoice: (voice: VoiceProfile) => void;
  player: GaplessAudioPlayer;
  isPlaying: boolean;
  playerCurrentTurn: number;
  script: DebateScript;
  setScript: React.Dispatch<React.SetStateAction<DebateScript>>;
  onGenerateDebate: (speakers: [SpeakerProfile, SpeakerProfile], tension: 'friendly' | 'balanced' | 'provocative') => Promise<void>;
  isGeneratingDebate: boolean;
  isSynthesizingDebate: boolean;
  onSynthesizeSingleTurn: (turnIndex: number) => Promise<void>;
  onUpdateTurnText: (turnIndex: number, newText: string) => void;
}

export const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({
  text,
  onChangeText,
  selectedVoice,
  onSelectVoice,
  player,
  isPlaying,
  playerCurrentTurn,
  script,
  onGenerateDebate,
  isGeneratingDebate,
  isSynthesizingDebate,
  onSynthesizeSingleTurn,
  onUpdateTurnText,
}) => {
  const [mode, setMode] = useState<StudioMode>('solo');

  // Calibrações Solo
  const [calibration, setCalibration] = useState<CalibrationPreset>('natural');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [autoProsody, setAutoProsody] = useState<boolean>(true);

  // Calibrações Debate
  const [speaker1, setSpeaker1] = useState<VoiceProfile>(
    GEMINI_VOICES.find((v) => v.id === 'Kore') || GEMINI_VOICES[1]
  );
  const [speaker2, setSpeaker2] = useState<VoiceProfile>(
    GEMINI_VOICES.find((v) => v.id === 'Puck') || GEMINI_VOICES[0]
  );
  const [activeSpeakerSlot, setActiveSpeakerSlot] = useState<1 | 2>(1);
  const [debateTension, setDebateTension] = useState<'friendly' | 'balanced' | 'provocative'>('provocative');

  // Estado de Reprodução Solo
  const [isSoloSynthesizing, setIsSoloSynthesizing] = useState<boolean>(false);
  const [isSoloPlaying, setIsSoloPlaying] = useState<boolean>(false);
  const [soloAudioUrl, setSoloAudioUrl] = useState<string | null>(null);
  const [soloAudioDuration, setSoloAudioDuration] = useState<number>(0);
  const [soloCurrentTime, setSoloCurrentTime] = useState<number>(0);
  const [soloErrorMessage, setSoloErrorMessage] = useState<string | null>(null);
  const [soloStatusMessage, setSoloStatusMessage] = useState<string | null>(null);

  const soloAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  // 4 Modos Práticos de Calibração Fonética em PT-BR
  const calibrationPresets: { id: CalibrationPreset; label: string; icon: string; desc: string }[] = [
    {
      id: 'natural',
      label: 'Natural & Fluido',
      icon: '🌿',
      desc: 'Ritmo equilibrado de fala humana com respirações orgânicas nos pontos e vírgulas.',
    },
    {
      id: 'storytelling',
      label: 'Narrativo & Envolvente',
      icon: '📖',
      desc: 'Cadência rica de audiolivro, com modulação acolhedora e pausas para reflexão.',
    },
    {
      id: 'technical',
      label: 'Técnico & Notícia',
      icon: '🏛️',
      desc: 'Dicção cristalina, ritmo firme e profissional para relatórios e análises.',
    },
    {
      id: 'spontaneous',
      label: 'Espontâneo & Conversa',
      icon: '☕',
      desc: 'Inflexão descontraída e ágil, como em um podcast ou diálogo informal.',
    },
  ];

  // Limpeza de áudio ao desmontar
  useEffect(() => {
    return () => {
      if (soloAudioRef.current) {
        soloAudioRef.current.pause();
      }
      revokeAudioUrl(currentBlobUrlRef.current);
    };
  }, []);

  const handleTimeUpdate = () => {
    if (soloAudioRef.current) {
      setSoloCurrentTime(soloAudioRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    setIsSoloPlaying(false);
    setSoloCurrentTime(0);
  };

  // 1. Síntese Solo (Gemini 3.1 Flash TTS com Director's Chair e Auto-Prosódia em PT-BR)
  const handleSoloSynthesizeAndPlay = async () => {
    if (!text.trim()) return;

    if (isSoloPlaying) {
      if (soloAudioRef.current) soloAudioRef.current.pause();
      setIsSoloPlaying(false);
      return;
    }

    // Se já temos o áudio pronto para este texto, tocar direto
    if (soloAudioUrl && soloAudioRef.current) {
      soloAudioRef.current.playbackRate = playbackSpeed;
      soloAudioRef.current.play();
      setIsSoloPlaying(true);
      return;
    }

    setIsSoloSynthesizing(true);
    setSoloErrorMessage(null);
    setSoloStatusMessage('Sintetizando voz com respiração natural e direção em português...');

    try {
      const resp = await fetch('/api/synthesize-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: selectedVoice.id,
          emotion: calibration,
          speed: playbackSpeed,
          language: 'pt-BR',
          autoProsody,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success || !data.audioBase64) {
        throw new Error(data.error || 'Falha ao sintetizar áudio com Gemini TTS.');
      }

      // Descarte atômico da URL anterior
      revokeAudioUrl(currentBlobUrlRef.current);
      const audioUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
      currentBlobUrlRef.current = audioUrl;
      setSoloAudioUrl(audioUrl);
      setSoloAudioDuration(data.durationSec || 10);

      const audio = new Audio(audioUrl);
      audio.playbackRate = playbackSpeed;
      soloAudioRef.current = audio;

      audio.ontimeupdate = handleTimeUpdate;
      audio.onended = handleAudioEnded;
      audio.onerror = () => {
        setIsSoloPlaying(false);
        setSoloErrorMessage('Erro ao reproduzir buffer de áudio WAV.');
      };

      await audio.play();
      setIsSoloPlaying(true);
    } catch (err: unknown) {
      console.warn('Erro na síntese neural:', err);
      setSoloErrorMessage(err instanceof Error ? err.message : 'Erro ao conectar à API do Gemini.');
    } finally {
      setIsSoloSynthesizing(false);
      setSoloStatusMessage(null);
    }
  };

  // Fallback opcional para Web Speech API se a rede ou a chave falharem
  const handleFallbackWebSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const clean = text.replace(/\[.*?\]/g, '').replace(/<.*?>/g, '').trim();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = 'pt-BR';
      utter.rate = playbackSpeed;
      utter.onend = () => setIsSoloPlaying(false);
      window.speechSynthesis.speak(utter);
      setIsSoloPlaying(true);
      setSoloErrorMessage(null);
    }
  };

  // Baixar WAV Solo
  const handleDownloadSoloWav = () => {
    if (!soloAudioUrl) return;
    const a = document.createElement('a');
    a.href = soloAudioUrl;
    a.download = `mytts-${selectedVoice.name.toLowerCase()}-${Date.now()}.wav`;
    a.click();
  };

  // 2. Disparar Geração de Debate (2 Vozes)
  const handleTriggerDebate = async () => {
    if (!text.trim()) return;
    const spk1: SpeakerProfile = {
      id: 'speaker1',
      name: speaker1.name,
      roleTitle: `${speaker1.archetype} (Interlocutor 1)`,
      archetype: 'analytical',
      voiceId: speaker1.id,
      bio: speaker1.styleDescription,
      color: speaker1.avatarColor,
    };
    const spk2: SpeakerProfile = {
      id: 'speaker2',
      name: speaker2.name,
      roleTitle: `${speaker2.archetype} (Interlocutor 2)`,
      archetype: 'provocateur',
      voiceId: speaker2.id,
      bio: speaker2.styleDescription,
      color: speaker2.avatarColor,
    };
    await onGenerateDebate([spk1, spk2], debateTension);
  };


  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-4 py-6 pb-36 gap-6">
      
      {/* 1. Header do Estúdio e Seletor de Modo Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Estúdio de Criação de Áudio</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-semibold">
              Gemini 3.1 Flash TTS
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cole um texto ou suba um arquivo. Escolha entre leitura solo de estúdio ou debate com 2 vozes.
          </p>
        </div>

        {/* Alternador de Modo em 1 Toque (Solo vs Debate) */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-900 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setMode('solo')}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              mode === 'solo'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Headphones className="w-4 h-4" />
            <span>Apenas Ler (Solo)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('debate')}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              mode === 'debate'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Transformar em Conversa (2)</span>
          </button>
        </div>
      </div>

      {/* 2. Zona de Ingestão Unificada (Editor com Colar, Upload PDF/TXT e Ditar) */}
      <section aria-label="Ingestão de Conteúdo">
        <StudioTextEditor
          text={text}
          onChangeText={(newText) => {
            onChangeText(newText);
            setSoloAudioUrl(null); // Invalida áudio solo anterior se o texto mudar
          }}
          isProcessing={isSoloSynthesizing || isGeneratingDebate}
          statusMessage={soloStatusMessage}
        />
      </section>

      {/* 3. Painel de Configuração Específico por Modo */}
      {mode === 'solo' ? (
        <section aria-label="Configuração de Voz e Calibração Solo" className="flex flex-col gap-4">
          
          {/* 3.1 Seleção de Voz Tátil */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-amber-400" />
              <span>Selecione a Voz Neural:</span>
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">
              Voz ativa: <strong className="text-amber-400">{selectedVoice.name}</strong>
            </span>
          </div>

          <VoiceCardGrid
            selectedVoice={selectedVoice}
            onSelectVoice={(voice) => {
              onSelectVoice(voice);
              setSoloAudioUrl(null);
            }}
          />

          {/* 3.2 Calibração de Intenção e Velocidade */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            
            {/* 4 Presets de Calibração */}
            <div className="lg:col-span-8 flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Intenção Vocal em Português:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {calibrationPresets.map((preset) => {
                  const isActive = calibration === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setCalibration(preset.id);
                        setSoloAudioUrl(null);
                      }}
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-amber-400/10 border-amber-400/60 text-amber-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1">
                        <span>{preset.icon}</span>
                        <span>{preset.label}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 leading-tight">
                        {preset.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Velocidade e Toggle de Auto-Prosódia */}
            <div className="lg:col-span-4 flex flex-col justify-between gap-3 border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-3 lg:pt-0 lg:pl-4">
              {/* Velocidade */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Velocidade:
                </span>
                <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800">
                  {[0.8, 1.0, 1.2, 1.5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setPlaybackSpeed(s);
                        if (soloAudioRef.current) soloAudioRef.current.playbackRate = s;
                      }}
                      className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        playbackSpeed === s
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Interruptor de Auto-Respiração e Pausas */}
              <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-200 block">
                      Auto-Respiração & Pausas
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Calcula fôlego biológico sem ler tags
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoProsody}
                  onChange={(e) => {
                    setAutoProsody(e.target.checked);
                    setSoloAudioUrl(null);
                  }}
                  className="w-4 h-4 rounded text-amber-400 focus:ring-amber-400 focus:ring-offset-0 bg-slate-900 border-slate-700 accent-amber-400 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Banner de Erro com Fallback */}
          {soloErrorMessage && (
            <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{soloErrorMessage}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFallbackWebSpeech}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold cursor-pointer"
                >
                  Ouvir voz do navegador
                </button>
                <button
                  type="button"
                  onClick={() => setSoloErrorMessage(null)}
                  className="text-rose-400 hover:text-white font-mono text-[11px] cursor-pointer"
                >
                  dispensar
                </button>
              </div>
            </div>
          )}

          {/* 3.3 Ação Hero Solo */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleSoloSynthesizeAndPlay}
              disabled={isSoloSynthesizing || !text.trim()}
              className="w-full sm:flex-1 min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {isSoloSynthesizing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sintetizando com Direção Vocal...</span>
                </>
              ) : isSoloPlaying ? (
                <>
                  <Pause className="w-5 h-5 fill-current" />
                  <span>Pausar Leitura</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>{soloAudioUrl ? 'Ouvir Novamente' : 'Ler Texto em Voz Alta'}</span>
                </>
              )}
            </button>

            {soloAudioUrl && (
              <button
                type="button"
                onClick={handleDownloadSoloWav}
                className="w-full sm:w-auto min-h-[52px] px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                title="Baixar arquivo WAV canônico (24kHz)"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Baixar WAV (24kHz)</span>
              </button>
            )}
          </div>

          {/* 3.4 Player Visual em Linha (Solo) */}
          {soloAudioUrl && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="text-amber-400 font-bold flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" />
                  Áudio Pronto ({selectedVoice.name} · {calibration})
                </span>
                <span>
                  {formatTime(soloCurrentTime)} / {formatTime(soloAudioDuration)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={soloAudioDuration || 100}
                step={0.1}
                value={soloCurrentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSoloCurrentTime(val);
                  if (soloAudioRef.current) soloAudioRef.current.currentTime = val;
                }}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
          )}
        </section>
      ) : (
        /* MODO CONVERSA / DEBATE DIALÉTICO */
        <section aria-label="Configuração do Debate com 2 Vozes" className="flex flex-col gap-5">
          
          {/* Seletor dos 2 Debatedores */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Escolha os 2 Interlocutores do Debate:</span>
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveSpeakerSlot(1)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSpeakerSlot === 1
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  Slot 1: {speaker1.name}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSpeakerSlot(2)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSpeakerSlot === 2
                      ? 'bg-emerald-400 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  Slot 2: {speaker2.name}
                </button>
              </div>
            </div>

            <VoiceCardGrid
              selectedVoice={selectedVoice}
              onSelectVoice={() => {}}
              multiSpeakerMode={true}
              speaker1={speaker1}
              speaker2={speaker2}
              activeSlot={activeSpeakerSlot}
              onSelectSpeakerSlot={(slot, voice) => {
                if (slot === 1) {
                  setSpeaker1(voice);
                  setActiveSpeakerSlot(2);
                } else {
                  setSpeaker2(voice);
                  setActiveSpeakerSlot(1);
                }
              }}
            />
          </div>

          {/* Intensidade de Tensão Dialética */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-200 block">
                Nível de Tensão Dialética:
              </span>
              <span className="text-[11px] text-slate-400">
                Define a energia dos argumentos e a firmeza dos contra-pontos.
              </span>
            </div>

            <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800">
              {[
                { id: 'friendly', label: 'Amigável' },
                { id: 'balanced', label: 'Equilibrado' },
                { id: 'provocative', label: 'Provocativo' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDebateTension(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    debateTension === t.id
                      ? 'bg-emerald-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Botão de Disparo do Debate */}
          <button
            type="button"
            onClick={handleTriggerDebate}
            disabled={isGeneratingDebate || isSynthesizingDebate || !text.trim()}
            className="min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {isGeneratingDebate ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Roteirizando Discussão com Gemini 3.8 Flash...</span>
              </>
            ) : isSynthesizingDebate ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                <span>Sintetizando Vozes Neurais do Debate...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 fill-current" />
                <span>Gerar Debate em Áudio ({speaker1.name} vs {speaker2.name})</span>
              </>
            )}
          </button>

          {/* Roteiro e Turnos do Debate Gerado */}
          {script && script.turns && script.turns.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800/80">
              <ScriptViewer
                script={script}
                currentTurnIndex={playerCurrentTurn}
                isPlaying={isPlaying}
                onPlayTurn={(index) => player.play(index)}
                onSynthesizeTurn={onSynthesizeSingleTurn}
                onUpdateTurnText={onUpdateTurnText}
                isSynthesizing={isSynthesizingDebate}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
};

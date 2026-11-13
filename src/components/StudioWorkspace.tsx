/**
 * Bancada do Estúdio de Criação de Áudio — Leitura Solo com Voz Neural Gemini 3.8 Flash TTS.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Download,
  Sparkles,
  Volume2,
  Loader2,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { VoiceProfile } from '../types/voices';
import {
  ConversationFormat,
  DebateConfig,
  DebateScript,
  LanguageCode,
  SpeakerProfile,
  StudioRenderMode,
} from '../types/debate';
import { GaplessAudioPlayer } from '../utils/audioEngine';
import { base64ToBlobUrl, revokeAudioUrl, speakBrowserFallback, stopBrowserSpeech } from '../utils/audio';
import { VoiceCardGrid } from './VoiceCardGrid';
import { StudioTextEditor } from './StudioTextEditor';
import { requestSynthesizeSpeech } from '../services/apiClient';
import { generateAudioCacheKey, synthesizeWithCache, setCachedAudio } from '../utils/audioCache';
import { AUDIO_CONSTANTS } from '../config/constants';

export type CalibrationPreset = 'natural' | 'storytelling' | 'technical' | 'spontaneous';

export interface StudioWorkspaceProps {
  text: string;
  onChangeText: (text: string) => void;
  selectedVoice: VoiceProfile;
  onSelectVoice: (voice: VoiceProfile) => void;
  lockedRenderMode?: 'solo';
  player?: GaplessAudioPlayer;
  isPlaying?: boolean;
  playerCurrentTurn?: number;
  script?: DebateScript;
  setScript?: React.Dispatch<React.SetStateAction<DebateScript>>;
  debateConfig?: DebateConfig;
  onChangeDebateConfig?: (config: DebateConfig) => void;
  onGenerateDebate?: (
    speakers: [SpeakerProfile, SpeakerProfile],
    tension: 'friendly' | 'balanced' | 'provocative',
    format?: ConversationFormat,
    language?: LanguageCode
  ) => Promise<void>;
  isGeneratingDebate?: boolean;
  isSynthesizingDebate?: boolean;
  onSynthesizeSingleTurn?: (turnIndex: number) => Promise<void>;
  onPlayTurn?: (turnIndex: number) => void;
  onUpdateTurnText?: (turnIndex: number, newText: string) => void;
  onUpdateTurnVoice?: (turnIndex: number, newVoiceId: string) => void;
  studioRenderMode?: StudioRenderMode;
  onChangeStudioRenderMode?: (mode: StudioRenderMode) => void;
}

const CALIBRATION_PRESETS: { id: CalibrationPreset; label: string; icon: string; desc: string }[] = [
  {
    id: 'natural',
    label: 'Natural & Fluido',
    icon: '01',
    desc: 'Ritmo equilibrado de fala humana com respirações orgânicas.',
  },
  {
    id: 'storytelling',
    label: 'Narrativo & Envolvente',
    icon: '02',
    desc: 'Cadência de audiolivro com modulação acolhedora.',
  },
  {
    id: 'technical',
    label: 'Técnico & Notícia',
    icon: '03',
    desc: 'Dicção cristalina e ritmo firme para relatórios e estudos.',
  },
  {
    id: 'spontaneous',
    label: 'Espontâneo & Conversa',
    icon: '04',
    desc: 'Inflexão descontraída e ágil, como em um diálogo informal.',
  },
];

export const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({
  text,
  onChangeText,
  selectedVoice,
  onSelectVoice,
}) => {
  const [calibration, setCalibration] = useState<CalibrationPreset>('natural');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [autoProsody, setAutoProsody] = useState<boolean>(true);

  const [isSoloSynthesizing, setIsSoloSynthesizing] = useState<boolean>(false);
  const [isSoloPlaying, setIsSoloPlaying] = useState<boolean>(false);
  const [soloAudioUrl, setSoloAudioUrl] = useState<string | null>(null);
  const [soloAudioDuration, setSoloAudioDuration] = useState<number>(0);
  const [soloCurrentTime, setSoloCurrentTime] = useState<number>(0);
  const [soloErrorMessage, setSoloErrorMessage] = useState<string | null>(null);
  const [soloStatusMessage, setSoloStatusMessage] = useState<string | null>(null);

  const soloAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  const invalidateSoloAudio = (): void => {
    if (soloAudioRef.current) {
      soloAudioRef.current.pause();
      soloAudioRef.current = null;
    }
    stopBrowserSpeech();
    revokeAudioUrl(currentBlobUrlRef.current);
    currentBlobUrlRef.current = null;
    setSoloAudioUrl(null);
    setIsSoloPlaying(false);
    setSoloCurrentTime(0);
    setSoloErrorMessage(null);
  };

  useEffect(() => {
    invalidateSoloAudio();
  }, [selectedVoice.id, calibration, autoProsody]);

  useEffect(() => {
    return () => {
      invalidateSoloAudio();
    };
  }, []);

  const handleTimeUpdate = (): void => {
    if (soloAudioRef.current) {
      setSoloCurrentTime(soloAudioRef.current.currentTime);
    }
  };

  const handleAudioEnded = (): void => {
    setIsSoloPlaying(false);
    setSoloCurrentTime(0);
  };

  const executeAudioSynthesis = async (trimmedText: string, cacheKey: string, forceRegenerate: boolean) => {
    if (forceRegenerate) {
      const data = await requestSynthesizeSpeech({
        text: trimmedText,
        voiceId: selectedVoice.id,
        emotion: calibration,
        speed: playbackSpeed,
        language: 'pt-BR',
        autoProsody,
      });
      if (!data.ok || !data.success || !data.audioBase64) {
        throw new Error(data.error || 'Falha ao sintetizar áudio com Gemini TTS.');
      }
      setCachedAudio({
        key: cacheKey,
        audioBase64: data.audioBase64,
        mimeType: 'audio/wav',
        durationSec: data.durationSec,
        language: 'pt-BR',
        voiceId: selectedVoice.id,
        speed: playbackSpeed,
        emotion: calibration,
      }).catch((err: unknown) => console.warn('MyTTS: Falha ao atualizar cache Solo:', err));
      return { audioBase64: data.audioBase64, durationSec: data.durationSec };
    }

    const cachedOrFresh = await synthesizeWithCache({
      endpoint: '/api/synthesize-speech',
      body: {
        text: trimmedText,
        voiceId: selectedVoice.id,
        emotion: calibration,
        speed: playbackSpeed,
        language: 'pt-BR',
        autoProsody,
      },
      cacheKey,
      metadata: {
        language: 'pt-BR',
        voiceId: selectedVoice.id,
        speed: playbackSpeed,
        emotion: calibration,
      },
    });
    return { audioBase64: cachedOrFresh.audioBase64, durationSec: cachedOrFresh.durationSec };
  };

  const handleSoloSynthesizeAndPlay = async (forceRegenerate = false): Promise<void> => {
    if (!text.trim()) return;

    if (isSoloPlaying && !forceRegenerate) {
      if (soloAudioRef.current) soloAudioRef.current.pause();
      stopBrowserSpeech();
      setIsSoloPlaying(false);
      return;
    }

    if (!forceRegenerate && soloAudioUrl && soloAudioRef.current) {
      soloAudioRef.current.playbackRate = playbackSpeed;
      soloAudioRef.current.play();
      setIsSoloPlaying(true);
      return;
    }

    if (forceRegenerate) invalidateSoloAudio();

    setIsSoloSynthesizing(true);
    setSoloErrorMessage(null);
    setSoloStatusMessage(`Sintetizando voz com ${selectedVoice.name} (${calibration})...`);

    try {
      const trimmedText = text.trim();
      const cacheKey = generateAudioCacheKey({
        type: 'speech',
        text: `${autoProsody ? 'prosody:1' : 'prosody:0'}:${trimmedText}`,
        language: 'pt-BR',
        voiceId: selectedVoice.id,
        speed: playbackSpeed,
        emotion: calibration,
      });

      const { audioBase64, durationSec } = await executeAudioSynthesis(trimmedText, cacheKey, forceRegenerate);

      revokeAudioUrl(currentBlobUrlRef.current);
      const audioUrl = base64ToBlobUrl(audioBase64, 'audio/wav');
      currentBlobUrlRef.current = audioUrl;
      setSoloAudioUrl(audioUrl);
      setSoloAudioDuration(durationSec || AUDIO_CONSTANTS.DEFAULT_DURATION_SEC);

      const audio = new Audio(audioUrl);
      audio.preservesPitch = true;
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
      console.warn('Erro na síntese neural (acionando fallback Web Speech):', err);
      setSoloErrorMessage(err instanceof Error ? err.message : 'Erro ao conectar à API do Gemini.');
      speakBrowserFallback(text, {
        lang: 'pt-BR',
        rate: playbackSpeed,
        voiceId: selectedVoice.id,
        onStart: () => setIsSoloPlaying(true),
        onEnd: () => setIsSoloPlaying(false),
        onError: () => setIsSoloPlaying(false),
      });
    } finally {
      setIsSoloSynthesizing(false);
      setSoloStatusMessage(null);
    }
  };

  const handleFallbackWebSpeech = (): void => {
    const started = speakBrowserFallback(text, {
      lang: 'pt-BR',
      rate: playbackSpeed,
      voiceId: selectedVoice.id,
      onStart: () => setIsSoloPlaying(true),
      onEnd: () => setIsSoloPlaying(false),
      onError: () => setIsSoloPlaying(false),
    });
    if (started) setIsSoloPlaying(true);
  };

  const handleDownloadSoloWav = (): void => {
    if (!soloAudioUrl) return;
    const a = document.createElement('a');
    a.href = soloAudioUrl;
    a.download = `mytts-${selectedVoice.name.toLowerCase()}-${Date.now()}.wav`;
    a.click();
  };

  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div
      data-state="idle"
      aria-busy={isSoloSynthesizing}
      className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-4 py-6 pb-36 gap-5"
    >
      <div className="flex flex-col gap-1 pb-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <h1 className="text-lg sm:text-xl font-extrabold text-primary font-display tracking-tight">
            Leitura Solo &amp; Renderização de Áudio
          </h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
            Gemini 3.8 Flash TTS
          </span>
        </div>
        <p className="text-xs text-secondary">
          Cole ou extraia texto/PDF, escolha a voz ativa, ajuste a intenção vocal e gere áudio WAV canônico de 24 kHz.
        </p>
      </div>

      <section aria-label="Ingestão de Conteúdo">
        <StudioTextEditor
          text={text}
          onChangeText={(newText) => {
            onChangeText(newText);
            setSoloAudioUrl(null);
          }}
          isProcessing={isSoloSynthesizing}
          statusMessage={soloStatusMessage}
        />
      </section>

      <section aria-label="Configuração de Voz e Calibração Solo" className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl card-matte">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${selectedVoice.avatarColor} flex items-center justify-center text-white text-xs font-extrabold shadow-sm`}
            >
              {selectedVoice.name[0]}
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 font-sans">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Voz Ativa no Leitor:</span>
                <span className="text-amber-300 font-extrabold normal-case text-sm tracking-normal">
                  {selectedVoice.name}
                </span>
                <span className="text-[11px] text-secondary font-normal">
                  · {selectedVoice.archetype}
                </span>
              </h2>
            </div>
          </div>
          <span className="text-[11px] text-secondary font-mono">
            Clique em qualquer card abaixo para trocar de voz instantaneamente
          </span>
        </div>

        <VoiceCardGrid
          selectedVoice={selectedVoice}
          onSelectVoice={(voice) => {
            onSelectVoice(voice);
            invalidateSoloAudio();
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-2xl card-matte">
          <div className="lg:col-span-8 flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider font-mono">
              Intenção Vocal em Português:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CALIBRATION_PRESETS.map((preset) => {
                const isActive = calibration === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setCalibration(preset.id);
                      setSoloAudioUrl(null);
                    }}
                    className={`p-2.5 rounded-xl text-left flex flex-col gap-1 transition-all cursor-pointer active:translate-y-px font-sans ${
                      isActive
                        ? 'card-matte-active ring-1 ring-amber-400/50 text-primary'
                        : 'btn-matte-dark text-secondary hover:text-primary'
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5 text-primary">
                      <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {preset.icon}
                      </span>
                      <span>{preset.label}</span>
                    </span>
                    <span className="text-[10px] text-secondary leading-tight">
                      {preset.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col justify-between gap-3 border-t lg:border-t-0 lg:border-l border-slate-800/60 pt-3 lg:pt-0 lg:pl-4">
            <div>
              <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider block mb-1.5 font-mono">
                Velocidade:
              </span>
              <div className="flex surface-inset rounded-xl p-1">
                {[0.8, 1.0, 1.2, 1.5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setPlaybackSpeed(s);
                      if (soloAudioRef.current) soloAudioRef.current.playbackRate = s;
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      playbackSpeed === s
                        ? 'btn-matte-amber text-white shadow-sm'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl surface-inset cursor-pointer hover:border-amber-400/40 transition-colors">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="text-left">
                  <span className="text-xs font-bold text-primary block font-sans">
                    Auto-Respiração &amp; Pausas
                  </span>
                  <span className="text-[10px] text-secondary font-sans">
                    Calcula fôlego biológico natural
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
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {soloErrorMessage && (
          <div className="p-3 rounded-2xl card-matte border border-rose-500/40 text-xs text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{soloErrorMessage}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFallbackWebSpeech}
                className="px-3 py-1.5 rounded-xl btn-matte-dark text-xs font-semibold cursor-pointer"
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

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => handleSoloSynthesizeAndPlay(false)}
            disabled={isSoloSynthesizing || !text.trim()}
            className="btn-matte-amber w-full sm:flex-1 min-h-[52px] rounded-2xl text-white font-bold text-sm tracking-normal flex items-center justify-center gap-2.5 shadow-xl active:translate-y-px transition-all cursor-pointer disabled:opacity-50 font-sans"
          >
            {isSoloSynthesizing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span>Sintetizando com {selectedVoice.name}...</span>
              </>
            ) : isSoloPlaying ? (
              <>
                <Pause className="w-5 h-5 fill-current text-white" />
                <span>Pausar Leitura ({selectedVoice.name})</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current text-white" />
                <span>
                  {soloAudioUrl
                    ? `Ouvir Leitura (${selectedVoice.name})`
                    : `Renderizar Leitura Solo (${selectedVoice.name})`}
                </span>
              </>
            )}
          </button>

          {soloAudioUrl && (
            <>
              <button
                type="button"
                onClick={() => handleSoloSynthesizeAndPlay(true)}
                disabled={isSoloSynthesizing || !text.trim()}
                className="w-full sm:w-auto min-h-[52px] px-4 rounded-2xl btn-matte-dark text-primary text-xs font-bold font-sans flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-px disabled:opacity-50"
                title="Gerar nova síntese forçada com a voz ativa atual"
              >
                <RotateCw className="w-4 h-4 text-amber-400" />
                <span>Regerar Áudio</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSoloWav}
                className="w-full sm:w-auto min-h-[52px] px-5 rounded-2xl btn-matte-dark text-primary text-xs font-bold font-sans flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-px"
                title="Baixar arquivo WAV canônico (24kHz)"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Baixar WAV</span>
              </button>
            </>
          )}
        </div>

        {soloAudioUrl && (
          <div className="p-4 rounded-2xl card-matte flex flex-col gap-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs text-secondary font-mono tabular-nums">
              <span className="text-amber-300 font-bold flex items-center gap-1.5 font-sans">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
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
              className="w-full h-1.5 surface-inset rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>
        )}
      </section>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2, Check } from 'lucide-react';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { base64ToBlobUrl, revokeAudioUrl, speakBrowserFallback, stopBrowserSpeech } from '../utils/audio';
import { requestPreviewVoice } from '../services/apiClient';

interface VoiceCardGridProps {
  selectedVoice: VoiceProfile;
  onSelectVoice: (voice: VoiceProfile) => void;
  multiSpeakerMode?: boolean;
  speaker1?: VoiceProfile;
  speaker2?: VoiceProfile;
  activeSlot?: 1 | 2;
  onSelectSpeakerSlot?: (slot: 1 | 2, voice: VoiceProfile) => void;
}

export const VoiceCardGrid: React.FC<VoiceCardGridProps> = ({
  selectedVoice,
  onSelectVoice,
  multiSpeakerMode = false,
  speaker1,
  speaker2,
  activeSlot = 1,
  onSelectSpeakerSlot,
}) => {
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  // Clean up preview audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      stopBrowserSpeech();
      revokeAudioUrl(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    };
  }, []);

  const clearPreviewBlob = (): void => {
    revokeAudioUrl(currentBlobUrlRef.current);
    currentBlobUrlRef.current = null;
  };

  const handlePlayPreview = async (voice: VoiceProfile): Promise<void> => {
    setPreviewError(null);

    // Pause active preview if toggling the same voice
    if (previewingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      stopBrowserSpeech();
      clearPreviewBlob();
      setPreviewingVoiceId(null);
      return;
    }

    // Stop any previous preview before starting the next
    if (audioRef.current) {
      audioRef.current.pause();
    }
    stopBrowserSpeech();
    clearPreviewBlob();

    setLoadingVoiceId(voice.id);
    setPreviewingVoiceId(null);

    try {
      const data = await requestPreviewVoice({
        voiceId: voice.id,
        speakerName: voice.name,
        language: 'pt-BR',
      });
      if (!data.ok || !data.success || !data.audioBase64) {
        throw new Error(data.error || 'Falha ao obter amostra de voz.');
      }

      const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
      currentBlobUrlRef.current = blobUrl;

      const audio = new Audio(blobUrl);
      audio.preservesPitch = true;
      audioRef.current = audio;

      audio.onended = () => {
        setPreviewingVoiceId(null);
        clearPreviewBlob();
      };
      audio.onerror = () => {
        setPreviewingVoiceId(null);
        setLoadingVoiceId(null);
        clearPreviewBlob();
        setPreviewError(`Não foi possível reproduzir a amostra de ${voice.name}.`);
      };

      await audio.play();
      setPreviewingVoiceId(voice.id);
    } catch (err: unknown) {
      clearPreviewBlob();
      console.warn('Erro ao reproduzir preview da voz (acionando fallback Web Speech):', err);
      const started = speakBrowserFallback(
        `Olá, sou ${voice.name}. Esta é uma demonstração de síntese da minha voz no estúdio.`,
        {
          lang: 'pt-BR',
          rate: 1.0,
          voiceId: voice.id,
          onStart: () => setPreviewingVoiceId(voice.id),
          onEnd: () => setPreviewingVoiceId(null),
          onError: () => {
            setPreviewingVoiceId(null);
            setPreviewError(`Não foi possível reproduzir a amostra de ${voice.name}.`);
          },
        }
      );
      if (started) {
        setPreviewingVoiceId(voice.id);
      } else {
        setPreviewError(`Não foi possível reproduzir a amostra de ${voice.name}.`);
      }
    } finally {
      setLoadingVoiceId(null);
    }
  };

  const handleSelect = (voice: VoiceProfile): void => {
    if (multiSpeakerMode && onSelectSpeakerSlot) {
      onSelectSpeakerSlot(activeSlot, voice);
    } else {
      onSelectVoice(voice);
    }
  };

  return (
    <div className="space-y-2.5">
      {previewError && (
        <p role="alert" className="text-xs font-medium text-rose-400 px-1">
          {previewError}
        </p>
      )}
      <div
        role="group"
        aria-label="Seleção de Vozes Neurais"
        className="grid grid-cols-[repeat(auto-fit,minmax(185px,1fr))] gap-3"
      >
        {GEMINI_VOICES.map((voice) => {
          const isSelectedSolo = !multiSpeakerMode && selectedVoice?.id === voice.id;
          const isSpk1 = multiSpeakerMode && speaker1?.id === voice.id;
          const isSpk2 = multiSpeakerMode && speaker2?.id === voice.id;
          const isSelected = isSelectedSolo || isSpk1 || isSpk2;

          const isPlaying = previewingVoiceId === voice.id;
          const isLoading = loadingVoiceId === voice.id;

          return (
            <article
              key={voice.id}
              className={`relative group rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 text-left ${
                isSelected
                  ? 'card-matte-active ring-1 ring-sky-500/40 border-sky-500/50'
                  : 'card-matte hover:border-slate-600'
              }`}
            >
              {/* Card header: sibling selection trigger + preview playback trigger */}
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleSelect(voice)}
                  aria-pressed={isSelected}
                  aria-label={`Selecionar voz ${voice.name} (${voice.archetype})`}
                  className="flex items-center gap-2.5 text-left min-w-0 flex-1 rounded-xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <div
                    className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr ${voice.avatarColor} flex items-center justify-center text-white text-base font-extrabold shadow-sm relative border border-white/10`}
                  >
                    <span aria-hidden="true">{voice.name[0]}</span>
                    {isSelectedSolo && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-sky-500 rounded-full flex items-center justify-center shadow-sm"
                      >
                        <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-primary font-display truncate">{voice.name}</span>
                      {isSelectedSolo && (
                        <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider block font-mono">
                      {voice.gender === 'female' ? 'Feminina' : 'Masculina'}
                    </span>
                  </div>
                </button>

                {/* 3s voice preview trigger */}
                <button
                  type="button"
                  onClick={() => void handlePlayPreview(voice)}
                  disabled={isLoading}
                  title={isPlaying ? `Pausar amostra de ${voice.name}` : `Ouvir amostra de 3s da voz ${voice.name}`}
                  aria-label={isPlaying ? `Pausar amostra de ${voice.name}` : `Ouvir amostra de 3 segundos da voz ${voice.name}`}
                  className={`w-10 h-10 min-w-[40px] min-h-[40px] shrink-0 rounded-xl flex items-center justify-center transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isPlaying
                      ? 'btn-matte-amber text-white shadow-md'
                      : 'btn-matte-dark text-secondary hover:text-primary'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                  ) : (
                    <Play className="w-4 h-4 fill-current translate-x-0.5 text-amber-400" aria-hidden="true" />
                  )}
                </button>
              </div>

              {/* Archetype description */}
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-300 mb-1 flex items-center gap-1 font-sans">
                  <span>{voice.archetype}</span>
                </p>
                <p className="text-[11px] text-secondary leading-snug line-clamp-2 font-sans">
                  {voice.bestFor}
                </p>
              </div>

              {/* Action footer */}
              <div className="pt-2 border-t border-slate-800/60">
                {!multiSpeakerMode ? (
                  <button
                    type="button"
                    aria-pressed={isSelectedSolo}
                    onClick={() => handleSelect(voice)}
                    className={`w-full min-h-[40px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sans outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      isSelectedSolo
                        ? 'btn-matte-amber text-white shadow-sm'
                        : 'btn-matte-dark text-secondary hover:text-primary'
                    }`}
                  >
                    {isSelectedSolo ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
                        <span>Voz Ativa no Leitor</span>
                      </>
                    ) : (
                      <span>Selecionar esta Voz</span>
                    )}
                  </button>
                ) : (
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="grid grid-cols-2 gap-1.5 w-full">
                      <button
                        type="button"
                        aria-pressed={isSpk1}
                        onClick={() => onSelectSpeakerSlot?.(1, voice)}
                        className={`min-h-[40px] py-2 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 font-sans outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                          isSpk1
                            ? 'btn-matte-primary text-white shadow-sm ring-1 ring-sky-400/50'
                            : 'btn-matte-dark text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                        }`}
                      >
                        {isSpk1 ? (
                          <>
                            <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
                            <span>Orador 1</span>
                          </>
                        ) : (
                          <span>Definir Orador 1</span>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-pressed={isSpk2}
                        onClick={() => onSelectSpeakerSlot?.(2, voice)}
                        className={`min-h-[40px] py-2 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 font-sans outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                          isSpk2
                            ? 'btn-matte-primary text-white shadow-sm ring-1 ring-emerald-400/50'
                            : 'btn-matte-dark text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                        }`}
                      >
                        {isSpk2 ? (
                          <>
                            <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
                            <span>Orador 2</span>
                          </>
                        ) : (
                          <span>Definir Orador 2</span>
                        )}
                      </button>
                    </div>
                    {!isSpk1 && !isSpk2 && (
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono text-center block">
                        Toque para Orador {activeSlot}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2, Check } from 'lucide-react';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { base64ToBlobUrl, revokeAudioUrl } from '../utils/audio';

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  // Limpeza de áudio ao desmontar
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      revokeAudioUrl(currentBlobUrlRef.current);
    };
  }, []);

  const handlePlayPreview = async (e: React.MouseEvent, voice: VoiceProfile) => {
    e.stopPropagation();

    // Se já estiver tocando esta mesma voz, pausar
    if (previewingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPreviewingVoiceId(null);
      return;
    }

    // Parar áudio anterior
    if (audioRef.current) {
      audioRef.current.pause();
    }
    revokeAudioUrl(currentBlobUrlRef.current);
    currentBlobUrlRef.current = null;

    setLoadingVoiceId(voice.id);
    setPreviewingVoiceId(null);

    try {
      const resp = await fetch('/api/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          speakerName: voice.name,
          language: 'pt-BR',
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success || !data.audioBase64) {
        throw new Error(data.error || 'Falha ao obter amostra de voz.');
      }

      const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
      currentBlobUrlRef.current = blobUrl;

      const audio = new Audio(blobUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPreviewingVoiceId(null);
      };
      audio.onerror = () => {
        setPreviewingVoiceId(null);
        setLoadingVoiceId(null);
      };

      await audio.play();
      setPreviewingVoiceId(voice.id);
    } catch (err) {
      console.warn('Erro ao reproduzir preview da voz:', err);
    } finally {
      setLoadingVoiceId(null);
    }
  };

  const handleSelect = (voice: VoiceProfile) => {
    if (multiSpeakerMode && onSelectSpeakerSlot) {
      onSelectSpeakerSlot(activeSlot, voice);
    } else {
      onSelectVoice(voice);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, voice: VoiceProfile) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(voice);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Seleção de Vozes Neurais"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
    >
      {GEMINI_VOICES.map((voice) => {
        const isSelectedSolo = !multiSpeakerMode && selectedVoice?.id === voice.id;
        const isSpk1 = multiSpeakerMode && speaker1?.id === voice.id;
        const isSpk2 = multiSpeakerMode && speaker2?.id === voice.id;
        const isSelected = isSelectedSolo || isSpk1 || isSpk2;

        const isPlaying = previewingVoiceId === voice.id;
        const isLoading = loadingVoiceId === voice.id;

        return (
          <div
            key={voice.id}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={() => handleSelect(voice)}
            onKeyDown={(e) => handleKeyDown(e, voice)}
            className={`relative group rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 text-left outline-none select-none active:translate-y-px focus-visible:ring-2 focus-visible:ring-sky-500 ${
              isSelected
                ? 'card-matte-active ring-1 ring-sky-500/40 border-sky-500/50'
                : 'card-matte hover:border-slate-600'
            }`}
          >
            {/* Header do Card: Avatar, Nome e Botão de Preview */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${voice.avatarColor} flex items-center justify-center text-white text-base font-extrabold shadow-sm relative border border-white/10`}
                >
                  <span>{voice.name[0]}</span>
                  {isSelectedSolo && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-sky-500 rounded-full flex items-center justify-center shadow-sm">
                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm text-slate-100 font-sans">{voice.name}</span>
                    {isSelectedSolo && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-sans">
                    {voice.gender === 'female' ? 'Feminina' : 'Masculina'}
                  </span>
                </div>
              </div>

              {/* Botão de Prévia de 3s Integrado no Card */}
              <button
                type="button"
                onClick={(e) => handlePlayPreview(e, voice)}
                disabled={isLoading}
                title={isPlaying ? `Pausar amostra de ${voice.name}` : `Ouvir amostra de 3s da voz ${voice.name}`}
                aria-label={`Ouvir amostra de 3 segundos da voz ${voice.name}`}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isPlaying
                    ? 'btn-matte-primary text-white shadow-md'
                    : 'btn-matte-dark text-slate-300 hover:text-white'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current translate-x-0.5 text-sky-400" />
                )}
              </button>
            </div>

            {/* Descrição e Arquétipo */}
            <div className="flex-1">
              <p className="text-xs font-bold text-sky-300 mb-1 flex items-center gap-1 font-sans">
                <span>{voice.archetype}</span>
              </p>
              <p className="text-[11px] text-slate-300 leading-snug line-clamp-2 font-sans">
                {voice.bestFor}
              </p>
            </div>

            {/* Rodapé de Ação e Seleção Tátil Explícita */}
            <div className="pt-2 border-t border-slate-800/60">
              {!multiSpeakerMode ? (
                /* Modo Solo: Botão de Seleção para Leitura */
                isSelectedSolo ? (
                  <div className="w-full py-1.5 px-3 rounded-xl btn-matte-primary text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm font-sans">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Voz Ativa no Leitor</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(voice);
                    }}
                    className="w-full py-1.5 px-3 rounded-xl btn-matte-dark text-slate-200 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sans"
                  >
                    <span>Selecionar esta Voz</span>
                  </button>
                )
              ) : (
                /* Modo Debate: Atribuição Direta para Orador 1 ou Orador 2 */
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="grid grid-cols-2 gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSpeakerSlot && onSelectSpeakerSlot(1, voice);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 font-sans ${
                        isSpk1
                          ? 'btn-matte-primary text-white shadow-sm ring-1 ring-sky-400/50'
                          : 'btn-matte-dark text-slate-300'
                      }`}
                    >
                      {isSpk1 ? '✓ Orador 1' : 'Definir Orador 1'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSpeakerSlot && onSelectSpeakerSlot(2, voice);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 font-sans ${
                        isSpk2
                          ? 'btn-matte-primary text-white shadow-sm ring-1 ring-emerald-400/50'
                          : 'btn-matte-dark text-slate-300'
                      }`}
                    >
                      {isSpk2 ? '✓ Orador 2' : 'Definir Orador 2'}
                    </button>
                  </div>
                  {!isSpk1 && !isSpk2 && (
                    <span className="text-[10px] text-slate-400 font-mono text-center block">
                      Toque para Orador {activeSlot}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

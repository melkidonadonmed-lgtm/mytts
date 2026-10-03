import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2, UserCheck } from 'lucide-react';
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
        const isSelectedSolo = !multiSpeakerMode && selectedVoice.id === voice.id;
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
            className={`relative group rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between gap-3 text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              isSelected
                ? 'bg-slate-900 border-amber-400 shadow-md shadow-amber-400/10'
                : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/90'
            }`}
          >
            {/* Header do Card: Avatar, Nome e Botão de Preview */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${voice.avatarColor} flex items-center justify-center text-white text-sm font-extrabold shadow-sm`}
                >
                  {voice.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-100">{voice.name}</span>
                    {isSelectedSolo && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    {voice.gender === 'female' ? 'Feminina' : 'Masculina'}
                  </span>
                </div>
              </div>

              {/* Botão de Prévia de 3s Integrado no Card */}
              <button
                type="button"
                onClick={(e) => handlePlayPreview(e, voice)}
                disabled={isLoading}
                aria-label={`Ouvir amostra de 3 segundos da voz ${voice.name}`}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isPlaying
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 scale-105'
                    : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current translate-x-0.5 text-amber-400" />
                )}
              </button>
            </div>

            {/* Descrição e Arquétipo */}
            <div>
              <p className="text-xs font-semibold text-amber-300/90 mb-1 flex items-center gap-1">
                <span>{voice.archetype}</span>
              </p>
              <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                {voice.bestFor}
              </p>
            </div>

            {/* Badges de Modo Debate (Speaker 1 / Speaker 2) */}
            {multiSpeakerMode && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
                {isSpk1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-bold">
                    <UserCheck className="w-3 h-3" /> Interlocutor 1
                  </span>
                )}
                {isSpk2 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold">
                    <UserCheck className="w-3 h-3" /> Interlocutor 2
                  </span>
                )}
                {!isSpk1 && !isSpk2 && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Toque para atribuir à Voz {activeSlot}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

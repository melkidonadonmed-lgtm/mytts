import React, { useState } from 'react';
import {
  Volume2,
  Check,
  Loader2,
  Play,
  Pause
} from 'lucide-react';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { base64ToBlobUrl, revokeAudioUrl } from '../utils/audio';
import { requestPreviewVoice } from '../services/apiClient';

interface VoiceLibraryProps {
  selectedVoice: VoiceProfile;
  onSelectVoice: (voice: VoiceProfile) => void;
}

export const VoiceLibrary: React.FC<VoiceLibraryProps> = ({
  selectedVoice,
  onSelectVoice,
}) => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      revokeAudioUrl(currentAudioUrlRef.current);
    };
  }, []);

  const previewVoice = async (voice: VoiceProfile): Promise<void> => {
    if (playingVoiceId === voice.id) {
      if (audioRef.current) audioRef.current.pause();
      setPlayingVoiceId(null);
      return;
    }

    try {
      setLoadingVoiceId(voice.id);
      const data = await requestPreviewVoice({
        voiceId: voice.id,
        speakerName: voice.name,
        language: 'pt-BR',
      });
      if (data.ok && data.success && data.audioBase64) {
        if (audioRef.current) audioRef.current.pause();
        revokeAudioUrl(currentAudioUrlRef.current);
        const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
        currentAudioUrlRef.current = blobUrl;

        const audio = new Audio(blobUrl);
        audioRef.current = audio;
        setPlayingVoiceId(voice.id);

        audio.onended = () => {
          setPlayingVoiceId(null);
          revokeAudioUrl(blobUrl);
        };
        audio.onerror = () => {
          setPlayingVoiceId(null);
          revokeAudioUrl(blobUrl);
        };
        await audio.play();
      }
    } catch (err: unknown) {
      console.error('Falha ao ouvir amostra de voz:', err);
    } finally {
      setLoadingVoiceId(null);
    }
  };

  return (
    <div data-state="idle" className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-4 py-8 pb-36">
      
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border  text-purple-800 dark:text-purple-300 text-xs font-semibold mb-3">
          <Volume2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>Catálogo Neural Gemini 3.1 Flash</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Biblioteca de Vozes Neurais
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-xl">
          Ouça amostras de alta fidelidade calibradas com respiração, pausas orgânicas e entonação de estúdio. Escolha a voz ideal para seu texto.
        </p>
      </div>

      {/* Grid de Vozes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GEMINI_VOICES.map((voice) => {
          const isSelected = selectedVoice.id === voice.id;
          const isPlaying = playingVoiceId === voice.id;
          const isLoading = loadingVoiceId === voice.id;

          return (
            <div
              key={voice.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectVoice(voice)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectVoice(voice);
                }
              }}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 group ${
                isSelected
                  ? 'ui-card-soft-active ring-1 ring-amber-400/40'
                  : 'ui-card-soft hover: dark:hover:'
              }`}
            >
              <div>
                {/* Header do Card com Avatar e Nome */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl surface-inset ${voice.avatarColor} flex items-center justify-center text-white font-extrabold text-base shadow-md`}
                    >
                      {voice.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                          {voice.name}
                        </h2>
                        {isSelected && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                            Selecionada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">
                        {voice.archetype}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded-lg border  dark:">
                    {voice.gender === 'female' ? 'Feminina' : 'Masculina'}
                  </span>
                </div>

                {/* Descrição e Estilo */}
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  {voice.styleDescription}
                </p>

                {/* Recomendado para */}
                <div className="mb-4 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border  dark: text-xs">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider block mb-1">
                    Indicado para:
                  </span>
                  <p className="text-slate-700 dark:text-slate-400 text-xs leading-relaxed">
                    {voice.bestFor}
                  </p>
                </div>
              </div>

              {/* Ações: Ouvir Amostra & Selecionar */}
              <div className="flex items-center gap-2 pt-2 border-t  dark:">
                {/* Botão Ouvir Amostra */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    previewVoice(voice);
                  }}
                  className={`flex-1 min-h-[42px] rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-px ${
                    isPlaying
                      ? 'btn-matte btn-matte-amber text-white font-bold shadow-sm'
                      : 'btn-matte ui-btn-tactile text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      <span>Gerando amostra...</span>
                    </>
                  ) : isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current text-white" />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current text-amber-600 dark:text-amber-400" />
                      <span>Ouvir Amostra (3s)</span>
                    </>
                  )}
                </button>

                {/* Botão Selecionar */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectVoice(voice);
                  }}
                  className={`min-h-[42px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-y-px ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border  cursor-default'
                      : 'btn-matte btn-matte-amber text-white shadow-sm'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Ativa</span>
                    </>
                  ) : (
                    <span>Usar esta Voz</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

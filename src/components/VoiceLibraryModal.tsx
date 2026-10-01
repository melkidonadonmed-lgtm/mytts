import React, { useState } from 'react';
import {
  Volume2,
  Check,
  Sparkles,
  Loader2,
  Play,
  Pause,
  User,
  Zap,
  Sliders,
  ShieldCheck
} from 'lucide-react';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';

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

  const previewVoice = async (voice: VoiceProfile) => {
    if (playingVoiceId === voice.id) {
      if (audioRef.current) audioRef.current.pause();
      setPlayingVoiceId(null);
      return;
    }

    try {
      setLoadingVoiceId(voice.id);
      const res = await fetch('/api/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          speakerName: voice.name,
          language: 'pt-BR',
        }),
      });

      const data = await res.json();
      if (data.success && data.audioBase64) {
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
        audioRef.current = audio;
        setPlayingVoiceId(voice.id);

        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => setPlayingVoiceId(null);
        await audio.play();
      }
    } catch (err) {
      console.error('Falha ao ouvir amostra de voz:', err);
    } finally {
      setLoadingVoiceId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-4 py-8 pb-36">
      
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-3">
          <Volume2 className="w-3.5 h-3.5 text-purple-400" />
          <span>Catálogo Neural Gemini 3.1 Flash</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Biblioteca de Vozes Neurais
        </h1>
        <p className="text-xs text-slate-400 mt-2 max-w-xl">
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
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900/90 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/30'
                  : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/80'
              }`}
            >
              <div>
                {/* Header do Card com Avatar e Nome */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${voice.avatarColor} flex items-center justify-center text-white font-extrabold text-base shadow-md`}
                    >
                      {voice.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-white tracking-tight">
                          {voice.name}
                        </h2>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                            Selecionada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-300/90 font-medium">
                        {voice.archetype}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                    {voice.gender === 'female' ? 'Feminina' : 'Masculina'}
                  </span>
                </div>

                {/* Descrição e Estilo */}
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {voice.styleDescription}
                </p>

                {/* Recomendado para */}
                <div className="mb-4 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Indicado para:
                  </span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {voice.bestFor}
                  </p>
                </div>
              </div>

              {/* Ações: Ouvir Amostra & Selecionar */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                {/* Botão Ouvir Amostra */}
                <button
                  type="button"
                  onClick={() => previewVoice(voice)}
                  className={`flex-1 min-h-[42px] rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 ${
                    isPlaying
                      ? 'bg-amber-400 text-slate-950 font-bold border-amber-300 shadow-sm'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-800'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Gerando amostra...</span>
                    </>
                  ) : isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
                      <span>Ouvir Amostra (3s)</span>
                    </>
                  )}
                </button>

                {/* Botão Selecionar */}
                <button
                  type="button"
                  onClick={() => onSelectVoice(voice)}
                  className={`min-h-[42px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
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

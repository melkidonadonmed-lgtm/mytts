import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Check, Loader2, Play, Pause } from 'lucide-react';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { base64ToBlobUrl, revokeAudioUrl, speakBrowserFallback, stopBrowserSpeech } from '../utils/audio';
import { requestPreviewVoice } from '../services/apiClient';
import { readFavoriteVoicesByLanguage, saveFavoriteVoicesByLanguage } from '../services/polyglotClient';
import { GoogleIcon } from './GoogleIcon';

export interface VoiceLibraryProps {
  selectedVoice: VoiceProfile;
  onSelectVoice: (voice: VoiceProfile) => void;
  favoriteVoicesByLang?: Record<'en' | 'it' | 'ja', string>;
  onChangeFavoriteVoice?: (lang: 'en' | 'it' | 'ja', voiceId: string) => void;
  onClose?: () => void;
}

export const VoiceLibrary: React.FC<VoiceLibraryProps> = ({
  selectedVoice,
  onSelectVoice,
  favoriteVoicesByLang,
  onChangeFavoriteVoice,
}) => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Record<'en' | 'it' | 'ja', string>>(() =>
    favoriteVoicesByLang || readFavoriteVoicesByLanguage()
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (favoriteVoicesByLang) setFavorites(favoriteVoicesByLang);
  }, [favoriteVoicesByLang]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      stopBrowserSpeech();
      revokeAudioUrl(currentAudioUrlRef.current);
    };
  }, []);

  const handleSelectFavorite = (lang: 'en' | 'it' | 'ja', voiceId: string): void => {
    const next = { ...favorites, [lang]: voiceId };
    setFavorites(next);
    saveFavoriteVoicesByLanguage(next);
    onChangeFavoriteVoice?.(lang, voiceId);
    window.dispatchEvent(new CustomEvent('mytts-favorite-voices-changed', { detail: next }));
  };

  const previewVoice = async (voice: VoiceProfile): Promise<void> => {
    if (playingVoiceId === voice.id) {
      if (audioRef.current) audioRef.current.pause();
      stopBrowserSpeech();
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
        stopBrowserSpeech();
        revokeAudioUrl(currentAudioUrlRef.current);
        const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
        currentAudioUrlRef.current = blobUrl;
        const audio = new Audio(blobUrl);
        audioRef.current = audio;
        setPlayingVoiceId(voice.id);
        audio.onended = () => { setPlayingVoiceId(null); revokeAudioUrl(blobUrl); };
        audio.onerror = () => { setPlayingVoiceId(null); revokeAudioUrl(blobUrl); };
        await audio.play();
      } else {
        throw new Error(data.error || 'Falha ao obter amostra neural.');
      }
    } catch (err: unknown) {
      console.warn('Falha ao ouvir amostra neural (acionando fallback Web Speech):', err);
      const started = speakBrowserFallback(
        `Olá, sou ${voice.name}. Esta é uma demonstração de síntese da minha voz no estúdio.`,
        {
          lang: 'pt-BR',
          rate: 1.0,
          voiceId: voice.id,
          onStart: () => setPlayingVoiceId(voice.id),
          onEnd: () => setPlayingVoiceId(null),
          onError: () => setPlayingVoiceId(null),
        }
      );
      if (started) setPlayingVoiceId(voice.id);
    } finally {
      setLoadingVoiceId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-4 py-6 pb-36 gap-6">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface-inset text-amber-300 text-xs font-semibold w-fit border border-amber-500/30">
          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Catálogo Neural Gemini 3.8 Flash TTS</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-primary font-display tracking-tight">
          Catálogo de Vozes &amp; Favoritas do Chat
        </h1>
        <p className="text-xs text-secondary max-w-2xl leading-relaxed">
          Ouça amostras com respiração orgânica e pausas naturais. Defina a voz ativa do estúdio e os timbres padrão para cada idioma do Chat Poliglota.
        </p>
      </div>

      <section aria-label="Vozes Favoritas por Idioma" className="p-4 rounded-2xl card-matte flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <GoogleIcon name="bookmark" size={18} className="text-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary font-mono">
              Vozes Favoritas do Chat Poliglota (EN, IT, JA)
            </h2>
          </div>
          <span className="text-[11px] text-secondary">Aplicadas automaticamente ao receber novas mensagens</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { code: 'en' as const, flag: 'EN', name: 'Inglês (EN)' },
            { code: 'it' as const, flag: 'IT', name: 'Italiano (IT)' },
            { code: 'ja' as const, flag: 'JA', name: 'Japonês (JA)' },
          ] as const).map((item) => {
            const currentVoiceId = favorites[item.code];
            const currentVoiceObj = GEMINI_VOICES.find((v) => v.id === currentVoiceId) || GEMINI_VOICES[0];
            const isCurrentVoiceActive = selectedVoice.id === currentVoiceId;

            return (
              <div key={item.code} className="p-3 rounded-xl surface-inset border border-slate-800/80 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30">{item.flag}</span>
                    <span>{item.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => previewVoice(currentVoiceObj)}
                    className="btn-compact-touch p-1 rounded-lg text-secondary hover:text-amber-300 cursor-pointer"
                    title={`Ouvir amostra de ${currentVoiceObj.name}`}
                  >
                    {playingVoiceId === currentVoiceObj.id ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${currentVoiceObj.avatarColor} flex items-center justify-center text-white text-[11px] font-extrabold shrink-0`}>
                    {currentVoiceObj.name[0]}
                  </div>
                  <select
                    aria-label={`Voz favorita para ${item.name}`}
                    value={currentVoiceId}
                    onChange={(e) => handleSelectFavorite(item.code, e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-primary font-mono cursor-pointer focus:outline-none focus:border-amber-400"
                  >
                    {GEMINI_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} · {v.archetype}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                  <span className="text-secondary font-mono truncate">{currentVoiceObj.archetype}</span>
                  <button
                    type="button"
                    onClick={() => onSelectVoice(currentVoiceObj)}
                    className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer transition-colors ${
                      isCurrentVoiceActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    {isCurrentVoiceActive ? 'Voz Ativa' : 'Tornar Ativa'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Catálogo de Vozes Neurais" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-secondary font-mono">Timbres Disponíveis no Gemini 3.8 Flash TTS</h2>
          <span className="text-[11px] text-secondary font-mono">Voz Ativa do Estúdio: <strong className="text-amber-300 font-bold">{selectedVoice.name}</strong></span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GEMINI_VOICES.map((voice) => {
            const isSelected = selectedVoice.id === voice.id;
            const isPlaying = playingVoiceId === voice.id;
            const isLoading = loadingVoiceId === voice.id;

            return (
              <div key={voice.id} className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${isSelected ? 'card-matte-active ring-1 ring-amber-400/40' : 'card-matte'}`}>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${voice.avatarColor} flex items-center justify-center text-white font-extrabold text-base shadow-md shrink-0`}>
                        {voice.name[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-primary tracking-tight font-display">{voice.name}</h3>
                          {isSelected && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">Ativa</span>}
                        </div>
                        <p className="text-xs text-amber-400 font-semibold font-mono">{voice.archetype}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-secondary surface-inset px-2 py-1 rounded-lg border border-slate-800">
                      {voice.gender === 'female' ? 'Feminina' : 'Masculina'}
                    </span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed mb-3">{voice.styleDescription}</p>
                  <div className="mb-4 p-2.5 rounded-xl surface-inset text-xs border border-slate-800/80">
                    <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider block mb-1 font-mono">Indicado para:</span>
                    <p className="text-secondary text-[11px] leading-relaxed">{voice.bestFor}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => previewVoice(voice)}
                    className={`flex-1 min-h-[44px] rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-px ${
                      isPlaying ? 'btn-matte-amber text-white font-bold shadow-sm' : 'btn-matte-dark text-secondary hover:text-primary'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span>Gerando amostra...</span>
                      </>
                    ) : isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current text-white" />
                        <span>Pausar</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
                        <span>Ouvir Amostra (3s)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectVoice(voice)}
                    className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-y-px ${
                      isSelected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default' : 'btn-matte-amber text-white shadow-sm'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Voz Ativa</span>
                      </>
                    ) : (
                      <span>Usar no Estúdio</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

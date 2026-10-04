import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  Globe2, 
  Gauge, 
  Flame, 
  Volume2,
  BrainCircuit,
  MessageSquareQuote,
  Check,
  Users
} from 'lucide-react';
import {
  AudienceLevel,
  DebateConfig,
  LanguageCode,
  SpeakerProfile,
  TensionIntensity,
} from '../types/debate';
import { LANGUAGE_OPTIONS } from '../data/sampleDebates';
import { VoiceCardGrid } from './VoiceCardGrid';
import { GEMINI_VOICES, VoiceProfile } from '../types/voices';

interface DebateConfigPanelProps {
  config: DebateConfig;
  onChangeConfig: (newConfig: DebateConfig) => void;
}

export const DebateConfigPanel: React.FC<DebateConfigPanelProps> = ({
  config,
  onChangeConfig,
}) => {
  const [activeMobileSpeaker, setActiveMobileSpeaker] = useState<0 | 1>(0);
  const [activeSlot, setActiveSlot] = useState<1 | 2>(1);

  const handleLanguageChange = (langCode: LanguageCode) => {
    const matched = LANGUAGE_OPTIONS.find((l) => l.code === langCode);
    if (matched) {
      onChangeConfig({
        ...config,
        language: langCode,
        speakers: matched.defaultSpeakers,
      });
    }
  };

  const handleSpeakerChange = (index: 0 | 1, field: keyof SpeakerProfile, value: string) => {
    const updatedSpeakers = [...config.speakers] as [SpeakerProfile, SpeakerProfile];
    updatedSpeakers[index] = {
      ...updatedSpeakers[index],
      [field]: value,
    };
    onChangeConfig({
      ...config,
      speakers: updatedSpeakers,
    });
  };

  const spk1Voice: VoiceProfile =
    GEMINI_VOICES.find((v) => v.id.toLowerCase() === (config.speakers[0]?.voiceId || '').toLowerCase()) ||
    GEMINI_VOICES[1]; // Kore fallback
  const spk2Voice: VoiceProfile =
    GEMINI_VOICES.find((v) => v.id.toLowerCase() === (config.speakers[1]?.voiceId || '').toLowerCase()) ||
    GEMINI_VOICES[0]; // Puck fallback

  const audienceLevels: { id: AudienceLevel; label: string; shortDesc: string }[] = [
    { id: 'layman', label: 'Leigo', shortDesc: 'Analogias' },
    { id: 'intermediate', label: 'Médio', shortDesc: 'Equilibrado' },
    { id: 'expert', label: 'Perito', shortDesc: 'Rigor Puro' },
  ];

  const tensionLevels: { id: TensionIntensity; label: string; shortDesc: string }[] = [
    { id: 'reflective', label: 'Reflexiva', shortDesc: 'Cautelosa' },
    { id: 'balanced', label: 'Equilibrada', shortDesc: 'Ágil' },
    { id: 'provocative', label: 'Provocativa', shortDesc: 'Atrito' },
  ];

  return (
    <section 
      aria-label="Painel de Calibração do Debate"
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 shadow-lg backdrop-blur-md"
    >
      <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 font-sans">
              Calibração do Debate
            </h2>
            <p className="text-[11px] text-slate-400">
              Ajuste idioma, profundidade e a postura dos debatedores.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-slate-950 px-2.5 py-1 border border-slate-800 text-[11px] font-mono text-slate-400">
          <span>24kHz</span>
          <span>•</span>
          <span className="text-sky-400">studio</span>
        </div>
      </div>

      {/* 2. Seleção de Idioma Matriz */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Globe2 className="h-4 w-4 text-sky-400" />
            <span>Idioma Matriz (Vozes Nativas)</span>
          </label>
          <span className="text-[11px] font-mono text-slate-400 uppercase">
            {config.language}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {LANGUAGE_OPTIONS.map((lang) => {
            const isSelected = config.language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageChange(lang.code)}
                className={`relative min-h-[48px] w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all active:translate-y-px cursor-pointer ${
                  isSelected
                    ? 'border-sky-500/60 bg-sky-500/15 text-white shadow-sm ring-1 ring-sky-500/30'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl leading-none">{lang.flag}</span>
                  <div className="truncate">
                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-sky-200' : 'text-slate-200'}`}>
                      {lang.nativeName}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{lang.name.split(' ')[0]}</p>
                  </div>
                </div>
                {isSelected && (
                  <Check className="h-4 w-4 text-sky-400 shrink-0 ml-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Controles Segmentados em Barra Única (Audience & Tension) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        
        {/* Nível do Público */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 font-sans">
            <Gauge className="h-4 w-4 text-sky-400" />
            <span>Nível do Público</span>
          </label>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-950/80 p-1 border border-slate-800">
            {audienceLevels.map((lvl) => {
              const active = config.audienceLevel === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => onChangeConfig({ ...config, audienceLevel: lvl.id })}
                  className={`min-h-[44px] flex flex-col items-center justify-center rounded-lg px-2 py-1 text-center transition-all active:translate-y-px cursor-pointer font-sans ${
                    active
                      ? 'bg-sky-500/20 border border-sky-400/50 text-sky-200 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-semibold leading-tight">{lvl.label}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{lvl.shortDesc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tensão Dialética */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 font-sans">
            <Flame className="h-4 w-4 text-sky-400" />
            <span>Intensidade do Conflito</span>
          </label>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-950/80 p-1 border border-slate-800">
            {tensionLevels.map((t) => {
              const active = config.tensionIntensity === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeConfig({ ...config, tensionIntensity: t.id })}
                  className={`min-h-[44px] flex flex-col items-center justify-center rounded-lg px-2 py-1 text-center transition-all active:translate-y-px cursor-pointer font-sans ${
                    active
                      ? 'bg-sky-500/20 border border-sky-400/50 text-sky-200 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-semibold leading-tight">{t.label}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{t.shortDesc}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* 4. Grade de Seleção de Vozes por Card (Visual Tátil) */}
      <div className="pt-2 border-t border-slate-800/80 mb-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-sans">
              Selecione as Vozes Neurais por Card:
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-slate-400">Atribuindo para:</span>
            <button
              type="button"
              onClick={() => setActiveSlot(activeSlot === 1 ? 2 : 1)}
              className="px-2.5 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-400/40 font-bold cursor-pointer"
            >
              Orador {activeSlot}
            </button>
          </div>
        </div>

        <VoiceCardGrid
          selectedVoice={spk1Voice}
          onSelectVoice={() => {}}
          multiSpeakerMode={true}
          speaker1={spk1Voice}
          speaker2={spk2Voice}
          activeSlot={activeSlot}
          onSelectSpeakerSlot={(slot, voice) => {
            if (slot === 1) {
              handleSpeakerChange(0, 'voiceId', voice.id);
              handleSpeakerChange(0, 'name', voice.name);
              handleSpeakerChange(0, 'roleTitle', voice.archetype);
              setActiveSlot(2);
            } else {
              handleSpeakerChange(1, 'voiceId', voice.id);
              handleSpeakerChange(1, 'name', voice.name);
              handleSpeakerChange(1, 'roleTitle', voice.archetype);
              setActiveSlot(1);
            }
          }}
        />
      </div>

      {/* 5. Personas dos Debatedores com Tab Switcher no Mobile */}
      <div className="pt-2 border-t border-slate-800/80">
        
        {/* Switcher visível apenas em telas menores que MD */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 font-sans">Configuração dos Debatedores</span>
          
          <div className="flex md:hidden rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveMobileSpeaker(0)}
              className={`min-h-[38px] px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeMobileSpeaker === 0
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                  : 'text-slate-400'
              }`}
            >
              1. {config.speakers[0].name || 'Orador 1'}
            </button>
            <button
              type="button"
              onClick={() => setActiveMobileSpeaker(1)}
              className={`min-h-[38px] px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeMobileSpeaker === 1
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : 'text-slate-400'
              }`}
            >
              2. {config.speakers[1].name || 'Orador 2'}
            </button>
          </div>
        </div>

        {/* Container das Personas: No Mobile exibe a aba ativa; no Desktop exibe grid lado a lado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card Interlocutor 1 (Tese / Analítico) */}
          <div className={`rounded-xl border border-sky-500/20 bg-gradient-to-b from-sky-500/5 to-slate-950/70 p-4 transition-all ${
            activeMobileSpeaker === 0 ? 'block' : 'hidden md:block'
          }`}>
            <div className="mb-3 flex items-center justify-between border-b border-sky-500/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                  <BrainCircuit className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-sky-300 uppercase tracking-wider font-sans">
                    Orador 1 (Tese & Evidência)
                  </h3>
                  <p className="text-[11px] text-slate-400">Perfil metódico e analítico</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/10 px-2.5 py-1 text-[11px] font-mono text-sky-300 border border-sky-400/30 font-bold">
                <Volume2 className="h-3.5 w-3.5" />
                {config.speakers[0].voiceId}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block font-sans">Nome do Debatedor</label>
                <input
                  type="text"
                  value={config.speakers[0].name}
                  onChange={(e) => handleSpeakerChange(0, 'name', e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-base md:text-xs text-slate-100 placeholder-slate-600 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block font-sans">Papel Conceitual</label>
                <input
                  type="text"
                  value={config.speakers[0].roleTitle}
                  onChange={(e) => handleSpeakerChange(0, 'roleTitle', e.target.value)}
                  placeholder="ex.: Analista Teórica & Investigativa"
                  className="min-h-[44px] w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-base md:text-xs text-slate-200 placeholder-slate-600 focus:border-sky-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card Interlocutor 2 (Antítese / Provocador) */}
          <div className={`rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/5 to-slate-950/70 p-4 transition-all ${
            activeMobileSpeaker === 1 ? 'block' : 'hidden md:block'
          }`}>
            <div className="mb-3 flex items-center justify-between border-b border-emerald-500/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <MessageSquareQuote className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider font-sans">
                    Orador 2 (Antítese & Prática)
                  </h3>
                  <p className="text-[11px] text-slate-400">Perfil cético e provocador</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-mono text-emerald-300 border border-emerald-400/30 font-bold">
                <Volume2 className="h-3.5 w-3.5" />
                {config.speakers[1].voiceId}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block font-sans">Nome do Debatedor</label>
                <input
                  type="text"
                  value={config.speakers[1].name}
                  onChange={(e) => handleSpeakerChange(1, 'name', e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-base md:text-xs text-slate-100 placeholder-slate-600 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block font-sans">Papel Conceitual</label>
                <input
                  type="text"
                  value={config.speakers[1].roleTitle}
                  onChange={(e) => handleSpeakerChange(1, 'roleTitle', e.target.value)}
                  placeholder="ex.: Provocador Pragmático & Cético"
                  className="min-h-[44px] w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-base md:text-xs text-slate-200 placeholder-slate-600 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

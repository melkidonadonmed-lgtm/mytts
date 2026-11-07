/**
 * Painel de configuração de Conversa & Debate — resolvido com 2 cards selecionáveis
 * (Voz Neural, Idioma e Estilo) + Seletor de Formato de Renderização (Debate, Podcast, Bar, Jantar).
 */
import React, { useState, useRef } from 'react';
import {
  ConversationFormat,
  DebateConfig,
  LanguageCode,
  SpeakerProfile,
  TensionIntensity,
} from '../types/debate';
import { LANGUAGE_OPTIONS } from '../data/sampleDebates';
import { GEMINI_VOICES } from '../types/voices';
import { GoogleIcon } from './GoogleIcon';
import { requestPreviewVoice } from '../services/apiClient';
import { base64ToBlobUrl, revokeAudioUrl, speakBrowserFallback } from '../utils/audio';

interface DebateConfigPanelProps {
  config: DebateConfig;
  onChangeConfig: (newConfig: DebateConfig) => void;
  hideFormatSelector?: boolean;
}

export const SPEAKER_STYLE_OPTIONS: {
  label: string;
  roleTitle: string;
  archetype: 'analytical' | 'provocateur';
  tensionHint?: TensionIntensity;
}[] = [
  {
    label: 'Analítico & Crítico (Rigor Metodológico)',
    roleTitle: 'Analista Teórico & Fundamentado',
    archetype: 'analytical',
    tensionHint: 'balanced',
  },
  {
    label: 'Provocador Pragmático (Cético & Direto)',
    roleTitle: 'Provocador Pragmático & Cético',
    archetype: 'provocateur',
    tensionHint: 'provocative',
  },
  {
    label: 'Host de Podcast (Curioso & Dinâmico)',
    roleTitle: 'Co-Host de Podcast & Investigador',
    archetype: 'analytical',
    tensionHint: 'balanced',
  },
  {
    label: 'Conversa de Bar (Coloquial & Espontâneo)',
    roleTitle: 'Amigo de Bar Franco & Bem-Humorado',
    archetype: 'provocateur',
    tensionHint: 'provocative',
  },
  {
    label: 'Mesa de Jantar (Caloroso & Reflexivo)',
    roleTitle: 'Anfitrião Caloroso & Contador de Histórias',
    archetype: 'analytical',
    tensionHint: 'reflective',
  },
  {
    label: 'Didático & Técnico (Explicação Clara)',
    roleTitle: 'Especialista Didático & Prático',
    archetype: 'analytical',
    tensionHint: 'reflective',
  },
];

export const FORMAT_RENDER_OPTIONS: {
  id: ConversationFormat;
  label: string;
  badge: string;
  icon: string;
  desc: string;
  defaultTension: TensionIntensity;
}[] = [
  {
    id: 'debate',
    label: 'Debate Dialético',
    badge: 'Embate',
    icon: 'forum',
    desc: 'Tese vs. antítese sem clichês de concordância',
    defaultTension: 'provocative',
  },
  {
    id: 'podcast',
    label: 'Podcast de Estúdio',
    badge: '2 Hosts',
    icon: 'podcasts',
    desc: 'Co-apresentadores curiosos com ritmo radiofônico',
    defaultTension: 'balanced',
  },
  {
    id: 'bar_chat',
    label: 'Conversa de Bar',
    badge: 'Coloquial',
    icon: 'local_cafe',
    desc: 'Papo descontraído, franco e espontâneo entre amigos',
    defaultTension: 'provocative',
  },
  {
    id: 'dinner',
    label: 'Mesa de Jantar',
    badge: 'Família',
    icon: 'restaurant',
    desc: 'Conversa calorosa, reflexiva e acolhedora',
    defaultTension: 'reflective',
  },
];

export const DebateConfigPanel: React.FC<DebateConfigPanelProps> = ({
  config,
  onChangeConfig,
  hideFormatSelector = false,
}) => {
  const [previewingSlot, setPreviewingSlot] = useState<0 | 1 | null>(null);
  const previewAudioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);

  const activeFormat: ConversationFormat = config.format || 'debate';

  const handleFormatChange = (format: ConversationFormat) => {
    const preset = FORMAT_RENDER_OPTIONS.find((f) => f.id === format);
    const updatedSpeakers = [...config.speakers] as [SpeakerProfile, SpeakerProfile];

    if (format === 'podcast') {
      updatedSpeakers[0] = { ...updatedSpeakers[0], roleTitle: 'Co-Host de Podcast & Investigador' };
      updatedSpeakers[1] = { ...updatedSpeakers[1], roleTitle: 'Co-Host Convidado & Pragmático' };
    } else if (format === 'bar_chat') {
      updatedSpeakers[0] = { ...updatedSpeakers[0], roleTitle: 'Amigo de Bar Observador & Irônico' };
      updatedSpeakers[1] = { ...updatedSpeakers[1], roleTitle: 'Amigo de Bar Franco & Bem-Humorado' };
    } else if (format === 'dinner') {
      updatedSpeakers[0] = { ...updatedSpeakers[0], roleTitle: 'Anfitrião Caloroso & Reflexivo' };
      updatedSpeakers[1] = { ...updatedSpeakers[1], roleTitle: 'Convidado de Jantar & Contador de Histórias' };
    } else {
      updatedSpeakers[0] = { ...updatedSpeakers[0], roleTitle: 'Analista Teórico & Fundamentado' };
      updatedSpeakers[1] = { ...updatedSpeakers[1], roleTitle: 'Provocador Pragmático & Cético' };
    }

    onChangeConfig({
      ...config,
      format,
      tensionIntensity: preset?.defaultTension || config.tensionIntensity,
      speakers: updatedSpeakers,
    });
  };

  const handleLanguageChange = (langCode: LanguageCode) => {
    const matched = LANGUAGE_OPTIONS.find((l) => l.code === langCode);
    onChangeConfig({
      ...config,
      language: langCode,
      speakers: matched ? matched.defaultSpeakers : config.speakers,
    });
  };

  const handleSpeakerChange = (index: 0 | 1, field: keyof SpeakerProfile, value: string) => {
    const updatedSpeakers = [...config.speakers] as [SpeakerProfile, SpeakerProfile];
    const nextSpeaker = {
      ...updatedSpeakers[index],
      [field]: value,
    };

    // Quando o usuário troca a voz na lista, sincroniza o nome padrão se for nome de voz
    if (field === 'voiceId') {
      const voiceObj = GEMINI_VOICES.find((v) => v.id === value);
      if (voiceObj) {
        nextSpeaker.name = voiceObj.name;
      }
    }

    updatedSpeakers[index] = nextSpeaker;
    onChangeConfig({
      ...config,
      speakers: updatedSpeakers,
    });
  };

  const handlePreviewSpeaker = async (index: 0 | 1) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.audio.pause();
      revokeAudioUrl(previewAudioRef.current.url);
      previewAudioRef.current = null;
    }

    if (previewingSlot === index) {
      setPreviewingSlot(null);
      return;
    }

    const spk = config.speakers[index];
    setPreviewingSlot(index);

    try {
      const res = await requestPreviewVoice({
        voiceId: spk.voiceId,
        speakerName: spk.name,
        language: config.language,
      });
      if (res.ok && res.audioBase64) {
        const url = base64ToBlobUrl(res.audioBase64, 'audio/wav');
        const audio = new Audio(url);
        audio.preservesPitch = true;
        previewAudioRef.current = { audio, url };
        audio.onended = () => setPreviewingSlot(null);
        audio.onerror = () => setPreviewingSlot(null);
        await audio.play();
        return;
      }
    } catch (err: unknown) {
      console.warn('Erro ao reproduzir preview de voz no painel de debate:', err);
    }

    speakBrowserFallback(`Olá, eu sou ${spk.name}, na configuração ${spk.roleTitle}.`, {
      lang: config.language,
      voiceId: spk.voiceId,
      onEnd: () => setPreviewingSlot(null),
      onError: () => setPreviewingSlot(null),
    });
  };

  return (
    <section
      data-state="idle"
      aria-busy="false"
      aria-label="Configuração da Conversa em 2 Cards"
      className="flex flex-col gap-4"
    >
      {/* 1. Barra de Formato de Renderização (Debate, Podcast, Conversa de Bar, Mesa de Jantar) */}
      {!hideFormatSelector && (
      <div className="rounded-2xl card-matte p-3.5 sm:p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GoogleIcon name="tune" size={18} className="text-amber-400" />
            <h2 className="text-xs sm:text-sm font-bold text-primary font-display">
              Formato de Renderização da Conversa
            </h2>
          </div>
          <span className="text-[11px] font-mono text-secondary">
            Escolha a dinâmica e configure as 2 vozes nos cards abaixo
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {FORMAT_RENDER_OPTIONS.map((fmt) => {
            const isSelected = activeFormat === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleFormatChange(fmt.id)}
                className={`p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? 'card-matte-active ring-1 ring-amber-400/50'
                    : 'btn-matte-dark hover:border-amber-400/30'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary font-display">
                    <GoogleIcon
                      name={fmt.icon}
                      size={16}
                      className={isSelected ? 'text-amber-400' : 'text-secondary'}
                    />
                    <span>{fmt.label}</span>
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'surface-inset text-secondary'
                    }`}
                  >
                    {fmt.badge}
                  </span>
                </div>
                <p className="text-[11px] text-secondary leading-snug">{fmt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* 2. Os DOIS Cards Selecionáveis (Voz Neural + Idioma + Estilo) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {([0, 1] as const).map((idx) => {
          const spk = config.speakers[idx];
          const isFirst = idx === 0;
          const voiceMeta =
            GEMINI_VOICES.find((v) => v.id.toLowerCase() === spk.voiceId.toLowerCase()) ||
            GEMINI_VOICES[idx];

          return (
            <div
              key={spk.id}
              className="rounded-2xl card-matte p-4 flex flex-col gap-3.5 transition-all"
            >
              {/* Topo do Card: Avatar da Voz + Nome Editável + Botão Ouvir Preview */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/60">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${voiceMeta.avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0`}
                  >
                    {spk.name?.[0] || voiceMeta.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber-400 block">
                      {isFirst ? 'Card 1 · Primeiro Interlocutor' : 'Card 2 · Segundo Interlocutor'}
                    </span>
                    <input
                      type="text"
                      aria-label={`Nome do Interlocutor ${idx + 1}`}
                      value={spk.name}
                      onChange={(e) => handleSpeakerChange(idx, 'name', e.target.value)}
                      placeholder={voiceMeta.name}
                      className="w-full bg-transparent text-sm font-bold text-primary font-display focus:outline-none border-b border-transparent focus:border-amber-400/60 truncate"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handlePreviewSpeaker(idx)}
                  className={`h-9 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                    previewingSlot === idx
                      ? 'btn-matte-amber text-white'
                      : 'btn-matte-dark text-secondary hover:text-primary'
                  }`}
                  title={`Ouvir amostra da voz ${spk.voiceId}`}
                >
                  <GoogleIcon
                    name={previewingSlot === idx ? 'stop' : 'volume_up'}
                    size={16}
                    className={previewingSlot === idx ? 'text-white' : 'text-amber-400'}
                  />
                  <span>{previewingSlot === idx ? 'Ouvindo' : 'Ouvir Voz'}</span>
                </button>
              </div>

              {/* Lista Selecionável 1: Nome da Voz Neural */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`debate-card-voice-${idx}`}
                  className="text-[11px] font-mono uppercase tracking-wider text-secondary font-semibold flex items-center justify-between"
                >
                  <span>1. Voz Neural</span>
                  <span className="text-amber-400">{voiceMeta.archetype}</span>
                </label>
                <select
                  id={`debate-card-voice-${idx}`}
                  value={spk.voiceId}
                  onChange={(e) => handleSpeakerChange(idx, 'voiceId', e.target.value)}
                  className="w-full h-10 px-3 rounded-xl input-sunken text-xs font-bold text-primary cursor-pointer focus:outline-none"
                >
                  {GEMINI_VOICES.map((v) => (
                    <option
                      key={v.id}
                      value={v.id}
                      className="bg-slate-900 text-slate-100"
                    >
                      {v.name} ({v.gender === 'male' ? 'Masculina' : 'Feminina'}) — {v.archetype}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lista Selecionável 2: Idioma */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`debate-card-lang-${idx}`}
                  className="text-[11px] font-mono uppercase tracking-wider text-secondary font-semibold flex items-center justify-between"
                >
                  <span>2. Idioma da Conversa</span>
                  <span>{config.language}</span>
                </label>
                <select
                  id={`debate-card-lang-${idx}`}
                  value={config.language}
                  onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
                  className="w-full h-10 px-3 rounded-xl input-sunken text-xs font-bold text-primary cursor-pointer focus:outline-none"
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option
                      key={lang.code}
                      value={lang.code}
                      className="bg-slate-900 text-slate-100"
                    >
                      {lang.flag} · {lang.name} ({lang.nativeName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Lista Selecionável 3: Estilo / Postura na Conversa */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`debate-card-style-${idx}`}
                  className="text-[11px] font-mono uppercase tracking-wider text-secondary font-semibold"
                >
                  3. Estilo & Papel na Dinâmica
                </label>
                <select
                  id={`debate-card-style-${idx}`}
                  value={spk.roleTitle}
                  onChange={(e) => handleSpeakerChange(idx, 'roleTitle', e.target.value)}
                  className="w-full h-10 px-3 rounded-xl input-sunken text-xs font-bold text-primary cursor-pointer focus:outline-none"
                >
                  {SPEAKER_STYLE_OPTIONS.map((st) => (
                    <option
                      key={st.roleTitle}
                      value={st.roleTitle}
                      className="bg-slate-900 text-slate-100"
                    >
                      {st.label}
                    </option>
                  ))}
                  {!SPEAKER_STYLE_OPTIONS.some((s) => s.roleTitle === spk.roleTitle) && (
                    <option value={spk.roleTitle} className="bg-slate-900 text-slate-100">
                      {spk.roleTitle}
                    </option>
                  )}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

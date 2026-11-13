/**
 * VoiceConfigWorkspace — Unifica Criação de Vozes, Biblioteca/Favoritas e Debate em "Configuração de Vozes".
 */
import React from 'react';
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
import { VoiceLibrary } from './VoiceLibraryModal';
import { StudioWorkspace } from './StudioWorkspace';
import { DocumentInputSection } from './DocumentInputSection';
import { DebateConfigPanel } from './DebateConfigPanel';
import { ScriptViewer } from './ScriptViewer';
import { GoogleIcon } from './GoogleIcon';

export type VoiceConfigSubTab = 'catalog' | 'solo' | 'debate';

export interface VoiceConfigWorkspaceProps {
  activeSubTab: VoiceConfigSubTab;
  onChangeSubTab: (subTab: VoiceConfigSubTab) => void;
  selectedVoice: VoiceProfile;
  onSelectVoice: (voice: VoiceProfile) => void;
  favoriteVoicesByLang: Record<'en' | 'it' | 'ja', string>;
  onChangeFavoriteVoice: (lang: 'en' | 'it' | 'ja', voiceId: string) => void;
  text: string;
  onChangeText: (text: string) => void;
  player: GaplessAudioPlayer;
  isPlaying: boolean;
  playerCurrentTurn: number;
  script: DebateScript;
  setScript: React.Dispatch<React.SetStateAction<DebateScript>>;
  debateConfig: DebateConfig;
  onChangeDebateConfig: (config: DebateConfig) => void;
  studioRenderMode: StudioRenderMode;
  onChangeStudioRenderMode: (mode: StudioRenderMode) => void;
  onGenerateDebate: (
    speakers: [SpeakerProfile, SpeakerProfile],
    tension: 'friendly' | 'balanced' | 'provocative',
    format?: ConversationFormat,
    language?: LanguageCode
  ) => Promise<void>;
  onGenerateScriptFromConfig?: () => Promise<void>;
  isGeneratingDebate: boolean;
  isSynthesizingDebate: boolean;
  onSynthesizeSingleTurn: (turnIndex: number) => Promise<void>;
  onPlayTurn: (turnIndex: number) => void;
  onUpdateTurnText: (turnIndex: number, newText: string) => void;
  onUpdateTurnVoice: (turnIndex: number, newVoiceId: string) => void;
  onOpenPolyglotTab: () => void;
}

const SUB_TABS: Array<{
  id: VoiceConfigSubTab;
  label: string;
  icon: string;
  badge: string;
}> = [
  { id: 'catalog', label: 'Catálogo & Favoritas', icon: 'record_voice_over', badge: '5 Timbres' },
  { id: 'solo', label: 'Leitura Solo (1 Voz)', icon: 'headphones', badge: 'Solo' },
  { id: 'debate', label: 'Debate & Diálogo (2 Vozes)', icon: 'forum', badge: '2 Vozes' },
];

export const VoiceConfigWorkspace: React.FC<VoiceConfigWorkspaceProps> = ({
  activeSubTab,
  onChangeSubTab,
  selectedVoice,
  onSelectVoice,
  favoriteVoicesByLang,
  onChangeFavoriteVoice,
  text,
  onChangeText,
  player,
  isPlaying,
  playerCurrentTurn,
  script,
  setScript,
  debateConfig,
  onChangeDebateConfig,
  studioRenderMode,
  onChangeStudioRenderMode,
  onGenerateDebate,
  isGeneratingDebate,
  isSynthesizingDebate,
  onSynthesizeSingleTurn,
  onPlayTurn,
  onUpdateTurnText,
  onUpdateTurnVoice,
}) => {
  return (
    <div className="flex-1 flex flex-col w-full min-w-0">
      {/* Sub-header de Navegação Horizontal das Vozes */}
      <div className="w-full border-b border-slate-800/80 bg-slate-950/40 sticky top-0 z-20">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-secondary font-mono">
              Configuração de Vozes:
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Sub-módulos de Configuração de Vozes"
            className="flex items-center gap-1.5 p-1 rounded-2xl surface-inset border border-slate-800 overflow-x-auto no-scrollbar"
          >
            {SUB_TABS.map((tab) => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => onChangeSubTab(tab.id)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? 'border-amber-400 bg-amber-500/15 text-amber-300 shadow-sm'
                      : 'border-transparent text-secondary hover:text-primary hover:bg-slate-800/40'
                  }`}
                >
                  <GoogleIcon
                    name={tab.icon}
                    size={16}
                    filled={isActive}
                    className={isActive ? 'text-amber-400' : undefined}
                  />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded border tabular-nums ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 font-bold'
                        : 'bg-slate-900 text-secondary border-slate-800'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Painéis de Conteúdo por Sub-Aba */}
      <div className="flex-1 flex flex-col w-full">
        {activeSubTab === 'catalog' && (
          <div role="tabpanel" id="panel-catalog" aria-labelledby="tab-catalog" className="w-full">
            <VoiceLibrary
              selectedVoice={selectedVoice}
              onSelectVoice={onSelectVoice}
              favoriteVoicesByLang={favoriteVoicesByLang}
              onChangeFavoriteVoice={onChangeFavoriteVoice}
            />
          </div>
        )}

        {activeSubTab === 'solo' && (
          <div role="tabpanel" id="panel-solo" aria-labelledby="tab-solo" className="w-full">
            <StudioWorkspace
              text={text}
              onChangeText={onChangeText}
              selectedVoice={selectedVoice}
              onSelectVoice={onSelectVoice}
              lockedRenderMode="solo"
              player={player}
              isPlaying={isPlaying}
              playerCurrentTurn={playerCurrentTurn}
              script={script}
              setScript={setScript}
              onGenerateDebate={onGenerateDebate}
              isGeneratingDebate={isGeneratingDebate}
              isSynthesizingDebate={isSynthesizingDebate}
              onSynthesizeSingleTurn={onSynthesizeSingleTurn}
              onPlayTurn={onPlayTurn}
              onUpdateTurnText={onUpdateTurnText}
              onUpdateTurnVoice={onUpdateTurnVoice}
              studioRenderMode={studioRenderMode}
              onChangeStudioRenderMode={onChangeStudioRenderMode}
            />
          </div>
        )}

        {activeSubTab === 'debate' && (
          <div
            role="tabpanel"
            id="panel-debate"
            aria-labelledby="tab-debate"
            className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-36 flex flex-col gap-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight font-display">
                  Estúdio de Debate &amp; Conversa (2 Vozes)
                </h2>
                <p className="text-xs text-secondary mt-1">
                  Crie embates dialéticos, podcasts ou conversas dinâmicas a partir de documentos com vozes alternadas por turno.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-xl shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Dual Speaker TTS ({debateConfig.speakers[0].name} &amp; {debateConfig.speakers[1].name})</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 flex flex-col gap-6">
                <DocumentInputSection
                  currentLanguage={debateConfig.language}
                  textInput={text}
                  onChangeText={onChangeText}
                  onGenerateDebate={() => {
                    const mappedTension =
                      debateConfig.tensionIntensity === 'reflective'
                        ? 'friendly'
                        : debateConfig.tensionIntensity;
                    return onGenerateDebate(
                      debateConfig.speakers,
                      mappedTension,
                      debateConfig.format,
                      debateConfig.language
                    );
                  }}
                  isGenerating={isGeneratingDebate || isSynthesizingDebate}
                />
                <DebateConfigPanel
                  config={debateConfig}
                  onChangeConfig={onChangeDebateConfig}
                />
              </div>

              <div className="lg:col-span-7 flex flex-col gap-4">
                <ScriptViewer
                  script={script}
                  currentTurnIndex={playerCurrentTurn}
                  isPlaying={isPlaying}
                  onPlayTurn={onPlayTurn}
                  onSynthesizeTurn={onSynthesizeSingleTurn}
                  onUpdateTurnText={onUpdateTurnText}
                  onUpdateTurnVoice={onUpdateTurnVoice}
                  isSynthesizing={isSynthesizingDebate}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

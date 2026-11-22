import React from 'react';
import { Download, Layers, Loader2, Radio, Volume2 } from 'lucide-react';
import {
  SOUNDTRACK_PRESETS,
  type SoundtrackConfig,
  type SoundtrackPreset,
} from '../../utils/audioEngine';

interface SoundtrackDrawerTabProps {
  soundtrackConfig: SoundtrackConfig;
  isDucking: boolean;
  isExportingMaster: boolean;
  onSelectSoundtrack: (presetId: SoundtrackPreset) => void;
  onChangeSoundtrackVolume: (vol: number) => void;
  onToggleDucking: () => void;
  onChangeDuckingDepth: (depthDb: number) => void;
  onChangeVoiceBoost: (boostDb: number) => void;
  onExportMasterMix: () => void;
}

export const SoundtrackDrawerTab: React.FC<SoundtrackDrawerTabProps> = ({
  soundtrackConfig,
  isDucking,
  isExportingMaster,
  onSelectSoundtrack,
  onChangeSoundtrackVolume,
  onToggleDucking,
  onChangeDuckingDepth,
  onChangeVoiceBoost,
  onExportMasterMix,
}) => {
  return (
    <div className="space-y-3">
      {/* Procedural Soundscape Selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Selecione o Soundscape de Fundo
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Procedural Web Audio • Zero Download
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {SOUNDTRACK_PRESETS.map((preset) => {
            const isSelected = soundtrackConfig.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectSoundtrack(preset.id)}
                className={`min-h-11 p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden group ${
                  isSelected
                    ? 'bg-slate-900 border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50'
                    : 'bg-slate-950/60 border-[var(--border-subtle)] hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                {isSelected && (
                  <div
                    className="absolute top-0 right-0 w-8 h-8 pointer-events-none opacity-20 rounded-bl-xl"
                    style={{ backgroundColor: preset.color || 'var(--brand-accent)' }}
                  />
                )}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-[var(--border-subtle)]">
                    {preset.icon}
                  </span>
                  {isSelected && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-100 truncate">
                    {preset.ptName.split(' ')[0]} {preset.ptName.split(' ')[1] || ''}
                  </p>
                  <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                    {preset.id === 'custom' && soundtrackConfig.customFileName
                      ? soundtrackConfig.customFileName
                      : preset.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mixing & Auto-Ducking Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900/90 rounded-xl p-3 border border-[var(--border-subtle)] shadow-inner">
        {/* Soundtrack Volume */}
        <div className="md:col-span-4 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              Volume da Trilha
            </span>
            <span className="text-xs font-mono font-bold text-amber-300">
              {Math.round(soundtrackConfig.musicVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={soundtrackConfig.musicVolume}
            onChange={(e) => onChangeSoundtrackVolume(parseFloat(e.target.value))}
            disabled={soundtrackConfig.preset === 'none'}
            aria-label="Volume da trilha sonora"
            className="w-full min-h-11 accent-amber-400 cursor-pointer disabled:opacity-40"
          />
          <p className="text-[10px] text-slate-400">
            Ajusta a intensidade da ambiência sonora relativa à voz.
          </p>
        </div>

        {/* Auto-Ducking */}
        <div className="md:col-span-4 flex flex-col justify-between gap-1.5 border-t md:border-t-0 md:border-l border-[var(--border-subtle)] md:pl-3 pt-2 md:pt-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              Auto-Ducking Dinâmico
            </span>
            <button
              type="button"
              onClick={onToggleDucking}
              className={`min-h-11 inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-3 rounded-lg cursor-pointer transition-all border border-[var(--border-subtle)] ${
                soundtrackConfig.duckingEnabled
                  ? 'card-matte-active text-primary'
                  : 'surface-inset-pill text-secondary'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: soundtrackConfig.duckingEnabled
                    ? 'var(--status-success)'
                    : 'var(--status-neutral)',
                }}
              />
              <span>{soundtrackConfig.duckingEnabled ? 'ATIVO' : 'DESLIGADO'}</span>
            </button>
          </div>

          {/* Attenuation Depth */}
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: 'Suave', db: -8 },
              { label: 'Studio', db: -14 },
              { label: 'Profundo', db: -20 },
            ].map((lvl) => (
              <button
                key={lvl.db}
                type="button"
                onClick={() => onChangeDuckingDepth(lvl.db)}
                disabled={!soundtrackConfig.duckingEnabled}
                className={`min-h-11 px-1 text-[11px] font-mono rounded-lg border transition-all cursor-pointer ${
                  soundtrackConfig.duckingDepthDb === lvl.db
                    ? 'btn-matte-primary text-white font-bold border-sky-400/50 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-[var(--border-subtle)] hover:border-slate-700'
                } disabled:opacity-40`}
              >
                {lvl.label} ({lvl.db}dB)
              </button>
            ))}
          </div>

          {/* Real-time Ducking Status */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isDucking ? 'bg-sky-400 animate-ping' : 'bg-slate-600'
              }`}
            />
            <span className={isDucking ? 'text-sky-300 font-semibold' : 'text-slate-500'}>
              {isDucking
                ? `Ducking Ativo (${soundtrackConfig.duckingDepthDb}dB)`
                : 'Trilha em Volume Nominal'}
            </span>
          </div>
        </div>

        {/* Vocal Presence & Master Export */}
        <div className="md:col-span-4 flex flex-col justify-between gap-2 border-t md:border-t-0 md:border-l border-[var(--border-subtle)] md:pl-3 pt-2 md:pt-0">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1 font-sans">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Reforço Vocal
              </span>
              <span className="text-xs font-mono font-bold text-purple-300">
                +{soundtrackConfig.voiceBoostDb}dB
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[0, 3, 6].map((boost) => (
                <button
                  key={boost}
                  type="button"
                  onClick={() => onChangeVoiceBoost(boost)}
                  className={`min-h-11 text-[11px] font-mono rounded-lg border transition-all cursor-pointer ${
                    soundtrackConfig.voiceBoostDb === boost
                      ? 'btn-matte-primary text-white font-bold border-[var(--border-subtle)]'
                      : 'bg-slate-950 text-slate-400 border-[var(--border-subtle)]'
                  }`}
                >
                  +{boost}dB
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onExportMasterMix}
            disabled={isExportingMaster}
            className="w-full min-h-11 px-3 rounded-xl btn-matte-primary text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:translate-y-px transition-all cursor-pointer disabled:opacity-50 font-sans"
          >
            {isExportingMaster ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Renderizando Master 44.1kHz...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-white" />
                <span>Exportar Master Studio (.wav)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

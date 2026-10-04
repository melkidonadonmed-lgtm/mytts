import React from 'react';

export type ArchetypeId =
  | 'tactile-matte'
  | 'deep-blue'
  | 'vangogh'
  | 'mermaid'
  | 'cotton-dandelions'
  | 'ocean-window'
  | 'nightfall-ambiance';

export interface ArchetypeOption {
  id: ArchetypeId;
  name: string;
  icon: string;
  accentColor: string;
  tag: string;
}

export const ARCHETYPE_OPTIONS: ArchetypeOption[] = [
  {
    id: 'tactile-matte',
    name: 'Tactile Matte',
    icon: '🌿',
    accentColor: '#38bdf8',
    tag: 'Ardósia Mineral',
  },
  {
    id: 'deep-blue',
    name: 'The Deep Blue',
    icon: '🌌',
    accentColor: '#233dff',
    tag: '#050A30 & #233DFF',
  },
  {
    id: 'vangogh',
    name: "Van Gogh's Dream",
    icon: '🎨',
    accentColor: '#042698',
    tag: 'Marfim Claro #FDFEE9',
  },
  {
    id: 'mermaid',
    name: 'Mermaid Lagoon',
    icon: '🌊',
    accentColor: '#56aeff',
    tag: 'Oceano Cristalino',
  },
  {
    id: 'cotton-dandelions',
    name: 'Cotton Dandelions',
    icon: '🌾',
    accentColor: '#a4b792',
    tag: 'Verde Musgo & Linho',
  },
  {
    id: 'ocean-window',
    name: 'Ocean Window',
    icon: '🪟',
    accentColor: '#1d97bd',
    tag: 'Ardósia & Teal',
  },
  {
    id: 'nightfall-ambiance',
    name: 'Nightfall Ambiance',
    icon: '🌃',
    accentColor: '#2479df',
    tag: 'Meia-Noite Safira',
  },
];

interface ArchetypeBarProps {
  currentArchetype: string;
  onSelectArchetype: (id: ArchetypeId) => void;
}

export const ArchetypeBar: React.FC<ArchetypeBarProps> = ({
  currentArchetype,
  onSelectArchetype,
}) => {
  return (
    <div className="card-matte p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
      <div className="flex items-center gap-2 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans">
          Arquétipo Visual Tátil:
        </span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        {ARCHETYPE_OPTIONS.map((opt) => {
          const isActive = currentArchetype === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectArchetype(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-sans flex items-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap active:translate-y-px ${
                isActive
                  ? 'btn-matte-primary text-white font-bold shadow-md ring-1 ring-sky-400/40'
                  : 'btn-matte-dark text-slate-300 hover:text-white'
              }`}
              title={`${opt.name} — ${opt.tag}`}
            >
              <span>{opt.icon}</span>
              <span>{opt.name}</span>
              {isActive && (
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/20 text-white font-extrabold uppercase ml-0.5">
                  Ativo
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

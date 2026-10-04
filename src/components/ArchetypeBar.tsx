import React from 'react';

export type ArchetypeId =
  | 'tactile-matte'
  | 'phantom-4k'
  | 'luxury-deepblue'
  | 'gilded-navy'
  | 'polar-sand';

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
    accentColor: '#f59e0b',
    tag: 'Padrão Melki',
  },
  {
    id: 'phantom-4k',
    name: 'Phantom 4K',
    icon: '⚡',
    accentColor: '#38bdf8',
    tag: 'Obsidian Ultra-Dark',
  },
  {
    id: 'luxury-deepblue',
    name: 'Luxury Deep Blue',
    icon: '💎',
    accentColor: '#60a5fa',
    tag: 'Safira Mineral',
  },
  {
    id: 'gilded-navy',
    name: 'Gilded Navy',
    icon: '👑',
    accentColor: '#d4af37',
    tag: 'Ouro Champanhe',
  },
  {
    id: 'polar-sand',
    name: 'Polar Sand',
    icon: '☀️',
    accentColor: '#0284c7',
    tag: 'Tema Claro Mineral',
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
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-bold font-display uppercase tracking-wider text-slate-300">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'btn-matte-amber text-slate-950 font-bold shadow-md'
                  : 'btn-matte-dark text-slate-300 hover:text-white'
              }`}
              title={`${opt.name} — ${opt.tag}`}
            >
              <span>{opt.icon}</span>
              <span>{opt.name}</span>
              {isActive && (
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/20 text-slate-950 font-extrabold uppercase ml-0.5">
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

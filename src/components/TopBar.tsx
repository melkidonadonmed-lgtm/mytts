import React from 'react';
import { Sparkles, Layers, BookOpen, Volume2, Zap } from 'lucide-react';

interface TopBarProps {
  activeTab: 'studio' | 'fastchunks' | 'architecture' | 'docs';
  onSelectTab: (tab: 'studio' | 'fastchunks' | 'architecture' | 'docs') => void;
  onNewDebate: () => void;
  isSynthesizing: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onNewDebate,
  isSynthesizing,
}) => {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('studio');
          }}
          className="text-base font-bold tracking-tight text-white flex items-center gap-2 group"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 group-hover:scale-125 transition-transform" />
          <span>DialecticPod</span>
          <span className="text-xs font-normal text-slate-400 border-l border-slate-700 pl-2">
            Studio & FastChunks
          </span>
        </a>
      </div>

      {/* Zone 2: Clean text navigation links for Desktop */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
        <button
          onClick={() => onSelectTab('studio')}
          className={`transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'studio' ? 'text-white font-semibold' : 'hover:text-slate-200'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Dialectic Studio</span>
        </button>
        <button
          onClick={() => onSelectTab('fastchunks')}
          className={`transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'fastchunks' ? 'text-amber-300 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-current" />
          <span>FastChunks (Idiomas)</span>
          <span className="text-[10px] font-mono bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full px-1.5 py-0.2">
            NOVO
          </span>
        </button>
        <button
          onClick={() => onSelectTab('architecture')}
          className={`transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'architecture' ? 'text-white font-semibold' : 'hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>Architecture & Cloud</span>
        </button>
        <button
          onClick={() => onSelectTab('docs')}
          className={`transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'docs' ? 'text-white font-semibold' : 'hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
          <span>System Prompt</span>
        </button>
      </nav>

      {/* Mobile Mode Switcher */}
      <div className="flex md:hidden items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
        <button
          onClick={() => onSelectTab('studio')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === 'studio' ? 'bg-amber-400 text-slate-950 shadow-sm font-bold' : 'text-slate-400'
          }`}
        >
          Studio
        </button>
        <button
          onClick={() => onSelectTab('fastchunks')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === 'fastchunks' ? 'bg-amber-400 text-slate-950 shadow-sm font-bold' : 'text-slate-400'
          }`}
        >
          ⚡ Chunks
        </button>
      </div>

      {/* Zone 3: Actions */}
      <div className="hidden sm:flex items-center gap-3">
        {activeTab === 'studio' ? (
          <button
            onClick={onNewDebate}
            disabled={isSynthesizing}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-all rounded-lg shadow-sm whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Novo Debate</span>
          </button>
        ) : (
          <button
            onClick={() => onSelectTab('studio')}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all rounded-lg shadow-sm whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Ir para Studio</span>
          </button>
        )}
      </div>
    </header>
  );
};

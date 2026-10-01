import React from 'react';
import { Sparkles, Layers, BookOpen, Volume2 } from 'lucide-react';

interface TopBarProps {
  activeTab: 'studio' | 'architecture' | 'docs';
  onSelectTab: (tab: 'studio' | 'architecture' | 'docs') => void;
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
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
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
            AI Debate Studio
          </span>
        </a>
      </div>

      {/* Zone 2: 4-6 clean text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
        <button
          onClick={() => onSelectTab('studio')}
          className={`transition-colors whitespace-nowrap ${
            activeTab === 'studio' ? 'text-white font-semibold' : 'hover:text-slate-200'
          }`}
        >
          Studio
        </button>
        <button
          onClick={() => onSelectTab('architecture')}
          className={`transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'architecture' ? 'text-white font-semibold' : 'hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>Architecture & Schema</span>
        </button>
        <button
          onClick={() => onSelectTab('docs')}
          className={`transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'docs' ? 'text-white font-semibold' : 'hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
          <span>System Prompt</span>
        </button>
      </nav>

      {/* Zone 3: 1-2 primary actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onNewDebate}
          disabled={isSynthesizing}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-all rounded-lg shadow-sm whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Novo Debate</span>
        </button>
      </div>
    </header>
  );
};

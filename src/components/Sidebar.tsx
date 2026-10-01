import React from 'react';
import {
  Headphones,
  Mic,
  Users,
  BookOpen,
  Volume2,
  Sparkles,
  Radio,
  FileCode2,
  Github,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';

export type AppTab = 'reader' | 'mic' | 'debate' | 'fastchunks' | 'voices' | 'architecture';

interface SidebarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  selectedVoice: VoiceProfile;
  isOpenMobile: boolean;
  onToggleMobile: () => void;
  onOpenVoiceLibrary: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  selectedVoice,
  isOpenMobile,
  onToggleMobile,
  onOpenVoiceLibrary,
}) => {
  const navItems = [
    {
      id: 'reader' as AppTab,
      label: 'Estúdio de Criação',
      badge: 'Principal',
      badgeColor: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
      icon: Headphones,
      description: 'Leitura Solo & Debate 2 Vozes',
    },
    {
      id: 'mic' as AppTab,
      label: 'Microfone & Ditado',
      badge: 'Ao Vivo',
      badgeColor: 'bg-rose-400/10 text-rose-300 border-rose-400/20',
      icon: Mic,
      description: 'Gravar fala e transcrever com IA',
    },
    {
      id: 'debate' as AppTab,
      label: 'Estúdio de Debate',
      badge: '2 Vozes',
      badgeColor: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
      icon: Users,
      description: 'Discussão dialética antagônica',
    },
    {
      id: 'fastchunks' as AppTab,
      label: 'FastChunks',
      badge: 'Idiomas',
      badgeColor: 'bg-blue-400/10 text-blue-300 border-blue-400/20',
      icon: BookOpen,
      description: 'Treino de blocos lexicais e áudio',
    },
    {
      id: 'voices' as AppTab,
      label: 'Biblioteca de Vozes',
      badge: '5 Timbres',
      badgeColor: 'bg-purple-400/10 text-purple-300 border-purple-400/20',
      icon: Volume2,
      description: 'Catálogo e audição de amostras',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onToggleMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-950 border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white">
                  MyTTS
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/20 font-semibold">
                  Studio
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Áudio Neural com Emoção</p>
            </div>
          </div>

          <button
            onClick={onToggleMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 lg:hidden cursor-pointer"
            aria-label="Fechar navegação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voz Ativa em Destaque (Card Rápido) */}
        <div className="p-3.5 mx-3 mt-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Voz Ativa
            </span>
            <button
              onClick={() => {
                onOpenVoiceLibrary();
                if (isOpenMobile) onToggleMobile();
              }}
              className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <span>Trocar</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${selectedVoice.avatarColor} flex items-center justify-center text-white font-bold text-xs shadow-sm`}
            >
              {selectedVoice.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-slate-100 truncate">
                {selectedVoice.name}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {selectedVoice.archetype}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (isOpenMobile) onToggleMobile();
                }}
                className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-400/10 text-white border border-amber-400/30 shadow-sm shadow-amber-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <div
                  className={`mt-0.5 p-1.5 rounded-lg ${
                    isActive ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-200'}`}>
                      {item.label}
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Status e Footer da Sidebar */}
        <div className="p-3 border-t border-slate-800/80 space-y-2">
          {/* Status do Modelo */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800/60 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-mono">Gemini 3.1 Flash TTS</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-1 rounded border border-emerald-400/20">
              Cloud Run
            </span>
          </div>

          {/* Links e Info */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <button
              onClick={() => onSelectTab('architecture')}
              className="flex items-center gap-1 hover:text-slate-300 transition-colors cursor-pointer text-[11px]"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Arquitetura</span>
            </button>
            <a
              href="https://github.com/melkidonadonmed-lgtm/mytts"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-slate-300 transition-colors text-[11px]"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </aside>
    </>
  );
};

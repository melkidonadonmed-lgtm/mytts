import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppTab } from './Sidebar';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { GoogleIcon } from './GoogleIcon';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: AppTab) => void;
  onSelectVoice: (voice: VoiceProfile) => void;
  currentVoice: VoiceProfile;
  onOpenDeck?: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Navegação' | 'Vozes Neurais' | 'Ações Rápidas';
  icon: string;
  shortcut?: string;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onSelectVoice,
  currentVoice,
  onOpenDeck,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus no input ao abrir
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Lista de comandos disponíveis
  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Módulos
      {
        id: 'tab-reader',
        title: 'Estúdio de Criação Principal',
        subtitle: 'Leitura Solo 1 Voz & Debate 2 Vozes no mesmo canvas',
        category: 'Navegação',
        icon: 'headphones',
        shortcut: '1',
        action: () => {
          onSelectTab('reader');
          onClose();
        },
      },
      {
        id: 'tab-polyglot',
        title: 'Chat Poliglota Multimodal',
        subtitle: 'Tradução paralela em EN, IT & JA com blocos lexicais FastChunks',
        category: 'Navegação',
        icon: 'translate',
        shortcut: '2',
        action: () => {
          onSelectTab('polyglot');
          onClose();
        },
      },
      {
        id: 'tab-mic',
        title: 'Microfone & Ditado Ao Vivo',
        subtitle: 'Gravar fala com WebRTC e transcrever com Gemini 3.8',
        category: 'Navegação',
        icon: 'mic',
        shortcut: '3',
        action: () => {
          onSelectTab('mic');
          onClose();
        },
      },
      {
        id: 'tab-debate',
        title: 'Estúdio de Debate Dialético',
        subtitle: 'Discussão antagônica e embate de ideias entre 2 vozes',
        category: 'Navegação',
        icon: 'group',
        shortcut: '4',
        action: () => {
          onSelectTab('debate');
          onClose();
        },
      },
      {
        id: 'tab-voices',
        title: 'Biblioteca de Vozes Neurais',
        subtitle: 'Catálogo de timbres e audição de amostras de 3 segundos',
        category: 'Navegação',
        icon: 'record_voice_over',
        shortcut: '5',
        action: () => {
          onSelectTab('voices');
          onClose();
        },
      },
      {
        id: 'tab-architecture',
        title: 'Arquitetura do Sistema & Governança',
        subtitle: 'Ver mapa de endpoints, diretrizes de áudio e status dos modelos',
        category: 'Navegação',
        icon: 'account_tree',
        action: () => {
          onSelectTab('architecture');
          onClose();
        },
      },
    ];

    // Vozes Neurais
    GEMINI_VOICES.forEach((voice) => {
      list.push({
        id: `voice-${voice.id}`,
        title: `Voz: ${voice.name} (${voice.archetype})`,
        subtitle: `${voice.gender === 'female' ? 'Feminina' : 'Masculina'} · ${voice.styleDescription}`,
        category: 'Vozes Neurais',
        icon: 'mic_none',
        shortcut: currentVoice.id === voice.id ? 'Ativa' : undefined,
        action: () => {
          onSelectVoice(voice);
          onClose();
        },
      });
    });

    // Ações Rápidas
    if (onOpenDeck) {
      list.push({
        id: 'action-deck',
        title: 'Abrir Meu Deck de Flashcards',
        subtitle: 'Ver frases salvas e treinar repetição espaçada',
        category: 'Ações Rápidas',
        icon: 'style',
        action: () => {
          onSelectTab('polyglot');
          onOpenDeck();
          onClose();
        },
      });
    }

    // Temas Binários Melki (Modo Claro & Modo Escuro)
    list.push({
      id: 'theme-light',
      title: 'Ativar Modo Claro',
      subtitle: 'Contraste elevado WCAG AAA para leitura confortável durante o dia',
      category: 'Ações Rápidas',
      icon: 'light_mode',
      action: () => {
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.setAttribute('data-theme', 'light');
        localStorage.setItem('mytts_theme', 'light');
        window.dispatchEvent(new Event('mytts-theme-change'));
        onClose();
      },
    });

    list.push({
      id: 'theme-dark',
      title: 'Ativar Modo Escuro',
      subtitle: 'Paleta Mineral Melki em ardósia pura para foco noturno sem ofuscamento',
      category: 'Ações Rápidas',
      icon: 'dark_mode',
      action: () => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('mytts_theme', 'dark');
        window.dispatchEvent(new Event('mytts-theme-change'));
        onClose();
      },
    });

    return list;
  }, [onSelectTab, onSelectVoice, currentVoice, onOpenDeck, onClose]);

  // Filtragem
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lower = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(lower) ||
        cmd.subtitle.toLowerCase().includes(lower) ||
        cmd.category.toLowerCase().includes(lower)
    );
  }, [commands, query]);

  // Navegação por teclado dentro do modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Scroll automático do item selecionado
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de Comandos e Busca Rápida"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md transition-opacity"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl card-matte rounded-2xl overflow-hidden flex flex-col max-h-[80vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Busca Sunken */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-950/60">
          <GoogleIcon name="search" size={22} className="text-amber-500 dark:text-amber-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="input-sunken w-full text-base sm:text-lg font-medium"
            placeholder="Digite para navegar ou buscar vozes... (ex: Chat, Puck, Debate, Deck)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-mono rounded-md">
            ESC
          </kbd>
        </div>

        {/* Lista de Resultados */}
        <div ref={listRef} className="overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/40">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-slate-600 dark:text-slate-400 flex flex-col items-center gap-2">
              <GoogleIcon name="search_off" size={32} className="text-slate-400 dark:text-slate-600" />
              <p className="text-sm font-medium">Nenhum comando ou voz encontrado para &quot;{query}&quot;</p>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  data-selected={isSelected}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3.5 py-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'card-matte-active text-slate-900 dark:text-white shadow-md'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'btn-matte-amber text-white font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <GoogleIcon name={cmd.icon} size={20} />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate text-slate-900 dark:text-slate-100">{cmd.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700/60 text-slate-700 dark:text-slate-400 font-mono">
                          {cmd.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">{cmd.subtitle}</p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 ml-3">
                    {cmd.shortcut && (
                      <kbd
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          cmd.shortcut === 'Ativa'
                            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 font-semibold'
                            : ''
                        }`}
                      >
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <GoogleIcon name="keyboard_return" size={16} className="text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé de Instrução Tátil */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono rounded">↑↓</kbd>
              <span>Navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono rounded">↵</kbd>
              <span>Executar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono rounded">ESC</kbd>
              <span>Fechar</span>
            </span>
          </div>
          <span className="font-mono text-amber-700 dark:text-amber-400/80 font-semibold">MyTTS Studio · Padrão Tátil Melki</span>
        </div>
      </div>
    </div>
  );
};

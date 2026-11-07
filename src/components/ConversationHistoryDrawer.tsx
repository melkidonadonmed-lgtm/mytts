/**
 * Gaveta / Painel Colapsável de Histórico de Últimas Conversas.
 * Permite retomar, fixar, filtrar, iniciar nova conversa ou excluir conversas salvas na Conta Google.
 */
import React, { useMemo, useState } from 'react';
import {
  History,
  Plus,
  Pin,
  Trash2,
  Search,
  ChevronRight,
  ChevronDown,
  Globe,
  Video,
  Mic,
  MessageSquare,
} from 'lucide-react';
import type { SavedConversation, MessageOriginMode } from '../types/polyglot';

export interface ConversationHistoryDrawerProps {
  conversations: SavedConversation[];
  activeConversationId: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectConversation: (conv: SavedConversation) => void;
  onNewConversation: () => void;
  onTogglePin: (conv: SavedConversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  userEmail?: string;
}

export const ConversationHistoryDrawer: React.FC<ConversationHistoryDrawerProps> = ({
  conversations,
  activeConversationId,
  isOpen,
  onToggleOpen,
  onSelectConversation,
  onNewConversation,
  onTogglePin,
  onDeleteConversation,
  userEmail,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.userPrompt.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  const getOriginBadge = (mode?: MessageOriginMode) => {
    switch (mode) {
      case 'youtube':
        return {
          label: 'YouTube',
          icon: <Video className="w-3 h-3 text-rose-400" />,
          cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        };
      case 'web_search':
        return {
          label: 'Busca Web',
          icon: <Globe className="w-3 h-3 text-sky-400" />,
          cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        };
      case 'live_agent':
        return {
          label: 'Agente Live',
          icon: <Mic className="w-3 h-3 text-emerald-400" />,
          cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      default:
        return {
          label: 'Poliglota',
          icon: <MessageSquare className="w-3 h-3 text-amber-400" />,
          cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
    }
  };

  const formatShortDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isToday) {
        return `Hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      }
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <div
      data-state={isOpen ? 'pressed' : 'idle'}
      className="w-full mb-1 sm:mb-3"
    >
      {/* Barra Colapsável de Fácil Acesso */}
      <div className="flex items-center justify-between gap-2 card-matte rounded-2xl px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={isOpen}
          aria-pressed={isOpen}
          className="btn-compact-touch flex items-center gap-2 text-left cursor-pointer group focus-visible:outline-2 focus-visible:outline-amber-400 rounded-xl min-w-0"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/25 transition-colors shrink-0">
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-primary font-display truncate">
                Últimas Conversas
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-full surface-inset text-amber-300 tabular-nums shrink-0">
                {conversations.length}
              </span>
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-secondary shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-secondary shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-secondary hidden sm:block">
              {userEmail
                ? `Sincronizado na conta Google (${userEmail})`
                : 'Clique para abrir ou recolher seu histórico recente'}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onNewConversation}
            className="btn-matte btn-matte-amber btn-compact-touch h-8 px-3 rounded-full text-[11px] sm:text-xs font-bold text-white inline-flex items-center gap-1 cursor-pointer"
            title="Iniciar uma nova conversa limpa (a atual fica salva no histórico)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Conversa</span>
          </button>
        </div>
      </div>

      {/* Gaveta Colapsável Expandida */}
      {isOpen && (
        <div className="mt-2.5 rounded-2xl card-matte p-3.5 sm:p-4 shadow-xl transition-all">
          {/* Busca Rápida */}
          {conversations.length > 3 && (
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="history-search-input"
                name="historySearch"
                aria-label="Buscar conversa no histórico"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conversa por tema, frase ou vídeo..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl input-sunken text-xs text-primary placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          )}

          {filteredConversations.length === 0 ? (
            <div className="py-6 text-center text-xs text-secondary">
              Nenhuma conversa encontrada no histórico. Envie uma frase, link do YouTube ou fale no microfone para criar a primeira!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[290px] overflow-y-auto pr-1">
              {filteredConversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const badge = getOriginBadge(conv.originMode);
                return (
                  <div
                    key={conv.id}
                    className={`rounded-xl p-2.5 flex flex-col justify-between gap-2 transition-all ${
                      isActive
                        ? 'card-matte-active ring-1 ring-amber-400/50'
                        : 'surface-inset hover:border-amber-400/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectConversation(conv)}
                        className="flex-1 min-w-0 text-left cursor-pointer group"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md border ${badge.cls}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                          <span className="text-[10px] font-mono text-secondary tabular-nums">
                            {formatShortDate(conv.updatedAt)}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-primary group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                          {conv.title}
                        </p>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onTogglePin(conv)}
                          title={conv.pinned ? 'Desafixar conversa' : 'Fixar conversa no topo'}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            conv.pinned
                              ? 'text-amber-400 bg-amber-500/15'
                              : 'text-secondary hover:text-primary'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteConversation(conv.id)}
                          title="Excluir conversa do histórico"
                          className="p-1.5 rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-secondary pt-1 border-t border-slate-800/40">
                      <span>{conv.messages.length} turno(s) EN·IT·JA</span>
                      {isActive && (
                        <span className="text-amber-400 font-bold">Aberta agora</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

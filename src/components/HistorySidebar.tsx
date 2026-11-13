import React, { useMemo, useState } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { downloadHistoryItemContent } from '../services/sessionHistoryStorage';
import type { UnifiedHistoryItem, UnifiedHistoryKind } from '../types/polyglot';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: UnifiedHistoryItem[];
  activeConversationId?: string | null;
  isCloudSynced?: boolean;
  onSelectHistoryItem: (item: UnifiedHistoryItem) => void;
  onNewConversation?: () => void;
  onTogglePin: (item: UnifiedHistoryItem) => void;
  onRenameItem: (item: UnifiedHistoryItem, newTitle: string) => void;
  onDeleteItem: (item: UnifiedHistoryItem) => void;
  onClearUnpinned: () => void;
}

type ScopeFilter = 'all' | UnifiedHistoryKind;

function formatRelativeTime(isoOrMs: string | number): string {
  const timestamp = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs) || Date.now();
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'agora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;
  return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getTemporalBucket(
  item: UnifiedHistoryItem
): 'Fixados' | 'Hoje' | 'Ontem' | 'Últimos 7 dias' | 'Anteriores' {
  if (item.pinned) return 'Fixados';
  const updatedMs = Date.parse(item.updatedAt) || Date.now();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  if (updatedMs >= startOfToday) return 'Hoje';
  if (updatedMs >= startOfYesterday) return 'Ontem';
  if (updatedMs >= startOfWeek) return 'Últimos 7 dias';
  return 'Anteriores';
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  onClose,
  items,
  activeConversationId,
  isCloudSynced = false,
  onSelectHistoryItem,
  onNewConversation,
  onTogglePin,
  onRenameItem,
  onDeleteItem,
  onClearUnpinned,
}) => {
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (scope !== 'all' && item.kind !== scope) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.languages.join(' ').toLowerCase().includes(q) ||
        (item.voiceId || '').toLowerCase().includes(q)
      );
    });
  }, [items, scope, searchQuery]);

  const groupedSections = useMemo(() => {
    const order: Array<'Fixados' | 'Hoje' | 'Ontem' | 'Últimos 7 dias' | 'Anteriores'> = [
      'Fixados',
      'Hoje',
      'Ontem',
      'Últimos 7 dias',
      'Anteriores',
    ];
    const map = new Map<string, UnifiedHistoryItem[]>();
    for (const bucket of order) map.set(bucket, []);

    for (const item of filteredItems) {
      const bucket = getTemporalBucket(item);
      map.get(bucket)?.push(item);
    }

    return order
      .map((label) => ({ label, entries: map.get(label) || [] }))
      .filter((group) => group.entries.length > 0);
  }, [filteredItems]);

  const startRename = (item: UnifiedHistoryItem) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const commitRename = (item: UnifiedHistoryItem) => {
    const trimmed = editingTitle.trim();
    if (trimmed && trimmed !== item.title) {
      onRenameItem(item, trimmed);
    }
    setEditingId(null);
    setEditingTitle('');
  };

  return (
    <>
      {/* Backdrop Mobile (< 1024px) */}
      {isOpen && (
        <button
          type="button"
          aria-label="Fechar gaveta de histórico"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/75 lg:hidden cursor-pointer"
        />
      )}

      <aside
        aria-label="Histórico e Linha do Tempo de Sessões"
        data-open={isOpen ? 'true' : 'false'}
        className={`fixed top-0 bottom-0 right-0 z-50 h-dvh max-h-dvh bg-slate-950 border-l border-slate-800 flex flex-col transition-[width,transform] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden ${
          isOpen
            ? 'w-[320px] translate-x-0'
            : 'w-[320px] translate-x-full lg:w-0 lg:translate-x-0 lg:border-l-0'
        }`}
      >
        <div className="w-[320px] h-full flex flex-col shrink-0">
          {/* Header da Gaveta Direita */}
          <div className="h-14 px-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <GoogleIcon name="history" size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-extrabold text-primary font-display truncate">
                    Histórico & Sessões
                  </h2>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300 tabular-nums">
                    {items.length}
                  </span>
                </div>
                <p className="text-[10px] text-secondary truncate">
                  Chats, Debates TTS e Flashcards
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onNewConversation && (
                <button
                  type="button"
                  onClick={onNewConversation}
                  title="Iniciar Nova Conversa Limpa"
                  className="px-2 py-1 rounded-lg btn-matte-amber text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <GoogleIcon name="add" size={14} />
                  <span>Nova</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Recolher histórico lateral (Ctrl + H)"
                title="Recolher histórico lateral (Ctrl + H)"
                className="p-1.5 rounded-xl text-secondary hover:text-primary hover:bg-slate-800/70 transition-colors cursor-pointer"
              >
                <GoogleIcon name="panel_right_close" size={18} />
              </button>
            </div>
          </div>

          {/* Busca Local + Abas de Escopo */}
          <div className="p-3 border-b border-slate-800/80 space-y-2.5 shrink-0 bg-slate-900/40">
            <div className="relative">
              <GoogleIcon
                name="search"
                size={15}
                className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar sessões, idiomas ou voz..."
                aria-label="Filtrar histórico de sessões"
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-primary placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div
              role="tablist"
              aria-label="Filtrar por categoria de histórico"
              className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800/80"
            >
              {(
                [
                  { id: 'all', label: 'Tudo' },
                  { id: 'chat', label: 'Chats' },
                  { id: 'debate_tts', label: 'Debates' },
                  { id: 'flashcards', label: 'Cards' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={scope === tab.id}
                  onClick={() => setScope(tab.id)}
                  className={`py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                    scope === tab.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista Agrupada Temporalmente */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-4">
            {groupedSections.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                  <GoogleIcon name="history" size={20} />
                </div>
                <p className="text-xs font-bold text-secondary">Nenhum registro encontrado</p>
                <p className="text-[11px] text-slate-500">
                  Suas conversas do Chat Poliglota, roteiros de Debate e Flashcards aparecerão aqui.
                </p>
              </div>
            ) : (
              groupedSections.map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      {group.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                      {group.entries.length}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {group.entries.map((item) => {
                      const isActive =
                        item.kind === 'chat' && item.id === activeConversationId;
                      const isEditing = editingId === item.id;
                      const iconName =
                        item.kind === 'chat'
                          ? 'translate'
                          : item.kind === 'debate_tts'
                          ? 'group'
                          : 'school';

                      return (
                        <div
                          key={`${item.kind}-${item.id}`}
                          className={`p-2.5 rounded-2xl border transition-colors ${
                            isActive
                              ? 'card-matte-active border-amber-500/40'
                              : 'card-matte border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitRename(item);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                aria-label="Novo título do item"
                                className="w-full px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-500/50 text-xs text-white focus:outline-none"
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => commitRename(item)}
                                  className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => onSelectHistoryItem(item)}
                                className="w-full text-left flex items-start gap-2.5 cursor-pointer"
                              >
                                <div
                                  className={`mt-0.5 w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                                    isActive
                                      ? 'btn-matte-amber text-white'
                                      : 'bg-slate-900 text-secondary border border-slate-800'
                                  }`}
                                >
                                  <GoogleIcon name={iconName} size={15} />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-bold text-primary truncate font-display">
                                      {item.title}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400 shrink-0 tabular-nums">
                                      {formatRelativeTime(item.updatedAt)}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-secondary truncate mt-0.5">
                                    {item.subtitle}
                                  </p>
                                </div>
                              </button>

                              {/* Rodapé de Metadados + Ações Rápidas */}
                              <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                                  {item.languages.length > 0 && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                                      {item.languages.join(' · ')}
                                    </span>
                                  )}
                                  {item.voiceId && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 truncate">
                                      {item.voiceId}
                                    </span>
                                  )}
                                  {item.originMode && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 uppercase shrink-0">
                                      {item.originMode}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-0.5 shrink-0">
                                  {item.kind !== 'flashcards' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => onTogglePin(item)}
                                        aria-label={item.pinned ? 'Desafixar' : 'Fixar no topo'}
                                        title={item.pinned ? 'Desafixar' : 'Fixar no topo'}
                                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                          item.pinned
                                            ? 'text-amber-400 bg-amber-500/15'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                      >
                                        <GoogleIcon name="pin" size={13} filled={item.pinned} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => startRename(item)}
                                        aria-label="Renomear sessão"
                                        title="Renomear sessão"
                                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                      >
                                        <GoogleIcon name="edit" size={13} />
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => downloadHistoryItemContent(item, 'md')}
                                    aria-label="Exportar como Markdown"
                                    title="Exportar como Markdown (.md)"
                                    className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
                                  >
                                    <GoogleIcon name="download" size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteItem(item)}
                                    aria-label="Excluir registro"
                                    title="Excluir registro"
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                                  >
                                    <GoogleIcon name="delete" size={13} />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé da Gaveta Direita: Status de Sincronização + Limpeza Segura */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/60 space-y-2 shrink-0">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="flex items-center gap-1.5 text-secondary">
                <GoogleIcon
                  name="cloud_done"
                  size={13}
                  className={isCloudSynced ? 'text-emerald-400' : 'text-amber-400'}
                />
                <span>
                  {isCloudSynced
                    ? 'Sincronizado · southamerica-east1'
                    : 'Armazenamento Local · Visitante'}
                </span>
              </span>
            </div>

            {items.length > 0 &&
              (!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="w-full py-1.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/25 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <GoogleIcon name="delete" size={14} />
                  <span>Limpar Histórico Não Fixado</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClearUnpinned();
                      setConfirmClear(false);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Confirmar Limpeza
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ))}
          </div>
        </div>
      </aside>
    </>
  );
};

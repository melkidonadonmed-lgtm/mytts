import type { SavedConversation } from '../types/polyglot';
import { readBrowserState, persistBrowserState } from './polyglotClient';

/**
 * Alvo da conversa ativa na sessão do usuário.
 * Pode ser um rascunho de novo chat ou uma conversa salva existente.
 */
export type ActiveConversationTarget =
  | { mode: 'new'; draftId: string }
  | { mode: 'saved'; conversationId: string };

const STORAGE_PREFIX = 'mytts_active_conv_';

export function getActiveConversationStorageKey(userId: string): string {
  const safeUid = userId ? encodeURIComponent(userId.trim()) : 'guest';
  return `${STORAGE_PREFIX}${safeUid}`;
}

export function readActiveConversationTarget(userId: string): ActiveConversationTarget | null {
  try {
    const raw = readBrowserState(getActiveConversationStorageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const record = parsed as Record<string, unknown>;
    if (record.mode === 'new' && typeof record.draftId === 'string' && record.draftId) {
      return { mode: 'new', draftId: record.draftId };
    }
    if (record.mode === 'saved' && typeof record.conversationId === 'string' && record.conversationId) {
      return { mode: 'saved', conversationId: record.conversationId };
    }
    return null;
  } catch (err: unknown) {
    console.warn('Erro ao ler alvo de conversa ativa:', err);
    return null;
  }
}

export function persistActiveConversationTarget(
  userId: string,
  target: ActiveConversationTarget
): void {
  try {
    const key = getActiveConversationStorageKey(userId);
    persistBrowserState(key, JSON.stringify(target));
  } catch (err: unknown) {
    console.warn('Erro ao persistir alvo de conversa ativa:', err);
  }
}

/**
 * Resolução determinística e pura da conversa a ser exibida.
 * Garante que:
 * 1. Seleção explícita '__NEW__' tem precedência máxima e nunca é sobrescrita por pinned.
 * 2. Seleção explícita por ID salvo carrega o registro solicitado.
 * 3. Rascunho salvo ({ mode: 'new' }) sobrevive a recarregamentos e troca de abas.
 * 4. Conversa salva ({ mode: 'saved' }) sobrevive à presença de conversas fixadas em list[0].
 * 5. Se o alvo salvo foi deletado, realiza fallback gracioso para list[0].
 */
export function resolveInitialConversationTarget(params: {
  explicitSelection: string | null;
  savedTarget: ActiveConversationTarget | null;
  conversations: SavedConversation[];
}):
  | { action: 'keep_new_draft'; draftId: string }
  | { action: 'load_saved'; conversation: SavedConversation }
  | { action: 'none' } {
  const { explicitSelection, savedTarget, conversations } = params;

  // 1. Seleção explícita '__NEW__' vinda da UI tem prioridade absoluta
  if (explicitSelection === '__NEW__') {
    const draftId = savedTarget?.mode === 'new' ? savedTarget.draftId : `conv_${Date.now()}`;
    return { action: 'keep_new_draft', draftId };
  }

  // 2. Seleção explícita por ID salva específica
  if (explicitSelection) {
    const explicitFound = conversations.find((c) => c.id === explicitSelection);
    if (explicitFound) {
      return { action: 'load_saved', conversation: explicitFound };
    }
  }

  // 3. Rascunho salvo de novo chat preservado na sessão
  if (savedTarget?.mode === 'new') {
    return { action: 'keep_new_draft', draftId: savedTarget.draftId };
  }

  // 4. Conversa salva na sessão anterior
  if (savedTarget?.mode === 'saved') {
    const savedFound = conversations.find((c) => c.id === savedTarget.conversationId);
    if (savedFound) {
      return { action: 'load_saved', conversation: savedFound };
    }
  }

  // 5. Fallback gracioso para a primeira conversa disponível (se houver)
  if (conversations.length > 0) {
    return { action: 'load_saved', conversation: conversations[0] };
  }

  // 6. Nenhuma conversa cadastrada nem rascunho ativo
  return { action: 'none' };
}

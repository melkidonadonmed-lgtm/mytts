/**
 * Store Reativo de Histórico Unificado (Conversas Poliglotas, Roteiros/Debates TTS e Baralhos de Flashcards).
 * Coordena restauração de estado, renomeação com customTitle, fixação (Pin) e exportação entre App.tsx e HistorySidebar.tsx.
 */
import type { DebateScript } from '../types/debate';
import type {
  SavedConversation,
  SavedDebateSession,
  UnifiedHistoryItem,
} from '../types/polyglot';
import { getActiveSession } from './authService';
import { readFlashcardDeck } from './flashcardDeckStorage';
import {
  persistBrowserState,
  readBrowserState,
  requestClearUnpinnedConversations,
  requestDeleteUserConversation,
  requestListUserConversations,
  requestSaveUserConversation,
} from './polyglotClient';

const MAX_DEBATE_SESSIONS = 30;

type HistoryListener = () => void;
const historyListeners = new Set<HistoryListener>();

function getDebateHistoryKey(userId?: string): string {
  const uid = (userId || getActiveSession().uid || 'guest_local').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `mytts_debate_history_${uid}`;
}

export function notifyHistoryChanged(): void {
  historyListeners.forEach((fn) => fn());
}

export function subscribeSessionHistory(listener: HistoryListener): () => void {
  historyListeners.add(listener);
  return () => {
    historyListeners.delete(listener);
  };
}

export function readDebateSessions(userId?: string): SavedDebateSession[] {
  try {
    const raw = readBrowserState(getDebateHistoryKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as SavedDebateSession[]).sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1;
      }
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  } catch {
    return [];
  }
}

function writeDebateSessions(sessions: SavedDebateSession[], userId?: string): SavedDebateSession[] {
  const sorted = [...sessions]
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1;
      }
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    })
    .slice(0, MAX_DEBATE_SESSIONS);

  persistBrowserState(getDebateHistoryKey(userId), JSON.stringify(sorted));
  notifyHistoryChanged();
  return sorted;
}

export function saveDebateSessionFromScript(
  script: DebateScript,
  options?: { format?: string; documentText?: string; userId?: string }
): SavedDebateSession {
  const uid = options?.userId || getActiveSession().uid;
  const list = readDebateSessions(uid);
  const existingIdx = list.findIndex((s) => s.id === script.id);
  const nowIso = new Date().toISOString();

  const voiceIds = Array.from(
    new Set([
      ...(script.speakers?.map((s) => s.voiceId) || []),
      ...(script.turns?.map((t) => t.voice_id) || []),
    ].filter(Boolean))
  );

  const session: SavedDebateSession = {
    id: script.id || `deb_${Date.now()}`,
    userId: uid,
    title:
      existingIdx >= 0 && list[existingIdx].customTitle
        ? list[existingIdx].title
        : script.title || 'Roteiro de Estúdio (2 Vozes)',
    customTitle: existingIdx >= 0 ? list[existingIdx].customTitle : false,
    language: script.language || 'pt-BR',
    format: options?.format || 'debate',
    voiceIds: voiceIds.length > 0 ? voiceIds : ['Puck', 'Kore'],
    createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : nowIso,
    updatedAt: nowIso,
    pinned: existingIdx >= 0 ? list[existingIdx].pinned : false,
    documentPreview: (options?.documentText || script.topicSummary || '').slice(0, 240),
    turns: (script.turns || []).map((t) => ({
      turn: t.turn,
      speaker: t.speaker,
      voice_id: t.voice_id,
      text: t.text,
      clean_text: t.clean_text,
      emotion: t.emotion,
      speech_rate: t.prosody?.speech_rate,
      pre_delay_ms: t.prosody?.pre_delay_ms,
      audioDurationSec: t.audioDurationSec,
    })),
  };

  if (existingIdx >= 0) {
    list[existingIdx] = session;
  } else {
    list.unshift(session);
  }

  writeDebateSessions(list, uid);
  return session;
}

export function renameDebateSession(sessionId: string, newTitle: string, userId?: string): SavedDebateSession[] {
  const cleanTitle = newTitle.trim().slice(0, 120);
  if (!cleanTitle) return readDebateSessions(userId);
  const list = readDebateSessions(userId).map((s) =>
    s.id === sessionId
      ? { ...s, title: cleanTitle, customTitle: true, updatedAt: new Date().toISOString() }
      : s
  );
  return writeDebateSessions(list, userId);
}

export function togglePinDebateSession(sessionId: string, userId?: string): SavedDebateSession[] {
  const list = readDebateSessions(userId).map((s) =>
    s.id === sessionId ? { ...s, pinned: !s.pinned } : s
  );
  return writeDebateSessions(list, userId);
}

export function deleteDebateSession(sessionId: string, userId?: string): SavedDebateSession[] {
  const list = readDebateSessions(userId).filter((s) => s.id !== sessionId);
  return writeDebateSessions(list, userId);
}

export function clearUnpinnedDebateSessions(userId?: string): SavedDebateSession[] {
  const list = readDebateSessions(userId).filter((s) => Boolean(s.pinned));
  return writeDebateSessions(list, userId);
}

export function buildUnifiedHistoryItems(
  conversations: SavedConversation[],
  debateSessions: SavedDebateSession[],
  userId?: string
): UnifiedHistoryItem[] {
  const items: UnifiedHistoryItem[] = [];

  for (const conv of conversations) {
    const firstMsg = conv.messages?.[0];
    const voiceId = firstMsg?.cardVoices?.en || 'Puck';
    items.push({
      id: conv.id,
      kind: 'chat',
      title: conv.title,
      subtitle: `${conv.messages.length} turno(s) · EN · IT · JA`,
      updatedAt: conv.updatedAt,
      createdAt: conv.createdAt,
      pinned: conv.pinned,
      languages: ['EN', 'IT', 'JA'],
      voiceId,
      originMode: conv.originMode || 'polyglot',
      itemCount: conv.messages.length,
      conversation: conv,
    });
  }

  for (const deb of debateSessions) {
    const langTag = deb.language.toUpperCase().slice(0, 2);
    items.push({
      id: deb.id,
      kind: 'debate_tts',
      title: deb.title,
      subtitle: `${deb.turns.length} turno(s) · ${deb.voiceIds.join(' & ')}`,
      updatedAt: deb.updatedAt,
      createdAt: deb.createdAt,
      pinned: deb.pinned,
      languages: [langTag],
      voiceId: deb.voiceIds[0] || 'Puck',
      itemCount: deb.turns.length,
      debateSession: deb,
    });
  }

  const flashcards = readFlashcardDeck(userId);
  if (flashcards.length > 0) {
    const byDeck = new Map<string, typeof flashcards>();
    for (const card of flashcards) {
      const dName = card.deckName || 'Baralho Principal';
      const arr = byDeck.get(dName) || [];
      arr.push(card);
      byDeck.set(dName, arr);
    }

    byDeck.forEach((cards, deckName) => {
      const newestMs = Math.max(...cards.map((c) => c.lastReviewedAt || c.createdAt || Date.now()));
      const oldestMs = Math.min(...cards.map((c) => c.createdAt || Date.now()));
      const langs = Array.from(
        new Set(
          cards.map((c) => {
            if (c.language.includes('ja')) return 'JA';
            if (c.language.includes('it')) return 'IT';
            return 'EN';
          })
        )
      );
      items.push({
        id: `deck_${deckName.replace(/\s+/g, '_').toLowerCase()}`,
        kind: 'flashcards',
        title: `Deck: ${deckName}`,
        subtitle: `${cards.length} flashcard(s) · Revisão espaçada`,
        updatedAt: new Date(newestMs).toISOString(),
        createdAt: new Date(oldestMs).toISOString(),
        pinned: false,
        languages: langs,
        voiceId: cards[0]?.voiceId || 'Puck',
        itemCount: cards.length,
        deckName,
      });
    });
  }

  return items.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

export function exportHistoryItemContent(
  item: UnifiedHistoryItem,
  format: 'json' | 'md',
  userId?: string
): { filename: string; content: string; mimeType: string } {
  const safeSlug = item.title
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'sessao-mytts';

  if (format === 'json') {
    const payload =
      item.kind === 'chat'
        ? item.conversation
        : item.kind === 'debate_tts'
          ? item.debateSession
          : readFlashcardDeck(userId).filter((c) => (c.deckName || 'Baralho Principal') === item.deckName);
    return {
      filename: `${safeSlug}.json`,
      content: JSON.stringify(payload, null, 2),
      mimeType: 'application/json;charset=utf-8',
    };
  }

  if (item.kind === 'chat' && item.conversation) {
    const lines = [
      `# ${item.conversation.title}`,
      `> Sincronizado em: ${item.conversation.updatedAt}`,
      '',
    ];
    for (const msg of item.conversation.messages) {
      lines.push(`## Prompt: ${msg.userPrompt}`);
      if (msg.agentReplyPtBr) {
        lines.push(`**Agente (pt-BR):** ${msg.agentReplyPtBr}`);
      }
      lines.push(`- **EN:** ${msg.fullText.en}`);
      lines.push(`- **IT:** ${msg.fullText.it}`);
      lines.push(`- **JA:** ${msg.fullText.ja}`);
      lines.push('');
    }
    return {
      filename: `${safeSlug}.md`,
      content: lines.join('\n'),
      mimeType: 'text/markdown;charset=utf-8',
    };
  }

  if (item.kind === 'debate_tts' && item.debateSession) {
    const lines = [
      `# ${item.debateSession.title}`,
      `> Idioma: ${item.debateSession.language} | Vozes: ${item.debateSession.voiceIds.join(', ')}`,
      '',
    ];
    for (const t of item.debateSession.turns) {
      lines.push(`**${t.speaker} (${t.voice_id}):** ${t.clean_text || t.text}`);
      lines.push('');
    }
    return {
      filename: `${safeSlug}.md`,
      content: lines.join('\n'),
      mimeType: 'text/markdown;charset=utf-8',
    };
  }

  const deckCards = readFlashcardDeck(userId).filter(
    (c) => (c.deckName || 'Baralho Principal') === item.deckName
  );
  const mdLines = [
    `# ${item.title}`,
    '',
    '| Frente | Verso | Contexto | Idioma |',
    '| :--- | :--- | :--- | :--- |',
    ...deckCards.map((c) => `| ${c.front} | ${c.back} | ${c.nuance} | ${c.language} |`),
  ];
  return {
    filename: `${safeSlug}.md`,
    content: mdLines.join('\n'),
    mimeType: 'text/markdown;charset=utf-8',
  };
}

export function downloadHistoryItemContent(
  item: UnifiedHistoryItem,
  format: 'json' | 'md',
  userId?: string
): void {
  if (typeof window === 'undefined') return;
  const exported = exportHistoryItemContent(item, format, userId);
  const blob = new Blob([exported.content], { type: exported.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exported.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export {
  requestListUserConversations,
  requestSaveUserConversation,
  requestDeleteUserConversation,
  requestClearUnpinnedConversations,
};

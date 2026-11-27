import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  FlashcardItem,
  SavedConversation,
  SavedDebateSession,
  UnifiedHistoryItem,
} from '../types/polyglot';
import {
  requestListUserConversations,
  requestSaveUserConversation,
  requestDeleteUserConversation,
  requestClearUnpinnedConversations,
} from '../services/polyglotClient';
import {
  readFlashcardDeck,
  subscribeFlashcardDeck,
  deleteFlashcardDeckByName,
  syncFlashcardDeckFromServer,
} from '../services/flashcardDeckStorage';
import {
  readDebateSessions,
  subscribeSessionHistory,
  togglePinDebateSession,
  renameDebateSession,
  deleteDebateSession,
  clearUnpinnedDebateSessions,
  buildUnifiedHistoryItems,
} from '../services/sessionHistoryStorage';
import {
  getActiveSession,
  refreshSessionFromServer,
  subscribeAuthChanges,
} from '../services/authService';

export function useAppHistory() {
  const [userSession, setUserSession] = useState(() => getActiveSession());
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newConversationSignal, setNewConversationSignal] = useState<number>(0);
  const [debateSessions, setDebateSessions] = useState<SavedDebateSession[]>(() =>
    readDebateSessions()
  );
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>(() => readFlashcardDeck());
  const [selectedStudyDeckName, setSelectedStudyDeckName] = useState<string | null>(null);

  // Sync flashcards, debate sessions, conversations, and hydrate HttpOnly Google session on mount
  useEffect(() => {
    setFlashcards(readFlashcardDeck());
    const unsubFlash = subscribeFlashcardDeck(setFlashcards);
    const unsubDebate = subscribeSessionHistory(() => {
      setDebateSessions(readDebateSessions());
    });
    const unsubAuth = subscribeAuthChanges((nextSession) => {
      setUserSession(nextSession);
      setDebateSessions(readDebateSessions(nextSession.uid));
      void syncFlashcardDeckFromServer(nextSession.uid);
      void requestListUserConversations().then(setConversations);
    });
    void refreshSessionFromServer();
    void syncFlashcardDeckFromServer();
    void requestListUserConversations().then(setConversations);
    return () => {
      unsubFlash();
      unsubDebate();
      unsubAuth();
    };
  }, []);

  const unifiedHistoryItems = useMemo(() => {
    void flashcards.length;
    return buildUnifiedHistoryItems(conversations, debateSessions, userSession.uid);
  }, [conversations, debateSessions, flashcards.length, userSession.uid]);

  const handleConversationsChanged = useCallback(
    (nextConvs: SavedConversation[], activeId: string) => {
      setConversations(nextConvs);
      setActiveConversationId(activeId);
    },
    []
  );

  const handleTogglePinHistoryItem = useCallback(async (item: UnifiedHistoryItem) => {
    if (item.kind === 'chat' && item.conversation) {
      const updated: SavedConversation = {
        ...item.conversation,
        pinned: !item.conversation.pinned,
      };
      const saved = await requestSaveUserConversation(updated);
      if (saved) {
        setConversations((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      }
    } else if (item.kind === 'debate_tts') {
      togglePinDebateSession(item.id);
    }
  }, []);

  const handleRenameHistoryItem = useCallback(
    async (item: UnifiedHistoryItem, newTitle: string) => {
      if (item.kind === 'chat' && item.conversation) {
        const updated: SavedConversation = {
          ...item.conversation,
          title: newTitle,
          customTitle: true,
        };
        const saved = await requestSaveUserConversation(updated);
        if (saved) {
          setConversations((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        }
      } else if (item.kind === 'debate_tts') {
        renameDebateSession(item.id, newTitle);
      }
    },
    []
  );

  const handleDeleteHistoryItem = useCallback(async (item: UnifiedHistoryItem) => {
    if (item.kind === 'chat') {
      const ok = await requestDeleteUserConversation(item.id);
      if (ok) {
        setConversations((prev) => prev.filter((c) => c.id !== item.id));
      }
    } else if (item.kind === 'debate_tts') {
      deleteDebateSession(item.id);
    } else if (item.kind === 'flashcards') {
      deleteFlashcardDeckByName(item.deckName || 'Baralho Principal');
    }
  }, []);

  const handleClearUnpinnedHistory = useCallback(async () => {
    await requestClearUnpinnedConversations();
    const nextConvs = await requestListUserConversations();
    setConversations(nextConvs);
    clearUnpinnedDebateSessions();
  }, []);

  return {
    userSession,
    conversations,
    activeConversationId,
    selectedConversationId,
    setSelectedConversationId,
    newConversationSignal,
    setNewConversationSignal,
    flashcards,
    selectedStudyDeckName,
    setSelectedStudyDeckName,
    unifiedHistoryItems,
    handleConversationsChanged,
    handleTogglePinHistoryItem,
    handleRenameHistoryItem,
    handleDeleteHistoryItem,
    handleClearUnpinnedHistory,
  };
}

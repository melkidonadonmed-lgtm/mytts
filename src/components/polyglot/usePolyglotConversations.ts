import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  PolyglotMessage,
  SavedConversation,
  GoogleUserSession,
} from '../../types/polyglot';
import {
  requestListUserConversations,
  requestSaveUserConversation,
} from '../../services/polyglotClient';
import {
  readActiveConversationTarget,
  persistActiveConversationTarget,
  resolveInitialConversationTarget,
} from '../../services/conversationSessionState';
import { getActiveSession, subscribeAuthChanges } from '../../services/authService';
import { INITIAL_DEMO_MESSAGE } from './polyglotConstants';

export interface UsePolyglotConversationsOptions {
  messages: PolyglotMessage[];
  setMessages: React.Dispatch<React.SetStateAction<PolyglotMessage[]>>;
  setFocusedMessageId: React.Dispatch<React.SetStateAction<string>>;
  selectedConversationId?: string | null;
  newConversationSignal?: number;
  onConversationsChanged?: (conversations: SavedConversation[], activeId: string) => void;
  stopCurrentAudio: () => void;
  showToast: (msg: string) => void;
}

export function usePolyglotConversations({
  messages,
  setMessages,
  setFocusedMessageId,
  selectedConversationId,
  newConversationSignal,
  onConversationsChanged,
  stopCurrentAudio,
  showToast,
}: UsePolyglotConversationsOptions) {
  const [userSession, setUserSession] = useState<GoogleUserSession>(() => getActiveSession());
  const [isExplicitNewChat, setIsExplicitNewChat] = useState<boolean>(() => {
    if (selectedConversationId === '__NEW__' || selectedConversationId === 'new') return true;
    return readActiveConversationTarget(getActiveSession().uid)?.mode === 'new';
  });
  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    const saved = readActiveConversationTarget(getActiveSession().uid);
    if (saved?.mode === 'new') return saved.draftId;
    if (saved?.mode === 'saved') return saved.conversationId;
    return `conv_${Date.now()}`;
  });
  const [conversations, setConversations] = useState<SavedConversation[]>([]);

  const messagesRef = useRef<PolyglotMessage[]>(messages);
  messagesRef.current = messages;
  const activeConversationIdRef = useRef<string>(activeConversationId);
  activeConversationIdRef.current = activeConversationId;
  const isExplicitNewChatRef = useRef<boolean>(isExplicitNewChat);
  isExplicitNewChatRef.current = isExplicitNewChat;
  const prevSessionRef = useRef<GoogleUserSession>(userSession);

  const handleNewConversation = useCallback((): void => {
    stopCurrentAudio();
    const nextId = `conv_${Date.now()}`;
    setIsExplicitNewChat(true);
    isExplicitNewChatRef.current = true;
    setActiveConversationId(nextId);
    activeConversationIdRef.current = nextId;
    setMessages([INITIAL_DEMO_MESSAGE]);
    setFocusedMessageId('msg-demo-1');
    persistActiveConversationTarget(userSession.uid, { mode: 'new', draftId: nextId });
    onConversationsChanged?.(conversations, nextId);
    showToast('Nova conversa iniciada! Suas conversas anteriores estão salvas no histórico.');
  }, [conversations, onConversationsChanged, setFocusedMessageId, setMessages, showToast, stopCurrentAudio, userSession.uid]);

  const handleSelectConversation = useCallback(
    (conv: SavedConversation): void => {
      stopCurrentAudio();
      setIsExplicitNewChat(false);
      isExplicitNewChatRef.current = false;
      setActiveConversationId(conv.id);
      activeConversationIdRef.current = conv.id;
      const nextMsgs = conv.messages.length > 0 ? conv.messages : [INITIAL_DEMO_MESSAGE];
      setMessages(nextMsgs);
      const lastId = nextMsgs[nextMsgs.length - 1].id;
      setFocusedMessageId(lastId);
      persistActiveConversationTarget(userSession.uid, { mode: 'saved', conversationId: conv.id });
      showToast(`Conversa "${conv.title}" restaurada.`);
    },
    [setFocusedMessageId, setMessages, showToast, stopCurrentAudio, userSession.uid]
  );

  const loadConversationsForActiveUser = useCallback(async () => {
    const list = await requestListUserConversations();
    setConversations(list);

    if (isExplicitNewChatRef.current) return;

    const savedTarget = readActiveConversationTarget(userSession.uid);
    const targetDecision = resolveInitialConversationTarget({
      explicitSelection: selectedConversationId || null,
      savedTarget,
      conversations: list,
    });

    if (targetDecision.action === 'keep_new_draft') {
      setIsExplicitNewChat(true);
      isExplicitNewChatRef.current = true;
      setActiveConversationId(targetDecision.draftId);
      activeConversationIdRef.current = targetDecision.draftId;
      setMessages([INITIAL_DEMO_MESSAGE]);
      persistActiveConversationTarget(userSession.uid, {
        mode: 'new',
        draftId: targetDecision.draftId,
      });
      return;
    }

    if (targetDecision.action === 'load_saved') {
      const conv = targetDecision.conversation;
      if (
        conv.id === activeConversationIdRef.current &&
        (messagesRef.current.length > 1 || messagesRef.current.some((m) => m.id !== 'msg-demo-1'))
      ) {
        return;
      }
      setIsExplicitNewChat(false);
      isExplicitNewChatRef.current = false;
      setActiveConversationId(conv.id);
      activeConversationIdRef.current = conv.id;
      setMessages(conv.messages.length > 0 ? conv.messages : [INITIAL_DEMO_MESSAGE]);
      persistActiveConversationTarget(userSession.uid, {
        mode: 'saved',
        conversationId: conv.id,
      });
    }
  }, [selectedConversationId, setMessages, userSession.uid]);

  useEffect(() => {
    void loadConversationsForActiveUser();
    const unsub = subscribeAuthChanges(async (nextSession) => {
      const wasGuest = !prevSessionRef.current.isGoogleAuthenticated;
      prevSessionRef.current = nextSession;
      setUserSession(nextSession);

      const currentReadyTurns = messagesRef.current.filter(
        (m) => m.status === 'ready' && m.id !== 'msg-demo-1'
      );
      if (wasGuest && nextSession.isGoogleAuthenticated && currentReadyTurns.length > 0) {
        const firstPrompt = currentReadyTurns[0].userPrompt || 'Conversa Poliglota';
        const migratedConv: SavedConversation = {
          id: activeConversationIdRef.current,
          userId: nextSession.uid,
          userName: nextSession.name,
          userEmail: nextSession.email || undefined,
          title: firstPrompt.length > 62 ? `${firstPrompt.slice(0, 62)}...` : firstPrompt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pinned: false,
          originMode: currentReadyTurns[currentReadyTurns.length - 1].originMode || 'polyglot',
          messages: messagesRef.current.filter((m) => m.status === 'ready'),
        };
        await requestSaveUserConversation(migratedConv);
      }

      const list = await requestListUserConversations();
      setConversations(list);
      const nextSavedTarget = readActiveConversationTarget(nextSession.uid);
      const decision = resolveInitialConversationTarget({
        explicitSelection: null,
        savedTarget: nextSavedTarget,
        conversations: list,
      });

      if (decision.action === 'keep_new_draft') {
        setIsExplicitNewChat(true);
        isExplicitNewChatRef.current = true;
        setActiveConversationId(decision.draftId);
        activeConversationIdRef.current = decision.draftId;
        setMessages([INITIAL_DEMO_MESSAGE]);
      } else if (decision.action === 'load_saved') {
        setIsExplicitNewChat(false);
        isExplicitNewChatRef.current = false;
        setActiveConversationId(decision.conversation.id);
        activeConversationIdRef.current = decision.conversation.id;
        setMessages(
          decision.conversation.messages.length > 0
            ? decision.conversation.messages
            : [INITIAL_DEMO_MESSAGE]
        );
      } else {
        setIsExplicitNewChat(true);
        isExplicitNewChatRef.current = true;
        const draftId = `conv_${Date.now()}`;
        setActiveConversationId(draftId);
        activeConversationIdRef.current = draftId;
        setMessages([INITIAL_DEMO_MESSAGE]);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onConversationsChanged?.(conversations, activeConversationId);
  }, [conversations, activeConversationId, onConversationsChanged]);

  const prevSignalRef = useRef(newConversationSignal);
  useEffect(() => {
    if (newConversationSignal && newConversationSignal !== prevSignalRef.current) {
      prevSignalRef.current = newConversationSignal;
      handleNewConversation();
    }
  }, [newConversationSignal, handleNewConversation]);

  useEffect(() => {
    if (!selectedConversationId) return;
    if (selectedConversationId === '__NEW__' || selectedConversationId === 'new') {
      handleNewConversation();
      return;
    }
    if (selectedConversationId === activeConversationIdRef.current) return;
    const found = conversations.find((c) => c.id === selectedConversationId);
    if (found) {
      handleSelectConversation(found);
    }
  }, [selectedConversationId, conversations, handleNewConversation, handleSelectConversation]);

  const persistConversationSnapshot = useCallback(
    async (updatedMessages: PolyglotMessage[], convId = activeConversationId) => {
      const readyOnly = updatedMessages
        .filter((m) => m.status === 'ready')
        .map(({ retryPayload: _ignoredRetry, ...cleanMsg }) => cleanMsg);
      if (readyOnly.length === 0) return;

      const userTurns = readyOnly.filter((m) => m.id !== 'msg-demo-1');
      if (userTurns.length === 0) return;

      const lastTurn = userTurns[userTurns.length - 1];
      const existing = conversations.find((c) => c.id === convId);
      const titleSource = userTurns[0].userPrompt || 'Conversa Poliglota';
      const cleanTitle =
        titleSource.length > 62 ? `${titleSource.slice(0, 62)}...` : titleSource;

      const payload: SavedConversation = {
        id: convId,
        userId: userSession.uid,
        userName: userSession.name,
        userEmail: userSession.email || undefined,
        title:
          existing?.customTitle && existing.title ? existing.title : existing?.title || cleanTitle,
        customTitle: existing?.customTitle,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pinned: existing?.pinned || false,
        originMode: lastTurn.originMode || existing?.originMode || 'polyglot',
        messages: readyOnly,
      };

      const saved = await requestSaveUserConversation(payload);
      if (saved) {
        setIsExplicitNewChat(false);
        isExplicitNewChatRef.current = false;
        persistActiveConversationTarget(userSession.uid, { mode: 'saved', conversationId: convId });
        setConversations((prev) => {
          const rest = prev.filter((c) => c.id !== saved.id);
          return [saved, ...rest].sort((a, b) => {
            if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
            return b.updatedAt.localeCompare(a.updatedAt);
          });
        });
      }
    },
    [activeConversationId, conversations, userSession]
  );

  return {
    handleNewConversation,
    persistConversationSnapshot,
  };
}

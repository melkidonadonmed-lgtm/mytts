import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PolyglotMessage,
  FlashcardItem,
  SavedConversation,
} from '../types/polyglot';
import type { StudioRenderMode } from '../types/debate';
import { VoiceProfile, GEMINI_VOICES } from '../types/voices';
import { ParallelMessageBlock } from './ParallelMessageBlock';
import { AgentInputDock } from './AgentInputDock';
import { FlashcardDeckDrawer } from './FlashcardDeckDrawer';
import { ExportInteractionModal } from './ExportInteractionModal';
import { GoogleIcon } from './GoogleIcon';
import {
  readFlashcardDeck,
  subscribeFlashcardDeck,
  addFlashcardsToDeck,
  deleteFlashcardFromDeck,
  clearFlashcardDeck,
  readDeckNamingPreference,
} from '../services/flashcardDeckStorage';
import { resolveOrganizedDeckName, toLocalCalendarDateKey } from '../utils/flashcardOrganizer';
import {
  readFavoriteVoicesByLanguage,
  saveFavoriteVoicesByLanguage,
} from '../services/polyglotClient';
import { INITIAL_DEMO_MESSAGE, LangKey } from './polyglot/polyglotConstants';
import { PolyglotStudioHeader } from './polyglot/PolyglotStudioHeader';
import { usePolyglotAudio } from './polyglot/usePolyglotAudio';
import { usePolyglotConversations } from './polyglot/usePolyglotConversations';
import { usePolyglotActions } from './polyglot/usePolyglotActions';

export interface PolyglotChatStudioProps {
  globalVoice?: VoiceProfile;
  onSyncGlobalVoice?: (voice: VoiceProfile) => void;
  onSendToCreationStudio?: (text: string, mode: StudioRenderMode) => void;
  selectedConversationId?: string | null;
  newConversationSignal?: number;
  onConversationsChanged?: (conversations: SavedConversation[], activeId: string) => void;
  onOpenStudyTab?: () => void;
  onOpenVoicesConfigTab?: () => void;
  favoriteVoicesByLang?: Record<LangKey, string>;
}

export const PolyglotChatStudio: React.FC<PolyglotChatStudioProps> = ({
  globalVoice,
  onSyncGlobalVoice,
  onSendToCreationStudio,
  selectedConversationId,
  newConversationSignal,
  onConversationsChanged,
  onOpenStudyTab,
  onOpenVoicesConfigTab,
  favoriteVoicesByLang,
}) => {
  const [messages, setMessages] = useState<PolyglotMessage[]>([INITIAL_DEMO_MESSAGE]);
  const [deck, setDeck] = useState<FlashcardItem[]>(() => readFlashcardDeck());
  const [isDeckDrawerOpen, setIsDeckDrawerOpen] = useState(false);
  const [exportingMessage, setExportingMessage] = useState<PolyglotMessage | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [focusedMessageId, setFocusedMessageId] = useState<string>('msg-demo-1');
  const [selectedLanguageByMsg, setSelectedLanguageByMsg] = useState<Record<string, LangKey>>({
    'msg-demo-1': 'en',
  });

  const [defaultVoiceByLang, setDefaultVoiceByLang] = useState<Record<LangKey, string>>(() =>
    readFavoriteVoicesByLanguage()
  );
  const [cardVoicesByMsg, setCardVoicesByMsg] = useState<
    Record<string, Record<LangKey, string>>
  >(() => ({
    'msg-demo-1': readFavoriteVoicesByLanguage(),
  }));

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const prevMessagesLengthRef = useRef<number>(messages.length);
  const lastSyncedVoiceIdRef = useRef<string>(globalVoice?.id || 'Puck');
  const cardVoicesByMsgRef = useRef<Record<string, Record<LangKey, string>>>(cardVoicesByMsg);
  cardVoicesByMsgRef.current = cardVoicesByMsg;

  const showToast = useCallback((msg: string): void => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const syncVoiceToGlobal = useCallback(
    (voiceId: string) => {
      lastSyncedVoiceIdRef.current = voiceId;
      if (onSyncGlobalVoice) {
        const found = GEMINI_VOICES.find((v) => v.id === voiceId || v.name === voiceId);
        if (found) onSyncGlobalVoice(found);
      }
    },
    [onSyncGlobalVoice]
  );

  useEffect(() => {
    if (!globalVoice || globalVoice.id === lastSyncedVoiceIdRef.current) return;
    lastSyncedVoiceIdRef.current = globalVoice.id;
    const activeLang = selectedLanguageByMsg[focusedMessageId] || 'en';
    const nextForMsg = {
      ...(cardVoicesByMsgRef.current[focusedMessageId] || defaultVoiceByLang),
      [activeLang]: globalVoice.id,
    };
    cardVoicesByMsgRef.current = {
      ...cardVoicesByMsgRef.current,
      [focusedMessageId]: nextForMsg,
    };
    setCardVoicesByMsg((prev) => ({ ...prev, [focusedMessageId]: nextForMsg }));
    setMessages((prev) =>
      prev.map((m) => (m.id === focusedMessageId ? { ...m, cardVoices: nextForMsg } : m))
    );
    setDefaultVoiceByLang((prev) => ({ ...prev, [activeLang]: globalVoice.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalVoice?.id]);

  useEffect(() => {
    setDeck(readFlashcardDeck());
    return subscribeFlashcardDeck((updated) => setDeck(updated));
  }, []);

  useEffect(() => {
    saveFavoriteVoicesByLanguage(defaultVoiceByLang);
  }, [defaultVoiceByLang]);

  useEffect(() => {
    if (favoriteVoicesByLang) setDefaultVoiceByLang(favoriteVoicesByLang);
  }, [favoriteVoicesByLang]);

  useEffect(() => {
    const handleVoicesChanged = (e: Event) => {
      const customEvent = e as CustomEvent<Record<LangKey, string>>;
      setDefaultVoiceByLang(customEvent.detail || readFavoriteVoicesByLanguage());
    };
    window.addEventListener('mytts-favorite-voices-changed', handleVoicesChanged);
    return () => window.removeEventListener('mytts-favorite-voices-changed', handleVoicesChanged);
  }, []);

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]);

  const getCardVoicesForMessage = useCallback(
    (messageId: string): Record<LangKey, string> =>
      cardVoicesByMsgRef.current[messageId] || cardVoicesByMsg[messageId] || defaultVoiceByLang,
    [cardVoicesByMsg, defaultVoiceByLang]
  );

  const audio = usePolyglotAudio({
    messages,
    focusedMessageId,
    globalVoice,
    setFocusedMessageId,
    setSelectedLanguageByMsg,
    getCardVoicesForMessage,
    syncVoiceToGlobal,
    showToast,
  });

  const { handleNewConversation, persistConversationSnapshot } = usePolyglotConversations({
    messages,
    setMessages,
    setFocusedMessageId,
    selectedConversationId,
    newConversationSignal,
    onConversationsChanged,
    stopCurrentAudio: audio.stopCurrentAudio,
    showToast,
  });

  const actions = usePolyglotActions({
    messages,
    setMessages,
    defaultVoiceByLang,
    setDefaultVoiceByLang,
    setCardVoicesByMsg,
    setFocusedMessageId,
    setSelectedLanguageByMsg,
    syncVoiceToGlobal,
    handleTogglePlay: audio.handleTogglePlay,
    persistConversationSnapshot,
    showToast,
  });

  const handleChangeCardVoice = (messageId: string, lang: LangKey, voiceId: string): void => {
    const currentForMsg =
      cardVoicesByMsgRef.current[messageId] || cardVoicesByMsg[messageId] || defaultVoiceByLang;
    const updatedVoices = { ...currentForMsg, [lang]: voiceId };
    cardVoicesByMsgRef.current = { ...cardVoicesByMsgRef.current, [messageId]: updatedVoices };

    setFocusedMessageId(messageId);
    setSelectedLanguageByMsg((prev) => ({ ...prev, [messageId]: lang }));
    setCardVoicesByMsg((prev) => ({ ...prev, [messageId]: updatedVoices }));
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, cardVoices: updatedVoices } : m))
    );
    setDefaultVoiceByLang((prev) => ({ ...prev, [lang]: voiceId }));
    syncVoiceToGlobal(voiceId);

    audio.stopCurrentAudio();
    void audio.handleTogglePlay(messageId, lang, undefined, voiceId);
  };

  const currentFocusedLang = selectedLanguageByMsg[focusedMessageId] || 'en';
  const currentFocusedVoice = getCardVoicesForMessage(focusedMessageId)[currentFocusedLang];

  return (
    <div className="flex-1 flex flex-col min-h-screen font-sans">
      <PolyglotStudioHeader
        currentFocusedVoice={currentFocusedVoice}
        defaultVoiceByLang={defaultVoiceByLang}
        deckCount={deck.length}
        onNewConversation={handleNewConversation}
        onOpenStudy={() => (onOpenStudyTab ? onOpenStudyTab() : setIsDeckDrawerOpen(true))}
        onOpenVoicesConfigTab={onOpenVoicesConfigTab}
      />

      {toastMessage && (
        <div className="fixed top-16 right-4 z-40 card-matte border border-emerald-500/40 text-primary px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
          <GoogleIcon name="check_circle" size={16} filled className="text-emerald-400" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      <div
        role="region"
        aria-label="Feed de conversas poliglotas"
        className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 pb-6 sm:pb-12 flex flex-col gap-4 sm:gap-6"
      >
        {messages.map((message) => {
          const selectedLang = selectedLanguageByMsg[message.id] || 'en';
          const cardVoices = getCardVoicesForMessage(message.id);
          const isThisBlockPlaying =
            audio.playingBlockInfo?.messageId === message.id && audio.isPlayingAudio;
          const isThisBlockLoading =
            audio.playingBlockInfo?.messageId === message.id && audio.isLoadingAudio;
          const playingLangForThisMsg =
            audio.playingBlockInfo?.messageId === message.id ? audio.playingBlockInfo.lang : null;

          const isCachedByLang = {
            en: audio.cachedKeysSet.has(audio.getMessageAudioCacheKey(message.id, 'en')),
            it: audio.cachedKeysSet.has(audio.getMessageAudioCacheKey(message.id, 'it')),
            ja: audio.cachedKeysSet.has(audio.getMessageAudioCacheKey(message.id, 'ja')),
          };

          return (
            <ParallelMessageBlock
              key={message.id}
              message={{ ...message, cardVoices }}
              onPlayChunkAudio={audio.handlePlayChunkAudio}
              onCreateFlashcard={actions.handleCreateFlashcard}
              playingAudioKey={audio.playingAudioKey}
              generatingCardKey={actions.generatingCardKey}
              selectedLanguage={selectedLang}
              onSelectLanguage={(lang) => audio.handleSelectLanguage(message.id, lang)}
              isPlaying={isThisBlockPlaying}
              isLoading={isThisBlockLoading}
              playingLangForThisMsg={playingLangForThisMsg}
              isCachedByLang={isCachedByLang}
              onTogglePlay={(lang) => audio.handleTogglePlay(message.id, lang)}
              onReplay={(lang) => audio.handleReplay(message.id, lang)}
              currentTime={audio.currentTime}
              duration={audio.duration}
              onSeek={audio.handleSeek}
              speed={audio.playbackSpeed}
              onChangeSpeed={audio.handleChangeSpeed}
              cardVoices={cardVoices}
              onChangeCardVoice={(lang, voice) => handleChangeCardVoice(message.id, lang, voice)}
              onDownloadCardWav={(lang) => audio.handleDownloadCardWav(message.id, lang)}
              onPlaySequence={() => audio.handlePlaySequence(message.id)}
              isPlayingSequence={audio.isPlayingSequence}
              sequenceStep={audio.sequenceStep}
              onOpenExport={(msg) => setExportingMessage({ ...msg, cardVoices })}
              onSendToCreationStudio={onSendToCreationStudio}
              onExecuteYoutubePostLinkAction={actions.handleExecuteYoutubePostLinkAction}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <AgentInputDock
        onSendMessage={actions.handleSendMessage}
        onSendToCreationStudio={(typedText, renderMode) => {
          if (!onSendToCreationStudio) return;
          if (typedText) {
            onSendToCreationStudio(typedText, renderMode);
            return;
          }
          const focusedMsg =
            messages.find((m) => m.id === focusedMessageId) || messages[messages.length - 1];
          const fallbackText = focusedMsg
            ? [focusedMsg.userPrompt, focusedMsg.agentReplyPtBr, focusedMsg.fullText.en]
                .filter(Boolean)
                .join('\n\n')
            : '';
          onSendToCreationStudio(fallbackText, renderMode);
        }}
        isLoading={actions.isLoading}
        activeVoiceName={currentFocusedVoice}
      />

      <FlashcardDeckDrawer
        isOpen={isDeckDrawerOpen}
        onClose={() => setIsDeckDrawerOpen(false)}
        cards={deck}
        onDeleteCard={(id) => deleteFlashcardFromDeck(id)}
        onClearDeck={() => clearFlashcardDeck()}
        onPlayCardAudio={audio.handlePlayChunkAudio}
      />

      <ExportInteractionModal
        isOpen={Boolean(exportingMessage)}
        onClose={() => setExportingMessage(null)}
        message={exportingMessage}
        cardVoices={exportingMessage ? getCardVoicesForMessage(exportingMessage.id) : undefined}
        onAddCardsToDeck={(newCards) => {
          const prefMode = readDeckNamingPreference();
          const organized = newCards.map((card) => {
            const dateKey =
              card.createdDateKey || toLocalCalendarDateKey(card.createdAt || Date.now());
            return {
              ...card,
              createdDateKey: dateKey,
              deckName:
                prefMode === 'custom' && card.deckName
                  ? card.deckName
                  : resolveOrganizedDeckName({
                      mode: prefMode,
                      customDeckName: card.deckName || 'Chat Poliglota',
                      language: card.language,
                      dateKey,
                    }),
            };
          });
          addFlashcardsToDeck(organized);
        }}
        onExportTrilogyWav={audio.handleExportTrilogyWav}
        onShowToast={showToast}
      />
    </div>
  );
};

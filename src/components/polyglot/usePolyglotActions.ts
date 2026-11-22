import { useState } from 'react';
import type {
  PolyglotMessage,
  FlashcardItem,
  YoutubePostLinkAction,
  YoutubeClipRange,
} from '../../types/polyglot';
import type { AgentInputDockSubmitPayload } from '../AgentInputDock';
import {
  addFlashcardsToDeck,
  readDeckNamingPreference,
} from '../../services/flashcardDeckStorage';
import { detectFlashcardLanguage, normalizeLanguageBadge } from '../../utils/flashcardParser';
import { resolveOrganizedDeckName, toLocalCalendarDateKey } from '../../utils/flashcardOrganizer';
import {
  requestTranslateParallelChunks,
  requestLiveAgentTurn,
  requestAgentExplore,
  requestGenerateFlashcard,
} from '../../services/polyglotClient';
import type { LangKey } from './polyglotConstants';

export interface UsePolyglotActionsOptions {
  messages: PolyglotMessage[];
  setMessages: React.Dispatch<React.SetStateAction<PolyglotMessage[]>>;
  defaultVoiceByLang: Record<LangKey, string>;
  setDefaultVoiceByLang: React.Dispatch<React.SetStateAction<Record<LangKey, string>>>;
  setCardVoicesByMsg: React.Dispatch<React.SetStateAction<Record<string, Record<LangKey, string>>>>;
  setFocusedMessageId: React.Dispatch<React.SetStateAction<string>>;
  setSelectedLanguageByMsg: React.Dispatch<React.SetStateAction<Record<string, LangKey>>>;
  syncVoiceToGlobal: (voiceId: string) => void;
  handleTogglePlay: (
    messageId: string,
    lang: LangKey,
    overrideMsg?: PolyglotMessage
  ) => Promise<void>;
  persistConversationSnapshot: (updatedMessages: PolyglotMessage[]) => Promise<void>;
  showToast: (msg: string) => void;
}

export function usePolyglotActions({
  messages,
  setMessages,
  defaultVoiceByLang,
  setDefaultVoiceByLang,
  setCardVoicesByMsg,
  setFocusedMessageId,
  setSelectedLanguageByMsg,
  syncVoiceToGlobal,
  handleTogglePlay,
  persistConversationSnapshot,
  showToast,
}: UsePolyglotActionsOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [generatingCardKey, setGeneratingCardKey] = useState<string | null>(null);

  const handleSendMessage = async (
    text: string,
    autoPlayAfter = false,
    payload?: AgentInputDockSubmitPayload
  ): Promise<void> => {
    const newMessageId = `msg-${Date.now()}`;
    const initialCardVoices = { ...defaultVoiceByLang };
    const originMode = payload?.youtubeUrl
      ? 'youtube'
      : payload?.dockMode === 'search_youtube' || payload?.enableSearch
      ? 'web_search'
      : payload?.dockMode === 'live_tutor' || payload?.dockMode === 'practice' || payload?.audioBase64
      ? 'live_agent'
      : 'polyglot';

    const placeholderMessage: PolyglotMessage = {
      id: newMessageId,
      userPrompt: text,
      timestamp: Date.now(),
      chunks: [],
      fullText: { en: '', it: '', ja: '' },
      cardVoices: initialCardVoices,
      status: 'loading',
      originMode,
      youtubeUrl: payload?.youtubeUrl,
    };

    setMessages((prev) => [...prev, placeholderMessage]);
    setFocusedMessageId(newMessageId);
    setSelectedLanguageByMsg((prev) => ({ ...prev, [newMessageId]: 'en' }));
    setCardVoicesByMsg((prev) => ({ ...prev, [newMessageId]: initialCardVoices }));
    syncVoiceToGlobal(initialCardVoices.en);
    setIsLoading(true);

    try {
      let readyMessage: PolyglotMessage;

      if (originMode === 'youtube' || originMode === 'web_search') {
        const exploreData = await requestAgentExplore({
          prompt: text,
          youtubeUrl: payload?.youtubeUrl,
          youtubeAction: payload?.youtubeAction,
          clipRange: payload?.clipRange,
          enableSearch: true,
        });
        if (!exploreData.ok || !exploreData.success || !exploreData.chunks || !exploreData.fullText) {
          throw new Error(exploreData.error || 'Falha ao consultar Agente com Busca/YouTube.');
        }

        readyMessage = {
          ...placeholderMessage,
          originMode: exploreData.originMode || originMode,
          youtubeUrl: exploreData.youtubeUrl || payload?.youtubeUrl,
          youtubeMeta: exploreData.youtubeMeta,
          youtubeSearchResults: exploreData.youtubeSearchResults,
          youtubeAction: exploreData.youtubeAction || payload?.youtubeAction,
          youtubeClipRange: payload?.clipRange,
          awaitingYoutubeIntent: Boolean(exploreData.awaitingYoutubeIntent),
          agentReplyPtBr: exploreData.agentReplyPtBr,
          sources: exploreData.sources,
          chunks: exploreData.chunks,
          fullText: exploreData.fullText,
          status: 'ready',
        };

        if (exploreData.toolCallsExecuted && exploreData.toolCallsExecuted.length > 0) {
          const toolCards: FlashcardItem[] = [];
          const prefMode = readDeckNamingPreference();
          for (const tool of exploreData.toolCallsExecuted) {
            if (tool.name === 'create_study_flashcard') {
              const firstChunk = exploreData.chunks[0];
              const frontText = tool.args.frontPhrase || firstChunk?.en || text;
              const now = Date.now();
              const dateKey = toLocalCalendarDateKey(now);
              const detectedLang = detectFlashcardLanguage(frontText, tool.args.language);
              toolCards.push({
                id: tool.id,
                chunkText: frontText,
                language: detectedLang,
                front: frontText,
                back: tool.args.backTranslation || firstChunk?.it || '',
                nuance: 'Expressão extraída do vídeo do YouTube.',
                pronunciation: firstChunk?.jaPronunciation,
                example: firstChunk?.en || frontText,
                exampleTranslation: firstChunk?.ja || '',
                createdAt: now,
                createdDateKey: dateKey,
                deckName: resolveOrganizedDeckName({
                  mode: prefMode,
                  customDeckName: 'YouTube & Web',
                  language: detectedLang,
                  dateKey,
                }),
              });
            }
          }
          if (toolCards.length > 0) {
            addFlashcardsToDeck(toolCards);
            showToast(`${toolCards.length} expressões do vídeo salvas na Área de Estudo!`);
          }
        }
      } else if (originMode === 'live_agent') {
        const recentHistory = messages
          .filter((m) => m.status === 'ready')
          .slice(-4)
          .map((m) => ({
            role: 'user',
            text: `${m.userPrompt} -> ${m.fullText.en}`,
          }));

        const liveData = await requestLiveAgentTurn({
          text: payload?.text ?? text,
          audioBase64: payload?.audioBase64,
          mimeType: payload?.mimeType,
          persona: payload?.persona || 'tutor_conversational',
          history: recentHistory,
        });

        if (!liveData.ok || !liveData.success || !liveData.chunks || !liveData.fullText) {
          throw new Error(liveData.error || 'Falha ao processar turno do Agente Live.');
        }

        readyMessage = {
          ...placeholderMessage,
          userPrompt: liveData.userTranscript || text,
          originMode: 'live_agent',
          agentPersona: liveData.persona,
          agentReplyPtBr: liveData.agentReplyPtBr,
          chunks: liveData.chunks,
          fullText: liveData.fullText,
          status: 'ready',
        };

        if (liveData.toolCallsExecuted && liveData.toolCallsExecuted.length > 0) {
          const prefMode = readDeckNamingPreference();
          for (const tool of liveData.toolCallsExecuted) {
            if (tool.name === 'create_study_flashcard') {
              const firstChunk = liveData.chunks[0];
              const frontText = tool.args.frontPhrase || firstChunk?.en || text;
              const now = Date.now();
              const dateKey = toLocalCalendarDateKey(now);
              const detectedLang = detectFlashcardLanguage(frontText, tool.args.language);
              addFlashcardsToDeck([
                {
                  id: tool.id,
                  chunkText: frontText,
                  language: detectedLang,
                  front: frontText,
                  back: tool.args.backTranslation || firstChunk?.it || '',
                  nuance: 'Gerado automaticamente via Function Calling do Agente Live.',
                  pronunciation: firstChunk?.jaPronunciation,
                  example: firstChunk?.en || frontText,
                  exampleTranslation: firstChunk?.ja || '',
                  createdAt: now,
                  createdDateKey: dateKey,
                  deckName: resolveOrganizedDeckName({
                    mode: prefMode,
                    customDeckName: 'Agente Live',
                    language: detectedLang,
                    dateKey,
                  }),
                },
              ]);
              showToast(tool.summaryPtBr);
            } else if (tool.name === 'switch_studio_voice' && tool.args.targetVoice) {
              const vId = tool.args.targetVoice;
              const targetLang = tool.args.language || 'all';
              if (targetLang === 'all') {
                const updated = { en: vId, it: vId, ja: vId };
                readyMessage.cardVoices = updated;
                setCardVoicesByMsg((prev) => ({ ...prev, [newMessageId]: updated }));
              } else if (targetLang === 'en' || targetLang === 'it' || targetLang === 'ja') {
                const updated = {
                  ...(readyMessage.cardVoices || defaultVoiceByLang),
                  [targetLang]: vId,
                };
                readyMessage.cardVoices = updated;
                setCardVoicesByMsg((prev) => ({ ...prev, [newMessageId]: updated }));
                setDefaultVoiceByLang((prev) => ({ ...prev, [targetLang]: vId }));
              }
              syncVoiceToGlobal(vId);
              showToast(tool.summaryPtBr);
            }
          }
        }
      } else {
        const data = await requestTranslateParallelChunks(text);
        if (!data.ok || !data.success || !data.chunks || !data.fullText) {
          throw new Error(data.error || 'Falha ao processar os chunks paralelos.');
        }

        readyMessage = {
          ...placeholderMessage,
          chunks: data.chunks,
          fullText: data.fullText,
          status: 'ready',
        };
      }

      setMessages((prev) => {
        const nextList = prev.map((msg) => (msg.id === newMessageId ? readyMessage : msg));
        void persistConversationSnapshot(nextList);
        return nextList;
      });

      if (autoPlayAfter || payload?.autoSpeakReply) {
        await handleTogglePlay(newMessageId, 'en', readyMessage);
      }
    } catch (err: unknown) {
      console.error(err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessageId
            ? {
                ...msg,
                status: 'error',
                error: err instanceof Error ? err.message : 'Erro de conexão com o Gemini.',
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteYoutubePostLinkAction = async (
    targetMessageId: string,
    youtubeUrl: string,
    action: YoutubePostLinkAction,
    clipRange?: YoutubeClipRange
  ): Promise<void> => {
    const actionPromptMap: Record<YoutubePostLinkAction, string> = {
      ask_intent: youtubeUrl,
      translate_video: `Traduza e transcreva a fala do vídeo do YouTube ${youtubeUrl} nos 3 idiomas.`,
      summary_dialogue: `Faça um resumo completo em português e crie um diálogo prático sobre o vídeo ${youtubeUrl}.`,
      extract_expressions: `Extraia as melhores expressões nativas e flashcards do vídeo ${youtubeUrl}.`,
      custom_prompt: `Analise o vídeo do YouTube ${youtubeUrl}.`,
    };

    setMessages((prev) =>
      prev.map((m) =>
        m.id === targetMessageId
          ? {
              ...m,
              status: 'loading',
              youtubeUrl,
              youtubeAction: action,
              youtubeClipRange: clipRange,
              awaitingYoutubeIntent: false,
            }
          : m
      )
    );
    setFocusedMessageId(targetMessageId);
    setIsLoading(true);

    try {
      const exploreData = await requestAgentExplore({
        prompt: actionPromptMap[action] || youtubeUrl,
        youtubeUrl,
        youtubeAction: action,
        clipRange,
        enableSearch: true,
      });

      if (!exploreData.ok || !exploreData.success || !exploreData.chunks || !exploreData.fullText) {
        throw new Error(exploreData.error || 'Falha ao processar o vídeo do YouTube.');
      }

      if (exploreData.toolCallsExecuted && exploreData.toolCallsExecuted.length > 0) {
        const prefMode = readDeckNamingPreference();
        const addedCards: FlashcardItem[] = exploreData.toolCallsExecuted
          .filter((t) => t.name === 'create_study_flashcard')
          .map((tool, idx) => {
            const chunk = exploreData.chunks?.[idx] || exploreData.chunks?.[0];
            const frontText = tool.args.frontPhrase || chunk?.en || youtubeUrl;
            const now = Date.now();
            const dateKey = toLocalCalendarDateKey(now);
            const detectedLang = detectFlashcardLanguage(frontText, tool.args.language);
            return {
              id: tool.id,
              chunkText: frontText,
              language: detectedLang,
              front: frontText,
              back: tool.args.backTranslation || chunk?.it || '',
              nuance: 'Expressão extraída do vídeo do YouTube.',
              pronunciation: chunk?.jaPronunciation,
              example: chunk?.en || frontText,
              exampleTranslation: chunk?.ja || '',
              createdAt: now - idx,
              createdDateKey: dateKey,
              deckName: resolveOrganizedDeckName({
                mode: prefMode,
                customDeckName: 'YouTube & Web',
                language: detectedLang,
                dateKey,
              }),
            };
          });
        if (addedCards.length > 0) {
          addFlashcardsToDeck(addedCards);
          showToast(`${addedCards.length} flashcards extraídos do vídeo e salvos no Deck!`);
        }
      }

      setMessages((prev) => {
        const nextList = prev.map((m) =>
          m.id === targetMessageId
            ? {
                ...m,
                originMode: 'youtube' as const,
                youtubeUrl: exploreData.youtubeUrl || youtubeUrl,
                youtubeMeta: exploreData.youtubeMeta || m.youtubeMeta,
                youtubeAction: action,
                youtubeClipRange: clipRange,
                awaitingYoutubeIntent: false,
                agentReplyPtBr: exploreData.agentReplyPtBr,
                sources: exploreData.sources,
                chunks: exploreData.chunks!,
                fullText: exploreData.fullText!,
                status: 'ready' as const,
              }
            : m
        );
        void persistConversationSnapshot(nextList);
        return nextList;
      });
    } catch (err: unknown) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === targetMessageId
            ? {
                ...m,
                status: 'error',
                error: err instanceof Error ? err.message : 'Erro ao analisar vídeo do YouTube.',
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFlashcard = async (chunkText: string, language: string): Promise<void> => {
    setGeneratingCardKey(chunkText);
    try {
      const data = await requestGenerateFlashcard(chunkText, language);
      if (data.ok && data.success && data.card) {
        const now = data.card.createdAt || Date.now();
        const dateKey = data.card.createdDateKey || toLocalCalendarDateKey(now);
        const resolvedLang = detectFlashcardLanguage(
          data.card.front,
          data.card.language || language
        );
        const badgeLower = normalizeLanguageBadge(resolvedLang).toLowerCase() as LangKey;
        const organizedCard: FlashcardItem = {
          ...data.card,
          language: resolvedLang,
          createdDateKey: dateKey,
          voiceId: data.card.voiceId || defaultVoiceByLang[badgeLower],
          deckName: resolveOrganizedDeckName({
            mode: readDeckNamingPreference(),
            customDeckName: 'Chat Poliglota',
            language: resolvedLang,
            dateKey,
          }),
        };
        addFlashcardsToDeck([organizedCard]);
        showToast(`Flashcard "${chunkText}" enviado para ${organizedCard.deckName}!`);
      } else {
        throw new Error(data.error || 'Falha ao criar flashcard.');
      }
    } catch (e: unknown) {
      console.error(e);
      showToast(
        'Erro ao criar flashcard: ' + (e instanceof Error ? e.message : 'erro desconhecido')
      );
    } finally {
      setGeneratingCardKey(null);
    }
  };

  return {
    isLoading,
    generatingCardKey,
    handleSendMessage,
    handleExecuteYoutubePostLinkAction,
    handleCreateFlashcard,
  };
}

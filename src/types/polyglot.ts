export interface AlignedChunk {
  id: number;
  en: string;
  it: string;
  ja: string;
  jaPronunciation?: string;
}

export type FlashcardRetentionStatus = 'new' | 'learning' | 'review' | 'mastered';

export interface FlashcardItem {
  id: string;
  chunkText: string;
  language: string;
  front: string;
  back: string;
  nuance: string;
  pronunciation?: string;
  example: string;
  exampleTranslation: string;
  createdAt: number;
  deckName?: string;
  status?: FlashcardRetentionStatus;
  nextReviewAt?: number;
  intervalDays?: number;
  repetitions?: number;
  lastReviewedAt?: number;
  voiceId?: string;
}

export type AgentPersona = 'polyglot_translator' | 'tutor_conversational' | 'practice_partner';

export interface AgentExploreSource {
  title: string;
  uri: string;
}

export interface LiveAgentToolCallResult {
  id: string;
  name: 'create_study_flashcard' | 'switch_studio_voice';
  behavior: 'NON_BLOCKING';
  args: {
    frontPhrase?: string;
    backTranslation?: string;
    targetVoice?: 'Puck' | 'Kore' | 'Aoede' | 'Fenrir' | 'Enceladus';
    language?: 'en' | 'it' | 'ja' | 'all';
  };
  status: 'executed';
  summaryPtBr: string;
}

export type MessageOriginMode = 'polyglot' | 'live_agent' | 'youtube' | 'web_search';

export type YoutubePostLinkAction =
  | 'ask_intent'
  | 'translate_video'
  | 'summary_dialogue'
  | 'extract_expressions'
  | 'custom_prompt';

export interface YoutubeClipRange {
  start?: string;
  end?: string;
}

export interface YoutubeVideoMetadata {
  videoId: string;
  canonicalUrl: string;
  title: string;
  authorName?: string;
  thumbnailUrl: string;
  durationHint?: string;
}

export interface PolyglotMessage {
  id: string;
  userPrompt: string;
  timestamp: number;
  chunks: AlignedChunk[];
  fullText: {
    en: string;
    it: string;
    ja: string;
  };
  cardVoices?: {
    en: string;
    it: string;
    ja: string;
  };
  status: 'loading' | 'ready' | 'error';
  error?: string;
  /** Resposta ou explicação contextual do Agente Gemini em Português (pt-BR) */
  agentReplyPtBr?: string;
  /** Persona ativa quando gerado via Live API ou Agente */
  agentPersona?: AgentPersona;
  /** URL de vídeo do YouTube analisado pelo Agente */
  youtubeUrl?: string;
  /** Metadados verificados do vídeo do YouTube principal */
  youtubeMeta?: YoutubeVideoMetadata;
  /** Resultados de vídeos do YouTube encontrados em uma busca por tema */
  youtubeSearchResults?: YoutubeVideoMetadata[];
  /** Ação pós-link selecionada ou inferida para o vídeo do YouTube */
  youtubeAction?: YoutubePostLinkAction;
  /** Intervalo opcional de tempo do vídeo (ex.: 00:00 a 03:00) */
  youtubeClipRange?: YoutubeClipRange;
  /** Indica que o card aguarda a escolha da ação pós-link pelo usuário */
  awaitingYoutubeIntent?: boolean;
  /** Fontes verificadas via Google Search Grounding / URL Context */
  sources?: AgentExploreSource[];
  /** Origem da rodada para exibição de badge no histórico e no card */
  originMode?: MessageOriginMode;
}

export interface SavedConversation {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  title: string;
  customTitle?: boolean;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  originMode?: MessageOriginMode;
  messages: PolyglotMessage[];
}

export interface SavedDebateTurnSummary {
  turn: number;
  speaker: string;
  voice_id: string;
  text: string;
  clean_text?: string;
  emotion?: string;
  speech_rate?: number;
  pre_delay_ms?: number;
  audioDurationSec?: number;
}

export interface SavedDebateSession {
  id: string;
  userId: string;
  title: string;
  customTitle?: boolean;
  language: string;
  format: string;
  voiceIds: string[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  turns: SavedDebateTurnSummary[];
  documentPreview?: string;
}

export type UnifiedHistoryKind = 'chat' | 'debate_tts' | 'flashcards';

export interface UnifiedHistoryItem {
  id: string;
  kind: UnifiedHistoryKind;
  title: string;
  subtitle: string;
  updatedAt: string;
  createdAt: string;
  pinned?: boolean;
  languages: string[];
  voiceId: string;
  originMode?: MessageOriginMode;
  itemCount: number;
  conversation?: SavedConversation;
  debateSession?: SavedDebateSession;
  deckName?: string;
}

export interface GoogleUserSession {
  uid: string;
  name: string;
  email: string;
  picture?: string;
  idToken?: string;
  isGoogleAuthenticated: boolean;
}

export interface ColumnVoiceConfig {
  voiceId: string;
  speed: number;
  tone: 'natural' | 'slow' | 'expressive';
}

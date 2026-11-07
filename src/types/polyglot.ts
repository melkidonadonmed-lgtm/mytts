export interface AlignedChunk {
  id: number;
  en: string;
  it: string;
  ja: string;
  jaPronunciation?: string;
}

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
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  originMode?: MessageOriginMode;
  messages: PolyglotMessage[];
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

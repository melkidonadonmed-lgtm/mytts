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
  status: 'loading' | 'ready' | 'error';
  error?: string;
}

export interface ColumnVoiceConfig {
  voiceId: string;
  speed: number;
  tone: 'natural' | 'slow' | 'expressive';
}

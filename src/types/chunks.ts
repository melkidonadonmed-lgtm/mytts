export type TargetLang = 'en-US' | 'it-IT' | 'ja-JP';

export interface ChunkItem {
  id: string;
  chunk: string;
  literalOrNuance: string;
  meaning: string;
  context: string;
  pronunciationHint?: string;
  userId?: string;
  isCustom?: boolean;
  createdAt?: number;
}

export interface GenerateChunksRequest {
  textOrPrompt: string;
  language: TargetLang;
  count?: number;
}

export interface GenerateChunksResponse {
  success: boolean;
  chunks?: ChunkItem[];
  error?: string;
}

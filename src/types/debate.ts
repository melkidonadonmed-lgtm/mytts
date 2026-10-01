export type LanguageCode = 'pt-BR' | 'en-US' | 'it-IT' | 'ja-JP';

export type AudienceLevel = 'layman' | 'intermediate' | 'expert';

export type TensionIntensity = 'reflective' | 'balanced' | 'provocative';

export type TurnEmotion = 
  | 'thoughtful' 
  | 'inquisitive' 
  | 'skeptical' 
  | 'ironic' 
  | 'passionate' 
  | 'resolute';

export interface TurnProsody {
  pre_delay_ms: number; // millisecond gap before speech starts
  speech_rate: number; // 0.90 to 1.15
  breath_sound: boolean; // whether breath marker <breath> is included
  volume_gain?: number; // relative loudness factor
}

export interface DebateTurn {
  turn: number;
  speaker: string;
  voice_id: string; // e.g. "Kore" | "Puck" | "Fenrir" | "Zephyr"
  emotion: TurnEmotion;
  text: string; // Prosodic markup: <breath>, <laugh>, <gasp>, |mhm|, |yeah|, reticências...
  clean_text?: string;
  prosody: TurnProsody;
  audioBase64?: string; // WAV base64 string
  audioDurationSec?: number;
  audioStatus?: 'idle' | 'generating' | 'ready' | 'error';
  errorMessage?: string;
}

export interface SpeakerProfile {
  id: 'speaker1' | 'speaker2';
  name: string;
  roleTitle: string; // e.g. "Analista Metódica & Crítica"
  archetype: 'analytical' | 'provocateur';
  voiceId: string;
  bio: string;
  color: string; // primary visual color
}

export interface DebateConfig {
  language: LanguageCode;
  audienceLevel: AudienceLevel;
  tensionIntensity: TensionIntensity;
  speakers: [SpeakerProfile, SpeakerProfile];
  maxTurns: number;
}

export interface DebateScript {
  id: string;
  title: string;
  topicSummary: string;
  keyThesis: string;
  language: LanguageCode;
  audienceLevel: AudienceLevel;
  tensionIntensity: TensionIntensity;
  speakers: [SpeakerProfile, SpeakerProfile];
  turns: DebateTurn[];
  fullAudioBase64?: string;
  createdAt: string;
}

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  defaultSpeakers: [SpeakerProfile, SpeakerProfile];
}

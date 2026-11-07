/**
 * Utilitários de Áudio do Frontend
 * Conversão segura de base64 para Blob URLs com gerenciamento de ciclo de vida.
 */

/**
 * Converte uma string base64 de áudio em um Blob URL (object URL) gerenciado pelo navegador.
 * Evita o estouro de tamanho de Data URIs e melhora significativamente a performance de reprodução.
 */
export function base64ToBlobUrl(base64: string, mimeType: string = 'audio/wav'): string {
  // Limpeza de possíveis prefixos data URI residuais
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = window.atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Libera de forma segura uma URL criada por URL.createObjectURL.
 */
export function revokeAudioUrl(url: string | null | undefined): void {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignora erro silencioso se a URL já tiver sido liberada
    }
  }
}

/**
 * Formata segundos em MM:SS tabular para contadores de áudio.
 */
export function formatAudioTime(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export interface BrowserSpeechOptions {
  lang?: string;
  rate?: number;
  voiceId?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

const VOICE_ACOUSTIC_PROFILES: Record<
  string,
  { gender: 'male' | 'female'; pitch: number; rateMultiplier: number; voiceOffset: number }
> = {
  Puck: { gender: 'male', pitch: 1.12, rateMultiplier: 1.06, voiceOffset: 0 },
  Kore: { gender: 'female', pitch: 1.02, rateMultiplier: 0.98, voiceOffset: 0 },
  Aoede: { gender: 'female', pitch: 1.22, rateMultiplier: 0.94, voiceOffset: 1 },
  Fenrir: { gender: 'male', pitch: 0.76, rateMultiplier: 0.92, voiceOffset: 1 },
  Enceladus: { gender: 'male', pitch: 0.9, rateMultiplier: 0.89, voiceOffset: 2 },
};

const FEMALE_VOICE_HINTS = [
  'female',
  'woman',
  'maria',
  'francisca',
  'thalita',
  'leila',
  'luciana',
  'zira',
  'aria',
  'jenny',
  'sonia',
  'elsa',
  'isabella',
  'alice',
  'federica',
  'kyoko',
  'haruka',
  'ayumi',
  'nanami',
  'samantha',
  'victoria',
  'helena',
  'paulina',
];

const MALE_VOICE_HINTS = [
  'male',
  'man',
  'daniel',
  'antonio',
  'fabio',
  'humberto',
  'david',
  'mark',
  'guy',
  'christopher',
  'diego',
  'cosimo',
  'luca',
  'ichiro',
  'keita',
  'otoya',
  'takumi',
  'alex',
  'jorge',
];

/**
 * Interrompe imediatamente qualquer síntese nativa em execução no navegador.
 */
export function stopBrowserSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignora erro se speechSynthesis não estiver disponível
    }
  }
}

/**
 * Reproduz texto via Web Speech API nativa do navegador (fallback resiliente quando a API Gemini TTS falha ou está offline),
 * diferenciando timbre, voz do sistema e pitch para cada uma das 5 vozes (Puck, Kore, Aoede, Fenrir, Enceladus).
 */
export function speakBrowserFallback(text: string, options: BrowserSpeechOptions = {}): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  const { lang = 'pt-BR', rate = 1.0, voiceId, onStart, onEnd, onError } = options;
  stopBrowserSpeech();

  const cleanText = text
    .replace(/\[.*?\]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\|[^|]+\|/g, '')
    .replace(lang.startsWith('ja') ? /\(.*?\)/g : /^$/, '')
    .trim();

  if (!cleanText) {
    return false;
  }

  try {
    const profile = (voiceId && VOICE_ACOUSTIC_PROFILES[voiceId]) || {
      gender: 'male',
      pitch: 1.0,
      rateMultiplier: 1.0,
      voiceOffset: 0,
    };

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.pitch = profile.pitch;
    utterance.rate = Math.max(0.5, Math.min(2.0, rate * profile.rateMultiplier));

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const normalizedLang = lang.toLowerCase();
      const langPrefix = normalizedLang.split('-')[0];
      const exactLangVoices = voices.filter((v) => v.lang.toLowerCase() === normalizedLang);
      const prefixLangVoices = voices.filter((v) =>
        v.lang.toLowerCase().startsWith(langPrefix)
      );
      const candidatePool =
        exactLangVoices.length > 0
          ? exactLangVoices
          : prefixLangVoices.length > 0
          ? prefixLangVoices
          : voices;

      const genderHints = profile.gender === 'female' ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS;
      const genderPool = candidatePool.filter((v) => {
        const lowerName = v.name.toLowerCase();
        return genderHints.some((hint) => lowerName.includes(hint));
      });

      const activePool = genderPool.length > 0 ? genderPool : candidatePool;
      const chosenVoice = activePool[profile.voiceOffset % activePool.length] || candidatePool[0];
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }
    }

    if (onStart) utterance.onstart = () => onStart();
    if (onEnd) utterance.onend = () => onEnd();
    if (onError) utterance.onerror = () => onError();

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    if (onError) onError();
    return false;
  }
}



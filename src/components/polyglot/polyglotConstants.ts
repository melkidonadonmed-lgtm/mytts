import type { PolyglotMessage } from '../../types/polyglot';

export type LangKey = 'en' | 'it' | 'ja';

export const getLanguageTag = (code: string): string => {
  if (code === 'it') return 'it-IT';
  if (code === 'ja') return 'ja-JP';
  return 'en-US';
};

export const INITIAL_DEMO_MESSAGE: PolyglotMessage = {
  id: 'msg-demo-1',
  userPrompt: 'Gostaria de pedir um café expresso e a conta com gentileza.',
  timestamp: Date.now() - 60000,
  chunks: [
    {
      id: 0,
      en: 'Could I please get an espresso,',
      it: 'Potrei avere un caffè espresso, per favore,',
      ja: 'エスプレッソを一杯お願いします、',
      jaPronunciation: 'Esupuresso o ippai onegai shimasu,',
    },
    {
      id: 1,
      en: 'and the check whenever you are ready?',
      it: 'e il conto quando è pronto?',
      ja: 'そしてお会計もお願いできますか？',
      jaPronunciation: 'soshite okaikei mo onegai dekimasu ka?',
    },
  ],
  fullText: {
    en: 'Could I please get an espresso, and the check whenever you are ready?',
    it: 'Potrei avere un caffè espresso, per favore, e il conto quando è pronto?',
    ja: 'エスプレッソを一杯お願いします、そしてお会計もお願いできますか？',
  },
  cardVoices: {
    en: 'Puck',
    it: 'Kore',
    ja: 'Aoede',
  },
  status: 'ready',
};

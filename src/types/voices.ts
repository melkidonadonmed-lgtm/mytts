export interface VoiceProfile {
  id: string;
  name: string;
  avatarColor: string;
  archetype: string;
  styleDescription: string;
  bestFor: string;
  gender: 'female' | 'male' | 'neutral';
  tone: string;
}

export const GEMINI_VOICES: VoiceProfile[] = [
  {
    id: 'Puck',
    name: 'Puck',
    avatarColor: 'from-amber-500 to-orange-600',
    archetype: 'Enérgico & Provocador',
    styleDescription: 'Voz jovem, ágil e expressiva, com cadência dinâmica e inflexões afiadas.',
    bestFor: 'Podcasts informais, debates acalorados, narração de tutoriais e ritmo acelerado.',
    gender: 'male',
    tone: 'Alto astral, irônico, expressivo',
  },
  {
    id: 'Kore',
    name: 'Kore',
    avatarColor: 'from-emerald-500 to-teal-600',
    archetype: 'Analítica & Teórica',
    styleDescription: 'Voz clara, reflexiva e fundamentada, com articulação impecável e pausas medidas.',
    bestFor: 'Ensaios acadêmicos, análises técnicas, notícias e áudio-livros educativos.',
    gender: 'female',
    tone: 'Séria, acolhedora, precisa',
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    avatarColor: 'from-rose-500 to-pink-600',
    archetype: 'Calorosa & Expressiva',
    styleDescription: 'Rica em musicalidade e ressonância, transmitindo empatia profunda e engajamento.',
    bestFor: 'Narrativas, storytelling, meditação guiada e apresentações corporativas.',
    gender: 'female',
    tone: 'Suave, magnética, calorosa',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    avatarColor: 'from-indigo-500 to-purple-600',
    archetype: 'Grave & Autoritário',
    styleDescription: 'Timbre profundo e estável, com presença acústica marcante e dicção assertiva.',
    bestFor: 'Documentários, anúncios de impacto, trailers e leituras solenes.',
    gender: 'male',
    tone: 'Profundo, resoluto, confiante',
  },
  {
    id: 'Enceladus',
    name: 'Enceladus',
    avatarColor: 'from-cyan-500 to-blue-600',
    archetype: 'Arejado & Contemplativo',
    styleDescription: 'Textura respirada e suave, excelente para passagens reflexivas, hesitações e calma.',
    bestFor: 'Poesia, relaxamento, conversas intimistas e ensaios pessoais.',
    gender: 'male',
    tone: 'Respirado, suave, intimista',
  },
];

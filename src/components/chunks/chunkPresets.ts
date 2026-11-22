import type { ChunkItem, TargetLang } from '../../types/chunks';

export const CHUNK_LANGUAGES: { code: TargetLang; label: string; flag: string }[] = [
  { code: 'en-US', label: 'Inglês', flag: 'EN' },
  { code: 'it-IT', label: 'Italiano', flag: 'IT' },
  { code: 'ja-JP', label: 'Japonês', flag: 'JA' },
];

// Banco inicial offline para teste imediato de alta fluência
export const CHUNK_PRESETS: Record<TargetLang, Record<string, ChunkItem[]>> = {
  'en-US': {
    geral: [
      {
        id: 'en-1',
        chunk: "I'm down for that.",
        literalOrNuance: 'Tô dentro / topo na hora',
        meaning:
          'Usado para concordar imediatamente com um plano ou convite de forma bem natural.',
        context: 'Casual entre amigos',
        pronunciationHint: 'aim-dáun-fer-thæt',
      },
      {
        id: 'en-2',
        chunk: 'Long story short...',
        literalOrNuance: 'Resumindo a ópera...',
        meaning: 'Corta os detalhes chatos de um relato longo e vai direto ao ponto central.',
        context: 'Transição de conversa',
        pronunciationHint: 'lóng-stóri-shórt',
      },
      {
        id: 'en-3',
        chunk: "Don't sweat it.",
        literalOrNuance: 'Esquenta a cabeça não / rlx',
        meaning: "Equivalente mais solto e coloquial para 'you're welcome' ou 'no problem'.",
        context: 'Alívio de tensão / agradecimento',
        pronunciationHint: 'dôunt-suét-it',
      },
      {
        id: 'en-4',
        chunk: 'Fair enough.',
        literalOrNuance: 'Justo / faz sentido',
        meaning:
          'Concordância rápida mesmo quando você não concorda 100%, mas respeita a lógica do outro.',
        context: 'Debates e alinhamento',
        pronunciationHint: 'fér-i-nâf',
      },
    ],
  },
  'it-IT': {
    geral: [
      {
        id: 'it-1',
        chunk: 'Ma figurati!',
        literalOrNuance: 'Imagina! / Que nada!',
        meaning:
          'Resposta coloquial para desfazer formalidades quando alguém agradece ou pede desculpas.',
        context: 'Dia a dia italiano',
        pronunciationHint: 'ma fi-gú-ra-ti',
      },
      {
        id: 'it-2',
        chunk: 'Ci sta.',
        literalOrNuance: 'Faz sentido / combina / topo',
        meaning: 'Gíria moderna universal usada para aprovar uma ideia, plano ou combinação.',
        context: 'Jovens e informal',
        pronunciationHint: 'tchi-stá',
      },
      {
        id: 'it-3',
        chunk: 'Meno male!',
        literalOrNuance: 'Ainda bem! / Menos mal!',
        meaning: 'Expressão de alívio puro ao ouvir uma notícia positiva ou solução de problema.',
        context: 'Reação espontânea',
        pronunciationHint: 'mé-no má-le',
      },
      {
        id: 'it-4',
        chunk: 'Che ne pensi?',
        literalOrNuance: 'O que você acha disso?',
        meaning: 'Puxador de conversa clássico e ágil para passar a bola de volta ao interlocutor.',
        context: 'Engajamento de fala',
        pronunciationHint: 'ke ne pén-si',
      },
    ],
  },
  'ja-JP': {
    geral: [
      {
        id: 'ja-1',
        chunk: 'なるほどね (Naruhodo ne)',
        literalOrNuance: 'Ah, entendi / faz sentido total',
        meaning:
          'Aizuchi (reação auditiva) indispensável para mostrar que você está ouvindo com atenção.',
        context: 'Conversação natural',
        pronunciationHint: 'na-ru-ho-do-ne',
      },
      {
        id: 'ja-2',
        chunk: 'とりあえず (Toriaezu)',
        literalOrNuance: 'Por enquanto / pra começar...',
        meaning:
          "Usado para tomar uma decisão rápida sem compromisso definitivo (ex: 'vamos pedir isso primeiro').",
        context: 'Restaurantes e decisões',
        pronunciationHint: 'to-ri-a-e-zu',
      },
      {
        id: 'ja-3',
        chunk: 'お疲れ様！ (Otsukaresama!)',
        literalOrNuance: 'Bom trabalho / valeu por hoje!',
        meaning: 'A saudação de encerramento mais natural do japonês após qualquer esforço conjunto.',
        context: 'Trabalho, estudos e academia',
        pronunciationHint: 'o-tsu-ka-re-sa-ma',
      },
      {
        id: 'ja-4',
        chunk: '気にしないで (Ki ni shinaide)',
        literalOrNuance: 'Não esquenta com isso / relaxa',
        meaning:
          "Maneira calorosa e suave de dizer 'não foi nada' para alguém que se desculpou.",
        context: 'Informal e acolhedor',
        pronunciationHint: 'ki ni shi-nai-de',
      },
    ],
  },
};

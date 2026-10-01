import { DebateScript, LanguageOption } from '../types/debate';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: 'pt-BR',
    name: 'Português (Brasil)',
    nativeName: 'Português',
    flag: '🇧🇷',
    defaultSpeakers: [
      {
        id: 'speaker1',
        name: 'Sofia',
        roleTitle: 'Analista Teórica & Investigativa',
        archetype: 'analytical',
        voiceId: 'Kore',
        bio: 'Examina dados empíricos, premissas metodológicas e falácias estruturais com rigor.',
        color: '#38bdf8' // sky-400
      },
      {
        id: 'speaker2',
        name: 'Lucas',
        roleTitle: 'Provocador Pragmático & Cético',
        archetype: 'provocateur',
        voiceId: 'Puck',
        bio: 'Desafia dogmas acadêmicos, testa a viabilidade prática no mundo real e usa ironia socrática.',
        color: '#fb923c' // orange-400
      }
    ]
  },
  {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English',
    flag: '🇺🇸',
    defaultSpeakers: [
      {
        id: 'speaker1',
        name: 'Elena',
        roleTitle: 'Senior Systems Epistemologist',
        archetype: 'analytical',
        voiceId: 'Kore',
        bio: 'Deconstructs foundational premises, causal loops, and peer-reviewed benchmark validity.',
        color: '#818cf8' // indigo-400
      },
      {
        id: 'speaker2',
        name: 'Marcus',
        roleTitle: 'Pragmatic Tech Provocateur',
        archetype: 'provocateur',
        voiceId: 'Puck',
        bio: 'Cuts through hype, challenges theoretical purity, and stresses market economics.',
        color: '#34d399' // emerald-400
      }
    ]
  },
  {
    code: 'it-IT',
    name: 'Italiano',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    defaultSpeakers: [
      {
        id: 'speaker1',
        name: 'Chiara',
        roleTitle: 'Critica Culturale & Ricercatrice',
        archetype: 'analytical',
        voiceId: 'Kore',
        bio: 'Valuta l’impatto sociologico, la coerenza etica e le conseguenze a lungo termine.',
        color: '#f472b6' // pink-400
      },
      {
        id: 'speaker2',
        name: 'Matteo',
        roleTitle: 'Disruttore Industriale',
        archetype: 'provocateur',
        voiceId: 'Fenrir',
        bio: 'Critica l’immobilismo burocratico e affronta la dura realtà dei mercati globali.',
        color: '#fbbf24' // amber-400
      }
    ]
  },
  {
    code: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    defaultSpeakers: [
      {
        id: 'speaker1',
        name: '葵 (Aoi)',
        roleTitle: '構造分析研究員',
        archetype: 'analytical',
        voiceId: 'Kore',
        bio: '学術的エビデンスと長期的な構造リスクを重視し、論理の前提を慎重に検証する。',
        color: '#a78bfa' // purple-400
      },
      {
        id: 'speaker2',
        name: '蓮 (Ren)',
        roleTitle: '実務リアリスト',
        archetype: 'provocateur',
        voiceId: 'Puck',
        bio: '現場の経済合理性と実装スピードを最優先し、過度な理論的慎重論に鋭く切り込む。',
        color: '#38bdf8' // sky-400
      }
    ]
  }
];

export const SAMPLE_DOCUMENTS = [
  {
    id: 'sample-pt',
    language: 'pt-BR' as const,
    title: 'A Falácia da Eficiência: Como a IA Generativa Está Canibalizando o Pensamento Crítico',
    category: 'Tecnologia & Cognição',
    readTime: '3 min',
    summary: 'Um ensaio denso sobre a atrofia cognitiva causada pela terceirização de raciocínio complexo a modelos fundacionais.',
    content: `A proliferação desenfreada de ferramentas de inteligência artificial generativa nos ambientes de trabalho e acadêmicos gerou uma ilusão perigosa: a de que a velocidade de geração é sinônimo de profundidade de raciocínio.

Historicamente, o esforço da escrita e da depuração intelectual não era mero atrito burocrático; era precisamente a forja onde o pensamento crítico se refinava. Ao eliminarmos o rascunho imperfeito em favor de respostas sinteticamente polidas e estruturadas em listas numeradas, criamos profissionais que sabem validar aparências, mas perderam a capacidade de questionar premissas subjacentes.

Mais alarmante ainda é a homogenização estilística e epistemológica. Modelos probabilísticos convergem invariavelmente para a média das expectativas culturais prévias. O erro fecundo, a heresia epistemológica e o salto intuitivo não-linear — motores de todas as revoluções científicas genuínas — são filtrados como anomalias indesejadas pelos mecanismos de alinhamento por reforço humano (RLHF). Estamos terceirizando nossa capacidade de discordar para sistemas programados para agradar.`
  },
  {
    id: 'sample-en',
    language: 'en-US' as const,
    title: 'The Nuclear Grid Paradox: Why AI Data Centers Will Break Net-Zero Pledges',
    category: 'Energy & Infrastructure',
    readTime: '4 min',
    summary: 'An investigation into Big Tech’s sudden rush toward Small Modular Reactors (SMRs) and whether baseload power reality eclipses green targets.',
    content: `The sudden divergence between Silicon Valley’s climate pledges and its electrical appetite represents the defining infrastructural clash of the decade. Hyperscalers projecting gigawatt-scale clusters for frontier model training have encountered an immovable physics barrier: intermittent wind and solar cannot guarantee the five-nines uptime required by modern GPU clusters without prohibitive battery storage capital costs.

The industry's pivot toward nuclear power — particularly Small Modular Reactors (SMRs) and restarted legacy reactors — is widely heralded as a technological savior. Yet SMR deployments remain unproven at commercial scale, entangled in multi-year regulatory licensing and supply-chain bottlenecks for High-Assay Low-Enriched Uranium (HALEU).

In the interim five to eight years before any theoretical SMR cluster comes online, utilities are quietly delaying coal retirements and commissioning peaker natural gas plants. The narrative of clean synthetic intelligence is masking an immediate carbon surge that legacy grid operators are fundamentally unprepared to absorb.`
  },
  {
    id: 'sample-it',
    language: 'it-IT' as const,
    title: 'L’Illusione della Sovranità Digitale Europea: Regolazione contro Competitività',
    category: 'Geopolitica & Economia',
    readTime: '3 min',
    summary: 'Un’analisi tagliente sulle contraddizioni dell’AI Act europeo dinanzi al monopolio infrastrutturale americano e cinese.',
    content: `L'Unione Europea ama definirsi la superpotenza normativa del pianeta. Con il lancio dell'AI Act e delle severe normative su copyright e trasparenza algoritmica, Bruxelles pretende di esportare un modello umanistico di tecnologia responsabile.

Tuttavia, esiste un paradosso ontologico: non si può regolamentare con autorevolezza ciò che non si è capaci di costruire. La totalità dell'infrastruttura di calcolo avanzato — dalle fonderie di semiconduttori estremi ultravioletti alle piattaforme cloud hyperscale — risiede al di fuori dei confini comunitari. 

Mentre gli Stati Uniti finanziano cluster di elaborazione energetica da decine di miliardi e la Cina verticalizza l'intera catena di fornitura, l'Europa produce documenti di conformità burocratica che soffocano le poche startup promettenti del continente. Proteggere i diritti dei cittadini è un dovere nobile, ma senza sovranità tecnologica materiale, la regolamentazione diventa soltanto una tassa sulla competitività futura.`
  },
  {
    id: 'sample-ja',
    language: 'ja-JP' as const,
    title: '日本の人口減少社会における自動化幻想：ロボットは労働力不足を救えるか',
    category: '社会構造 & 技術実装',
    readTime: '3 min',
    summary: '少子高齢化の切り札とされるサービス・介護ロボットの現場導入における費用対効果と人間的摩擦の検証。',
    content: `日本が直面する急激な人口減少と少子高齢化に対し、政界や産業界は長年「ロボティクスと自動化による克服」を旗印に掲げてきた。介護現場での見守りセンサー、飲食店の配膳ロボット、工場内の無人搬送車（AGV）など、技術的なデモンストレーションは確かに目覚ましい。

しかし、現場の実態は遥かに複雑である。ハードウェアの導入コストと保守費用、さらにはイレギュラーな事態に即応するための人的オペレーションが不可欠であり、結果として「機械を監視するための労働」が新たに発生している。

とりわけ感情労働や高度な文脈理解が要求される領域において、機械は人間の代替ではなく単なる補足に留まっている。人口構造の根本的な是正や抜本的な産業再編から目を背け、テクノロジーによる対症療法に依存し続けることは、日本社会の構造的改革を先送りする口実になっていないだろうか。`
  }
];

export const INITIAL_PRESET_SCRIPTS: Record<string, DebateScript> = {
  'pt-BR': {
    id: 'preset-pt-01',
    title: 'A Ilusão da Produtividade: A IA nos Libertará ou nos Escravizará?',
    topicSummary: 'Confronto dialético sobre a perda da agência cognitiva e a viabilidade prática da automação intelectual.',
    keyThesis: 'A terceirização do pensamento para modelos generativos corrói a capacidade de inovação disruptiva.',
    language: 'pt-BR',
    audienceLevel: 'intermediate',
    tensionIntensity: 'provocative',
    speakers: LANGUAGE_OPTIONS[0].defaultSpeakers,
    createdAt: new Date().toISOString(),
    turns: [
      {
        turn: 1,
        speaker: 'Sofia',
        voice_id: 'Kore',
        emotion: 'thoughtful',
        text: '<breath> Olha... analisando friamente esse ensaio sobre atrofia cognitiva, tem algo que a gente não pode varrer pra baixo do tapete. Quando você automatiza o rascunho — aquele atrito duro da folha em branco —, você não tá apenas economizando tempo; você tá eliminando a única etapa onde o cérebro realmente estrutura uma tese.',
        clean_text: 'Olha... analisando friamente esse ensaio sobre atrofia cognitiva, tem algo que a gente não pode varrer pra baixo do tapete. Quando você automatiza o rascunho — aquele atrito duro da folha em branco —, você não tá apenas economizando tempo; você tá eliminando a única etapa onde o cérebro realmente estrutura uma tese.',
        prosody: {
          pre_delay_ms: 80,
          speech_rate: 1.0,
          breath_sound: true
        }
      },
      {
        turn: 2,
        speaker: 'Lucas',
        voice_id: 'Puck',
        emotion: 'ironic',
        text: '<laugh> Ah, por favor, Sofia! <breath> Esse é exatamente o mesmo pânico moral que os copistas medievais tiveram com a imprensa de Gutenberg! "Ninguém mais vai memorizar nada!" — |mhm| era o mesmo choro. A IA não mata o raciocínio; ela só corta a datilografia e a busca mecânica de referências.',
        clean_text: 'Ah, por favor, Sofia! Esse é exatamente o mesmo pânico moral que os copistas medievais tiveram com a imprensa de Gutenberg! "Ninguém mais vai memorizar nada!" — era o mesmo choro. A IA não mata o raciocínio; ela só corta a datilografia e a busca mecânica de referências.',
        prosody: {
          pre_delay_ms: 120,
          speech_rate: 1.06,
          breath_sound: true
        }
      },
      {
        turn: 3,
        speaker: 'Sofia',
        voice_id: 'Kore',
        emotion: 'skeptical',
        text: 'Não distorça o argumento com falsa analogia histórica, Lucas. A prensa mecânica multiplicava a distribuição do texto humano; ela não gerava a interpretação no seu lugar. O ponto central do texto é sobre convergência à média: modelos treinados por RLHF são otimizados pra soar palatáveis e consensuais. Quem consome isso o dia inteiro perde o músculo da heresia intelectual.',
        clean_text: 'Não distorça o argumento com falsa analogia histórica, Lucas. A prensa mecânica multiplicava a distribuição do texto humano; ela não gerava a interpretação no seu lugar. O ponto central do texto é sobre convergência à média: modelos treinados por RLHF são otimizados pra soar palatáveis e consensuais. Quem consome isso o dia inteiro perde o músculo da heresia intelectual.',
        prosody: {
          pre_delay_ms: 90,
          speech_rate: 1.02,
          breath_sound: false
        }
      },
      {
        turn: 4,
        speaker: 'Lucas',
        voice_id: 'Puck',
        emotion: 'passionate',
        text: '<breath> Mas me diz: desde quando o trabalhador médio numa multinacional precisa de "heresia intelectual" pra validar um fluxo de caixa ou redigir um contrato padrão? 90% do trabalho cognitivo é operacional, repetitivo e maçante! Se a máquina entrega o consenso em 3 segundos, sobra energia pro profissional questionar o que realmente importa.',
        clean_text: 'Mas me diz: desde quando o trabalhador médio numa multinacional precisa de "heresia intelectual" pra validar um fluxo de caixa ou redigir um contrato padrão? 90% do trabalho cognitivo é operacional, repetitivo e maçante! Se a máquina entrega o consenso em 3 segundos, sobra energia pro profissional questionar o que realmente importa.',
        prosody: {
          pre_delay_ms: 110,
          speech_rate: 1.08,
          breath_sound: true
        }
      },
      {
        turn: 5,
        speaker: 'Sofia',
        voice_id: 'Kore',
        emotion: 'resolute',
        text: 'Sobra energia? <gasp> A ilusão tá justamente aí! Os estudos mostram que o usuário não usa o tempo livre pra aprofundar; ele simplesmente aceita o output plausível com viés de confirmação e corre pra próxima tarefa. A mediocridade vira o novo teto de qualidade da indústria.',
        clean_text: 'Sobra energia? A ilusão tá justamente aí! Os estudos mostram que o usuário não usa o tempo livre pra aprofundar; ele simplesmente aceita o output plausível com viés de confirmação e corre pra próxima tarefa. A mediocridade vira o novo teto de qualidade da indústria.',
        prosody: {
          pre_delay_ms: 100,
          speech_rate: 0.98,
          breath_sound: true
        }
      },
      {
        turn: 6,
        speaker: 'Lucas',
        voice_id: 'Puck',
        emotion: 'inquisitive',
        text: 'Então o seu problema não é com a tecnologia, Sofia... é com a preguiça humana. E tentar frear a ferramenta por causa da fraqueza do operador é uma batalha perdida antes de começar. A gente precisa ensinar pensamento crítico com a IA na mão, não fingir que podemos trancar a caixa de Pandora.',
        clean_text: 'Então o seu problema não é com a tecnologia, Sofia... é com a preguiça humana. E tentar frear a ferramenta por causa da fraqueza do operador é uma batalha perdida antes de começar. A gente precisa ensinar pensamento crítico com a IA na mão, não fingir que podemos trancar a caixa de Pandora.',
        prosody: {
          pre_delay_ms: 140,
          speech_rate: 1.04,
          breath_sound: false
        }
      }
    ]
  }
};

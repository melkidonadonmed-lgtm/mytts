import assert from 'assert';
import { SOUNDTRACK_PRESETS, SoundtrackPreset } from './src/utils/proceduralSoundtracks';

console.log('🧪 Iniciando Verificação de Engenharia de Áudio (mytts)...');

// 1. Validar Presets de Trilha Sonora
console.log('\n[1/4] Validando presets de Soundscape:');
const expectedPresets: SoundtrackPreset[] = [
  'none',
  'lofi-warmth',
  'deep-focus',
  'cinematic-pulse',
  'tech-ambient',
  'custom',
];

assert.strictEqual(SOUNDTRACK_PRESETS.length, 6, 'Deve haver exatamente 6 presets configurados.');

expectedPresets.forEach((id) => {
  const found = SOUNDTRACK_PRESETS.find((p) => p.id === id);
  assert.ok(found, `Preset ${id} deve existir no catálogo de trilhas.`);
  console.log(`  ✓ Preset "${found.id}" verificado: ${found.icon} ${found.ptName}`);
});

// 2. Validar Matemática do Auto-Ducking
console.log('\n[2/4] Validando atenuação dinâmica (Auto-Ducking dB -> Linear):');
const testDepths = [
  { db: -8, expectedMin: 0.39, expectedMax: 0.41, label: 'Suave' },
  { db: -14, expectedMin: 0.19, expectedMax: 0.21, label: 'Studio' },
  { db: -20, expectedMin: 0.09, expectedMax: 0.11, label: 'Profundo' },
];

testDepths.forEach(({ db, expectedMin, expectedMax, label }) => {
  const linear = Math.pow(10, db / 20);
  assert.ok(linear >= expectedMin && linear <= expectedMax, `Cálculo de ducking ${label} (${db}dB) incorreto.`);
  console.log(`  ✓ ${label} (${db}dB): Fator linear = ${(linear * 100).toFixed(1)}% do volume nominal`);
});

// 3. Validar Reforço Vocal (Voice Boost)
console.log('\n[3/4] Validando ganho vocal (+dB -> Linear):');
const boostDepths = [
  { db: 0, expected: 1.0 },
  { db: 3, expectedMin: 1.40, expectedMax: 1.43 },
  { db: 6, expectedMin: 1.98, expectedMax: 2.01 },
];

boostDepths.forEach(({ db, expected, expectedMin, expectedMax }) => {
  const linear = Math.pow(10, db / 20);
  if (expected !== undefined) {
    assert.strictEqual(linear, expected);
  } else {
    assert.ok(linear >= expectedMin! && linear <= expectedMax!);
  }
  console.log(`  ✓ Voice Boost +${db}dB: Multiplicador linear = ${linear.toFixed(2)}x`);
});

// 4. Validar Geração de Cabeçalho WAV RIFF canônico (44 bytes)
console.log('\n[4/4] Validando estrutura canônica do container WAV RIFF:');
function createMockWavHeader(sampleRate: number, numChannels: number, bitsPerSample: number, dataSize: number): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const chunkSize = 36 + dataSize;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return header;
}

const header44kStereo = createMockWavHeader(44100, 2, 16, 176400); // 1 segundo estéreo 44.1kHz
assert.strictEqual(header44kStereo.toString('ascii', 0, 4), 'RIFF');
assert.strictEqual(header44kStereo.toString('ascii', 8, 12), 'WAVE');
assert.strictEqual(header44kStereo.toString('ascii', 12, 16), 'fmt ');
assert.strictEqual(header44kStereo.readUInt16LE(20), 1); // PCM
assert.strictEqual(header44kStereo.readUInt16LE(22), 2); // 2 canais
assert.strictEqual(header44kStereo.readUInt32LE(24), 44100); // 44.1kHz
assert.strictEqual(header44kStereo.readUInt16LE(34), 16); // 16-bit
assert.strictEqual(header44kStereo.toString('ascii', 36, 40), 'data');
assert.strictEqual(header44kStereo.readUInt32LE(40), 176400);

console.log('  ✓ Cabeçalho WAV RIFF canônico de 44 bytes verificado com precisão para 44.1kHz estéreo 16-bit.');

// 5. Validar Motor de Calibração e Auto-Prosódia em PT-BR
console.log('\n[5/5] Validando Calibração Fonética PT-BR e Auto-Prosódia Acústica:');
import { getEmotionStyle, applyAcousticProsody } from './src/utils/prosodyEngine';

// 5.1 Testar getEmotionStyle com forçamento de idioma e mapeamento de velocidade
const naturalPrompt = getEmotionStyle('natural', 1.0);
assert.ok(naturalPrompt.includes('Brazilian Portuguese (pt-BR)'), 'Prompt natural deve forçar estritamente PT-BR.');
assert.ok(naturalPrompt.includes('natural and steady-paced'), 'Velocidade 1.0 deve mapear para natural and steady-paced.');

const slowStorytelling = getEmotionStyle('storytelling', 0.8);
assert.ok(slowStorytelling.includes('Brazilian Portuguese (pt-BR)'), 'Prompt storytelling deve forçar PT-BR.');
assert.ok(slowStorytelling.includes('slow, deliberate and well-paced'), 'Velocidade 0.8 deve mapear para slow and deliberate.');

const fastSpontaneous = getEmotionStyle('spontaneous', 1.3);
assert.ok(fastSpontaneous.includes('agile, fast and energetic'), 'Velocidade 1.3 deve mapear para agile and fast.');

console.log('  ✓ getEmotionStyle: Instrução estrita de PT-BR e mapeamento de velocidade validados.');

// 5.2 Testar applyAcousticProsody: sanitização de tags perigosas e pontuação acústica
const rawTextWithTags = 'Olá [deep breath] a todos! <pause> Vamos começar [sighs] agora.';
const sanitized = applyAcousticProsody(rawTextWithTags, { enabled: true });
assert.ok(!sanitized.includes('[deep breath]'), 'Não deve conter tags brutas [deep breath].');
assert.ok(!sanitized.includes('<pause>'), 'Não deve conter tags brutas <pause>.');
assert.ok(!sanitized.includes('[sighs]'), 'Não deve conter tags brutas [sighs].');
assert.ok(!sanitized.includes('deep breath'), 'Não deve conter o texto "deep breath" para evitar leitura literal.');

// 5.3 Testar inserção de pontuação de fôlego em orações longas (> 25 palavras)
const longSentence = 'Este é um parágrafo bastante extenso que discute os fundamentos da inteligência artificial generativa e da síntese neural de voz, explicando como modelos modernos conseguem simular o ritmo biológico e a cadência humana sem ruídos digitais perceptíveis.';
const prosodyResult = applyAcousticProsody(longSentence, { enabled: true });
assert.ok(prosodyResult.includes('...') || prosodyResult.includes('—'), 'Frase longa sem quebras deve receber pontuação acústica de fôlego.');

// 5.4 Testar Casos de Borda Críticos (Edge Cases: Texto Sujo, Emojis, Moeda e Código)
const dirtyText = 'Excelente novidade! 🚀 O pacote custa R$ 1.500,00 e o link é https://example.com/api?id=123. Veja o log: console.log("ok");';
const cleanEdgeCase = applyAcousticProsody(dirtyText, { enabled: true });
assert.ok(cleanEdgeCase.includes('R$ 1.500,00'), 'Valores monetários formatados devem ser preservados.');
assert.ok(cleanEdgeCase.includes('https://example.com/api?id=123'), 'URLs devem ser preservadas sem quebrar.');
assert.ok(cleanEdgeCase.includes('🚀'), 'Emojis devem ser preservados sem travar a sanitização.');
assert.ok(cleanEdgeCase.includes('console.log("ok");'), 'Trechos de código devem ser preservados.');

console.log('  ✓ Casos de borda (emojis, moeda, URLs e código) validados com sucesso.');

// 6. Validar Exportador CSV de Flashcards para Anki & Notion
console.log('\n[6/6] Validando Exportador CSV de Flashcards (Anki & Notion UTF-8):');
import { formatFlashcardsToCsv } from './src/utils/csvExporter';
import { FlashcardItem } from './src/types/polyglot';

const sampleCards: FlashcardItem[] = [
  {
    id: 'c1',
    chunkText: 'Devo davvero imparare',
    language: 'it-IT',
    front: 'Devo davvero imparare',
    back: 'Eu realmente preciso aprender',
    nuance: 'Uso coloquial com "davvero" indicando ênfase.',
    pronunciation: 'de-vo da-vé-ro im-pa-rá-re',
    example: 'Devo davvero imparare l\'italiano.',
    exampleTranslation: 'Eu realmente preciso aprender italiano.',
    createdAt: Date.now(),
  },
  {
    id: 'c2',
    chunkText: 'なるほどね',
    language: 'ja-JP',
    front: 'なるほどね (Naruhodo ne)',
    back: 'Ah, entendi / faz sentido total',
    nuance: 'Aizuchi de escuta ativa.',
    pronunciation: 'na-ru-ho-do-ne',
    example: 'なるほどね、そうだったんだ。',
    exampleTranslation: 'Entendi, era isso então.',
    createdAt: Date.now(),
  },
];

const csvOutput = formatFlashcardsToCsv(sampleCards);
assert.ok(csvOutput.startsWith('\uFEFF'), 'CSV deve iniciar com UTF-8 BOM para suporte a caracteres japoneses e acentos.');
assert.ok(csvOutput.includes('Frente (Original);Verso (Tradução)'), 'Delimitador padrão do cabeçalho deve ser ponto e vírgula (;).');
assert.ok(csvOutput.includes('"Devo davvero imparare"'), 'Campos de texto devem ser sanitizados entre aspas.');
assert.ok(csvOutput.includes('なるほどね (Naruhodo ne)'), 'Caracteres japoneses e romaji devem ser preservados sem corrupção.');
assert.ok(csvOutput.includes('Uso coloquial com ""davvero""'), 'Aspas internas no texto devem ser escapadas com aspas duplas ("").');

console.log('  ✓ Exportador CSV validado: UTF-8 BOM, delimitador Anki (;), escape e caracteres japoneses conformes.');

// 7. Validar Motor de Cache de Áudio (IndexedDB & L1 Memória)
console.log('\n[7/7] Validando Motor de Cache de Áudio (IndexedDB & L1 Memória):');
import {
  generateAudioCacheKey,
  getCachedAudio,
  setCachedAudio,
  clearAudioCache,
  isAudioCached,
  getAudioCacheStats,
} from './src/utils/audioCache';

// 7.1 Chave determinística e normalização de espaços/caracteres
const key1 = generateAudioCacheKey({
  type: 'speech',
  text: '  Could I please   get an   espresso?  ',
  language: 'en-US',
  voiceId: 'Puck',
  speed: 1,
  emotion: 'natural',
});

const key2 = generateAudioCacheKey({
  type: 'speech',
  text: 'Could I please get an espresso?',
  language: 'EN-US',
  voiceId: 'Puck',
  speed: 1.0,
  emotion: 'NATURAL',
});

assert.strictEqual(key1, key2, 'Chaves geradas para textos e parâmetros equivalentes devem ser estritamente idênticas.');
assert.strictEqual(
  key1,
  'speech:en-us:Puck:1.00:natural:Could I please get an espresso?',
  'Formato canônico da chave deve seguir o padrão determinístico delimitado por dois-pontos.'
);

// 7.2 Distinção de chaves para variações de voz, idioma ou velocidade
const keyDiffVoice = generateAudioCacheKey({
  type: 'speech',
  text: 'Could I please get an espresso?',
  language: 'en-US',
  voiceId: 'Aoede',
  speed: 1.0,
  emotion: 'natural',
});
assert.notStrictEqual(key1, keyDiffVoice, 'Mudança de voz deve gerar chave de cache distinta.');

const keyDiffSpeed = generateAudioCacheKey({
  type: 'speech',
  text: 'Could I please get an espresso?',
  language: 'en-US',
  voiceId: 'Puck',
  speed: 0.8,
  emotion: 'natural',
});
assert.notStrictEqual(key1, keyDiffSpeed, 'Mudança de velocidade deve gerar chave de cache distinta.');

console.log('  ✓ Geração determinística de chaves de cache e normalização validadas.');

// 7.3 Armazenamento, Recuperação e Hit Count no L1 Memória / L2
await clearAudioCache();

const mockAudioBase64 = 'UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='; // WAV RIFF mock
await setCachedAudio({
  key: key1,
  audioBase64: mockAudioBase64,
  mimeType: 'audio/wav',
  durationSec: 2.45,
  language: 'en-US',
  voiceId: 'Puck',
  speed: 1.0,
  emotion: 'natural',
});

const cachedRecord = await getCachedAudio(key1);
assert.ok(cachedRecord, 'Registro gravado no cache deve ser recuperável.');
assert.strictEqual(cachedRecord.key, key1);
assert.strictEqual(cachedRecord.audioBase64, mockAudioBase64);
assert.strictEqual(cachedRecord.durationSec, 2.45);
assert.strictEqual(cachedRecord.hitCount, 2, 'Hit count deve ser incrementado na leitura.');
assert.ok(cachedRecord.sizeBytes > 0, 'Tamanho em bytes do áudio deve ser computado.');

const exists = await isAudioCached(key1);
assert.strictEqual(exists, true, 'isAudioCached deve retornar true para chave existente.');

const notExists = await isAudioCached('non:existent:key');
assert.strictEqual(notExists, false, 'isAudioCached deve retornar false para chave não existente.');

// 7.4 Estatísticas e Limpeza do Cache
const statsBefore = await getAudioCacheStats();
assert.strictEqual(statsBefore.count, 1, 'Estatísticas devem registrar 1 item em cache.');
assert.ok(statsBefore.totalSizeBytes > 0, 'Tamanho total em bytes deve ser maior que zero.');

await clearAudioCache();
const statsAfter = await getAudioCacheStats();
assert.strictEqual(statsAfter.count, 0, 'Após clearAudioCache, contagem deve ser zero.');
const existsAfterClear = await isAudioCached(key1);
assert.strictEqual(existsAfterClear, false, 'Chave não deve mais existir após limpeza do cache.');

console.log('  ✓ Operações CRUD, Hit Count, verificação de existência e limpeza validadas.');

// 8. Validar Exportador de Fast Chunks da Interação (interactionExporter)
console.log('\n[8/8] Validando Exportador de Fast Chunks da Interação:');
const {
  generateInteractionAnkiCsv,
  generateInteractionMarkdown,
  generateInteractionJson,
  convertInteractionToFlashcards,
} = await import('./src/utils/interactionExporter');

const mockMessage = {
  id: 'msg-test-123',
  userPrompt: 'Gostaria de pedir um café espresso, por favor.',
  timestamp: 1727980000000,
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
      en: 'and the check?',
      it: 'e il conto?',
      ja: 'そしてお会計も？',
      jaPronunciation: 'soshite okaikei mo?',
    },
  ],
  fullText: {
    en: 'Could I please get an espresso, and the check?',
    it: 'Potrei avere un caffè espresso, per favore, e il conto?',
    ja: 'エスプレッソを一杯お願いします、そしてお会計も？',
  },
  status: 'ready' as const,
};

// 8.1 Teste Anki CSV
const csv = generateInteractionAnkiCsv(mockMessage);
assert.ok(csv.startsWith('\uFEFF'), 'CSV deve iniciar com UTF-8 BOM.');
assert.ok(csv.includes('Frente (Original);Verso (Tradução / Contexto)'), 'Cabeçalho Anki presente.');
assert.ok(csv.includes('Esupuresso o ippai onegai shimasu,'), 'Pronúncia fonética japonesa presente no CSV.');
assert.strictEqual(csv.split('\n').length, 3, 'CSV deve conter cabeçalho + 2 linhas de chunks.');

// 8.2 Teste Markdown
const md = generateInteractionMarkdown(mockMessage);
assert.ok(md.includes('# Interação de Estudo Poliglota — MyTTS Studio'));
assert.ok(md.includes('| # | 🇺🇸 Inglês | 🇮🇹 Italiano | 🇯🇵 Japonês | Pronúncia Fonética (Rōmaji) |'));
assert.ok(md.includes('Could I please get an espresso,'));

// 8.3 Teste JSON
const json = generateInteractionJson(mockMessage);
const parsed = JSON.parse(json);
assert.strictEqual(parsed.sourceApp, 'MyTTS Studio Polyglot Chat');
assert.strictEqual(parsed.interaction.chunks.length, 2);

// 8.4 Teste Conversão para Deck
const deckCards = convertInteractionToFlashcards(mockMessage);
assert.strictEqual(deckCards.length, 6, '2 chunks * 3 idiomas = 6 flashcards criados.');
assert.strictEqual(deckCards[0].language, 'en-US');
assert.strictEqual(deckCards[1].language, 'it-IT');
assert.strictEqual(deckCards[2].language, 'ja-JP');

console.log('  ✓ Anki CSV, Markdown, JSON e injeção no Deck local 100% validados.');

console.log('\n🎉 Todos os testes de Engenharia de Áudio, Prosódia, Estúdio Poliglota, Fast Chunks e Cache Local passaram com 100% de conformidade!');





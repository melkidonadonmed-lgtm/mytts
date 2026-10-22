import assert from 'assert';
import { SOUNDTRACK_PRESETS } from './src/utils/proceduralSoundtracks';
import type { SoundtrackPreset } from './src/utils/proceduralSoundtracks';
import { dbToLinear, buildWavHeader } from './src/utils/audioEngine';
import { getEmotionStyle, applyAcousticProsody } from './src/utils/prosodyEngine';
import { formatFlashcardsToCsv } from './src/utils/csvExporter';
import type { FlashcardItem } from './src/types/polyglot';
import {
  generateAudioCacheKey,
  getCachedAudio,
  setCachedAudio,
  clearAudioCache,
  isAudioCached,
  getAudioCacheStats,
} from './src/utils/audioCache';
import {
  generateInteractionAnkiCsv,
  generateInteractionMarkdown,
  generateInteractionJson,
  convertInteractionToFlashcards,
} from './src/utils/interactionExporter';
import {
  sanitizeFavoriteVoices,
  DEFAULT_FAVORITE_VOICES_BY_LANG,
} from './src/services/polyglotClient';
import { EXTERNAL_LINKS } from './src/config/constants';

type TestFn = () => void | Promise<void>;
const registeredTests: Array<{ name: string; fn: TestFn }> = [];

function test(name: string, fn: TestFn): void {
  registeredTests.push({ name, fn });
}

// 1. Validar Presets de Trilha Sonora (AAA: Catálogo Real)
test('Suite 01: Catálogo de Presets de Trilha Sonora Procedural', () => {
  // 1. ARRANGE
  const expectedPresets: SoundtrackPreset[] = [
    'none',
    'lofi-warmth',
    'deep-focus',
    'cinematic-pulse',
    'tech-ambient',
    'custom',
  ];

  // 2. ACT & 3. ASSERT
  assert.strictEqual(SOUNDTRACK_PRESETS.length, 6, 'Deve haver exatamente 6 presets configurados.');
  expectedPresets.forEach((id) => {
    const found = SOUNDTRACK_PRESETS.find((p) => p.id === id);
    assert.ok(found, `Preset ${id} deve existir no catálogo de trilhas.`);
    assert.strictEqual(found.id, id);
  });
});

// 2. Validar Matemática Real do Auto-Ducking (SUT: dbToLinear de audioEngine.ts)
test('Suite 02: Atenuação Dinâmica Auto-Ducking (dbToLinear SUT)', () => {
  // 1. ARRANGE
  const testDepths = [
    { db: -8, expectedMin: 0.39, expectedMax: 0.41, label: 'Suave' },
    { db: -14, expectedMin: 0.19, expectedMax: 0.21, label: 'Studio' },
    { db: -20, expectedMin: 0.09, expectedMax: 0.11, label: 'Profundo' },
  ];

  // 2. ACT & 3. ASSERT
  testDepths.forEach(({ db, expectedMin, expectedMax, label }) => {
    const linear = dbToLinear(db);
    assert.ok(
      linear >= expectedMin && linear <= expectedMax,
      `Cálculo de ducking ${label} (${db}dB) fora da faixa esperada.`
    );
  });
});

// 3. Validar Reforço Vocal (SUT: dbToLinear de audioEngine.ts)
test('Suite 03: Ganho Vocal Voice Boost (dbToLinear SUT)', () => {
  // 1. ARRANGE
  const boostDepths = [
    { db: 0, expected: 1.0 },
    { db: 3, expectedMin: 1.40, expectedMax: 1.43 },
    { db: 6, expectedMin: 1.98, expectedMax: 2.01 },
  ];

  // 2. ACT & 3. ASSERT
  boostDepths.forEach(({ db, expected, expectedMin, expectedMax }) => {
    const linear = dbToLinear(db);
    if (expected !== undefined) {
      assert.strictEqual(linear, expected);
    } else {
      assert.ok(linear >= expectedMin! && linear <= expectedMax!);
    }
  });
});

// 4. Validar Geração de Cabeçalho WAV RIFF Canônico (SUT: buildWavHeader de audioEngine.ts)
test('Suite 04: Container WAV RIFF Canônico de 44 Bytes (buildWavHeader SUT)', () => {
  // 1. ARRANGE
  const dataByteLength = 176400; // 1 segundo estéreo 44.1kHz 16-bit

  // 2. ACT
  const rawBuffer = buildWavHeader({
    sampleRate: 44100,
    numChannels: 2,
    bitsPerSample: 16,
    dataByteLength,
  });
  const header44kStereo = Buffer.from(rawBuffer);

  // 3. ASSERT
  assert.strictEqual(header44kStereo.byteLength, 44);
  assert.strictEqual(header44kStereo.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(header44kStereo.readUInt32LE(4), 36 + dataByteLength);
  assert.strictEqual(header44kStereo.toString('ascii', 8, 12), 'WAVE');
  assert.strictEqual(header44kStereo.toString('ascii', 12, 16), 'fmt ');
  assert.strictEqual(header44kStereo.readUInt16LE(20), 1); // PCM
  assert.strictEqual(header44kStereo.readUInt16LE(22), 2); // 2 canais
  assert.strictEqual(header44kStereo.readUInt32LE(24), 44100); // 44.1kHz
  assert.strictEqual(header44kStereo.readUInt32LE(28), 176400); // ByteRate
  assert.strictEqual(header44kStereo.readUInt16LE(32), 4); // BlockAlign
  assert.strictEqual(header44kStereo.readUInt16LE(34), 16); // 16-bit
  assert.strictEqual(header44kStereo.toString('ascii', 36, 40), 'data');
  assert.strictEqual(header44kStereo.readUInt32LE(40), dataByteLength);
});

// 5. Validar Motor de Calibração e Auto-Prosódia em PT-BR
test('Suite 05: Calibração Fonética PT-BR, Sanitização de Tags e Casos de Borda', () => {
  // 1. ARRANGE
  const rawTextWithTags = 'Olá [deep breath] a todos! <pause> Vamos começar [sighs] agora.';
  const longSentence =
    'Este é um parágrafo bastante extenso que discute os fundamentos da inteligência artificial generativa e da síntese neural de voz, explicando como modelos modernos conseguem simular o ritmo biológico e a cadência humana sem ruídos digitais perceptíveis.';
  const dirtyText =
    `Excelente novidade! \u{1F680} O pacote custa R$ 1.500,00 e o link é ${EXTERNAL_LINKS.SAMPLE_AUDIT_URL}. Veja o log: console.log("ok");`;

  // 2. ACT
  const naturalPrompt = getEmotionStyle('natural', 1.0);
  const slowStorytelling = getEmotionStyle('storytelling', 0.8);
  const fastSpontaneous = getEmotionStyle('spontaneous', 1.3);
  const sanitized = applyAcousticProsody(rawTextWithTags, { enabled: true });
  const prosodyResult = applyAcousticProsody(longSentence, { enabled: true });
  const cleanEdgeCase = applyAcousticProsody(dirtyText, { enabled: true });

  // 3. ASSERT
  assert.ok(naturalPrompt.includes('Brazilian Portuguese (pt-BR)'));
  assert.ok(naturalPrompt.includes('natural and steady-paced'));
  assert.ok(slowStorytelling.includes('Brazilian Portuguese (pt-BR)'));
  assert.ok(slowStorytelling.includes('slow, deliberate and well-paced'));
  assert.ok(fastSpontaneous.includes('agile, fast and energetic'));

  assert.strictEqual(sanitized.includes('[deep breath]'), false);
  assert.strictEqual(sanitized.includes('<pause>'), false);
  assert.strictEqual(sanitized.includes('[sighs]'), false);
  assert.strictEqual(sanitized.includes('deep breath'), false);

  assert.ok(prosodyResult.includes('...') || prosodyResult.includes('—'));
  assert.ok(cleanEdgeCase.includes('R$ 1.500,00'));
  assert.ok(cleanEdgeCase.includes(EXTERNAL_LINKS.SAMPLE_AUDIT_URL));
  assert.ok(cleanEdgeCase.includes('\u{1F680}'));
  assert.ok(cleanEdgeCase.includes('console.log("ok");'));
});

// 6. Validar Exportador CSV de Flashcards para Anki & Notion (Sem Date.now não-determinístico)
test('Suite 06: Exportador CSV de Flashcards UTF-8 BOM e Escape Anki', () => {
  // 1. ARRANGE (Timestamps determinísticos fixos)
  const sampleCards: FlashcardItem[] = [
    {
      id: 'c1',
      chunkText: 'Devo davvero imparare',
      language: 'it-IT',
      front: 'Devo davvero imparare',
      back: 'Eu realmente preciso aprender',
      nuance: 'Uso coloquial com "davvero" indicando ênfase.',
      pronunciation: 'de-vo da-vé-ro im-pa-rá-re',
      example: "Devo davvero imparare l'italiano.",
      exampleTranslation: 'Eu realmente preciso aprender italiano.',
      createdAt: 1727980000000,
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
      createdAt: 1727980060000,
    },
  ];

  // 2. ACT
  const csvOutput = formatFlashcardsToCsv(sampleCards);

  // 3. ASSERT
  assert.ok(csvOutput.startsWith('\uFEFF'), 'CSV deve iniciar com UTF-8 BOM.');
  assert.ok(csvOutput.includes('Frente (Original);Verso (Tradução)'));
  assert.ok(csvOutput.includes('"Devo davvero imparare"'));
  assert.ok(csvOutput.includes('なるほどね (Naruhodo ne)'));
  assert.ok(csvOutput.includes('Uso coloquial com ""davvero""'));
});

// 7. Validar Motor de Cache de Áudio com Isolamento try/finally
test('Suite 07: Motor de Cache de Áudio L1/L2 com Isolamento de Estado (try/finally)', async () => {
  // 1. ARRANGE
  await clearAudioCache();
  try {
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
    const keyDiffVoice = generateAudioCacheKey({
      type: 'speech',
      text: 'Could I please get an espresso?',
      language: 'en-US',
      voiceId: 'Aoede',
      speed: 1.0,
      emotion: 'natural',
    });
    const keyDiffSpeed = generateAudioCacheKey({
      type: 'speech',
      text: 'Could I please get an espresso?',
      language: 'en-US',
      voiceId: 'Puck',
      speed: 0.8,
      emotion: 'natural',
    });

    // 2. ACT & 3. ASSERT
    assert.strictEqual(key1, key2);
    assert.strictEqual(key1, 'speech:en-us:Puck:1.00:natural:Could I please get an espresso?');
    assert.notStrictEqual(key1, keyDiffVoice);
    assert.notStrictEqual(key1, keyDiffSpeed);

    const mockAudioBase64 = 'UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
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
    assert.ok(cachedRecord);
    assert.strictEqual(cachedRecord.key, key1);
    assert.strictEqual(cachedRecord.audioBase64, mockAudioBase64);
    assert.strictEqual(cachedRecord.durationSec, 2.45);
    assert.strictEqual(cachedRecord.hitCount, 2);
    assert.strictEqual(cachedRecord.sizeBytes, 45);

    assert.strictEqual(await isAudioCached(key1), true);
    assert.strictEqual(await isAudioCached('non:existent:key'), false);

    const statsBefore = await getAudioCacheStats();
    assert.strictEqual(statsBefore.count, 1);
    assert.strictEqual(statsBefore.totalSizeBytes, 45);
  } finally {
    await clearAudioCache();
    const statsAfter = await getAudioCacheStats();
    assert.strictEqual(statsAfter.count, 0);
  }
});

// 8. Validar Exportador de Fast Chunks da Interação (interactionExporter)
test('Suite 08: Exportador Multi-Formato de Interação Poliglota (Anki, MD, JSON, Deck)', () => {
  // 1. ARRANGE
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

  // 2. ACT
  const csv = generateInteractionAnkiCsv(mockMessage);
  const md = generateInteractionMarkdown(mockMessage);
  const json = generateInteractionJson(mockMessage);
  const parsed = JSON.parse(json);
  const deckCards = convertInteractionToFlashcards(mockMessage);

  // 3. ASSERT
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Frente (Original);Verso (Tradução / Contexto)'));
  assert.ok(csv.includes('Esupuresso o ippai onegai shimasu,'));
  assert.strictEqual(csv.split('\n').length, 3);

  assert.ok(md.includes('# Interação de Estudo Poliglota — MyTTS Studio'));
  assert.ok(md.includes('| # | 🇺🇸 Inglês | 🇮🇹 Italiano | 🇯🇵 Japonês | Pronúncia Fonética (Rōmaji) |'));
  assert.ok(md.includes('Could I please get an espresso,'));

  assert.strictEqual(parsed.sourceApp, 'MyTTS Studio Polyglot Chat');
  assert.strictEqual(parsed.interaction.chunks.length, 2);

  assert.strictEqual(deckCards.length, 6);
  assert.strictEqual(deckCards[0].language, 'en-US');
  assert.strictEqual(deckCards[1].language, 'it-IT');
  assert.strictEqual(deckCards[2].language, 'ja-JP');

  // Validação determinística de perfis favoritos de vozes por idioma e sanitização de fallback
  const customFavorites = sanitizeFavoriteVoices({ en: 'Fenrir', it: 'Aoede', ja: 'Kore' });
  assert.strictEqual(customFavorites.en, 'Fenrir');
  assert.strictEqual(customFavorites.it, 'Aoede');
  assert.strictEqual(customFavorites.ja, 'Kore');

  const fallbackFavorites = sanitizeFavoriteVoices({ en: 'VozInexistente', it: 123, ja: '' });
  assert.deepStrictEqual(fallbackFavorites, DEFAULT_FAVORITE_VOICES_BY_LANG);
});

import { runContractTests } from './tests/audio-engine.test';

async function runAllTests(): Promise<void> {
  console.log('[TEST] Iniciando Verificação Determinística de Engenharia de Áudio (mytts — Nível 4)...\n');
  let passed = 0;
  for (const t of registeredTests) {
    await t.fn();
    passed++;
    console.log(`  ✓ [PASS] ${t.name}`);
  }
  const contractPassed = await runContractTests();
  const totalPassed = passed + contractPassed;
  console.log(`\n[PASS] ${totalPassed}/${totalPassed} suítes concluídas com 100% de conformidade Nível 4!`);
}

runAllTests().catch((err: unknown) => {
  console.error('[FAIL] Falha na suíte de testes:', err);
  process.exit(1);
});

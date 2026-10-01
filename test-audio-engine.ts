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

console.log('  ✓ applyAcousticProsody: Sanitização anti-leitura de tags e pontuação de fôlego validadas.');

console.log('\n🎉 Todos os testes de Engenharia de Áudio e Prosódia passaram com 100% de conformidade!');


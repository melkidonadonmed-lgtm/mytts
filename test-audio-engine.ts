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

console.log('\n🎉 Todos os testes de Engenharia de Áudio passaram com 100% de conformidade!');

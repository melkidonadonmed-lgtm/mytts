import assert from 'assert';
import { parseApiJson } from '../src/services/apiClient';
import { formatAudioTime } from '../src/utils/audio';
import { buildWavHeader, dbToLinear } from '../src/utils/audioEngine';
import { applyAcousticProsody, getEmotionStyle } from '../src/utils/prosodyEngine';

type TestFn = () => void | Promise<void>;
const contractTests: Array<{ name: string; fn: TestFn }> = [];

function test(name: string, fn: TestFn): void {
  contractTests.push({ name, fn });
}

// Suite 09: Resiliência de parseApiJson contra HTML 502/413 e blindagem de resp.ok
test('Suite 09: Resiliência de parseApiJson (JSON válido, HTML 502/413 e blindagem de ok)', async () => {
  // 1. ARRANGE
  const okResponse = new Response(
    JSON.stringify({ success: true, text: 'Texto extraído do PDF' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
  const htmlErrorResponse = new Response(
    '<html><body><h1>502 Bad Gateway</h1></body></html>',
    { status: 502, headers: { 'Content-Type': 'text/html' } }
  );
  const spoofedOkErrorResponse = new Response(
    JSON.stringify({ ok: true, error: 'Payload Too Large' }),
    { status: 413, headers: { 'Content-Type': 'application/json' } }
  );

  // 2. ACT
  const parsedOk = await parseApiJson<{ success?: boolean; text?: string }>(okResponse);
  const parsedHtmlErr = await parseApiJson<{ success?: boolean }>(htmlErrorResponse);
  const parsedSpoofed = await parseApiJson<{ ok?: boolean; error?: string }>(spoofedOkErrorResponse);

  // 3. ASSERT
  assert.strictEqual(parsedOk.ok, true);
  assert.strictEqual(parsedOk.success, true);
  assert.strictEqual(parsedOk.text, 'Texto extraído do PDF');

  assert.strictEqual(parsedHtmlErr.ok, false);
  assert.strictEqual(parsedHtmlErr.error, 'Erro HTTP 502: resposta inválida do servidor.');

  assert.strictEqual(parsedSpoofed.ok, false);
  assert.strictEqual(parsedSpoofed.error, 'Payload Too Large');
});

// Suite 10: Formatação de Tempo de Áudio e Fronteiras Numéricas (formatAudioTime SUT)
test('Suite 10: Formatação de Tempo de Áudio e Fronteiras (formatAudioTime SUT)', () => {
  // 1. ARRANGE & 2. ACT & 3. ASSERT
  assert.strictEqual(formatAudioTime(0), '00:00');
  assert.strictEqual(formatAudioTime(-12), '00:00');
  assert.strictEqual(formatAudioTime(Number.NaN), '00:00');
  assert.strictEqual(formatAudioTime(Number.POSITIVE_INFINITY), '00:00');
  assert.strictEqual(formatAudioTime(9), '00:09');
  assert.strictEqual(formatAudioTime(65), '01:05');
  assert.strictEqual(formatAudioTime(125.9), '02:05');
});

// Suite 11: Container WAV 24kHz Mono (Formato Nativo Gemini 3.1 Flash TTS)
test('Suite 11: Cabeçalho WAV RIFF 24kHz Mono 16-bit (buildWavHeader & dbToLinear SUT)', () => {
  // 1. ARRANGE
  const pcmBytes = 48000; // 1 segundo a 24kHz 16-bit mono

  // 2. ACT
  const headerBuf = Buffer.from(
    buildWavHeader({
      sampleRate: 24000,
      numChannels: 1,
      bitsPerSample: 16,
      dataByteLength: pcmBytes,
    })
  );
  const unityGain = dbToLinear(0);

  // 3. ASSERT
  assert.strictEqual(headerBuf.byteLength, 44);
  assert.strictEqual(headerBuf.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(headerBuf.toString('ascii', 8, 12), 'WAVE');
  assert.strictEqual(headerBuf.readUInt16LE(22), 1);
  assert.strictEqual(headerBuf.readUInt32LE(24), 24000);
  assert.strictEqual(headerBuf.readUInt32LE(28), 48000);
  assert.strictEqual(headerBuf.readUInt16LE(32), 2);
  assert.strictEqual(headerBuf.readUInt32LE(40), pcmBytes);
  assert.strictEqual(unityGain, 1);
});

// Suite 12: Prosódia Multilíngue e Modo Desativado (prosodyEngine SUT)
test('Suite 12: Calibração Prosódica Multilíngue e Sanitização com AutoProsody Desativado', () => {
  // 1. ARRANGE
  const taggedInput = 'Buongiorno [laughs] a tutti <sigh> amici!';

  // 2. ACT
  const cleanedDisabled = applyAcousticProsody(taggedInput, { enabled: false, language: 'it-IT' });
  const italianStyle = getEmotionStyle('expressive', 1.0, 'it-IT');
  const japaneseStyle = getEmotionStyle('calm', 0.95, 'ja-JP');

  // 3. ASSERT
  assert.strictEqual(cleanedDisabled, 'Buongiorno a tutti amici!');
  assert.ok(italianStyle.includes('natural Italian'));
  assert.ok(japaneseStyle.includes('native Japanese'));
});

export async function runContractTests(): Promise<number> {
  let passed = 0;
  for (const t of contractTests) {
    await t.fn();
    passed++;
    console.log(`  ✓ [PASS] ${t.name}`);
  }
  return passed;
}

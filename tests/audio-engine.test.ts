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

// Suite 13: Auditoria Determinística Soft UI v4.5-soft (FSM, Tokens Anti-Cobalto & Sanitização)
import { resolveCardFSMState, sanitizeCardTitle } from '../src/components/ui/SoftCard';
import { SOFT_UI_PRESETS, resolvePresetTokens, getBentoSpanClass } from '../src/config/tokens';

test('Suite 13: Soft UI v4.5-soft — FSM Determinística (AUDIT-STATE-01/02) e Tokens Anti-Cobalto (AUDIT-VIS-01)', () => {
  // 1. ARRANGE
  const forbiddenCobaltHexes = ['#0044ff', '#0057ff', '#1d4ed8', '#233dff'];
  const allPresets = Object.values(SOFT_UI_PRESETS);

  // 2. ACT
  const stateIdle = resolveCardFSMState({ isLoading: false, error: null, isPressed: false });
  const stateLoading = resolveCardFSMState({ isLoading: true, error: null, isPressed: false });
  const stateError = resolveCardFSMState({ isLoading: true, error: 'Falha HTTP 502', isPressed: true });
  const statePressed = resolveCardFSMState({ isLoading: false, error: null, isPressed: true });
  const sanitizedTitle = sanitizeCardTitle('  Estúdio Neural <img src=x onerror=void(0)>  ');
  const slateTokens = resolvePresetTokens('slate');
  const span8 = getBentoSpanClass(8);

  // 3. ASSERT
  assert.strictEqual(stateIdle, 'idle');
  assert.strictEqual(stateLoading, 'loading');
  assert.strictEqual(stateError, 'error');
  assert.strictEqual(statePressed, 'pressed');
  assert.strictEqual(sanitizedTitle, 'Estúdio Neural <img src=x onerror=void(0)>');
  assert.strictEqual(slateTokens.accentPoint, '#0284C7');
  assert.strictEqual(span8, 'col-span-8');

  allPresets.forEach((palette) => {
    const values = Object.values(palette).map((v) => v.toLowerCase());
    forbiddenCobaltHexes.forEach((cobalt) => {
      assert.strictEqual(values.includes(cobalt), false);
    });
  });
});

// Suite 14: Utilitários Server-Side WAV RIFF 44 Bytes, Sanitização e Allowlists (audioContainer SUT)
import {
  ensureWavContainer,
  pcmToWav,
  sanitizeUserId,
  capText,
  formatForTts,
  formatGeminiError,
  ALLOWED_PREVIEW_VOICES,
  ALLOWED_PREVIEW_LANGS,
} from '../src/server/audioContainer';
import { getConversationStorage } from '../src/services/conversationStorage';
import { detectYoutubeUrl } from '../src/services/polyglotClient';

test('Suite 14: Container WAV Server-Side (ensureWavContainer/pcmToWav) e Sanitização de Fronteira', () => {
  // 1. ARRANGE
  const rawPcm = Buffer.alloc(4800, 0x12); // 100ms a 24kHz 16-bit mono
  const rawBase64 = rawPcm.toString('base64');

  // 2. ACT
  const wavBase64 = ensureWavContainer(rawBase64, 24000);
  const wavBuffer = Buffer.from(wavBase64, 'base64');
  const idempotentWavBase64 = ensureWavContainer(wavBase64, 24000);
  const directWav = pcmToWav(rawPcm, 24000, 1, 16);
  const validUser = sanitizeUserId('user_123-abc');
  const invalidUser = sanitizeUserId('bad/user;drop');
  const capped = capText('abcdef', 4);
  const formattedTts = formatForTts('Olá <breath> mundo |mhm| <b>enfase</b>');
  const formatted401Err = formatGeminiError(
    new Error('{"error":{"code":401,"message":"The bound service account is deleted or disabled.","reason":"ACCOUNT_STATE_INVALID"}}'),
    'Falha genérica'
  );

  // 3. ASSERT
  assert.strictEqual(wavBuffer.byteLength, 44 + 4800);
  assert.strictEqual(wavBuffer.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(wavBuffer.toString('ascii', 8, 12), 'WAVE');
  assert.strictEqual(wavBuffer.readUInt32LE(24), 24000);
  assert.strictEqual(wavBuffer.readUInt32LE(40), 4800);
  assert.strictEqual(idempotentWavBase64, wavBase64);
  assert.strictEqual(directWav.byteLength, 4844);
  assert.strictEqual(validUser, 'user_123-abc');
  assert.strictEqual(invalidUser, 'anonymous-user');
  assert.strictEqual(capped, 'abcd');
  assert.strictEqual(formattedTts, 'Olá [deep breath] mundo mhm... enfase');
  assert.strictEqual(ALLOWED_PREVIEW_VOICES.has('Puck'), true);
  assert.strictEqual(ALLOWED_PREVIEW_LANGS.has('it-IT'), true);
  assert.ok(formatted401Err.includes('Service Account vinculada a esta chave está desativada'));
});

test('Suite 15: Persistência de Histórico de Conversas por Conta Google e Detecção de YouTube', async () => {
  const storage = getConversationStorage();
  const testUserId = 'google_test_suite_15';
  const testConvId = `conv_test_${Date.now()}`;

  const saved = await storage.upsert(testUserId, {
    id: testConvId,
    userId: testUserId,
    userName: 'Melki Teste',
    userEmail: 'melki@gmail.com',
    title: 'Estudo de Vídeo do YouTube',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pinned: true,
    originMode: 'youtube',
    messages: [],
  });

  const listed = await storage.listByUser(testUserId);
  const removed = await storage.remove(testUserId, testConvId);
  const detectedYt = detectYoutubeUrl('Veja este vídeo https://www.youtube.com/watch?v=dQw4w9WgXcQ agora');

  assert.strictEqual(saved.id, testConvId);
  assert.ok(listed.some((c) => c.id === testConvId));
  assert.strictEqual(removed, true);
  assert.strictEqual(detectedYt, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

import {
  getVoiceAcousticStyle,
  buildExpressiveTtsTranscript,
} from '../src/utils/prosodyEngine';

test('Suite 16: Gemini 3.8 Flash TTS — 12 Emoções, 5 Personas Acústicas e Tags Vocais Canônicas (<breath>, <short pause>, <chuckle>)', () => {
  // 1. ARRANGE: Todas as 6 emoções de debate + 4 solo + expressive/calm devem produzir estilos únicos (nunca cair em natural por engano)
  const allEmotions = [
    'natural',
    'storytelling',
    'technical',
    'spontaneous',
    'thoughtful',
    'inquisitive',
    'skeptical',
    'ironic',
    'passionate',
    'resolute',
    'expressive',
    'calm',
  ];
  const allVoices = ['Puck', 'Kore', 'Aoede', 'Fenrir', 'Enceladus'];

  // 2. ACT
  const emotionStyles = allEmotions.map((emo) => getEmotionStyle(emo, 1.0, 'pt-BR'));
  const uniqueEmotionStyles = new Set(emotionStyles);

  const voiceStyles = allVoices.map((voice) =>
    getVoiceAcousticStyle(voice, 'passionate', 1.0, 'pt-BR')
  );
  const uniqueVoiceStyles = new Set(voiceStyles);

  const bracketInput =
    '[deep breath] Olha... [sighs] isso muda tudo! [laughs] <script>evil()</script> <b>Mesmo</b> assim [pause] seguimos |mhm|.';
  const normalizedTranscript = buildExpressiveTtsTranscript(bracketInput, {
    enabled: false,
    language: 'pt-BR',
  });

  const longParagraphs =
    'A arquitetura de síntese neural moderna exige controle fino sobre a cadência respiratória, pois ouvintes humanos percebem imediatamente quando uma frase longa carece de pausas orgânicas e inflexão emocional genuína.\n\nNo segundo parágrafo continuamos a reflexão com serenidade.';
  const autoProsodyTranscript = buildExpressiveTtsTranscript(longParagraphs, {
    enabled: true,
    language: 'pt-BR',
    emotion: 'storytelling',
    injectNaturalBreaths: true,
  });

  const japaneseTranscript = buildExpressiveTtsTranscript(
    '[breath] こんにちは、これは自然な日本語のテストです。',
    { enabled: true, language: 'ja-JP' }
  );

  // Casos de borda adicionais: tags estendidas do Gemini 3.8, oração longa iniciada por <breath> com travessão e parágrafos curtos consecutivos
  const extendedVocalInput =
    '[throat clear] <exhales> Olha... <snicker> <groan> isso é sério.';
  const extendedNormalized = buildExpressiveTtsTranscript(extendedVocalInput, {
    enabled: false,
    language: 'pt-BR',
  });

  const leadingBreathLongSentence =
    '<breath> Olha, quando analisamos a estrutura profunda dessa arquitetura neural em tempo real — percebemos imediatamente que cada pausa respiratória altera a percepção humana de naturalidade e presença acústica no estúdio.';
  const leadingBreathOutput = buildExpressiveTtsTranscript(leadingBreathLongSentence, {
    enabled: true,
    language: 'pt-BR',
    injectNaturalBreaths: true,
  });

  const shortDialogParagraphs = 'Sim, claro.\n\nCom certeza!\n\nConcordo plenamente.';
  const shortDialogOutput = buildExpressiveTtsTranscript(shortDialogParagraphs, {
    enabled: true,
    language: 'pt-BR',
    injectNaturalBreaths: true,
  });

  // 3. ASSERT
  assert.strictEqual(
    uniqueEmotionStyles.size,
    allEmotions.length,
    'Cada uma das 12 emoções deve produzir uma diretriz acústica única'
  );
  assert.strictEqual(
    uniqueVoiceStyles.size,
    allVoices.length,
    'Cada uma das 5 vozes deve ter um perfil acústico exclusivo em getVoiceAcousticStyle'
  );
  assert.ok(voiceStyles[0].includes('Voice Persona (Puck)'));
  assert.ok(voiceStyles[4].includes('Voice Persona (Enceladus)'));
  for (const style of voiceStyles) {
    assert.ok(
      !/<[^>]+>/.test(style),
      'speechMetadata.style nunca deve conter tags angulares literais (<breath>, etc.) para evitar conflito com o texto falado'
    );
  }

  assert.ok(normalizedTranscript.includes('<heavy breath>'));
  assert.ok(normalizedTranscript.includes('<sigh>'));
  assert.ok(normalizedTranscript.includes('<laugh>'));
  assert.ok(normalizedTranscript.includes('<short pause>'));
  assert.ok(normalizedTranscript.includes('|mhm|'));
  assert.ok(!normalizedTranscript.includes('<script>'));
  assert.ok(!normalizedTranscript.includes('<b>'));

  assert.ok(extendedNormalized.includes('<throat-clearing>'));
  assert.ok(extendedNormalized.includes('<exhales>'));
  assert.ok(extendedNormalized.includes('<snicker>'));
  assert.ok(extendedNormalized.includes('<groan>'));

  assert.ok(
    autoProsodyTranscript.includes('<short pause> <breath>'),
    'Orações longas e quebras de parágrafo devem receber marcadores orgânicos <short pause> <breath>'
  );
  const breathCountInLeadingSentence = (leadingBreathOutput.match(/<breath>/g) || []).length;
  assert.ok(
    breathCountInLeadingSentence >= 2,
    'Oração longa (>20 palavras) iniciada por <breath> ainda deve receber respiração orgânica no meio da frase'
  );
  assert.ok(
    !shortDialogOutput.includes('<breath>'),
    'Parágrafos curtos consecutivos (< 6 palavras) não devem receber spam de <short pause> <breath>'
  );
  assert.strictEqual(
    japaneseTranscript,
    '<breath> こんにちは、これは自然な日本語のテストです。'
  );
  assert.strictEqual(buildExpressiveTtsTranscript(''), '');
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


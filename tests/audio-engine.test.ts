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
import {
  SOFT_UI_PRESETS,
  resolvePresetTokens,
  getBentoSpanClass,
  normalizeThemePreset,
} from '../src/config/tokens';

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

  // Validação dos 2 únicos presets foscos ('obsidian' e 'slate') e migração legada
  assert.deepStrictEqual(Object.keys(SOFT_UI_PRESETS).sort(), ['obsidian', 'slate'].sort());
  assert.strictEqual(normalizeThemePreset('moss'), 'slate');
  assert.strictEqual(normalizeThemePreset('light'), 'slate');
  assert.strictEqual(normalizeThemePreset('slate'), 'slate');
  assert.strictEqual(normalizeThemePreset('sapphire'), 'obsidian');
  assert.strictEqual(normalizeThemePreset('dark'), 'obsidian');
  assert.strictEqual(normalizeThemePreset('obsidian'), 'obsidian');
  assert.strictEqual(normalizeThemePreset(null), 'obsidian');
  assert.strictEqual(normalizeThemePreset(undefined), 'obsidian');
  assert.strictEqual(normalizeThemePreset('unknown-theme'), 'obsidian');

  // Superfície clara fosca sem branco puro ofuscante (#FFFFFF)
  assert.notStrictEqual(slateTokens.raised.toLowerCase(), '#ffffff');

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
  buildFfmpegMixFilterComplex,
  ALLOWED_PREVIEW_VOICES,
  ALLOWED_PREVIEW_LANGS,
} from '../src/server/audioContainer';
import { getConversationStorage } from '../src/services/conversationStorage';
import {
  detectYoutubeUrl,
  normalizeYoutubeVideo,
  isBareYoutubeLinkOnly,
  inferYoutubeActionFromPrompt,
  hasYoutubeOrWebSearchIntent,
} from '../src/services/polyglotClient';
import {
  parseStructuredJsonFromModel,
  parseYoutubeSearchResultsHtml,
} from '../src/utils/youtubeHelper';
import { setActiveSession, signOutGoogle } from '../src/services/authService';

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
  const filterGraph = buildFfmpegMixFilterComplex('1.41', '0.20', 6);

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
  assert.ok(filterGraph.includes('asplit=2[voice_sc][voice_mix]'));
  assert.ok(filterGraph.includes('[bg][voice_sc]sidechaincompress=threshold=0.08:ratio=6'));
  assert.ok(filterGraph.includes('[voice_mix][ducked]amix=inputs=2'));
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
  const detectedShort = detectYoutubeUrl('Link curto: https://youtu.be/dQw4w9WgXcQ?si=abc123&t=42');
  const detectedShortsPath = normalizeYoutubeVideo('https://youtube.com/shorts/dQw4w9WgXcQ?feature=share');

  // Fluxo Pós-Link: link puro vs comando explícito de tradução/flashcards/resumo
  assert.strictEqual(isBareYoutubeLinkOnly('  https://youtu.be/dQw4w9WgXcQ?si=xyz  '), true);
  assert.strictEqual(
    isBareYoutubeLinkOnly('https://youtu.be/dQw4w9WgXcQ traduza este vídeo'),
    false
  );
  assert.strictEqual(
    inferYoutubeActionFromPrompt('https://youtu.be/dQw4w9WgXcQ'),
    'ask_intent'
  );
  assert.strictEqual(
    inferYoutubeActionFromPrompt('https://youtu.be/dQw4w9WgXcQ traduza o vídeo inteiro'),
    'translate_video'
  );
  assert.strictEqual(
    inferYoutubeActionFromPrompt('https://youtu.be/dQw4w9WgXcQ extraia flashcards e expressões'),
    'extract_expressions'
  );
  assert.strictEqual(
    inferYoutubeActionFromPrompt('https://youtu.be/dQw4w9WgXcQ faça um resumo'),
    'summary_dialogue'
  );

  // Detecção de intenção de busca no YouTube em modo padrão
  assert.strictEqual(
    hasYoutubeOrWebSearchIntent('busque no youtube vídeos sobre conversação em inglês'),
    true
  );
  assert.strictEqual(
    hasYoutubeOrWebSearchIntent('Gostaria de pedir um café expresso'),
    false
  );

  // Extração resiliente de JSON com prosa/chaves extras ao redor e busca HTML YouTube
  const messyModelOutput =
    'Claro! Aqui está a análise {nota: 10}:\n```json\n{"agentReplyPtBr":"Resumo ok","chunks":[{"id":0,"en":"Hello","it":"Ciao","ja":"こんにちは"}]}\n```';
  const parsedModel = parseStructuredJsonFromModel<{ agentReplyPtBr: string }>(messyModelOutput);
  assert.strictEqual(parsedModel?.agentReplyPtBr, 'Resumo ok');

  const sampleYtHtml =
    'var ytInitialData = {"contents":{"videoRenderer":{"videoId":"dQw4w9WgXcQ","title":{"runs":[{"text":"Video Aula Ingles"}]},"ownerText":{"runs":[{"text":"English Channel"}]},"lengthText":{"simpleText":"10:25"}}}};';
  const parsedSearch = parseYoutubeSearchResultsHtml(sampleYtHtml, 4);
  assert.strictEqual(parsedSearch.length, 1);
  assert.strictEqual(parsedSearch[0].videoId, 'dQw4w9WgXcQ');
  assert.strictEqual(parsedSearch[0].title, 'Video Aula Ingles');
  assert.strictEqual(parsedSearch[0].authorName, 'English Channel');
  assert.strictEqual(parsedSearch[0].durationHint, '10:25');

  // Isolamento de sessão Google no signOutGoogle() (nunca manter google_... após logout)
  setActiveSession({
    uid: 'google_melki_gmail_com',
    name: 'Melki',
    email: 'melki@gmail.com',
    isGoogleAuthenticated: true,
  });
  const afterLogout = signOutGoogle();
  assert.strictEqual(afterLogout.isGoogleAuthenticated, false);
  assert.ok(
    !afterLogout.uid.startsWith('google_'),
    'signOutGoogle() deve gerar um novo uid de visitante e nunca manter o uid da conta Google anterior'
  );

  assert.strictEqual(saved.id, testConvId);
  assert.ok(listed.some((c) => c.id === testConvId));
  assert.strictEqual(removed, true);
  assert.strictEqual(detectedYt, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.strictEqual(detectedShort, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.strictEqual(detectedShortsPath?.videoId, 'dQw4w9WgXcQ');
});

import {
  getVoiceAcousticStyle,
  buildExpressiveTtsTranscript,
  buildTtsModelPart,
  CANONICAL_VOCAL_TAGS,
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

  const part38 = buildTtsModelPart(
    '<breath> Olá mundo.',
    'Kore',
    'Warm expressive delivery.',
    'gemini-3.8-flash-tts'
  );
  const part38Lite = buildTtsModelPart(
    '<breath> Olá mundo.',
    'Puck',
    'Energetic delivery.',
    'gemini-3.8-flash-lite-tts'
  );
  const partLegacy31 = buildTtsModelPart(
    '<breath> Olá mundo.',
    'Kore',
    'Warm expressive delivery.',
    'gemini-3.1-flash-tts-preview'
  );

  // 3. ASSERT
  assert.strictEqual(
    CANONICAL_VOCAL_TAGS.size,
    42,
    'O catálogo CANONICAL_VOCAL_TAGS deve conter exatamente as 42 entradas de tags vocais canônicas do Gemini 3.8 TTS'
  );
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

  assert.deepStrictEqual(part38, {
    text: '<breath> Olá mundo.',
    speechMetadata: {
      speaker: 'Kore',
      style: 'Warm expressive delivery.',
    },
  });
  assert.deepStrictEqual(part38Lite, {
    text: '<breath> Olá mundo.',
    speechMetadata: {
      speaker: 'Puck',
      style: 'Energetic delivery.',
    },
  });
  assert.strictEqual(partLegacy31.speechMetadata, undefined);
  assert.ok(
    partLegacy31.text.startsWith('Performance Direction (Kore): Warm expressive delivery.\n\n<breath> Olá mundo.'),
    'Modelos legados na cascata (gemini-3.1/2.5) devem receber direção inline sem speechMetadata'
  );

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

import {
  parseFlashcardsInput,
  detectFlashcardLanguage,
  normalizeLanguageBadge,
  candidatesToFlashcardItems,
} from '../src/utils/flashcardParser';
import { getFlashcardStorage } from '../src/services/flashcardStorage';

test('Suite 17: Parser Multi-Formato de Flashcards (JSON, CSV Anki, Markdown, HTML), Detecção de Idioma e Persistência por Usuário', async () => {
  // 1. ARRANGE & ACT — Detecção automática de idioma ('en-US' | 'it-IT' | 'ja-JP' e badge 'EN' | 'IT' | 'JA')
  assert.strictEqual(detectFlashcardLanguage('お疲れ様です (Otsukaresama desu)'), 'ja-JP');
  assert.strictEqual(detectFlashcardLanguage('Non vedo l’ora di andare a Roma, grazie!'), 'it-IT');
  assert.strictEqual(detectFlashcardLanguage('Break a leg on your presentation today'), 'en-US');
  assert.strictEqual(normalizeLanguageBadge('ja-JP'), 'JA');
  assert.strictEqual(normalizeLanguageBadge('it-IT'), 'IT');
  assert.strictEqual(normalizeLanguageBadge('en-US'), 'EN');

  // 2. Parser de Tabela Markdown
  const mdInput = `| Frente | Verso | Contexto | Idioma |
| --- | --- | --- | --- |
| Break the ice | Quebrar o gelo | Reunião inicial | EN |
| In bocca al lupo | Boa sorte | Antes de prova | IT |
| よろしくお願いします | Conto com você | Saudação formal | JA |`;
  const mdParsed = parseFlashcardsInput(mdInput, { deckName: 'Deck MD' });
  assert.strictEqual(mdParsed.detectedFormat, 'markdown');
  assert.strictEqual(mdParsed.cards.length, 3);
  assert.strictEqual(mdParsed.cards[0].front, 'Break the ice');
  assert.strictEqual(mdParsed.cards[1].language, 'it-IT');
  assert.strictEqual(mdParsed.cards[2].language, 'ja-JP');

  // 3. Parser CSV/TSV Anki com aspas escapadas
  const csvInput = `front;back;context;lang\n"Hit the nail on the head";"Acertar em cheio";"Diagnóstico preciso";"EN"\n"Meno male!";"Ainda bem!";"Alívio";"IT"`;
  const csvParsed = parseFlashcardsInput(csvInput, { deckName: 'Deck Anki' });
  assert.strictEqual(csvParsed.detectedFormat, 'csv');
  assert.strictEqual(csvParsed.cards.length, 2);
  assert.strictEqual(csvParsed.cards[0].front, 'Hit the nail on the head');
  assert.strictEqual(csvParsed.cards[1].language, 'it-IT');

  // 4. Parser JSON + Sanitização Zero-Trust contra <script> e prototype pollution
  const jsonInput = JSON.stringify([
    {
      front: '<script>alert(1)</script>Piece of cake',
      back: '<b>Muito fácil</b>',
      context: 'Exame tranquilo',
      language: 'EN',
    },
  ]);
  const jsonParsed = parseFlashcardsInput(jsonInput, { deckName: 'Deck JSON' });
  assert.strictEqual(jsonParsed.detectedFormat, 'json');
  assert.strictEqual(jsonParsed.cards.length, 1);
  assert.strictEqual(jsonParsed.cards[0].front, 'Piece of cake');
  assert.strictEqual(jsonParsed.cards[0].back, 'Muito fácil');

  // 5. Conversão para FlashcardItem e Persistência isolada por userId
  const items = candidatesToFlashcardItems(mdParsed.cards, 'Deck Teste Suite 17');
  assert.strictEqual(items.length, 3);
  assert.strictEqual(items[0].deckName, 'Deck Teste Suite 17');
  assert.strictEqual(items[0].status, 'new');

  const store = getFlashcardStorage();
  const testUid = `test_flash_user_${Date.now()}`;
  const savedCards = await store.upsertMany(testUid, items);
  assert.strictEqual(savedCards.length, 3);

  const listedCards = await store.listByUser(testUid);
  assert.strictEqual(listedCards.length, 3);

  const removedOne = await store.remove(testUid, items[0].id);
  assert.strictEqual(removedOne, true);

  const clearedCount = await store.clearByUser(testUid);
  assert.strictEqual(clearedCount, 2);
  const afterClear = await store.listByUser(testUid);
  assert.strictEqual(afterClear.length, 0);
});

import type { SavedConversation } from '../src/types/polyglot';
import {
  resolveInitialConversationTarget,
  readActiveConversationTarget,
  persistActiveConversationTarget,
} from '../src/services/conversationSessionState';

test('Suite 18: Resolução de Conversa Ativa, Novo Chat Explícito vs. Chat Fixado e Isolamento por Usuário', () => {
  const pinnedFirst: SavedConversation = {
    id: 'conv_pinned_1',
    userId: 'uid_1',
    userName: 'Melki Teste',
    title: 'Primeiro Chat Fixado',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    pinned: true,
    messages: [],
  };
  const recentSecond: SavedConversation = {
    id: 'conv_recent_2',
    userId: 'uid_1',
    userName: 'Melki Teste',
    title: 'Segundo Chat Recente',
    createdAt: '2026-11-12T10:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
    pinned: false,
    messages: [],
  };

  // 1. Novo chat explícito NÃO pode ser sobrescrito pelo primeiro chat fixado
  const draftRes = resolveInitialConversationTarget({
    explicitSelection: null,
    savedTarget: { mode: 'new', draftId: 'conv_draft_999' },
    conversations: [pinnedFirst, recentSecond],
  });
  assert.deepStrictEqual(draftRes, { action: 'keep_new_draft', draftId: 'conv_draft_999' });

  // 2. Seleção salva da segunda conversa sobrevive mesmo havendo conversa fixada em list[0]
  const secondRes = resolveInitialConversationTarget({
    explicitSelection: null,
    savedTarget: { mode: 'saved', conversationId: 'conv_recent_2' },
    conversations: [pinnedFirst, recentSecond],
  });
  assert.strictEqual(secondRes.action, 'load_saved');
  if (secondRes.action === 'load_saved') {
    assert.strictEqual(secondRes.conversation.id, 'conv_recent_2');
  }

  // 3. Seleção explícita '__NEW__' e 'new' tem precedência absoluta
  const explicitNewRes = resolveInitialConversationTarget({
    explicitSelection: '__NEW__',
    savedTarget: { mode: 'saved', conversationId: 'conv_pinned_1' },
    conversations: [pinnedFirst, recentSecond],
  });
  assert.strictEqual(explicitNewRes.action, 'keep_new_draft');

  const explicitNewLowerRes = resolveInitialConversationTarget({
    explicitSelection: 'new',
    savedTarget: { mode: 'saved', conversationId: 'conv_pinned_1' },
    conversations: [pinnedFirst, recentSecond],
  });
  assert.strictEqual(explicitNewLowerRes.action, 'keep_new_draft');

  // 4. Conversa salva inexistente (foi deletada) faz fallback gracioso para list[0]
  const deletedFallback = resolveInitialConversationTarget({
    explicitSelection: null,
    savedTarget: { mode: 'saved', conversationId: 'conv_deletada' },
    conversations: [pinnedFirst, recentSecond],
  });
  assert.strictEqual(deletedFallback.action, 'load_saved');
  if (deletedFallback.action === 'load_saved') {
    assert.strictEqual(deletedFallback.conversation.id, 'conv_pinned_1');
  }

  // 5. Isolamento de Estado por Usuário em readActiveConversationTarget / persistActiveConversationTarget
  const origDesc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    const memoryStore = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => memoryStore.get(key) ?? null,
      setItem: (key: string, value: string) => memoryStore.set(key, String(value)),
      removeItem: (key: string) => {
        memoryStore.delete(key);
      },
      clear: () => memoryStore.clear(),
      length: 0,
      key: () => null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      configurable: true,
      writable: true,
      enumerable: true,
    });

    persistActiveConversationTarget('user_alice', { mode: 'new', draftId: 'draft_alice_1' });
    persistActiveConversationTarget('user_bob', { mode: 'saved', conversationId: 'conv_bob_2' });

    assert.deepStrictEqual(readActiveConversationTarget('user_alice'), {
      mode: 'new',
      draftId: 'draft_alice_1',
    });
    assert.deepStrictEqual(readActiveConversationTarget('user_bob'), {
      mode: 'saved',
      conversationId: 'conv_bob_2',
    });
  } finally {
    if (origDesc) {
      Object.defineProperty(globalThis, 'localStorage', origDesc);
    } else {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  }
});

import type { FlashcardItem } from '../src/types/polyglot';
import {
  computeDeckSummaries,
  filterStudyQueue,
  buildManualFlashcardItem,
} from '../src/services/flashcardDeckStorage';

test('Suite 19: Área de Estudo Anki/Brainscape — Métricas de Baralho, Fila SRS Due e Criador Manual', () => {
  const now = 1_730_000_000_000;
  const DAY_MS = 86_400_000;

  const sampleCards: FlashcardItem[] = [
    {
      id: 'c_new_1',
      chunkText: 'Could I get an espresso?',
      language: 'en-US',
      front: 'Could I get an espresso?',
      back: 'Poderia me ver um expresso?',
      nuance: 'Pedido educado',
      example: 'Could I get an espresso, please?',
      exampleTranslation: 'Poderia me ver um expresso, por favor?',
      createdAt: now - 10_000,
      deckName: 'Baralho Principal',
      status: 'new',
      intervalDays: 0,
      repetitions: 0,
    },
    {
      id: 'c_due_review',
      chunkText: 'Non vedo l’ora',
      language: 'it-IT',
      front: 'Non vedo l’ora',
      back: 'Não vejo a hora / Mal posso esperar',
      nuance: 'Expressão idiomática',
      example: 'Non vedo l’ora di partire.',
      exampleTranslation: 'Mal posso esperar para partir.',
      createdAt: now - 2 * DAY_MS,
      deckName: 'Baralho Principal',
      status: 'learning',
      intervalDays: 1,
      repetitions: 1,
      lastReviewedAt: now - DAY_MS,
      nextReviewAt: now - 1000, // Vencido!
    },
    {
      id: 'c_future_mastered',
      chunkText: 'Piece of cake',
      language: 'en-US',
      front: 'Piece of cake',
      back: 'Muito fácil / Moleza',
      nuance: 'Expressão comum',
      example: 'The exam was a piece of cake.',
      exampleTranslation: 'O exame foi moleza.',
      createdAt: now - 10 * DAY_MS,
      deckName: 'Baralho Principal',
      status: 'mastered',
      intervalDays: 8,
      repetitions: 3,
      lastReviewedAt: now - DAY_MS,
      nextReviewAt: now + 7 * DAY_MS, // No futuro (não due)
    },
    {
      id: 'c_fast_1',
      chunkText: 'なるほど',
      language: 'ja-JP',
      front: 'なるほど (Naruhodo)',
      back: 'Entendi / Faz sentido',
      nuance: 'Aizuchi de escuta',
      example: 'なるほど、わかりました。',
      exampleTranslation: 'Entendi, compreendi.',
      createdAt: now - 5 * DAY_MS,
      deckName: 'FastChunks',
      status: 'mastered',
      intervalDays: 5,
      repetitions: 2,
      lastReviewedAt: now - DAY_MS,
      nextReviewAt: now + 4 * DAY_MS,
    },
    {
      id: 'c_fast_2',
      chunkText: 'よろしくお願いします',
      language: 'ja-JP',
      front: 'よろしくお願いします',
      back: 'Conto com você',
      nuance: 'Fórmula de cortesia',
      example: '明日もよろしくお願いします。',
      exampleTranslation: 'Amanhã conto com você também.',
      createdAt: now - 6 * DAY_MS,
      deckName: 'FastChunks',
      status: 'mastered',
      intervalDays: 10,
      repetitions: 4,
      lastReviewedAt: now - 2 * DAY_MS,
      nextReviewAt: now + 8 * DAY_MS,
    },
  ];

  // 1. computeDeckSummaries (agrupamento, contadores Anki, domínio Brainscape e ordenação)
  const summaries = computeDeckSummaries(sampleCards, now);
  assert.strictEqual(summaries.length, 2);

  const mainDeck = summaries.find((s) => s.deckName === 'Baralho Principal');
  assert.ok(mainDeck, 'Baralho Principal deve estar presente nos resumos');
  assert.strictEqual(mainDeck.total, 3);
  assert.strictEqual(mainDeck.newCount, 1);
  assert.strictEqual(mainDeck.learningCount, 1);
  assert.strictEqual(mainDeck.masteredCount, 1);
  assert.strictEqual(mainDeck.dueCount, 2, 'dueCount deve incluir novos + vencidos');
  assert.strictEqual(mainDeck.masteryPercent, 33, 'Math.round((1 / 3) * 100) = 33%');
  assert.ok(mainDeck.languages.includes('EN') && mainDeck.languages.includes('IT'));

  const fastDeck = summaries.find((s) => s.deckName === 'FastChunks');
  assert.ok(fastDeck, 'FastChunks deve estar presente nos resumos');
  assert.strictEqual(fastDeck.total, 2);
  assert.strictEqual(fastDeck.newCount, 0);
  assert.strictEqual(fastDeck.dueCount, 0, 'Ambos estão agendados no futuro');
  assert.strictEqual(fastDeck.masteredCount, 2);
  assert.strictEqual(fastDeck.masteryPercent, 100);
  assert.deepStrictEqual(fastDeck.languages, ['JA']);

  // Ordenação estável: Baralho Principal primeiro
  assert.strictEqual(summaries[0].deckName, 'Baralho Principal');
  assert.strictEqual(summaries[1].deckName, 'FastChunks');

  // 2. filterStudyQueue (deck, idioma, dueOnly e timestamp)
  const allMain = filterStudyQueue(sampleCards, {
    deckName: 'Baralho Principal',
    language: 'ALL',
    dueOnly: false,
    now,
  });
  assert.strictEqual(allMain.length, 3);

  const dueOnlyMain = filterStudyQueue(sampleCards, {
    deckName: 'Baralho Principal',
    language: 'ALL',
    dueOnly: true,
    now,
  });
  assert.strictEqual(dueOnlyMain.length, 2, 'Deve excluir o card agendado para o futuro');
  assert.ok(!dueOnlyMain.some((c) => c.id === 'c_future_mastered'));

  const italianMain = filterStudyQueue(sampleCards, {
    deckName: 'Baralho Principal',
    language: 'IT',
    dueOnly: false,
    now,
  });
  assert.strictEqual(italianMain.length, 1);
  assert.strictEqual(italianMain[0].id, 'c_due_review');

  const allDecksDue = filterStudyQueue(sampleCards, {
    deckName: 'ALL',
    language: 'ALL',
    dueOnly: true,
    now,
  });
  assert.strictEqual(allDecksDue.length, 2);

  // 3. buildManualFlashcardItem (criação com inferência de idioma e sanitização de vazios)
  const createdCard = buildManualFlashcardItem({
    deckName: 'Italiano Viagem',
    front: 'Prendiamo un caffè insieme?',
    back: 'Vamos tomar um café juntos?',
    pronunciation: '   ',
    example: '',
    exampleTranslation: '',
    nuance: '',
  });

  assert.ok(createdCard.id.startsWith('fc_manual_'));
  assert.strictEqual(createdCard.deckName, 'Italiano Viagem');
  assert.strictEqual(createdCard.language, 'it-IT', 'Deve inferir italiano automaticamente');
  assert.strictEqual(createdCard.front, 'Prendiamo un caffè insieme?');
  assert.strictEqual(createdCard.back, 'Vamos tomar um café juntos?');
  assert.strictEqual(createdCard.pronunciation, undefined, 'String com espaços deve virar undefined');
  assert.strictEqual(createdCard.example, 'Prendiamo un caffè insieme?', 'Fallback para front');
  assert.strictEqual(createdCard.exampleTranslation, 'Vamos tomar um café juntos?', 'Fallback para back');
  assert.strictEqual(createdCard.status, 'new');
  assert.strictEqual(createdCard.intervalDays, 0);
  assert.strictEqual(createdCard.repetitions, 0);

  // 4. buildManualFlashcardItem (edição preservando id e progresso SRS)
  const editedCard = buildManualFlashcardItem({
    id: 'c_future_mastered',
    deckName: 'Baralho Principal',
    front: 'Piece of cake (revised)',
    back: 'Muito fácil mesmo',
    existing: sampleCards[2],
  });

  assert.strictEqual(editedCard.id, 'c_future_mastered');
  assert.strictEqual(editedCard.front, 'Piece of cake (revised)');
  assert.strictEqual(editedCard.status, 'mastered', 'Deve preservar status SRS');
  assert.strictEqual(editedCard.intervalDays, 8, 'Deve preservar intervalDays');
  assert.strictEqual(editedCard.repetitions, 3, 'Deve preservar repetitions');
  assert.strictEqual(editedCard.nextReviewAt, now + 7 * DAY_MS, 'Deve preservar nextReviewAt');
  assert.strictEqual(editedCard.createdAt, sampleCards[2].createdAt, 'Deve preservar createdAt');
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


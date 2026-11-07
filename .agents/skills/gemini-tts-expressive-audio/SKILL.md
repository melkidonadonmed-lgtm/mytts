---
name: gemini-tts-expressive-audio
description: Arquitetura e regras canônicas de síntese neural Gemini 3.8 Flash TTS (@google/genai), speechMetadata em camelCase, 42 tags vocais inline, failover Vertex AI ADC (global), sincronia de vozes por card, cache de turnos e Web Audio / HTML5 preservesPitch no MyTTS Studio.
---

# Gemini 3.8 Flash TTS & Expressive Audio Architecture (`mytts`)

Use esta skill sempre que alterar rotas de síntese de voz (`server.ts`), motor de prosódia (`src/utils/prosodyEngine.ts`), cache de áudio (`src/utils/audioCache.ts`), fallback Web Speech (`src/utils/audio.ts`) ou players de áudio no MyTTS Studio.

## 1. Serialização `speechMetadata` em camelCase (`@google/genai`)

- O serializador interno `partToMldev` / `partToVertex` do SDK `@google/genai` lê exclusivamente a propriedade **`speechMetadata`** (em **camelCase**) no objeto `Part`:
  ```ts
  const partPayload = {
    text: spokenText,
    speechMetadata: {
      speaker: speakerName,
      style: stylePrompt,
    },
  };
  ```
- **Proibido** usar `speech_metadata` (snake_case): o SDK descarta silenciosamente chaves fora do mapeamento `Part` antes da requisição HTTP, fazendo o `gemini-3.8-flash-tts` sintetizar sem direção de emoção ou persona.

## 2. Separação Estrita entre `speechMetadata.style` e Tags Vocais Inline

- **`speechMetadata.style` (`getVoiceAcousticStyle` + `getEmotionStyle`)**:
  - Deve conter apenas direção acústica, emocional e de persona (5 personas: `Puck`, `Kore`, `Aoede`, `Fenrir`, `Enceladus`; 12 emoções: `natural`, `storytelling`, `technical`, `spontaneous`, `thoughtful`, `inquisitive`, `skeptical`, `ironic`, `passionate`, `resolute`, `expressive`, `calm`).
  - **Nunca** inclua tags angulares literais (`<breath>`, `<sigh>`, etc.) nem meta-instruções negativas dentro de `style`.
- **Tags Vocais Inline em `part.text` (`buildExpressiveTtsTranscript`)**:
  - As **42 tags vocais canônicas** do Gemini 3.8 TTS pertencem exclusivamente ao `part.text`:
    - *Respiração e fisiologia*: `<breath>`, `<heavy breath>`, `<pant>`, `<sigh>`, `<gasp>`, `<exhales>`, `<yawn>`, `<cough>`, `<throat-clearing>`, `<sniffle>`, `<snort>`, `<hiccup>`, `<gulps>`, `<swallows>`, `<groan>`, `<grunt>`, `<phew>`, `<uhm>`, `<tsk>`, `<clicks tongue>`, `<smacks lips>`
    - *Riso e emoção*: `<laugh>`, `<chuckle>`, `<giggle>`, `<snicker>`, `<cackle>`, `<cry>`, `<sob>`, `<whimper>`
    - *Dinâmica e prosódia*: `<whispering>`, `<soft>`, `<loud>`, `<screaming>`, `<shouting>`, `<fast>`, `<slow>`, `<high pitch>`, `<low pitch>`, `<singing>`
    - *Pausas*: `<short pause>`, `<medium pause>`, `<long pause>`
  - **Heurística de fôlego natural**:
    - Entre parágrafos: injetar `\n\n<short pause> <breath> ` somente quando ambos os parágrafos adjacentes tiverem `>= 6` palavras (evitando excesso de respiração em diálogos curtos).
    - No meio de orações longas (`> 20` palavras): injetar `<short pause> <breath>` no ponto de articulação sintática (`,`, `;` ou ` — `) próximo ao meio da frase, mesmo que a frase já inicie com `<breath>`, desde que o miolo da frase ainda não possua tag de respiração/pausa.

## 3. Autenticação Híbrida (`AQ.` vs `AIza`) e Failover Vertex AI ADC (`global`)

- Chaves prefixadas com `AQ.` (Vertex AI Express Mode) exigem `vertexai: true`, enquanto chaves `AIza` (Google AI Studio) exigem `vertexai: false`.
- **Isolamento de `process.env` no ADC**: Ao instanciar `new GoogleGenAI({ vertexai: true, project, location: 'global' })` em `getVertexAdcClient()`, remova temporariamente `process.env.GEMINI_API_KEY` e `process.env.GOOGLE_API_KEY` no bloco `try` e restaure-os no `finally`. Caso contrário, o construtor do SDK lançará erro por coexistência de `apiKey` e `project`/`location`.
- **Cascata de Modelos TTS**:
  `gemini-3.8-flash-tts` → `gemini-3.8-flash-lite-tts` → `gemini-3.1-flash-tts-preview` → `gemini-2.5-flash-preview-tts`.

## 4. Cache de Turnos, Sincronia de Voz nos Cards e Players (`preservesPitch`)

- **Cache L1/L2 (`audioCache.generateKey`)**: Para turnos de debate/conversa, gere a chave de cache a partir de `turn.text` (que preserva as tags vocais `<breath>`, `<laugh>`, etc.), nunca de `turn.clean_text`.
- **Invalidação e Re-síntese**:
  - Editar o texto de um turno (`handleUpdateTurnText`) ou alterar a voz nos cards de configuração (`DebateConfigPanel`) deve limpar `audioBase64: undefined` nos turnos afetados.
  - Acionar "Re-sintetizar Voz" (`handleSynthesizeSingleTurn`) deve enviar `bypassCache: true`.
- **Seletores `<select>` em Cards Selecionáveis (`LanguageColumnCard`)**: Nunca invoque `onSelectCard()` antes de `onChangeCardVoice()`, mantendo `cardVoicesByMsgRef` atualizado sincronamente.
- **Fidelidade de Timbre e Duração WAV**:
  - Todos os players HTML5 (`new Audio(...)`) que aplicam `playbackRate` devem habilitar `audio.preservesPitch = true` (`mozPreservesPitch` / `webkitPreservesPitch`).
  - O cálculo de `durationSec` em WAV 24 kHz mono PCM 16-bit deve descontar os 44 bytes do cabeçalho RIFF: `Math.max(0, wavBuffer.length - 44) / (24000 * 2)`.
  - No fallback local (`speakBrowserFallback`), sempre repasse `voiceId` para diferenciar gênero, `pitch` e cadência entre `Puck`, `Kore`, `Aoede`, `Fenrir` e `Enceladus`.

---
name: gemini-tts-expressive-audio
description: "Arquitetura de síntese neural Gemini 3.8 Flash TTS (@google/genai) no MyTTS Studio: speechMetadata camelCase, 42 tags vocais inline, failover Vertex AI ADC global, cascata de modelos, cache L1/L2 e players HTML5/FFmpeg. Use ao alterar server.ts, prosodyEngine.ts ou players TTS; não use para CSS ou banco sem áudio."
compatibility: Node.js 22+ / TypeScript 5+ / @google/genai / FFmpeg / MyTTS Studio
metadata:
  author: melki-agent-os
  version: "1.1.0"
  updated_at: "2026-11-13"
---

# Gemini 3.8 Flash TTS & Expressive Audio (`mytts`)

Use esta skill sempre que alterar rotas TTS (`server.ts`), motor de prosódia (`src/utils/prosodyEngine.ts`), cache (`src/utils/audioCache.ts`), fallback Web Speech (`src/utils/audio.ts`) ou players do MyTTS Studio. Lista integral das 42 tags vocais e detalhes FFmpeg constam em [`references/vocal_tags_and_audio_pipeline.md`](references/vocal_tags_and_audio_pipeline.md).

## 1. Serialização `speechMetadata` em camelCase & Separação de Tags

- `@google/genai` (`partToMldev`/`partToVertex`) exige **`speechMetadata`** em **camelCase** (`{ speaker, style }`); `speech_metadata` é descartado silenciosamente.
- **`speechMetadata.style`:** Apenas direção acústica, persona (`Puck`, `Kore`, `Aoede`, `Fenrir`, `Enceladus`) e emoção (12 estilos) — **nunca** inclua tags `<...>` nem meta-instruções negativas.
- **`part.text` (`buildExpressiveTtsTranscript`):** Recebe exclusivamente as 42 tags vocais em inglês (e pausas `<short pause>` / `<long pause>`) com heurística de fôlego entre parágrafos e orações `> 20` palavras.

## 2. Auth Híbrida (`AQ.` vs `AIza`), Vertex ADC & Cascata de Modelos

- **`AQ.` (Express Mode):** `vertexai: true`; **`AIza` (AI Studio):** `vertexai: false`.
- **Isolamento no `getVertexAdcClient()`:** Ao criar `new GoogleGenAI({ vertexai: true, project, location: 'global' })`, remova `GEMINI_API_KEY` e `GOOGLE_API_KEY` de `process.env` no `try` e restaure no `finally`.
- **Cascata (`TTS_MODEL_CASCADE` em `server.ts`):**
  `gemini-3.8-flash-tts` → `gemini-3.8-flash-lite-tts` *(modelos `gemini-3.1-flash-tts-preview`, `gemini-3.1-flash-lite-tts-preview` e `gemini-2.5-*-preview-tts` removidos por shutdown em nov–dez/2026; `gemini-3.8-flash-lite` inexistente)*.
  Em `gemini-3.8-*tts`, o contrato envia `speechMetadata: { speaker, style }` em camelCase e isola tags vocais exclusivamente em `part.text`.

## 3. Cache de Turnos, Cards & Fidelidade de Áudio

- **Cache (`audioCache.generateKey`):** Gere chaves com `turn.text` (preservando tags vocais), nunca `turn.clean_text`.
- **Invalidação:** Editar texto ou trocar voz nos cards limpa `audioBase64: undefined`; "Re-sintetizar Voz" envia `bypassCache: true`; nunca chame `onSelectCard()` antes de `onChangeCardVoice()`.
- **Players, WAV & FFmpeg:** Habilite `audio.preservesPitch = true` ao usar `playbackRate`; desconte 44 bytes RIFF ao calcular `durationSec` (`24000 * 2` B/s); aplique `asplit=2` + `aresample=44100` no FFmpeg e repasse `voiceId` no `speakBrowserFallback`.

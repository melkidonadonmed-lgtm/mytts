---
name: gemini-tts-expressive-audio
description: "Use this skill when modifying Gemini 3.8 TTS synthesis, prosodyEngine.ts vocal tags, Vertex AI AQ./AIza/ADC failover, L1/L2 audio cache, FFmpeg sidechain mixing, or HTML5 playback in MyTTS Studio. Do NOT use for CSS/OKLCH styling, database queries, or unrelated UI work."
compatibility: "Node.js 22+, TypeScript 5+, @google/genai, FFmpeg, MyTTS Studio"
metadata:
  author: "melki-agent-os"
  version: "1.2.0"
  updated_at: "2026-11-16"
  tags: ["tts", "voz", "audio", "podcast", "gemini", "ffmpeg", "narracao", "dialogo", "ssml", "vocal-tags", "prosody", "mytts"]
---

# Gemini 3.8 TTS & Expressive Audio (`mytts`)

## 1. Overview & Scope

Govern Gemini neural TTS, acoustic direction, auth failover, L1/L2 caching, FFmpeg mastering, and HTML5/Web Speech playback across `server.ts`, `src/server/`, `src/utils/`, and players. See [`references/vocal_tags_and_audio_pipeline.md`](references/vocal_tags_and_audio_pipeline.md) for the 42-tag catalog and FFmpeg graph.

- **When NOT to Use:** Do NOT use for CSS/OKLCH styling, UI layouts, non-TTS Firestore schemas, or SQL queries.

## 2. Inputs & Prerequisites

- **Scope:** `/api/synthesize-turn`, `/api/mix-audio`, `geminiClient.ts`, `prosodyEngine.ts`, `audioCache.ts`, `audio.ts`, and players.
- **Runtime:** `@google/genai`, `ffmpeg`, `AQ.`/`AIza`/ADC (`global`) auth, 5 voices (`Puck`, `Kore`, `Aoede`, `Fenrir`, `Enceladus`), 12 emotions, 4 locales (`pt-BR`, `en-US`, `it-IT`, `ja-JP`).

## 3. Step-by-Step Procedure (CoT -> ToT -> ReAct -> RAW)

1. **Phase 1 — Two-Channel `Part` Payload Audit (`CoT` — `prosodyEngine.ts` + `geminiClient.ts`):**
   - Send `speechMetadata: { speaker, style }` in **camelCase** for `gemini-3.8-*`; `@google/genai` (`partToMldev`/`partToVertex`) silently drops `speech_metadata`.
   - Keep `speechMetadata.style` to persona, acoustic direction, speed, and emotion—never `<...>` tags or negative rules.
   - Route verbatim text and the 42 English vocal tags (plus `<short pause>` / `<long pause>`) solely in `part.text` via `buildExpressiveTtsTranscript()`.
2. **Phase 2 — Hybrid Auth & Cascade Failover (`ToT` — `getGenAiClient` / `getVertexAdcClient`):**
   - Set `vertexai: true` for `AQ.` keys and `vertexai: false` for `AIza` keys.
   - In `getVertexAdcClient()` (`global`), delete `GEMINI_API_KEY` and `GOOGLE_API_KEY` from `process.env` in `try` and restore in `finally`.
3. **Phase 3 — Cache Keys, Card State & Playback (`ReAct`):**
   - Compute keys with `generateAudioCacheKey()` from `turn.text` (with tags), never `turn.clean_text`.
   - Clear `audioBase64: undefined` on edits, send `bypassCache: true` on re-synthesis, and never call `onSelectCard()` before `onChangeCardVoice()`.
   - Set `audio.preservesPitch = true`, pass `voiceId` to `speakBrowserFallback()`, subtract 44 RIFF bytes for `durationSec` (`24000 * 2` B/s), and use `asplit=2` + `aresample=44100` in FFmpeg.
4. **Phase 4 — Command-First Verification (`RAW`):**
   - Execute `npm run lint && npm test && npm run build` in the repository root and confirm zero errors before closing.

## 4. Gotchas & Edge Cases

- **Active Cascade (`TTS_MODEL_CASCADE`):** `gemini-3.8-flash-tts` -> `gemini-3.8-flash-lite-tts` (`inline-fallback` moves `style` to a text prefix only for non-`gemini-3.8-` targets). Retired `gemini-3.1-*-tts-preview` and `gemini-2.5-*-preview-tts` are forbidden/migrated; `gemini-3.8-flash-lite` does not exist.
- **Locale & Stream Guards:** Skip comma-slicing for `ja-JP`/`ja`; never reuse `[voice]` in FFmpeg without `asplit=2[voice_sc][voice_mix]`.

## 5. Output Schema & Validation Criteria

- **Responses:** `/api/synthesize-turn` -> `{ success, turnNumber, audioBase64, mimeType: 'audio/wav', durationSec }`; `/api/mix-audio` -> `{ success, audioBase64, mimeType: 'audio/wav' }`.
- **Gate:** Run `npm run lint && npm test && npm run build` and verify camelCase `speechMetadata`, tag isolation in `part.text`, 44-byte RIFF offset, and `preservesPitch = true`.

## 6. User Communication Rule

Always formulate all direct user-facing conversation, explanations, clarifying questions, status reports, and deliverables in Portuguese (Brazil / pt-BR), unless the user explicitly requests otherwise.

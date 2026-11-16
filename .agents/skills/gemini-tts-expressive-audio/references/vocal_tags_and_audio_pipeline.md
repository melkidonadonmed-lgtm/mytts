# Canonical Vocal Tags (`gemini-3.8-flash-tts`) & FFmpeg Audio Pipeline

Complementary technical reference for `SKILL.md` (`gemini-tts-expressive-audio`) covering expressive speech synthesis, prosody heuristics, cache behavior, and FFmpeg audio mastering in MyTTS Studio.

---

## 1. Active Gemini 3.8 TTS Models & Payload Contract

- **Active Cascade (`TTS_MODEL_CASCADE` in `src/server/geminiClient.ts`):** `gemini-3.8-flash-tts` -> `gemini-3.8-flash-lite-tts`.
- **Migrated / Forbidden Models:** Never use retired `gemini-3.1-flash-tts-preview`, `gemini-3.1-flash-lite-tts-preview`, or `gemini-2.5-*-preview-tts` models, and never reference the non-existent `gemini-3.8-flash-lite` model ID.
- **Part Serialization (`buildTtsModelPart` in `src/utils/prosodyEngine.ts`):**
  - For `gemini-3.8-*` targets, attach `speechMetadata: { speaker, style }` in **camelCase** (`@google/genai` `partToMldev`/`partToVertex` silently drops `speech_metadata`).
  - For `inline-fallback` (non-`gemini-3.8-` fallback targets), omit `speechMetadata` and prepend `Performance Direction (${speaker}): ${style}\n\n${spokenText}`.

## 2. The 42 Canonical Inline Vocal Tags (`CANONICAL_VOCAL_TAGS` in `part.text`)

Use strictly inside `part.text`—always in English regardless of the spoken locale (`pt-BR`, `en-US`, `it-IT`, `ja-JP`)—and never inside `speechMetadata.style`:

- **Breath & physiology:** `<breath>`, `<heavy breath>`, `<exhales>`, `<pant>`, `<sigh>`, `<sighs>`, `<gasp>`, `<yawn>`, `<cough>`, `<sneeze>`, `<snort>`, `<throat-clearing>` (alias `throat clear` normalized to `<throat-clearing>`), `<groan>`, `<grunt>`, `<growl>`, `<grr>`, `<argh>`, `<hiss>`, `<moan>`, `<pff>`, `<phew>`, `<tsk>`
- **Laughter & emotion:** `<laugh>`, `<laughter>`, `<chuckle>`, `<chuckles>`, `<giggle>`, `<snicker>`, `<cackle>`, `<cheer>`, `<cry>`, `<sob>`, `<whimper>`, `<scream>`, `<shout>`, `<shriek>`
- **Point-in-time whisper:** `<whisper>`, `<whispers>`, `<whispering>`
- **Pauses:** `<short pause>`, `<long pause>` *(there is no `<medium pause>`; continuous speed and pitch belong in `speechMetadata.style`)*

Bracketed markers (e.g., `[deep breath]`, `[sigh]`, `[pause]`) are normalized by `buildExpressiveTtsTranscript()` into canonical angle-bracket tags, while non-canonical `<...>` tags are stripped.

## 3. Personas, Emotions & Breath Heuristics (`src/utils/prosodyEngine.ts`)

- **5 Prebuilt Voice Personas (`VOICE_ACOUSTIC_PERSONAS` / `ALLOWED_PREVIEW_VOICES`):** `Puck`, `Kore`, `Aoede`, `Fenrir`, `Enceladus`.
- **12 Emotion Styles (`getEmotionStyle`):** `natural`, `storytelling`, `technical`, `spontaneous`, `thoughtful`, `inquisitive`, `skeptical`, `ironic`, `passionate`, `resolute`, `expressive`, `calm`.
- **4 Supported Languages (`ALLOWED_PREVIEW_LANGS`):** `pt-BR`, `en-US`, `it-IT`, `ja-JP` (`ja-JP`/`ja` skips Western comma-slicing while preserving explicit vocal tags).
- **Between paragraphs:** Inject `<short pause> <breath> ` when the current paragraph has `>= 6` words or the previous paragraph has `>= 10` words (unless already starting with a breath/sigh/pause tag).
- **Long sentences (`> 20` words):** Inject `<short pause> <breath>` (or `<breath>` for `passionate`/`expressive`) after `min(48, floor(length * 0.35))` chars at an articulation boundary (`,`, `;`, or ` — `) when `withoutLeadingTags` lacks a breath/pause tag and at least `18` characters remain.
- **Multi-sentence cadence:** Prepend `<breath>` before even-indexed sentences (`sentIdx > 0 && sentIdx % 2 === 0 && words.length >= 10`) when the transcript has no explicit breath or pause tag.

## 4. FFmpeg Mixing (`/api/mix-audio` in `src/server/audioContainer.ts` & `ttsRoutes.ts`)

- Resample both inputs to 44.1 kHz (`aresample=44100`).
- Split the voice stream via `asplit=2[voice_sc][voice_mix]` before referencing `[voice_sc]` and `[voice_mix]` separately (prevents `Invalid stream specifier: voice`).
- Pass `[bg]` as the first input and `[voice_sc]` as the second (sidechain trigger) input:
  `[0:a]aresample=44100,volume=${voiceVol},asplit=2[voice_sc][voice_mix];[1:a]aresample=44100,volume=${bgVol}[bg];[bg][voice_sc]sidechaincompress=threshold=0.08:ratio=${ratio}:attack=100:release=500[ducked];[voice_mix][ducked]amix=inputs=2:duration=first:dropout_transition=2[out]`
- Encode mastered output with `-c:a pcm_s16le -ar 44100`.
- **Exact 24 kHz mono 16-bit PCM WAV duration (`src/server/geminiClient.ts`):** `Math.max(0, wavBuffer.length - 44) / (24000 * 2)` (floored at `1.0` s in `synthesizeGeminiTtsWav` after wrapping with `ensureWavContainer(base64Audio, 24000)`).

## 5. Client Cache, Card State & Playback Fidelity (`audioCache.ts` & `audio.ts`)

- **Cache Hierarchy (`src/utils/audioCache.ts`):** L1 RAM `Map` (max `60` entries) + L2 IndexedDB (`mytts_audio_cache_v2`, store `audio_records`, max `300` LRU entries).
- **Deterministic Key (`generateAudioCacheKey`):** Format `${type}:${language}:${voiceId}:${speed}:${emotion}:${normalizedText}` using `turn.text` (preserving vocal tags), never `turn.clean_text`.
- **State Invalidation:** Editing turn text or switching a card voice clears `audioBase64: undefined`; explicit re-synthesis passes `bypassCache: true`; `<select>` handlers must invoke `onChangeCardVoice()` without firing `onSelectCard()` first.
- **Playback & Browser Fallback (`src/utils/audio.ts`):** Always set `audio.preservesPitch = true` on HTML5 audio elements using `playbackRate`, and pass `voiceId` to `speakBrowserFallback(text, { lang, rate, voiceId })` so pitch/rate multipliers match the selected persona.

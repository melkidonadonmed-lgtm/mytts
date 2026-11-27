# AGENTS.md — MyTTS Studio (`mytts` v2.1)

> **Global Kernel Inheritance:** Universal Golden Rules (1–8), `Managed Antigravity Agent` constraints, Technical English internals / **Portuguese (`pt-BR`)** user bridge, and the Self-Refine Closing Block inherit from `quality-efficiency-guidelines.md` (`always_on`).

## 0. Project Overview & Stack

Neural voice studio built on the Gemini API: TTS reading with "Director's Chair" (prosody, direction, procedural soundtracks), neural batch & live dictation/transcription, real-time Gemini Live voice conversations (`/ws/live`), dual-speaker debate, and *FastChunks* (sliced cached synthesis) playing 24 kHz WAV via Web Audio API.
- **State Triad & Docs:** [`.context/context.md`](file:///C:/Users/melki/dev/repos/mytts/.context/context.md) | [`.context/spec.md`](file:///C:/Users/melki/dev/repos/mytts/.context/spec.md) | [`DESIGN.md`](file:///C:/Users/melki/dev/repos/mytts/DESIGN.md) | [`.context/CURRENT_STATE.md`](file:///C:/Users/melki/dev/repos/mytts/.context/CURRENT_STATE.md)
- **Client:** React 19.0 + Tailwind v4 (`@tailwindcss/vite` 4.3) + Vite 8, `lucide-react`, `motion`.
- **Server:** Express 4 + `ws` 8 (`/ws/live`) run via `tsx` in `server.ts` (no separate server build step); `helmet`, `express-rate-limit` 8, `@google/genai` 3.6+, `@google-cloud/firestore` 9.
- **Types & Testing:** TypeScript 7.0.2 (`strict` + `noUnusedLocals`/`noUnusedParameters`), Playwright 1.63, npm (`package-lock.json` -> `npm ci`).

## 1. Commands (`Command-First` — Canonical Port `3002`)

```bash
npm ci                      # reproducible install from lockfile
npm run dev                 # tsx server.ts -> http://0.0.0.0:3002
npm run build               # vite build -> dist/
npm run lint                # tsc --noEmit
npm test                    # tsx test-audio-engine.ts
npm start                   # tsx server.ts (production)
```

## 2. Structure & Domain Invariants

- **Modules:** `server.ts` + `src/server/` (SSOT `modelRegistry.ts`: `gemini-3.5-flash-lite`, `gemini-4-hydrogen`, `gemini-3.5-transcribe`, `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`, `gemini-3.8-live`, `gemini-3.5-transcribe-live`; routes `/api/*` + `/api/live/ticket`; WebSocket proxy `liveWsProxy.ts` `/ws/live`; Vertex AI Express `AQ.` + automatic Vertex AI ADC failover `global` + Firestore), `src/App.tsx`, `src/components/`, `src/utils/` (`audioEngine`, `prosodyEngine`, `proceduralSoundtracks`, `audioCache`, `liveVoiceMonitor`, `liveAudioBridge`), `src/services/` (`apiClient`, `polyglotClient`, `liveWsClient`).
- **Bilingual Bridge (`[LOCK-04]`):** Author all code identifiers, comments, commits, `SKILL.md`, and `.context/*.md` in Technical English (preserving `pt-BR` UI copy and expressive TTS prompts where required by the studio UI). Formulate all user-facing dialogue and status reports in **Portuguese (`pt-BR`)**.
- **Code & UI Hygiene:** Narrow `catch (err: unknown)` (never `catch (e: any)`); use semantic `<button>` elements (never clickable `<div>`); slate + amber palette (`DESIGN.md` v8.0.0); run `npm run lint && npm test && npm run build` before closing.
- **Security:** Keep `GEMINI_API_KEY` in `.env` only; rate limit 120 req/15 min (AI + `/api/live/ticket`) and 300 req/15 min (`/api`); parse RIFF WAV chunks dynamically (`extractWavPcmInfo` / `extractWavDataChunk`); invoke FFmpeg exclusively via `execFile` with clamped parameters; never trust `X-User-Id` for authorization; deploy target Cloud Run `southamerica-east1` (`agent-md-506215`, service `mytts`, `scripts/deploy-sp.ps1`).

## 3. Evolutionary Memory (Project-Learned Rules)

> Detailed expressive synthesis rules live in local skill [`.agents/skills/gemini-tts-expressive-audio/SKILL.md`](file:///C:/Users/melki/dev/repos/mytts/.agents/skills/gemini-tts-expressive-audio/SKILL.md).

1. **`AQ.` vs. `AIza` Keys, Vertex AI ADC (`global`) Failover & Gemini 4 Hygiene:** In `@google/genai`, `AQ.` requires `vertexai: true` while `AIza` uses `vertexai: false`. In `getVertexAdcClient()` (`src/server/geminiClient.ts`), temporarily isolate `process.env.GEMINI_API_KEY`/`GOOGLE_API_KEY` when instantiating ADC (`project: agent-md-506215, location: global`). Use `src/server/modelRegistry.ts` as SSOT: never pass `temperature`/`topP`/`topK` or `'minimal'` `thinkingLevel` to `gemini-4-hydrogen` / `gemini-3.5-flash-lite`, never mix `responseSchema` with `tools` on the same call, and never use retired `3.1-*`/`2.5-*` or non-existent `gemini-3.8-flash-lite`.
2. **`speechMetadata` camelCase vs. 42 Inline Vocal Tags & Hybrid TTS:** `@google/genai` `partToMldev`/`partToVertex` requires `speechMetadata: { speaker, style }` in **camelCase** (`speech_metadata` is silently dropped). Both `gemini-3.8-flash-tts` and `gemini-3.8-flash-lite-tts` require native camelCase `speechMetadata` (never `'inline-fallback'`). Keep `speechMetadata.style` strictly for acoustic/emotional direction (zero literal `<tags>` or negative instructions) and inject the 42 canonical tags (`<breath>`, `<sigh>`, `<laugh>`, `<short pause>`) only into `part.text` via `buildExpressiveTtsTranscript`. Route short chunks & speech `<= 220` chars to `gemini-3.8-flash-lite-tts` and solo/debate/previews to `gemini-3.8-flash-tts`, synthesizing at canonical `1.0x` and controlling speed on the client via `playbackRate` + `preservesPitch = true`.
3. **Turn Cache (`turn.text`), Card Sync & `preservesPitch`:** Key turn caches by `turn.text` (never `turn.clean_text`), clear `audioBase64` when editing text or changing voices in `DebateConfigPanel`, pass `bypassCache: true` on re-synthesis, keep `cardVoicesByMsgRef` synchronous, and enable `audio.preservesPitch = true`.
4. **Web Speech Fallback Differentiation (`speakBrowserFallback`):** Always pass `voiceId` (`Puck`, `Kore`, `Aoede`, `Fenrir`, `Enceladus`) to browser fallback to apply distinct system voice gender, pitch, and cadence.
5. **Tailwind v4 `@variant dark` & `globals.css`:** Keep `@import "./styles/globals.css"` and `@variant dark (&:where(.dark, .dark *, [data-theme="dark"], [data-theme="dark"] *));` in `src/index.css`.

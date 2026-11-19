# SPEC — Functional Contracts and REST Endpoints (`mytts`)

## 1. SPA UI Functional Modules (`src/App.tsx`)

| Tab / Modal (`ActiveTab`) | Primary Components & Services | Functional Contract |
| :--- | :--- | :--- |
| Global Shell & Navigation | `src/App.tsx`, `src/utils/navigationOrganizer.ts`, `src/components/Sidebar.tsx`, `src/components/MobileAppHeader.tsx` | Grouped navigation (`studio` vs. `retention`), contextual sub-trees (`voices` & `study`), 2/3-level clickable breadcrumbs with empty-alt CSS dividers, `Alt+1..4` / `Ctrl+K` / `Ctrl+B` / `Ctrl+H` shortcuts, and mobile 1-tap sub-tab strip |
| `polyglot` | `src/components/PolyglotChatStudio.tsx` + `AgentInputDock.tsx` + `FlashcardDeckDrawer.tsx` + `src/services/conversationSessionState.ts` | Parallel EN/IT/JA translation with per-card voices, Quick Dictation, Gemini Live Mic, Web/YouTube exploration, language/date-filtered deck drawer, and persistent flashcard saving respecting `readDeckNamingPreference()` |
| `voices` | `src/components/VoiceConfigWorkspace.tsx` (`VoiceLibraryModal.tsx`, `StudioWorkspace.tsx`, `DebateConfigPanel.tsx`, `ScriptViewer.tsx`, `BottomAudioDock.tsx`) | Unified Voice Configuration hub across 3 WAI-ARIA keyboard-navigable sub-tabs: `catalog` (5 neural voices + favorite voices by EN/IT/JA), `solo` (1-voice reader `0.8x`–`1.5x` with `preservesPitch` and `.txt`/`.md`/`.pdf` ingestion), and `debate` (2-voice studio in `debate`, `podcast`, `bar_chat`, `dinner` formats with procedural soundtracks & 44.1 kHz WAV export) |
| `chunks` | `src/components/FastChunkAudioApp.tsx` | FastChunks lexical trainer on canonical `1440px` Bento Grid with 12-col control bar, Gemini chunk extraction, cached neural pronunciation, 1-click flashcard export, and quick bridges to `study` and `polyglot` |
| `study` | `src/components/StudyArenaView.tsx` + `StudyDeckOverview.tsx` + `FlashcardCreatorPanel.tsx` + `FlashcardCatalogManager.tsx` + `FlashcardImporterModal.tsx` + `src/utils/flashcardOrganizer.ts` | Anki/Brainscape-inspired Study Arena across 3 controlled WAI-ARIA keyboard-navigable sub-tabs (`decks`, `review`, `create`) with Overview by Deck/Language/Date, SRS queue, trilingual AI generation, batch importer, and hierarchical catalog |
| Modal `architecture` | `src/components/ArchitectureModal.tsx` | Technical specification of Web Audio API graph, FFmpeg sidechain mixing, and Gemini models |
| Modal `Ctrl+K` | `src/components/CommandPaletteModal.tsx` | Global keyboard command palette (`Ctrl+K` / `Cmd+K`) with deep-links to Voices & Study sub-modules |

---

## 2. REST Endpoints (`server.ts` + `src/server/routes/*`)

Protection limits:
- **Rate limit:** `aiLimiter` = 120 req / 15 min per IP on AI routes; `apiLimiter` = 300 req / 15 min per IP on `/api`.
- **Body size:** `50mb` on `/api/mix-audio`, `25mb` on `/api/transcribe-audio`, `/api/extract-text`, and `/api/live-agent-turn`, `2mb` elsewhere.
- **Text truncation (`capText`):** `20,000` chars default (`5,000` on `/api/synthesize-turn`, `3,000` on `/api/agent-explore`, `2,000` on `/api/synthesize-chunk` and `/api/live-agent-turn`).

### 2.1. `POST /api/extract-text`
Extracts and sanitizes plain text or PDF documents (base64) via `gemini-3.8-flash`.
- **Request (`application/json`, up to 25 MB):** `{ "text"?: "...", "fileData"?: "<base64>", "mimeType"?: "application/pdf", "fileName"?: "document.pdf" }`
- **Response (`200 OK`):** `{ "success": true, "text": "...", "fileName": "document.pdf", "wordCount": 240 }`

### 2.2. `POST /api/generate-script`
Generates dual-speaker conversation/debate scripts via `gemini-3.8-flash` using structured JSON schema and canonical vocal tags (`<breath>`, `<sigh>`, `<laugh>`, `<chuckle>`, `<short pause>`).
- **Request:** `{ "documentText": "...", "language": "pt-BR", "audienceLevel": "intermediate", "tensionIntensity": "provocative", "format": "debate", "speakers": [...], "maxTurns": 6 }`
- **Response (`200 OK`):** `{ "success": true, "script": { "id": "...", "title": "...", "turns": [...] } }`

### 2.3. `POST /api/synthesize-speech` & `POST /api/synthesize-turn`
- `POST /api/synthesize-speech`: neural TTS synthesis via `gemini-3.8-flash-tts` (`speechMetadata: { speaker, style }` in camelCase + 42 canonical vocal tags via `buildExpressiveTtsTranscript`) and 24 kHz mono RIFF WAV header enforced by `ensureWavContainer`.
- `POST /api/synthesize-turn`: synthesizes an individual debate turn (`{ turn, speakerName, voiceId, language }`) returning `{ success: true, turnNumber, audioBase64, mimeType: "audio/wav", durationSec }`.

### 2.4. `POST /api/mix-audio`
Server-side broadcast mixing via `execFile('ffmpeg', ...)` using `sidechaincompress` and `amix` (up to 50 MB payload).

### 2.5. `POST /api/preview-voice`, `POST /api/synthesize-chunk` & `POST /api/transcribe-audio`
- `/api/preview-voice`: persona-calibrated 3-second voice sample (`{ voiceId, speakerName, language }`).
- `/api/synthesize-chunk`: native pronunciation WAV for a lexical chunk (`{ text, language, voiceId }`).
- `/api/transcribe-audio`: punctuated microphone audio transcription via `gemini-3.8-flash` (up to 25 MB).

### 2.6. FastChunks, Polyglot Studio, Flashcards & Live/YouTube Agent
- `POST /api/generate-chunks` (`1..20` chunks) + `GET /api/chunks` / `POST /api/chunks` / `DELETE /api/chunks/:id` (per sanitized `X-User-Id`).
- `POST /api/translate-parallel-chunks`: semantic trilingual chunk alignment (`en`, `it`, `ja`, `jaPronunciation`).
- `POST /api/generate-flashcard`: validated by `ROUTE_ALLOWED_KEYS.generateFlashcard` (`chunkText`, `language`, `contextSentence`, `trilingual`).
  - Single mode (`trilingual` false/omitted): generates a pedagogical Anki flashcard (`{ success: true, card }`) with normalized `language` (`en-US` | `it-IT` | `ja-JP`) and timezone-safe `createdDateKey` (`YYYY-MM-DD`).
  - Trilingual mode (`trilingual: true`): generates 3 parallel flashcards across `en-US`, `it-IT`, and `ja-JP` from a single expression (`{ success: true, cards, card: cards[0] }`).
- `GET /api/flashcards` / `POST /api/flashcards` / `DELETE /api/flashcards/:id` / `DELETE /api/flashcards`: user-scoped dual persistence (Firestore `mytts_flashcards` + `.data/flashcards.json`) preserving `createdDateKey`, `deckName`, and SRS fields.
- `POST /api/live-agent-turn` (up to 25 MB) with `NON_BLOCKING` function calling (`create_study_flashcard`, `switch_studio_voice`).
- `GET /api/youtube/metadata` & `POST /api/agent-explore`: grounded web search (`googleSearch`), YouTube search, and multimodal YouTube video analysis (`ask_intent`, `translate_video`, `summary_dialogue`, `extract_expressions`, `custom_prompt`, optional `clipRange`).

### 2.7. Auth, Conversation History & Health
- `GET /api/auth/config` & `POST /api/auth/google`
- `GET /api/conversations` / `POST /api/conversations` / `DELETE /api/conversations/:id`
- `GET /api/health`: `{ status: "online", service: "DialecticPod & FastChunks API", modelTts: "gemini-3.8-flash-tts", modelGen: "gemini-3.8-flash", geminiKeyConfigured: true, storage: "local-fallback" | "firestore", uptimeSec }`
- Unknown `/api/*` routes return structured `404 JSON` (`{ success: false, error: "Endpoint não encontrado: ..." }`).

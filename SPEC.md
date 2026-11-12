# SPEC — Contratos Funcionais e Endpoints (`mytts`)

## 1. Módulos Funcionais da Interface (`src/App.tsx`)

| Aba / Modal (`ActiveTab`) | Componente Principal | Contrato Funcional |
| :--- | :--- | :--- |
| `polyglot` | `src/components/PolyglotChatStudio.tsx` + `AgentInputDock.tsx` | Estúdio Poliglota principal (#1): tradução paralela EN/IT/JA com voz independente por card, Ditado Rápido e Gemini Live Mic integrados no dock, Busca Web / YouTube e deck Anki |
| `studio` | `src/components/StudioWorkspace.tsx` + `BottomAudioDock.tsx` | Estúdio de Voz Neural unificado (Solo 1 voz ou Conversa 2 vozes), ingestão de texto/arquivo (`.txt`, `.md`, `.pdf`), leitura rápida estilo Speechify (`0.8x` a `1.5x` com `preservesPitch`), grade de vozes neurais e calibração prosódica |
| `debate` | `DebateConfigPanel.tsx`, `DocumentInputSection.tsx`, `ScriptViewer.tsx` | Configuração em 2 cards selecionáveis (`Voz`, `Idioma`, `Estilo`), geração de roteiro em múltiplos formatos (`debate`, `podcast`, `bar_chat`, `dinner`), síntese turno a turno ou episódio completo, trilha sonora procedural e exportação Master WAV 44.1 kHz |
| `chunks` | `src/components/FastChunkAudioApp.tsx` | Treinador Lexical FastChunks com geração via Gemini, síntese neural por chunk e persistência Firestore/JSON |
| `voices` | `src/components/VoiceCardGrid.tsx` + `VoiceLibraryModal.tsx` | Catálogo interativo das 5 vozes neurais (`Puck`, `Kore`, `Fenrir`, `Aoede`, `Enceladus`) com audição de amostras expressivas em 4 idiomas |
| Modal `architecture` | `src/components/ArchitectureModal.tsx` | Especificação técnica da arquitetura de áudio, modelos Gemini e grafo Web Audio API |
| Modal `Ctrl+K` | `src/components/CommandPaletteModal.tsx` | Paleta de comandos global (`Ctrl+K` / `Cmd+K`) para navegação instantânea sem mouse |

---

## 2. Endpoints REST (`server.ts`)

Limites de proteção:
- **Rate limit:** `aiLimiter` = 120 req / 15 min por IP nas rotas de IA; `apiLimiter` = 300 req / 15 min por IP em `/api`.
- **Body size:** `50mb` em `/api/mix-audio`, `25mb` em `/api/transcribe-audio`, `/api/extract-text` e `/api/live-agent-turn`, `2mb` nas demais rotas.
- **Truncamento de texto (`capText`):** 20.000 caracteres padrão (`5.000` em `/api/synthesize-turn`, `3.000` em `/api/agent-explore`, `2.000` em `/api/synthesize-chunk` e `/api/live-agent-turn`).

### 2.1. `POST /api/extract-text`
Extrai e higieniza texto puro ou documento PDF (base64) via `gemini-3.8-flash`.
- **Request (`application/json`, até 25 MB):**
  ```json
  {
    "text": "Texto bruto opcional",
    "fileData": "JVBERi0xLjQK... (base64 sem prefixo data URI)",
    "mimeType": "application/pdf",
    "fileName": "documento.pdf"
  }
  ```
- **Response (`200 OK`):** `{ "success": true, "text": "...", "fileName": "documento.pdf", "wordCount": 240 }`

### 2.2. `POST /api/generate-script`
Roteiriza conversa/debate entre 2 oradores via `gemini-3.8-flash` com schema JSON estruturado e tags vocais canônicas (`<breath>`, `<sigh>`, `<laugh>`, `<chuckle>`, `<short pause>`).
- **Request (`application/json`):**
  ```json
  {
    "documentText": "Texto base do debate...",
    "language": "pt-BR",
    "audienceLevel": "intermediate",
    "tensionIntensity": "provocative",
    "format": "debate",
    "speakers": [
      { "name": "Sofia", "voiceId": "Kore", "roleTitle": "Analista Teórica & Fundamentada" },
      { "name": "Lucas", "voiceId": "Puck", "roleTitle": "Provocador Pragmático & Cético" }
    ],
    "maxTurns": 6
  }
  ```
- **Response (`200 OK`):** `{ "success": true, "script": { "id": "...", "title": "...", "turns": [...] } }`

### 2.3. `POST /api/synthesize-speech`
Síntese neural de leitura rápida com *Director's Chair* (`gemini-3.8-flash-tts`, `speechMetadata: { speaker, style }` em camelCase e 42 tags vocais canônicas via `buildExpressiveTtsTranscript`) e cabeçalho RIFF WAV 24 kHz mono garantido por `ensureWavContainer`.
- **Request:** `{ "text": "...", "voiceId": "Puck", "emotion": "natural", "speed": 1.0, "autoProsody": true, "language": "pt-BR" }`
- **Response (`200 OK`):** `{ "success": true, "audioBase64": "UklGR...", "mimeType": "audio/wav", "durationSec": 4.2, "wordCount": 18 }`

### 2.4. `POST /api/synthesize-turn`
- `/api/synthesize-turn`: sintetiza um turno individual do roteiro (`{ turn, speakerName, voiceId, language }`) usando `gemini-3.8-flash-tts` com `speechMetadata` em camelCase e tags vocais inline, retornando `{ success: true, turnNumber, audioBase64, mimeType: "audio/wav", durationSec }`.

### 2.5. `POST /api/mix-audio`
Mixagem broadcast server-side via `execFile('ffmpeg', ...)` com `sidechaincompress` e `amix`.
- **Request (até 50 MB):** `{ "voiceAudioBase64": "...", "soundtrackPreset": "lofi-warmth", "musicVolume": 0.2, "duckingDepthDb": -14, "voiceBoostDb": 3, "customMusicBase64": "..." }`
- **Response (`200 OK`):** `{ "success": true, "audioBase64": "UklGR...", "mimeType": "audio/wav" }`

### 2.6. `POST /api/preview-voice` & `POST /api/synthesize-chunk`
- `/api/preview-voice`: amostra vocal expressiva personalizada por persona e idioma (`{ voiceId, speakerName, language }`) -> `{ success: true, audioBase64, mimeType: "audio/wav", durationSec }`.
- `/api/synthesize-chunk`: pronúncia neural nativa de um chunk lexical (`{ text, language, voiceId }`) -> `{ success: true, audioBase64, mimeType: "audio/wav" }`.

### 2.7. `POST /api/transcribe-audio`
Transcrição pontuada de áudio capturado no microfone via `gemini-3.8-flash`.
- **Request (até 25 MB):** `{ "audioData": "base64...", "mimeType": "audio/webm" }`
- **Response (`200 OK`):** `{ "success": true, "transcript": "...", "wordCount": 12 }`

### 2.8. FastChunks, Estúdio Poliglota, Agente Live & Busca/YouTube
- `POST /api/generate-chunks`: extrai de 1 a 20 chunks coloquiais (`{ textOrPrompt, language, count }`) e persiste em `chunkStorage`.
- `GET /api/chunks` / `POST /api/chunks` / `DELETE /api/chunks/:id`: CRUD de chunks por `X-User-Id` sanitizado (`^[a-zA-Z0-9_-]{1,64}$`).
- `POST /api/translate-parallel-chunks`: alinhamento semântico trilingue (`en`, `it`, `ja` + `jaPronunciation`) -> `{ success: true, chunks: [...], fullText: { en, it, ja } }`.
- `POST /api/generate-flashcard`: gera flashcard pedagógico Anki (`front`, `back`, `nuance`, `pronunciation`, `example`, `exampleTranslation`) -> `{ success: true, card: {...} }`.
- `POST /api/live-agent-turn` (até 25 MB): turno conversacional por voz/texto com personas (`tutor_conversational`, `practice_partner`, `polyglot_translator`) e Function Calling `NON_BLOCKING` (`create_study_flashcard`, `switch_studio_voice`).
- `GET /api/youtube/metadata`: retorna metadados reais do vídeo (`videoId`, `canonicalUrl`, `title`, `authorName`, `thumbnailUrl`) via YouTube oEmbed.
- `POST /api/agent-explore`: pesquisa web fundamentada (`googleSearch`), busca no catálogo do YouTube (`youtubeSearchResults`) e análise multimodal de vídeos do YouTube (`fileData` com URL canônica) suportando modos de ação pós-link (`ask_intent`, `translate_video`, `summary_dialogue`, `extract_expressions`, `custom_prompt`) e intervalo opcional de tempo (`clipRange`).

### 2.9. Autenticação Google, Histórico de Conversas e `GET /api/health`
- `GET /api/auth/config` & `POST /api/auth/google`: configuração Google Identity Services e autenticação de sessão (`{ success: true, user }`).
- `GET /api/conversations` / `POST /api/conversations` / `DELETE /api/conversations/:id`: histórico persistente de conversas por usuário (Firestore `mytts_conversations` + fallback `.data/conversations.json`).
- `GET /api/health`: `{ status: "online", service: "DialecticPod & FastChunks API", modelTts: "gemini-3.8-flash-tts", modelGen: "gemini-3.8-flash", geminiKeyConfigured: true, storage: "local-fallback" | "firestore", uptimeSec }`.
- Qualquer rota `/api/*` inexistente retorna `404 JSON` estruturado (`{ success: false, error: "Endpoint não encontrado: ..." }`).

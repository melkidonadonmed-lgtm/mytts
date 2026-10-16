# SPEC — Contratos Funcionais e Endpoints (`mytts`)

## 1. Módulos Funcionais da Interface (`src/App.tsx`)

| Aba / Modal (`ActiveTab`) | Componente Principal | Contrato Funcional |
| :--- | :--- | :--- |
| `studio` | `src/components/StudioWorkspace.tsx` | Estúdio de Voz Neural unificado (Solo 1 voz ou Conversa 2 vozes), ingestão de texto/arquivo (`.txt`, `.md`, `.pdf`) e ditado por voz, grade de vozes neurais e calibração prosódica pt-BR |
| `reader` | `src/App.tsx` + `BottomAudioDock.tsx` | Leitor Rápido estilo Speechify com estimativa de tempo, controle de velocidade (`0.8x` a `1.5x`), emoção e auto-prosódia |
| `dictate` | `src/components/LiveVoiceMic.tsx` | Gravação de microfone com cronômetro, envio para `/api/transcribe-audio` e ponte direta para leitura em voz alta |
| `debate` | `DebateConfigPanel.tsx`, `DocumentInputSection.tsx`, `ScriptViewer.tsx` | Geração de roteiro antagônico (2 a 12 turnos), síntese turno a turno ou episódio completo, trilha sonora procedural e exportação Master WAV 44.1 kHz estéreo |
| `chunks` | `PolyglotChatStudio.tsx` + `FastChunkAudioApp.tsx` | Estúdio Poliglota (tradução paralela EN/IT/JA com áudio em cache L1/L2 e deck Anki) e Treinador Lexical FastChunks com persistência Firestore/JSON |
| `voices` | `src/components/VoiceLibraryModal.tsx` | Catálogo interativo das 5 vozes neurais (`Puck`, `Kore`, `Fenrir`, `Aoede`, `Enceladus`) com audição de amostras de 3s |
| Modal `architecture` | `src/components/ArchitectureModal.tsx` | Especificação técnica da arquitetura de áudio, modelos Gemini e grafo Web Audio API |
| Modal `Ctrl+K` | `src/components/CommandPaletteModal.tsx` | Paleta de comandos global (`Ctrl+K` / `Cmd+K`) para navegação instantânea sem mouse |

---

## 2. Endpoints REST (`server.ts`)

Limites de proteção:
- **Rate limit:** `aiLimiter` = 120 req / 15 min por IP nas rotas de IA; `apiLimiter` = 300 req / 15 min por IP em `/api`.
- **Body size:** `50mb` em `/api/mix-audio`, `25mb` em `/api/transcribe-audio` e `/api/extract-text`, `2mb` nas demais rotas.
- **Truncamento de texto (`capText`):** 20.000 caracteres padrão (`5.000` em `/api/synthesize-turn`, `2.000` em `/api/synthesize-chunk`).

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
- **Response (`200 OK`):** `{ "success": true, "text": "...", "charCount": 1420 }`

### 2.2. `POST /api/generate-script`
Roteiriza debate dialético entre 2 oradores via `gemini-3.8-flash` com schema JSON estruturado.
- **Request (`application/json`):**
  ```json
  {
    "documentText": "Texto base do debate...",
    "language": "pt-BR",
    "audienceLevel": "technical",
    "tensionIntensity": "moderate",
    "speakers": [
      { "id": "spk1", "name": " Elena", "voiceId": "Kore", "role": "Proponente", "stance": "..." },
      { "id": "spk2", "name": "Marcus", "voiceId": "Puck", "role": "Cético", "stance": "..." }
    ],
    "maxTurns": 6
  }
  ```
- **Response (`200 OK`):** `{ "success": true, "script": { "id": "...", "title": "...", "turns": [...] } }`

### 2.3. `POST /api/synthesize-speech`
Síntese neural de leitura rápida com *Director's Chair* (`gemini-3.1-flash-tts-preview`) e cabeçalho RIFF WAV 24 kHz mono garantido por `ensureWavContainer`.
- **Request:** `{ "text": "...", "voiceId": "Puck", "emotion": "natural", "speed": 1.0, "autoProsody": true, "language": "pt-BR" }`
- **Response (`200 OK`):** `{ "success": true, "audioBase64": "UklGR...", "mimeType": "audio/wav", "durationSec": 4.2, "wordCount": 18 }`

### 2.4. `POST /api/synthesize-turn` & `POST /api/synthesize-full`
- `/api/synthesize-turn`: sintetiza um turno individual do roteiro (`{ turn, speakerName, voiceId }`) retornando `{ success: true, turnNumber, audioBase64, mimeType: "audio/wav", durationSec }`.
- `/api/synthesize-full`: sintetiza o episódio multi-speaker completo (`multiSpeakerVoiceConfig`) retornando `{ success: true, audioBase64, mimeType: "audio/wav" }`.

### 2.5. `POST /api/mix-audio`
Mixagem broadcast server-side via `execFile('ffmpeg', ...)` com `sidechaincompress` e `amix`.
- **Request (até 50 MB):** `{ "voiceAudioBase64": "...", "soundtrackPreset": "lofi-warmth", "musicVolume": 0.2, "duckingDepthDb": -14, "voiceBoostDb": 3, "customMusicBase64": "..." }`
- **Response (`200 OK`):** `{ "success": true, "audioBase64": "UklGR...", "mimeType": "audio/wav" }`

### 2.6. `POST /api/preview-voice` & `POST /api/synthesize-chunk`
- `/api/preview-voice`: amostra vocal de 3 segundos (`{ voiceId, speakerName, language }`) -> `{ success: true, voiceId, audioBase64, mimeType: "audio/wav", sampleText }`.
- `/api/synthesize-chunk`: pronúncia neural nativa de um chunk lexical (`{ text, language, speed, voiceId }`) -> `{ success: true, audioBase64, mimeType: "audio/wav" }`.

### 2.7. `POST /api/transcribe-audio`
Transcrição pontuada de áudio capturado no microfone via `gemini-3.8-flash`.
- **Request (até 25 MB):** `{ "audioData": "base64...", "mimeType": "audio/webm" }`
- **Response (`200 OK`):** `{ "success": true, "transcript": "...", "wordCount": 12 }`

### 2.8. FastChunks & Estúdio Poliglota
- `POST /api/generate-chunks`: extrai de 1 a 20 chunks coloquiais (`{ textOrPrompt, language, count }`) e persiste em `chunkStorage`.
- `GET /api/chunks` / `POST /api/chunks` / `DELETE /api/chunks/:id`: CRUD de chunks por `X-User-Id` sanitizado (`^[a-zA-Z0-9_-]{1,64}$`).
- `POST /api/translate-parallel-chunks`: alinhamento semântico trilingue (`en`, `it`, `ja` + `jaPronunciation`) -> `{ success: true, chunks: [...], fullText: { en, it, ja } }`.
- `POST /api/generate-flashcard`: gera flashcard pedagógico Anki (`front`, `back`, `nuance`, `pronunciation`, `example`, `exampleTranslation`) -> `{ success: true, card: {...} }`.

### 2.9. `GET /api/health` e Fallback 404
- `GET /api/health`: `{ status: "online", service: "DialecticPod & FastChunks API", modelTts: "gemini-3.1-flash-tts-preview", modelGen: "gemini-3.8-flash", geminiKeyConfigured: true, storage: "local-fallback" | "firestore", uptimeSec }`.
- Qualquer rota `/api/*` inexistente retorna `404 JSON` estruturado (`{ success: false, error: "Endpoint não encontrado: ..." }`).

# AGENTS.md — MyTTS Studio (`mytts`)

## Visão geral

Estúdio de voz neural sobre a API Gemini: leitura TTS com "Director's Chair" (prosódia, direção e
trilhas procedurais), ditado/transcrição, debate dual-speaker e *FastChunks* (síntese fatiada com
cache). A reprodução no cliente é WAV 24 kHz via Web Audio API. Docs canônicos: `CONTEXT.md`
(arquitetura), `SPEC.md` (contratos/endpoints), `design/design.md` (visual), `GEMINI.md` (API
Gemini), `.context/CURRENT_STATE.md` e `.context/SESSION_LOG.md` (estado e histórico).

## Stack verificada (`package.json`)

- **Cliente:** React 19.0 + Tailwind v4 (`@tailwindcss/vite` 4.3) + Vite 8, `lucide-react`, `motion`.
- **Servidor:** Express 4 rodado por `tsx` em `server.ts`, **sem etapa de compilação**; `helmet`,
  `express-rate-limit` 8, `@google/genai` 2.4, `@google-cloud/firestore` 9.
- **Tipos:** TypeScript 7.0.2 (devDep), `strict` + `noUnusedLocals`/`noUnusedParameters`.
- **Qualidade/gerência:** Playwright 1.63; npm + `package-lock.json` → use `npm ci`.

## Comandos

```bash
npm ci                      # instala a partir do lockfile
cp .env.example .env        # preencher GEMINI_API_KEY (obrigatória; fail-fast no boot)
npm run dev                 # tsx server.ts -> http://0.0.0.0:3002
npm run build               # vite build -> dist/       (npm run preview serve o build)
npm run lint                # tsc --noEmit
npm test                    # tsx test-audio-engine.ts
npm start                   # tsx server.ts (produção); npm run clean = rm -rf dist server.js
```

**Porta canônica: 3002** (`process.env.PORT || 3002`, `server.ts:1370`). O `:3000` do `README.md`
está desatualizado.

## Estrutura

- `server.ts` — servidor único: rotas, rate limit, cache, integração Gemini/Firestore.
- `src/App.tsx` (entrada) e `src/components/`: `StudioWorkspace`, `PolyglotChatStudio`,
  `LiveVoiceMic`, `DebateConfigPanel`, `BottomAudioDock`, `VoiceCardGrid`, `CommandPaletteModal`.
- `src/utils/`: `audioEngine`, `prosodyEngine`, `proceduralSoundtracks`, `audioCache`, `csvExporter`;
  `src/services/chunkStorage.ts` — Firestore `fastchunks_chunks`, fallback `.data/chunks.json`.
- API REST (`SPEC.md`): `synthesize-speech`, `preview-voice`, `transcribe-audio`, `extract-text`,
  `generate-script`, `synthesize-turn`, `translate-parallel-chunks`, `health` (todas sob `/api/`).

## Convenções

- **Idioma:** todo texto, comentário e commit em pt-BR.
- **Erro:** `catch` sempre com `unknown` + narrowing; proibido `catch (e: any)`.
- **Interação:** todo controle é `<button>` com handler real — sem `div` clicável.
- **Visual:** paleta slate + âmbar, nunca zinco; fontes Outfit / Inter / Plus Jakarta / JetBrains Mono.
- **Contexto:** registre mudanças relevantes em `.context/`.
- **Trio de qualidade:** `npm run lint && npm test && npm run build`; mexeu no motor de áudio,
  `npm test` é obrigatório.

## Segurança

- `GEMINI_API_KEY` só via `.env` (falha rápida se ausente); `.env*` está no `.gitignore`.
- **`firebase-config.json` está versionado** (`git ls-files` confirma). Se contiver credenciais de
  serviço, remova do índice (`git rm --cached`) e rotacione a chave.
- Rate limit por IP: 120 req/15 min na IA, 300 req/15 min no restante de `/api`.
- Payloads: 2 MB padrão, 25 MB em transcrição, 50 MB na mixagem; textos truncados em
  20.000 / 2.000 / 5.000 caracteres conforme o endpoint.
- `ensureWavContainer` produz cabeçalho RIFF de 44 bytes (sem ele o áudio não toca); FFmpeg só via
  `execFile`, parâmetros clampados, temporários limpos em `finally`.
- `X-User-Id` é **spoofável** — não é autenticação; não o use para autorizar nada.

## Deploy

`Dockerfile` multi-stage (`node:22-slim`) + `firebase.json`; alvo Cloud Run `us-central1`, projeto
`agent-md-506215`, serviço `mytts`. **Não existem** `deploy-cloudrun.ps1`/`.sh`, ao contrário do que
diz `Projetos/AGENTS.md` §4.5.

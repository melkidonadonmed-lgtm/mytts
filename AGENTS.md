# AGENTS.md — MyTTS Studio (`mytts`)

## Visão geral

Estúdio de voz neural sobre a API Gemini: leitura TTS com "Director's Chair" (prosódia, direção e
trilhas procedurais), ditado/transcrição, debate dual-speaker e *FastChunks* (síntese fatiada com
cache). A reprodução no cliente é WAV 24 kHz via Web Audio API. Docs canônicos: `CONTEXT.md`
(arquitetura), `SPEC.md` (contratos/endpoints), `DESIGN.md` e `design/design.md` (visual),
`.context/CURRENT_STATE.md` e `.context/SESSION_LOG.md` (estado e histórico).

## Stack verificada (`package.json`)

- **Cliente:** React 19.0 + Tailwind v4 (`@tailwindcss/vite` 4.3) + Vite 8, `lucide-react`, `motion`.
- **Servidor:** Express 4 rodado por `tsx` em `server.ts`, **sem etapa de compilação**; `helmet`,
  `express-rate-limit` 8, `@google/genai` 2.4, `@google-cloud/firestore` 9.
- **Tipos:** TypeScript 7.0.2 (devDep), `strict` + `noUnusedLocals`/`noUnusedParameters`.
- **Qualidade/gerência:** Playwright 1.63; npm + `package-lock.json` → use `npm ci`.

## Comandos

```bash
npm ci                      # instala a partir do lockfile
cp .env.example .env        # preencher GEMINI_API_KEY (opcional se houver Vertex AI ADC ativo)
npm run dev                 # tsx server.ts -> http://0.0.0.0:3002
npm run build               # vite build -> dist/       (npm run preview serve o build)
npm run lint                # tsc --noEmit
npm test                    # tsx test-audio-engine.ts
npm start                   # tsx server.ts (produção); npm run clean = rm -rf dist server.js
```

**Porta canônica: 3002** (`process.env.PORT || 3002`, `server.ts`). O `:3000` do `README.md`
está desatualizado.

## Estrutura

- `server.ts` — servidor único: rotas, rate limit, cache, integração `gemini-3.8-flash-tts` (`speechMetadata` camelCase) + Vertex AI Express Mode (`AQ.`) + failover automático Vertex AI ADC (`global`) + Firestore.
- `src/App.tsx` (entrada) e `src/components/`: `PolyglotChatStudio`, `StudioWorkspace`,
  `DebateConfigPanel`, `FloatingCardAudioController`, `BottomAudioDock`, `AgentInputDock`,
  `ConversationHistoryDrawer`, `GoogleAuthWidget`, `VoiceCardGrid`, `CommandPaletteModal`.
- `src/utils/`: `audioEngine`, `prosodyEngine`, `proceduralSoundtracks`, `audioCache`, `csvExporter`,
  `liveVoiceMonitor`; `src/services/`: `chunkStorage.ts`, `conversationStorage.ts`, `authService.ts`.
- API REST (`SPEC.md`): `synthesize-speech`, `preview-voice`, `transcribe-audio`, `extract-text`,
  `generate-script`, `synthesize-turn`, `translate-parallel-chunks`, `live-agent-turn`, `agent-explore`,
  `conversations`, `auth/google`, `health` (todas sob `/api/`).

## Convenções

- **Idioma:** todo texto, comentário e commit em pt-BR.
- **Erro:** `catch` sempre com `unknown` + narrowing; proibido `catch (e: any)`.
- **Interação:** todo controle é `<button>` com handler real — sem `div` clicável.
- **Visual:** paleta slate + âmbar (`DESIGN.md` v8.0.0 — Cinza Studio Monolítico / Ad Lucem), nunca zinco; fontes Outfit / Inter / Plus Jakarta / JetBrains Mono.
- **Contexto:** registre mudanças relevantes em `.context/`.
- **Trio de qualidade:** `npm run lint && npm test && npm run build`; mexeu no motor de áudio,
  `npm test` é obrigatório.

## Memória Evolutiva (Oportunidades & Regras Aprendidas)

> Regras detalhadas de síntese expressiva e prosódia refatoradas na skill local [`.agents/skills/gemini-tts-expressive-audio/SKILL.md`](.agents/skills/gemini-tts-expressive-audio/SKILL.md).

1. **Chaves `AQ.` vs. `AIza` e Failover Vertex AI ADC (`global`)**: No `@google/genai`, `AQ.` exige `vertexai: true` e `AIza` usa `vertexai: false`. Em `getVertexAdcClient()` (`server.ts`), isole temporariamente `process.env.GEMINI_API_KEY`/`GOOGLE_API_KEY` ao instanciar ADC (`project: agent-md-506215, location: global`) e use a cascata `gemini-3.8-flash-tts` → `gemini-3.8-flash-lite-tts` → `gemini-3.1-flash-tts-preview` → `gemini-2.5-flash-preview-tts`.
2. **`speechMetadata` em camelCase vs. 42 Tags Vocais Inline (`@google/genai`)**: O serializador `partToMldev`/`partToVertex` exige `speechMetadata: { speaker, style }` em **camelCase** no `Part` (`speech_metadata` em snake_case é silenciosamente descartado). Mantenha `speechMetadata.style` exclusivo para direção acústica/emocional (12 emoções, 5 personas, zero `<tags>` literais ou instruções negativas) e injete as 42 tags canônicas (`<breath>`, `<sigh>`, `<laugh>`, `<short pause>`, etc.) apenas em `part.text` via `buildExpressiveTtsTranscript`.
3. **Cache de Turnos (`turn.text`), Sincronia de Cards e `preservesPitch`**: Gere chaves de cache de turnos por `turn.text` (nunca `turn.clean_text`), limpe `audioBase64` ao editar texto ou trocar voz nos cards (`DebateConfigPanel`), passe `bypassCache: true` ao re-sintetizar, mantenha `cardVoicesByMsgRef` síncrono sem disparar `onSelectCard()` antes de `onChangeCardVoice()` no `<select>`, e ative `audio.preservesPitch = true` em todos os players HTML5.
4. **Diferenciação Acústica no Fallback Web Speech (`speakBrowserFallback`)**: Sempre repasse `voiceId` (`Puck`, `Kore`, `Aoede`, `Fenrir`, `Enceladus`) para o fallback local do navegador para aplicar seleção por gênero de voz do sistema, `pitch` e cadência distintos.
5. **Tailwind v4 `@variant dark` e Tokens `globals.css`**: Mantenha `@import "./styles/globals.css"` e `@variant dark (&:where(.dark, .dark *, [data-theme="dark"], [data-theme="dark"] *));` em `src/index.css` para evitar conflito de contraste cor-sobre-cor entre temas.

## Segurança

- `GEMINI_API_KEY` só via `.env` (com hot-reload em `server.ts`); `.env*` está no `.gitignore`.
- **`firebase-config.json` está versionado** (`git ls-files` confirma). Se contiver credenciais de
  serviço, remova do índice (`git rm --cached`) e rotacione a chave.
- Rate limit por IP: 120 req/15 min na IA, 300 req/15 min no restante de `/api`.
- Payloads: 2 MB padrão, 25 MB em transcrição/live, 50 MB na mixagem; textos truncados em
  20.000 / 2.000 / 5.000 caracteres conforme o endpoint.
- `ensureWavContainer` produz cabeçalho RIFF de 44 bytes (sem ele o áudio não toca); FFmpeg só via
  `execFile`, parâmetros clampados, temporários limpos em `finally`.
- `X-User-Id` é **spoofável** — não é autenticação; não o use para autorizar nada.

## Deploy

`Dockerfile` multi-stage (`node:22-slim`) + `firebase.json` + `.firebaserc`; alvo Cloud Run `southamerica-east1` (São Paulo), projeto `agent-md-506215`, serviço `mytts`, script `scripts/deploy-sp.ps1`.

---

<!-- WORKSPACE-CONTEXT START -->
## Referências Globais do Workspace
- Diretrizes globais de engenharia, arquitetura visual por propósito e memória: [C:\Users\melki\dev\AGENTS.md](file:///C:/Users/melki/dev/AGENTS.md) e [Preferências de Trabalho com Agentes.md](file:///C:/Users/melki/dev/notes/Memória/Preferências%20de%20Trabalho%20com%20Agentes.md).
<!-- WORKSPACE-CONTEXT END -->

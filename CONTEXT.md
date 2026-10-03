# CONTEXT.md — Regras de Negócio, Fronteiras e Restrições do MyTTS Studio

> Documento canônico de contexto. Detalhes arquiteturais em `GEMINI.md`, design system em `design/design.md`, estado de sessão em `.context/CURRENT_STATE.md`.

## 1. Identidade e Propósito
O **MyTTS Studio** é uma estação de trabalho de áudio neural (síntese TTS, debates dual-speaker, ditado inteligente, treino de idiomas FastChunks e Chat Poliglota) construída sobre os modelos Gemini (TTS + LLM multimodal), com processamento de áudio Web Audio API no cliente e FFmpeg no backend.

## 2. Fronteiras do MVP Atual
- Acesso **aberto**, sem onboarding: identidade por sessão de dispositivo via header `X-User-Id` (formato restrito a `[a-zA-Z0-9_-]{1,64}`, sanitizado no servidor).
- Persistência de chunks: Firestore (`fastchunks_chunks`) com fallback local (`.data/chunks.json`) quando não há credenciais GCP.
- 7 módulos de UI em SPA de abas: Estúdio de Criação, Chat Poliglota, Microfone & Ditado, Estúdio de Debate, FastChunks, Biblioteca de Vozes, Arquitetura.

## 3. Restrições de Segurança (hard rules)
- `GEMINI_API_KEY` é obrigatória: o servidor faz **fail-fast** no boot sem ela.
- Rate limiting obrigatório em todos os endpoints de IA (120 req/15min/IP) e geral (300 req/15min/IP).
- Payloads: máx. 2 MB por padrão; 25 MB em `/api/transcribe-audio`; 50 MB apenas em `/api/mix-audio`.
- Textos para síntese truncados em 20.000 caracteres (chunks em 2.000, turnos em 5.000).
- Todo áudio retornado DEVE passar por `ensureWavContainer` (cabeçalho WAV RIFF canônico de 44 bytes).
- FFmpeg somente via `execFile` (sem shell); parâmetros numéricos sempre clampados; arquivos temporários limpos em `finally`.

## 4. Limitações Conhecidas (aceitas nesta fase)
- **Sem autenticação real**: o header `X-User-Id` é spoofável (IDOR mitigado apenas por sanitização). Autenticação Firebase Auth com ID token é o próximo passo planejado — exige mudança de UX e aprovação de design.
- O modelo de dados `ChunkItem` não possui campo de idioma; o parâmetro `lang` dos adapters de storage é contrato reservado para uso futuro.
- `count` de geração de chunks é clampado a 1–20 no servidor.

## 5. Convenções Inegociáveis de Código
- TypeScript `strict` + `noUnusedLocals` + `noUnusedParameters` (verificados por `npm run lint`).
- `catch` com `unknown` + narrowing `instanceof Error` — proibido `catch (e: any)`.
- Design tokens: paleta **slate** (`slate-950` fundo, `slate-900` cards, `slate-800` bordas, `amber-400/500` destaque). Nunca reintroduzir escala zinc.
- Fontes: Outfit (display/títulos via utility `font-display`), Inter/Plus Jakarta Sans (corpo), JetBrains Mono (métricas).
- Todo botão interativo deve ser `<button>` semântico com handler real; proibido `onClick` vazio.
- Ao alterar o motor de áudio, executar `npm test` (conformidade matemática de ganhos dB e cabeçalho WAV).

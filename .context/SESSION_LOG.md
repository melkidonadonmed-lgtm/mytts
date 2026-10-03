# Checkpoint da Sessão (mytts)

## Data e Hora
- **Data/Hora**: 2026-10-03T04:14:00Z (Horário UTC)

## Arquivos Tocados
- `src/utils/prosodyEngine.ts`: Suporte nativo a múltiplos idiomas (`en-US`, `it-IT`, `ja-JP`, `pt-BR`) em `getEmotionStyle` com instruções fonéticas precisas e proteção de caracteres japoneses em `applyAcousticProsody`.
- `server.ts`: Atualização do endpoint `/api/synthesize-speech` para aceitar `language`, selecionar a voz adequada e calibrar o prompt do Director's Chair para cada idioma.
- `src/components/PolyglotChatStudio.tsx`: Resolução de race condition com `AbortController` e `activeSynthesisIdRef`, auto-play na seleção de idioma/card, cancelamento da trilogia sequencial ao clicar em card manual e isolamento de scrubbers/progresso por mensagem.
- `src/components/LanguageColumnCard.tsx`: Exibição de status detalhado (Sintetizando, Ouvindo com animação, Focado, Ouvir) com badges dedicadas.
- `src/components/ParallelMessageBlock.tsx`: Propagação isolada de `isPlaying` e `isLoading` para os cards (`selectedLanguage === code`).
- `test-audio-engine.ts`: Adição de testes de calibração fonética multi-idioma (EN, IT, JA) no grupo [5/5].
- `.context/CURRENT_STATE.md` e `.context/SESSION_LOG.md`: Sincronização da hierarquia de governança.

## Comandos Validados
1. `npm test` (`tsx test-audio-engine.ts`):
   - Código de saída: `0`.
   - 100% de conformidade nos testes de engenharia de áudio e prosódia multi-idioma.
2. `npm run lint` (`tsc --noEmit`):
   - Código de saída: `0`.
   - Zero erros de tipagem estrita no TypeScript.
3. `npm run build` (`vite build`):
   - Código de saída: `0`.
   - Bundle de produção compilado em 295ms.
4. `gcloud run deploy mytts --source . --region us-central1 --allow-unauthenticated --project agent-md-506215`:
   - Código de saída: `0`.
   - Revisão `mytts-00010-zlp` criada e servindo 100% do tráfego.
5. Live Smoke Test em Produção:
   - `GET /api/health`: Status `online`, modelTts `gemini-3.1-flash-tts-preview`, modelGen `gemini-3.8-flash`.
   - `POST /api/synthesize-speech` (Italiano `it-IT` / `Kore`): HTTP 200, áudio WAV 2.92s gerado com sucesso.
   - `POST /api/synthesize-speech` (Japonês `ja-JP` / `Aoede`): HTTP 200, áudio WAV 2.44s gerado com sucesso.

## Próxima Ação Recomendada
- Acompanhar os testes e utilização em produção: `https://mytts-1044179901556.us-central1.run.app`.

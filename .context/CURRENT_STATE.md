# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Deploy em Produção da Revisão com Correção Crítica de Áudio Multi-Idioma e Anti-Race Condition Concluído.
- **Status da Branch**: `main` (100% sincronizado com `origin/main`).
- **Revisão Ativa Cloud Run**: `mytts-00010-zlp` (100% do tráfego).
- **URL de Produção**: `https://mytts-1044179901556.us-central1.run.app`.

## Decisões Tomadas
1. **Calibração Fonética Multi-Idioma no Backend (`server.ts` & `src/utils/prosodyEngine.ts`)**:
   - `/api/synthesize-speech` agora recebe `language`, mapeia personas nativas (`Puck` para EN, `Kore` para IT, `Aoede` para JA) e instrui o Director's Chair com diretrizes fonéticas autênticas para cada idioma, sem forçar sotaque brasileiro.
   - `applyAcousticProsody` agora preserva intacto textos em japonês sem quebras por vírgulas ocidentais.
2. **Blindagem contra Race Conditions e Dupla Ativação (`src/components/PolyglotChatStudio.tsx`)**:
   - `AbortController` e token de versão `activeSynthesisIdRef` abortam requisições HTTP pendentes em voo, eliminando instâncias concorrentes de áudio tocando simultaneamente.
   - Seleção de card/idioma agora aciona a reprodução direta do áudio escolhido e cancela qualquer Trilogia Sequencial em background.
   - Isolamento de estado por mensagem (`sequenceMessageId`, `blockCurrentTime`, `blockDuration`), garantindo que o progresso e badges não vazem para mensagens vizinhas.
3. **Feedback Visual Estrito nos Cards (`src/components/LanguageColumnCard.tsx` & `ParallelMessageBlock.tsx`)**:
   - Cada card recebe `isPlaying` e `isLoading` condicionado ao idioma selecionado, exibindo badges dinâmicas de "Sintetizando", "Ouvindo" ou "Focado".
4. **Deploy no Google Cloud Run e Smoke Test ao Vivo**:
   - Revisão `mytts-00010-zlp` servindo 100% do tráfego.
   - Testes comprovados em produção:
     - `GET /api/health`: Status `online`, modelo `gemini-3.1-flash-tts-preview`.
     - `POST /api/synthesize-speech` (Italiano `it-IT` / `Kore`): Status `True`, áudio WAV gerado com 2.92s.
     - `POST /api/synthesize-speech` (Japonês `ja-JP` / `Aoede`): Status `True`, áudio WAV gerado com 2.44s.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Adicionar WebSockets para conversação bidirecional streaming ao vivo (Gemini Live API).

## Próximo Ponto de Entrada
- Monitorar a utilização em produção: `https://mytts-1044179901556.us-central1.run.app`.

# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Deploy em Produção da Revisão `mytts-00012-jqk` Concluído com Sucesso.
- **Status da Branch**: `main` (commit `f001d03` sincronizado com `origin/main`).
- **Revisão Ativa Cloud Run**: `mytts-00012-jqk` (100% do tráfego).
- **URL de Produção**: `https://mytts-1044179901556.us-central1.run.app`.

## Decisões Tomadas
1. **Desbloqueio de Seleção nos Chunks (`src/components/LanguageColumnCard.tsx`)**:
   - `onClickChunk` executava `e.stopPropagation()` antes que o container do card pudesse registrar o clique. Corrigido para registrar `onSelectCard()` antes da exibição de menu.
2. **Sincronização Bidirecional e Auto-Play (`src/components/PolyglotChatStudio.tsx`)**:
   - Auto-play imediato ao focar card de idioma e vinculação bidirecional com o `FloatingCardAudioController`.
3. **Erradicação Definitiva de Race Conditions e Ativação Múltipla**:
   - `activeSynthesisIdRef` e `abortControllerRef` cancelando requisições em voo e impedindo áudio duplicado.
4. **Isolamento de Estado por Mensagem no Feed**:
   - Scrubbers e progresso condicionados exclusivamente ao bloco ativo.
5. **Calibração de Prosódia e Vozes Nativas no Backend (`server.ts` & `src/utils/prosodyEngine.ts`)**:
   - Mapeamento nativo de personas (`Puck` para EN, `Kore` para IT, `Aoede` para JA) sem sotaque forçado em PT-BR.
6. **Motor de Cache Local Universal de Áudio (L1 RAM + L2 IndexedDB) (`src/utils/audioCache.ts`)**:
   - Eliminação completa de latência de rede em reproduções repetidas de frases, chunks e cards do feed.
   - **Camada L1 (Memória RAM)**: Resolução instantânea (0ms) na sessão ativa via `Map<string, CachedAudioRecord>`.
   - **Camada L2 (IndexedDB)**: Banco `mytts_audio_cache` (store `audio_records`) com persistência permanente entre reloads do navegador, índice temporal `lastAccessedAt` e política de evicção LRU (máx. 300 áudios).
   - **Geração Determinística de Chaves**: Normalização estrita de espaços, Unicode NFC, velocidade e tags prosódicas.
   - **Feedback Visual na UI**: Badges `⚡ 0ms` nos cards de idioma e botão dinâmico `⚡ Neural (0ms)` no `FastChunkAudioApp`, `LanguageColumnCard` e `FloatingCardAudioController`.

## Testes Reais em Produção (Smoke Tests Comprovados)
- `GET /api/health`: Status `online`, Uptime ativo, modelos `gemini-3.1-flash-tts-preview` e `gemini-3.8-flash`.
- `POST /api/synthesize-chunk` (Inglês `en-US`): Status `True`, áudio WAV canônico sintetizado com sucesso.
- `test-audio-engine.ts`: 7 baterias de testes com 100% de conformidade (Soundscapes, Auto-Ducking, Voice Boost, WAV RIFF 44B, Prosódia PT-BR, CSV Anki e Cache Local IndexedDB/L1).
- `tsc --noEmit`: 0 erros de tipagem estrita no TypeScript.
- `vite build`: Compilação de produção aprovada em 300ms.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Integração streaming bidirecional via WebSocket (Gemini Live API).

## Próximo Ponto de Entrada
- Testar interativamente no navegador a eliminação de latência na repetição de frases: `https://mytts-1044179901556.us-central1.run.app`.

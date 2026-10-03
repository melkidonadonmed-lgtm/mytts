# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Deploy em Produção da Revisão `mytts-00013-pdd` Concluído com Sucesso.
- **Status da Branch**: `main` (commit `c1d66c3` sincronizado com `origin/main`).
- **Revisão Ativa Cloud Run**: `mytts-00013-pdd` (100% do tráfego).
- **URL de Produção**: `https://mytts-1044179901556.us-central1.run.app`.

## Decisões Tomadas
1. **Botão Dedicado de Sotaque Nativo no Player Flutuante (`FloatingCardAudioController.tsx`)**:
   - Inserido botão ergonômico (altura 44px, alvo tátil do polegar) "Reproduzir com Sotaque" (`record_voice_over`) diretamente na linha de controles do player.
   - Estado visual reativo: quando em reprodução fonética, destaca-se em esmeralda com pulso (`animate-pulse`) e muda o rótulo para "Pausar Sotaque".
   - Exibe indicador de loading (`progress_activity` spin) durante a síntese.
2. **Ação Rápida de Sotaque no Cabeçalho do Card (`LanguageColumnCard.tsx`)**:
   - Adicionado botão tátil ao lado do botão de cópia no cabeçalho de cada coluna de idioma, permitindo acionar a reprodução fonética instantânea sem depender de menus de chunks avulsos.
3. **Orquestração Multimodal e Separação de Modos de Áudio (`PolyglotChatStudio.tsx`)**:
   - Adicionado `activeAudioMode` (`'standard' | 'accent' | null`) e `isLoadingAccent` para distinguir com precisão se a reprodução em andamento é da voz padrão do estúdio ou da síntese fonética.
   - Função `handlePlayCardWithAccent(messageId, lang)` sintetiza a frase completa via `/api/synthesize-chunk` com instruções fonéticas nativas rigorosas e salva no cache `IndexedDB` com chave determinística (`type: 'chunk'`).
   - Sincronização completa de barra de progresso (scrubber), seek, velocidade de reprodução e tempo decorrido.
4. **Propagação Hierárquica Limpa (`ParallelMessageBlock.tsx`)**:
   - Encaminha `onPlayAccent`, `isPlayingAccent` e `isLoadingAccent` tanto para o controlador flutuante quanto para cada coluna de idioma (EN, IT, JA).
5. **Motor de Cache Local Universal de Áudio (L1 RAM + L2 IndexedDB) (`src/utils/audioCache.ts`)**:
   - Eliminação completa de latência de rede em reproduções repetidas de frases, chunks e cards do feed.
   - Camada L1 (RAM) + Camada L2 (IndexedDB `mytts_audio_cache`) com política LRU (máx. 300 áudios).

## Testes Reais em Produção (Smoke Tests Comprovados)
- `GET /api/health`: Status `online`, Uptime ativo, modelos `gemini-3.1-flash-tts-preview` e `gemini-3.8-flash`.
- `POST /api/synthesize-chunk` (Inglês `en-US`): Status `True`, áudio WAV canônico sintetizado (125.500 bytes) com sucesso.
- `test-audio-engine.ts`: 7 baterias de testes com 100% de conformidade.
- `tsc --noEmit`: 0 erros de tipagem estrita no TypeScript.
- `vite build`: Compilação de produção aprovada em 526ms.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Integração streaming bidirecional via WebSocket (Gemini Live API).

## Próximo Ponto de Entrada
- Testar interativamente no navegador (`Ctrl + F5`) a reprodução com sotaque nativo direto do reprodutor: `https://mytts-1044179901556.us-central1.run.app`.

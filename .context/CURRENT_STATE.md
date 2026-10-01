# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Correção Definitiva de Reprodução de Áudio Neural (Encapsulamento Canônico WAV RIFF de 44 Bytes + Blob URLs no Frontend).
- **Status da Branch**: `main` pronta para deploy no Cloud Run e push no GitHub.

## Decisões Tomadas
1. **Container WAV RIFF 44-Bytes no Backend (`server.ts`)**:
   - A API `gemini-3.1-flash-tts-preview` retorna áudio PCM raw mono a 24.000 Hz, 16-bit little-endian, sem container de arquivo.
   - Implementadas as funções `pcmToWav` e `ensureWavContainer` que anexam o cabeçalho canônico de 44 bytes (`RIFF....WAVEfmt ...data...`) caso o payload não possua a assinatura RIFF.
   - Aplicado a todos os endpoints de voz: `/api/synthesize-speech`, `/api/synthesize-turn`, `/api/synthesize-full`, `/api/preview-voice` e `/api/synthesize-chunk`.
2. **Substituição de Data URIs por Blob URLs no Frontend**:
   - Criado `src/utils/audio.ts` com `base64ToBlobUrl` e `revokeAudioUrl`.
   - Atualizados `QuickReader.tsx`, `VoiceLibraryModal.tsx` e `FastChunkAudioApp.tsx` para tocar via Blob URL, eliminando limites de tamanho de string do navegador e vazamentos de memória.
3. **Validação Factual Rigorosa**:
   - Vite build executado com sucesso (zero erros).
   - Teste de integração real com a API Gemini comprovou a geração do header `RIFF` / `WAVE` a 24.000 Hz com `ExitCode: 0`.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Adicionar WebSockets para conversação bidirecional streaming ao vivo (Gemini Live API).

## Próximo Ponto de Entrada
- Deploy no Cloud Run e sincronização com GitHub.

# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Fase 1 Concluída — Hiper-Realismo Neural em Gemini 3.1 Flash TTS (Director's Chair Prompting, Pausas, Respiração, Emoção e Dockerfile Cloud Run). Preparando deploy em nuvem e arquitetura da Fase 2 (Gemini Live API).
- **Status da Branch**: `main` (código testado com `tsc --noEmit` e `vite build` 100% exit code 0).

## Decisões Tomadas
1. **Director's Chair Prompting Nativo**:
   - Remoção de metadados inertes (`speechMetadata`) em favor de prompts diretoriais em linguagem natural no cabeçalho das requisições de TTS.
   - Mapeamento estrito de tags prosódicas em inglês para o decodificador neural: `[deep breath]`, `[sighs]`, `[pause]`, `[laughs]`, `[gasp]`, `[whispers]`, combinados com pontuação dramática (`...`, `—`).
2. **Síntese Neural para Chunks**: Novo endpoint `POST /api/synthesize-chunk` permitindo que tanto o DialecticPod quanto o FastChunks toquem áudio ultra-realista com fluência e sotaque nativo.
3. **Containerização Pronta para Produção**: `Dockerfile` multi-stage (Node 22-slim) e `.dockerignore` configurados para Google Cloud Run na porta dinâmica 8080 (`PORT`).
4. **Resiliência do Player**: Fallback automático entre áudio neural (`/api/synthesize-chunk`) e Web Speech nativo caso haja indisponibilidade de rede ou chave de API.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Implementar arquitetura da Fase 2 com WebSocket bidirecional para `gemini-3.1-flash-live-preview` (Live API).
  - `[BAIXO]`: Configurar regras de segurança do Firestore (`firestore.rules`) quando Firebase Auth for adicionado.

## Próximo Ponto de Entrada
- Push do commit no GitHub (`origin main`) e subida do serviço para o Google Cloud Run.

# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Fase 1 Concluída e Implantada em Produção no Google Cloud Run (`https://mytts-1044179901556.us-central1.run.app`). Hiper-realismo com Director's Chair, respiração e pausas 100% validado em produção.
- **Status da Branch**: `main` (commit `f964c45` sincronizado no GitHub e revision `mytts-00001-5sw` no Cloud Run).

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
- Iniciar arquitetura e prototipagem da Fase 2 (Gemini Live API via WebSockets para conversa interativa em tempo real com áudio nativo).

# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Deploy em Produção no Google Cloud Run e Sincronização do Repositório GitHub Concluídos com Sucesso.
- **Status da Branch**: `main` (100% sincronizado com `origin/main`).
- **Revisão Ativa Cloud Run**: `mytts-00005-mjz` (100% do tráfego).
- **URL de Produção**: `https://mytts-1044179901556.us-central1.run.app`.

## Decisões Tomadas
1. **Central de Ingestão Unificada (`src/components/StudioWorkspace.tsx` e `StudioTextEditor.tsx`)**:
   - Ponto de entrada único para colar texto, arrastar e subir arquivos (PDF, TXT, MD) ou ditar por microfone com IA.
   - Alternância em 1 toque entre `[🎙️ Apenas Ler (Solo)]` e `[👥 Transformar em Conversa (2 Vozes)]`, com persistência 100% íntegra do texto durante a troca.
2. **Grade Tátil de Vozes Neurais (`src/components/VoiceCardGrid.tsx`)**:
   - Cards visuais para as 5 vozes (Kore, Puck, Aoede, Fenrir, Enceladus) com avatar, arquétipo, gênero e prévia rápida de 3 segundos embutida no card.
   - Acessibilidade completa por teclado (`tabIndex={0}`, `role="radio"`, `focus-visible`).
   - Gerenciamento atômico de memória revogando Blob URLs anteriores via `URL.revokeObjectURL(url)`.
3. **Motor de Calibração e Auto-Prosódia Acústica (`src/utils/prosodyEngine.ts` e `server.ts`)**:
   - `getEmotionStyle`: Inclusão obrigatória de `Speak strictly in natural Brazilian Portuguese (pt-BR)` e mapeamento de velocidade (`speedAdj`).
   - 4 Presets Práticos em Português: `Natural & Fluido`, `Narrativo & Envolvente`, `Técnico & Notícia`, `Espontâneo & Conversa`.
   - `applyAcousticProsody`: Elimina injeção literal de tags perigosas (como `[deep breath]`, `[pause]`) que corriam risco de serem pronunciadas em voz alta pela IA, substituindo por micro-pontuação acústica orgânica (`...`, `—`, quebras duplas).
4. **Resiliência e Fallback Suave**:
   - Preservação estrita do container WAV RIFF canônico de 44 bytes.
   - Fallback de contingência opcional para a Web Speech API do navegador caso a API do Gemini apresente oscilação de rede ou quota.
5. **Otimização de Build & Containerização**:
   - Adicionado `.gcloudignore` prevenindo uploads desnecessários de `node_modules` e pastas locais para o Cloud Build.
   - Container multi-stage com Node 22 e FFmpeg compilado e servido no Cloud Run.
6. **Validação em Produção**:
   - Resposta HTTP 200 servindo os assets Vite atualizados (`index-CeB3QRxI.js` e `index-C_JvaTrL.css`).
   - Endpoint `/api/preview-voice` validado ao vivo gerando áudio WAV RIFF de 44 bytes canônico.

7. **Consolidação da Pasta Canônica de Design (`design/`)**:
   - Criação da pasta `design/` contendo `design/design.md` (especificação atualizada com StudioWorkspace, VoiceCardGrid, Auto-Prosody e master multitrack) e `design/README.md`.
   - Remoção do arquivo redundante `designe.md` da raiz e atualização dos links do `README.md`.


## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Adicionar WebSockets para conversação bidirecional streaming ao vivo (Gemini Live API).

## Próximo Ponto de Entrada
- Monitoramento de uso das novas funcionalidades em produção e planejamento do streaming bidirecional de baixa latência.


# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Deploy em Produção da Revisão do Estúdio Poliglota Concluído com Sucesso.
- **Status da Branch**: `main` (100% sincronizado com `origin/main`).
- **Revisão Ativa Cloud Run**: `mytts-00006-6gk` (100% do tráfego).
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

8. **Estúdio Poliglota Multimodal em Chat (`src/components/PolyglotChatStudio.tsx`)**:
   - Dock inferior multimodal estilo Agent (`AgentInputDock.tsx`): suporte a texto, anexos (PDF, TXT, MD), microfone com transcrição Gemini 3.8 e botão Live.
   - Canvas multi-pane em 3 colunas paralelas (`ParallelMessageBlock.tsx` e `LanguageColumnCard.tsx`) para 🇺🇸 Inglês, 🇮🇹 Italiano e 🇯🇵 Japonês com hover sync reativo de chunks alinhados.
   - Menu flutuante tátil (`ChunkActionMenu.tsx`) para ouvir frase, gerar flashcard com IA e copiar.
   - Gaveta lateral de flashcards (`FlashcardDeckDrawer.tsx`) com exportador CSV sanitizado para Anki/Notion (`csvExporter.ts`).
   - Novos endpoints no backend (`server.ts`): `/api/translate-parallel-chunks` e `/api/generate-flashcard` via Gemini 3.8 Flash com schema estruturado e calibração fonética estrita para IT e JA.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Adicionar WebSockets para conversação bidirecional streaming ao vivo (Gemini Live API).

## Próximo Ponto de Entrada
- Deploy da nova revisão no Google Cloud Run e teste em ambiente real de produção.



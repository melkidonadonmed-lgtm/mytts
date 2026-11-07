# Log de Sessão (mytts)

## Data e Hora
- **Data/Hora**: 2026-11-07T15:50:00-04:00 (Local)

## Evolução de Governança (`gemini-3.8-flash-tts` + `speechMetadata` camelCase), Correção FFmpeg `/api/mix-audio` e Deploy em Produção (`07/11/2026`)
- `.agents/skills/gemini-tts-expressive-audio/SKILL.md`, `.agents/skills.json`, `AGENTS.md`, `SPEC.md`, `CONTEXT.md`: Consolidação das regras aprendidas sobre `speechMetadata: { speaker, style }` em camelCase no `@google/genai`, catálogo exato das 42 entradas de `CANONICAL_VOCAL_TAGS` (`speech-generation.md#vocal-bursts`), adaptação automática de payload na cascata (`buildTtsModelPart` / `adaptContentsForTtsModel`), failover automático para Vertex AI ADC (`global`), grafo FFmpeg (`buildFfmpegMixFilterComplex` com `asplit=2[voice_sc][voice_mix]` e `[bg][voice_sc]sidechaincompress`), invalidação/bypass de cache por `turn.text` e `audio.preservesPitch = true`.
- `scripts/deploy-sp.ps1`: Inclusão explícita de `GOOGLE_CLOUD_LOCATION=global` e `--quiet` no deploy do Cloud Run (`southamerica-east1`).
- **Deploy e Verificação Live**:
  - Cloud Run (`southamerica-east1`): revisão `mytts-00004-jnd` ativa com 100% do tráfego em `https://mytts-1044179901556.southamerica-east1.run.app`.
  - Firebase Hosting: release publicado em `https://mytts.web.app`.
  - Smoke Test Live (`https://mytts.web.app/api/health`, `/api/synthesize-speech` e `/api/mix-audio`): `modelTts: "gemini-3.8-flash-tts"`, `storage: "firestore"`, síntese WAV RIFF 24kHz real (`durationSec: 4.2`, `268.840` chars base64) e mixagem broadcast FFmpeg 44.1kHz (`warning: null`, `sampleRate: 44100`, `475.208` chars base64).

## Refinamento Mobile UI/UX, Espaçamentos e Flex Bar (`07/11/2026`)
- `src/components/AgentInputDock.tsx`: Flex Bar em 2 níveis com `<textarea>` ocupando 100% da largura na linha 1 (`315px` em tela de `375px`) sem outline retangular interno, e barra flexível de controles na linha 2 (`+` + chip `3 Idiomas` à esquerda; `Mic`, `Gemini Live`, `Enviar` e `Recolher` à direita).
- `src/components/Sidebar.tsx`: Drawer com `h-dvh max-h-dvh` e corpo rolável unificado (`overscroll-contain`) colocando os 5 itens de navegação principal no topo sem qualquer corte ou sobreposição.
- `src/components/FloatingCardAudioController.tsx`: Cápsula `rounded-2xl md:rounded-full` no mobile com barra de progresso em largura total e pílulas `EN / IT / JA` com `.btn-compact-touch`.
- `src/App.tsx`, `src/components/PolyglotChatStudio.tsx`, `src/components/ConversationHistoryDrawer.tsx`, `src/components/ParallelMessageBlock.tsx`, `src/components/LanguageColumnCard.tsx`, `src/styles/globals.css`, `src/index.css`: Compactação do header mobile (ícone de busca no lugar de `Ctrl+K`, ocultação do breadcrumb redundante em `< 640px`), ajuste de `.btn-compact-touch` em `@media (pointer: coarse)` e redução de espaçamentos verticais no topo para exibir o primeiro card de idioma completo na primeira dobra.

## Aprendizados Consolidados e Entregas de 07/11/2026
- `server.ts`, `src/server/audioContainer.ts`: Detecção automática de chaves Vertex AI Express Mode (`AQ.` -> `vertexai: true`) vs. Google AI Studio (`AIza` -> `vertexai: false`), hot-reload de `.env` em cada requisição (`resolveActiveApiKey()`), cascata de modelos (`gemini-3.1-flash-tts-preview` -> `gemini-2.5-flash-preview-tts`, `gemini-3.8-flash` -> `gemini-2.5-flash`), e endpoints `/api/live-agent-turn` (Function Calling `NON_BLOCKING`), `/api/agent-explore` (Google Search Grounding + YouTube `fileData`), `/api/conversations` e `/api/auth/google`.
- `src/utils/audio.ts`, `src/components/LanguageColumnCard.tsx`, `src/components/ParallelMessageBlock.tsx`, `src/components/PolyglotChatStudio.tsx`: Eliminação da condição de corrida em `<select>` de voz por card (`cardVoicesByMsgRef` síncrono), passagem de `voiceId` para chunks e diferenciação acústica real (gênero, `pitch` e ritmo) entre `Puck`, `Kore`, `Aoede`, `Fenrir` e `Enceladus` no `speakBrowserFallback`.
- `src/components/DebateConfigPanel.tsx`, `src/components/StudioWorkspace.tsx`, `src/App.tsx`: Simplificação da configuração de conversa em 2 cards selecionáveis (`Voz`, `Idioma`, `Estilo`) com formatos de renderização (`Leitura Solo`, `Debate Dialético`, `Podcast de Estúdio`, `Conversa de Bar`, `Mesa de Jantar`) e sincronização imediata das vozes dos cards com `script.turns`.
- `src/components/FloatingCardAudioController.tsx`, `src/components/BottomAudioDock.tsx`, `src/components/AgentInputDock.tsx`: Refatoração em **Pílula de Produtor** colapsável em Linha Animada e **Pílula de Chat Fixa** com menu `+` estilo Chat LLM e símbolo vetorial do Gemini Live.
- `firebase.json`, `.firebaserc`, `scripts/deploy-sp.ps1`: Configuração da região `southamerica-east1` (São Paulo) e URL curta via Firebase Hosting (`agent-md-506215.web.app`).

## Arquivos Tocados em Turno Anterior (`plan-uiux` v1.1.0 + `design-md` v8.0.0)
- `DESIGN.md` (Atualização para o contrato canônico `v8.0.0` com as 9 Seções Canônicas e Adendos A–I, tokens OKLCH em 3 camadas, regra 60-30-10, Cinza Studio Monolítico `#57545d`, Ad Lucem `#F3F3F5`/`#FFFFFF` e Terminal IBM `#070709`).
- `design/design.md` (Sincronização do diagrama Mermaid de navegabilidade, tabela de módulos com Chat Poliglota #1 + Live Mic integrado e seção de Design System `v8.0.0`).
- `src/styles/globals.css` (Adição dos tokens `v8.0.0`, regra LVHA, `@property --gradient-angle`, `.bentoGrid` RAM, `.bentoCardSubgrid`, `.sliderGrid`, `.tabsOverflowContainer`, `.modalOverlay` com `@starting-style` + `allow-discrete`, `.nodeFlashing` e `@media (any-pointer: coarse)` com preservação de `.chunk-inline-btn`).
- `src/components/PolyglotChatStudio.tsx` (Substituição de emojis de bandeira em `stepNames` por rótulos tipográficos `'EN · Inglês'`, `'IT · Italiano'`, `'JA · Japonês'`).
- `src/components/AgentInputDock.tsx` (Remoção de classes Flexbox `order-1`/`order-2`/`order-3` para garantir Ordem do DOM === Ordem Visual em mobile e desktop).
- `src/components/CommandPaletteModal.tsx` (Conversão de `<div onClick>` dos itens de comando para `<button type="button">` semântico).
- `src/components/LanguageColumnCard.tsx` (Conversão do seletor de cabeçalho de card e dos blocos lexicais `<span onClick>` para `<button type="button">` semânticos com foco por teclado).

## Arquivos Tocados em Turno Anterior (Correção de Navegação e Responsividade Mobile)
- `src/components/GoogleIcon.tsx` (Mapeamento do ícone `menu: Menu` do `lucide-react` para o botão hamburger mobile).
- `src/index.css` (Resolução de especificidade `.btn-matte.hidden` e breakpoints responsivos + utilitários `.no-scrollbar` / `.scrollbar-none`).
- `src/App.tsx` (Contenção horizontal `min-w-0 max-w-full overflow-x-clip`, navegação rápida mobile em `grid-cols-5` sem corte/scrollbar e restauração de scroll ao topo na troca de abas).
- `src/components/PolyglotChatStudio.tsx` (Layout responsivo da barra de Vozes Favoritas em grade de 3 colunas no mobile sem deformação oval, remoção do botão "Meu Deck" duplicado no mobile e supressão de `scrollIntoView` no mount inicial).
- `src/components/FloatingCardAudioController.tsx` (Seletor de idiomas `EN / IT / JA` em `grid-cols-3` contido 100% dentro do card no mobile e alinhamento responsivo dos controles de reprodução/exportação).
- `src/components/AgentInputDock.tsx`, `src/components/ParallelMessageBlock.tsx` (`<textarea>` com 100% da largura no mobile acima da linha de botões de ação, eliminando esmagamento do texto e scrollbar vertical interna).

## Arquivos Tocados em Turnos Anteriores (Auditoria Matemática Frontend UI/UX v3.0.0 — 9 Eixos SSOT)
- `src/styles/globals.css`, `src/styles/theme.css`, `src/index.css` (Tokens perceptuais `oklch()`/`light-dark()`/`color-mix()`, `--shadow-elevation-1..3`, `isolation: isolate`, Box Model lógico + `.bfc-flow-root`, 4 variantes de cards, `text-wrap: pretty`, transições zero-reflow GPU, `@media (pointer: coarse)` e `@media (display-mode: standalone)`).
- `src/App.tsx`, `src/components/Sidebar.tsx` (Navegação em 3 Camadas completa com `aria-label="Navegação principal"`, Breadcrumbs estruturais `<nav aria-label="Caminho de navegação"><ol role="list">`, elevação de touch target mobile `.pill-nav-item` para `44px` e unificação de `GoogleIcon`).

## Arquivos Tocados neste Turno (Refatoração Minimalista Cinza Studio / Ad Lucem + Voz por Card + Exportação WAV)
- `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/CommandPaletteModal.tsx` (Chat Poliglota definido como página principal #1; remoção da aba isolada `mic`/`LiveVoiceMic.tsx`; sincronização global bidirecional de voz por Card e por turno).
- `src/components/AgentInputDock.tsx` (Atalho de Ditado Rápido e Live Mic API integrado diretamente no dock do Chat Poliglota com timer em tempo real, transcrição Gemini e auto-reprodução traduzida).
- `src/components/LanguageColumnCard.tsx`, `src/components/ParallelMessageBlock.tsx`, `src/components/FloatingCardAudioController.tsx`, `src/components/PolyglotChatStudio.tsx`, `src/components/ScriptViewer.tsx`, `src/components/StudioWorkspace.tsx` (Seletor de voz `<select>` dentro de cada Card, perfis favoritos de vozes por idioma persistidos no `localStorage`, sincronização automática com a voz global e download `.wav` 24kHz por card).
- `src/utils/interactionExporter.ts`, `src/components/ExportInteractionModal.tsx` (Correção de colunas duplicadas no CSV Anki, inclusão de `cardVoices` em Markdown/JSON, Preview ao Vivo `<pre>` e exportação de Áudio Master da Trilogia `.wav` 24kHz concatenado EN + IT + JA).
- `index.html`, `src/index.css`, `src/styles/globals.css`, `src/styles/theme.css`, `src/config/tokens.ts` (Tema Cinza sobre Cinza Monolítico `#57545d`/`#49464f`/`#8e8999` no escuro e Claro Moderno `Ad Lucem` `#F3F3F5`/`#FFFFFF` no claro, fundo com malha de pontos estilo Canva `radial-gradient` 22x22px, movimento elástico `spring` no hover dos cards e tipografia subpixel ultra-nítida).

## Comandos Validados no Terminal
- `npm run lint` (`tsc --noEmit`): Exit code 0 comprovado.
- `npm test` (`tsx test-audio-engine.ts`): Exit code 0 comprovado (16/16 suítes Nível 4 aprovadas).
- `npm run build` (`vite build`): Exit code 0 comprovado (`dist/` compilado em 302ms sem warnings).
- `audit_tactile_ui.py`: Exit code 0 (`Readiness Score: 100.0/100.0`).
- `ui_ux_frontend_auditor.py --target .` & `--target src`: Exit code 0 (`SCORE FINAL: 100.0 / 100 | NOTA: A+ (Produção de Elite) | [PASS]`).
- `deterministic_scorer.py --scan src`: Exit code 0 (`SGA = 100.0`, `INE = 100.0`, `ICI = 100.0`, `IPC = 100.0`, `IRM = 100.0`, `ICTE = 100.0`).

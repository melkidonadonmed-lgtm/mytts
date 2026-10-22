# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Refatoração Arquitetural Minimalista (`minimal-impact-ui` + `frontend-code-architect` + `arquitetura-design-implementacao-sistema` + `modern-web-guidance` + `code-quality-audit-3d-physics`).
- **Status da Branch**: `main` (Trio de qualidade `npm run lint && npm test && npm run build` 100% verde, 14/14 suítes Nível 4 aprovadas, `audit_tactile_ui.py` = 100.0/100, `deterministic_scorer.py` SGA = 100.0/100).

## Decisões Arquiteturais e Correções Aplicadas
1. **Tema Minimalista de Estúdio de Áudio (`minimal-impact-ui` & `frontend-code-architect`)**:
   - **Modo Escuro (Cinza sobre Cinza Monolítico)**: Canvas `#57545d`, cards esculpidos `#49464f`, superfícies elevadas `#635f6a`, contraste `#232127` e menus em pílula `#8e8999` com texto `#16151A` (`.pill-nav-shell`), sombras físicas de 3 camadas e Rim Light 1px (`135°`).
   - **Modo Claro Moderno (`Ad Lucem`)**: Canvas `#F3F3F5`, cards `#FFFFFF`, superfície elevada `#E6E6EA` e contraste `#18181C`, preservando `SOFT_UI_PRESETS.slate.accentPoint === '#0284C7'`.
2. **Chat Poliglota como Página Principal & Remoção da Aba Isolada de Gravação**:
   - `activeTab` padrão definido como `'polyglot'` em [`src/App.tsx`](../src/App.tsx) e item #1 na [`src/components/Sidebar.tsx`](../src/components/Sidebar.tsx).
   - Aba dedicada `'mic'` (`LiveVoiceMic.tsx`) eliminada da navegação; atalhos de **Ditado Rápido** e **Live Mic API** integrados diretamente no dock do Chat ([`src/components/AgentInputDock.tsx`](../src/components/AgentInputDock.tsx)) com gravação instantânea, transcrição Gemini e resposta traduzida falada automaticamente.
3. **Voz Independente por Card + Sincronização Bidirecional Global**:
   - Adicionado seletor `<select>` de voz neural diretamente no cabeçalho de cada Card de idioma ([`src/components/LanguageColumnCard.tsx`](../src/components/LanguageColumnCard.tsx)) e de cada Card de turno de debate ([`src/components/ScriptViewer.tsx`](../src/components/ScriptViewer.tsx)).
   - Estado `cardVoices: { en, it, ja }` persistido por mensagem em [`src/types/polyglot.ts`](../src/types/polyglot.ts) e [`src/components/PolyglotChatStudio.tsx`](../src/components/PolyglotChatStudio.tsx).
   - Ao clicar/focar um Card ou alterar a voz no Card, a voz global (`selectedVoice` na Sidebar/Header) e o indicador da barra inferior ([`src/components/FloatingCardAudioController.tsx`](../src/components/FloatingCardAudioController.tsx)) sincronizam automaticamente, eliminando conflitos de nomes de vozes na interface.
4. **Exportação Multi-Formato Revisada + Preview ao Vivo + Exportação WAV 24kHz**:
   - Corrigida duplicação de colunas no CSV Anki em [`src/utils/interactionExporter.ts`](../src/utils/interactionExporter.ts) e incluído metadado `cardVoices` nos relatórios Markdown e JSON.
   - Adicionado **Preview ao Vivo do Formato (`<pre>`)**, cópia rápida e exportação de **Áudio Master da Trilogia (`.wav` 24kHz concatenado EN + IT + JA)** em [`src/components/ExportInteractionModal.tsx`](../src/components/ExportInteractionModal.tsx), além de botão de download `.wav` individual em cada Card.
5. **Nitidez Tipográfica, Ícones Vetoriais Lucide (`stroke-width: 1.75`), Zero Emojis e Zero Sobreposições**:
   - Corrigida tipografia embaçada em [`src/index.css`](../src/index.css), [`src/styles/theme.css`](../src/styles/theme.css) e [`index.html`](../index.html): removido `font-weight: 450` (substituído por `400`/`500`/`600`/`700` discretos), aplicado `-webkit-font-smoothing: antialiased` e `-moz-osx-font-smoothing: grayscale`, eliminado deslocamento fracionário `translateY(-1.5px)` / `-translate-y-0.5` e elevado contraste de texto secundário/terciário.
   - Substituída fonte de ligaturas genérica (`Material Symbols Rounded`) em [`src/components/GoogleIcon.tsx`](../src/components/GoogleIcon.tsx) por ícones SVG vetoriais `lucide-react` (`strokeWidth={1.75}`), e removidos todos os emojis da UI (`AUDIT-VIS-EMOJI` = 0 ocorrências).
   - Eliminadas todas as sobreposições de layout:
     - [`src/components/VoiceCardGrid.tsx`](../src/components/VoiceCardGrid.tsx): trocado `lg:grid-cols-5` fixo por `grid-cols-[repeat(auto-fit,minmax(185px,1fr))]` para evitar esmagamento de 5 colunas dentro do painel lateral de debate.
     - [`src/components/LanguageColumnCard.tsx`](../src/components/LanguageColumnCard.tsx): cabeçalho reestruturado em 2 linhas para evitar colisão entre título/badge, seletor `<select>` de voz e botões de ação em larguras intermediárias (`1024px–1360px`).
     - [`src/components/ParallelMessageBlock.tsx`](../src/components/ParallelMessageBlock.tsx): corrigido cálculo de coordenadas de [`src/components/ChunkActionMenu.tsx`](../src/components/ChunkActionMenu.tsx) (`position: fixed` relativo à viewport sem somar `window.scrollY`/`window.scrollX`, com flip automático acima do dock inferior).
     - [`src/App.tsx`](../src/App.tsx), [`src/components/PolyglotChatStudio.tsx`](../src/components/PolyglotChatStudio.tsx) e [`src/components/FastChunkAudioApp.tsx`](../src/components/FastChunkAudioApp.tsx): headers internos configurados como `lg:sticky lg:top-0` para nunca colidirem com o header mobile fixo, além de barra de navegação rápida horizontal no mobile e `pb-40` para respiro sobre o dock.

## Testes Reais e Verificações Auditáveis
- `npm run lint` (`tsc --noEmit`): Exit code `0` (0 erros).
- `npm test` (`tsx test-audio-engine.ts`): Exit code `0` (14/14 suítes Nível 4 aprovadas).
- `npm run build` (`vite build`): Exit code `0` (`dist/` compilado sem warnings).
- `audit_tactile_ui.py`: `Readiness Score: 100.0/100.0` (`A11y: 100.0 | FSM: 100.0 | Tokens/Layers: 100.0 | Sec: 100.0`).
- `deterministic_scorer.py --scan src`: `SGA = 100.0` (`28` nós, `0` órfãos, `26/26` telas com 4 estados, `102/102` funções coesas).

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**: Nenhum.

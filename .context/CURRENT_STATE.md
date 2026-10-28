# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Refatoração Arquitetural Minimalista (`minimal-impact-ui` + `frontend-code-architect` + `arquitetura-design-implementacao-sistema` + `modern-web-guidance` + `code-quality-audit-3d-physics`).
- **Status da Branch**: `main` (Trio de qualidade `npm run lint && npm test && npm run build` 100% verde, 14/14 suítes Nível 4 aprovadas, `audit_tactile_ui.py` = 100.0/100, `deterministic_scorer.py` SGA = 100.0/100, responsividade mobile 375x812 validada via Playwright com `scrollWidth === clientWidth`).

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
5. **Nitidez Tipográfica, Ícones Vetoriais Lucide (`stroke-width: 1.75`), Zero Emojis e Navegação Mobile sem Estouro Horizontal**:
   - Corrigida tipografia embaçada em [`src/index.css`](../src/index.css), [`src/styles/theme.css`](../src/styles/theme.css) e [`index.html`](../index.html): removido `font-weight: 450` (substituído por `400`/`500`/`600`/`700` discretos), aplicado `-webkit-font-smoothing: antialiased` e `-moz-osx-font-smoothing: grayscale`, eliminado deslocamento fracionário `translateY(-1.5px)` / `-translate-y-0.5` e elevado contraste de texto secundário/terciário.
   - Substituída fonte de ligaturas genérica (`Material Symbols Rounded`) em [`src/components/GoogleIcon.tsx`](../src/components/GoogleIcon.tsx) por ícones SVG vetoriais `lucide-react` (`strokeWidth={1.75}`), incluindo mapeamento de `menu: Menu` para o botão hamburger mobile.
   - Eliminadas todas as sobreposições e quebras de layout no modo mobile:
     - [`src/index.css`](../src/index.css): resolvido conflito de especificidade de `.btn-matte` com `.hidden` / breakpoints responsivos (`sm:`, `lg:`, `xl:`) e definidas `.no-scrollbar` / `.scrollbar-none`.
     - [`src/App.tsx`](../src/App.tsx): barra de navegação rápida mobile em `grid-cols-5` dentro de `.pill-nav-shell` com todas as 5 abas 100% visíveis sem corte e sem scrollbar, além de contenção `min-w-0 max-w-full overflow-x-clip`.
     - [`src/components/PolyglotChatStudio.tsx`](../src/components/PolyglotChatStudio.tsx): barra de Vozes Favoritas em grade simétrica de 3 colunas no mobile (`grid-cols-3 !rounded-2xl sm:!rounded-full`), eliminando a cápsula oval deformada e a duplicação do botão "Meu Deck".
     - [`src/components/FloatingCardAudioController.tsx`](../src/components/FloatingCardAudioController.tsx): seletor de idiomas (`EN / IT / JA`) convertido para `grid-cols-3 w-full sm:w-auto` contido 100% dentro do card no mobile.
     - [`src/components/AgentInputDock.tsx`](../src/components/AgentInputDock.tsx): `<textarea>` reestruturado para ocupar 100% da largura na primeira linha do compositor no mobile, com os botões de ação logo abaixo.

## Testes Reais e Verificações Auditáveis
- `npm run lint` (`tsc --noEmit`): Exit code `0` (0 erros).
- `npm test` (`tsx test-audio-engine.ts`): Exit code `0` (14/14 suítes Nível 4 aprovadas).
- `npm run build` (`vite build`): Exit code `0` (`dist/` compilado sem warnings).
- Playwright Mobile (`375x812`): `scrollWidth === clientWidth === 375` em todas as 5 abas (`Poliglota`, `Estúdio`, `Debate`, `Chunks`, `Vozes`).

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**: Nenhum.

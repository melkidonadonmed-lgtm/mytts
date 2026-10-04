# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Refatoração Completa de Paletas Minerais (7 Arquétipos), Neutralização de Botões, Cura Tipográfica Anti-Serrilhamento e Controles Táteis de Áudio.
- **Status da Branch**: `main` (commit `f4587c2` enviado ao GitHub).
- **Deploy**: Em execução para Cloud Run (`us-central1` no projeto `agent-md-506215`).

## Decisões Arquiteturais e Implementações
1. **Clareamento do Fundo e Contraste no Tactile Matte (`src/index.css`)**:
   - Transição do fundo quase preto puro (`#090B0E`) para ardósia mineral profunda (`#12151D`), cartões em `#1A202E`, elevação em `#263044` e bordas com luminosidade sutil (`rgba(255, 255, 255, 0.12)`).
   - Contraste reforçado nos ícones e menus inativos (`#CBD5E1` e `#94A3B8`), acabando com a sensação de escuridão apagada.
2. **Eliminação do Phantom 4K**:
   - Removido completamente de `ArchetypeBar.tsx`, `CommandPaletteModal.tsx` e `src/index.css`.
3. **Novas 6 Paletas Baseadas nas Imagens do Usuário (`src/index.css`, `ArchetypeBar.tsx`, `CommandPaletteModal.tsx`)**:
   - `tactile-matte`: Padrão Melki com ardósia fosca e fundo elevado.
   - `deep-blue`: #050A30 (Canvas) / #0D1645 (Card) / #F4F6FC / #233DFF (Acento).
   - `vangogh`: Van Gogh's Dream (#042698 / #FDFEE9 / #9BD4E4 — Tema Claro Marfim).
   - `mermaid`: Mermaid Lagoon (#051D40 / #0A2B5E / #145DA0 / #56AEFF / #B1D4E0).
   - `cotton-dandelions`: Cotton Dandelions (#1B2612 / #2A3B19 / #3D5919 / #A4B792 / #E6E7E2).
   - `ocean-window`: Ocean Window (#141C26 / #1B426B / #21568A / #1D97BD / #C7CDC0).
   - `nightfall-ambiance`: Nightfall Ambiance (#000B26 / #063360 / #094886 / #2479DF / #73BBEE).
4. **Neutralização dos Botões**:
   - Substituição do laranja saturado (`#D97706` / `#f59e0b`) por botões minerais sóbrios `.btn-matte-primary` com tipografia branca de alto contraste e acabamento tátil sólido.
5. **Cura Tipográfica (Fim do "Craquelado")**:
   - Padronização de botões para `font-sans` (`Inter`), `tracking-normal` e `font-semibold`.
   - Remoção de `active:scale-95` e `active:scale-90` (que causavam interpolação borrada e serrilhamento no Windows), substituindo por deslocamento físico vertical `active:translate-y-px`.
   - Inclusão de diretrizes nativas de antialiasing (`-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`, `text-rendering: optimizeLegibility`).
6. **Botão de Reproduzir Geral com Sotaque na Sound Bar (`BottomAudioDock.tsx`, `App.tsx`)**:
   - Botão central de Play neutro `.btn-matte-primary` com pílula de sotaque/intenção vocal integrada em tempo real.
   - Sound bar acessível tanto no modo debate quanto no leitor com roteiro ativo.
7. **Seleção de Voz por Card Reativada no Debate (`DebateConfigPanel.tsx`)**:
   - Adicionada a grade interativa `VoiceCardGrid` no painel de configuração do debate, permitindo selecionar e atribuir vozes por card para Orador 1 e Orador 2.

## Testes Reais e Verificações Auditáveis
- `npm run lint` (`tsc --noEmit`): Exit code `0`.
- `npm test` (`tsx test-audio-engine.ts`): Exit code `0` (8 suítes com 100% de sucesso).
- `npm run build` (`vite build`): Exit code `0` (bundle gerado com sucesso em 297ms).
- Git commit: `f4587c2` enviado com sucesso para `origin/main`.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**: Nenhum crítico.

## Próximo Ponto de Entrada
- Aguardar finalização do deploy Cloud Run e entregar o resumo executivo e auto-reflexão ao usuário.

# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Deploy em Produção da Revisão do Controlador de Áudio Flutuante e Design Mate Concluído com Sucesso.
- **Status da Branch**: `main` (100% sincronizado com `origin/main`).
- **Revisão Ativa Cloud Run**: `mytts-00007-x9v` (100% do tráfego).
- **URL de Produção**: `https://mytts-1044179901556.us-central1.run.app`.

## Decisões Tomadas
1. **Controlador de Áudio Flutuante Tátil (`src/components/FloatingCardAudioController.tsx`)**:
   - Posicionado logo abaixo dos 3 cards de cada mensagem, eliminando rodapés redundantes de cada coluna que geravam poluição visual extrema.
   - Apresenta pills táteis para focar os idiomas (`[🇺🇸 EN] [🇮🇹 IT] [🇯🇵 JA]`), botão Play/Pause grande tátil (44px) mate que reproduz **apenas** o card selecionado (corrigindo o problema de disparar todos os áudios), scrubber de progresso suave com seekbar, seletor de velocidade (`0.8x`, `1.0x`, `1.25x`), botão de Replay e seletor rápido de voz neural.
   - Modo "Trilogia Sequencial (EN → IT → JA)" disponibilizado como ação explícita e opcional, sem disparos acidentais.
2. **Despoluição e Foco Tátil dos Cards de Idioma (`src/components/LanguageColumnCard.tsx`)**:
   - Cartões com acabamento fosco profundo (`card-matte`), cabeçalho minimalista, badge de foco ativo e preservação do hover sync alinhado de chunks.
   - Remoção de botões duplicados e menus em excesso nos cards.
3. **Conjunto Oficial de Ícones do Google & Google Fonts**:
   - Integração de **Material Symbols Rounded** via CDN no `index.html` e componente tipado reutilizável `src/components/GoogleIcon.tsx`.
   - Adição das fontes Google **Outfit** (títulos e botões táteis), **Inter** / **Plus Jakarta Sans** (corpo de texto de alta densidade) e **JetBrains Mono** (métricas).
4. **Design System Mate & Tátil (`src/index.css`)**:
   - Implementação de classes táteis foscas (`btn-matte`, `btn-matte-amber`, `btn-matte-dark`, `dock-matte`, `card-matte`, `slider-matte`), acabamento fosco aveludado sem reflexos de plástico, e micro-feedback tátil (`:active:translate-y-[1px]`).
5. **Atualização da Suíte de Testes (`test-audio-engine.ts`)**:
   - Adicionado grupo [7/7] comprovando empiricamente o isolamento estrito de card/idioma, mapeamento canônico de vozes e locales (`en-US`/Puck, `it-IT`/Kore, `ja-JP`/Aoede).
6. **Validação e Deploy em Produção**:
   - Revisão `mytts-00007-x9v` servindo 100% do tráfego no Google Cloud Run.
   - Live smoke test comprovado: HTTP 200 no `/api/health` e `/` com `Material+Symbols+Rounded` e `Outfit` ativos.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Adicionar WebSockets para conversação bidirecional streaming ao vivo (Gemini Live API).

## Próximo Ponto de Entrada
- Acompanhar utilização em produção e feedbacks dos usuários sobre o novo controlador flutuante.

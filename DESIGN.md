---
title: MyTTS Studio Design System
version: 8.1.0
status: active
scope: ui-visual-tokens-a11y
updated: 2026-11-22
---

# DESIGN.md — MyTTS Studio Design System (v8.1.0 SSOT)

> **Single Source of Truth (SSOT) Visual e de Interação.**  
> Arquitetura de backend, segurança de rotas, cotas de IA, persistência Firestore e deploy Cloud Run estão documentados em [`.context/context.md`](.context/context.md) e [`design/design.md`](design/design.md).

---

## 1. Filosofia Visual e Presets Canônicos (OKLCH 5-Plane Tactile Matte Mineral)

O MyTTS Studio adota **Tactile Matte Mineral** (iluminação zenital sutil, sombras em 3 camadas, borda especular superior de 1 px e zero `backdrop-filter: blur`) em exatamente dois presets sincronizados via `localStorage` (`mytts_preset` e `mytts_theme`) em [`src/config/tokens.ts`](src/config/tokens.ts) e consolidados via `light-dark()` em [`src/styles/globals.css`](src/styles/globals.css):

| Preset | Modo | Materialidade | 5 Planos OKLCH (`canvas / inset / flat / raised / contrast`) | Destaque Primário (`--accent-point`) |
| :--- | :--- | :--- | :--- | :--- |
| `obsidian` | `dark` | Tactile Matte (carvão-ardósia) | `oklch(0.155 0.012 260)` / `oklch(0.125 0.01 260)` / `oklch(0.195 0.018 262)` / `oklch(0.23 0.02 262)` / `oklch(0.258 0.022 262)` | `oklch(0.71 0.13 225)` |
| `slate` | `light` | Steadfast Stainless (papel-ardósia) | `oklch(0.93 0.01 250)` / `oklch(0.89 0.012 250)` / `oklch(0.955 0.006 250)` / `oklch(0.975 0.005 250)` / `oklch(0.19 0.02 255)` | `oklch(0.57 0.15 240)` |

Invariantes ópticos:
- **Zero `#000000` e zero branco puro (`#FFFFFF`)** como fundo de cards/containers em `slate` (`--surface-raised` usa `oklch(0.975 0.005 250)`).
- **Croma disciplinado (`C <= 0.20`):** todos os tokens OKLCH permanecem abaixo do teto perceptual de saturação, com zero azul cobalto (`#0044FF`, `#0057FF`, `#1D4ED8`, `#233DFF`).
- **Zero glassmorphism (`backdrop-filter: none`)** e zero padrão de pontos no canvas (`--canvas-dot-color: transparent`).
- **Zero `!important` em CSS:** toda estilização de tema opera via `light-dark()`, `[data-theme="light"|"dark"]` (`color-scheme: light dark`) e camadas nativas (`@layer base`, `@layer components`, `@layer utilities`), sem `@theme inline` em tokens mutáveis.

---

## 2. Tokens Semânticos OKLCH (`60-30-10` — SSOT em `src/styles/globals.css`)

| Categoria | Token CSS | Função / Valor Canônico (`light-dark()`) |
| :--- | :--- | :--- |
| Planos Base (60%) | `--surface-canvas`, `--surface-inset` | `light-dark(oklch(0.93 0.01 250), oklch(0.155 0.012 260))` e cavidades `light-dark(oklch(0.89 0.012 250), oklch(0.125 0.01 260))` |
| Cartões e Elevação (30%) | `--surface-flat`, `--surface-raised`, `--surface-contrast` | Containers planos, cards suspensos (`--shadow-elevation-2`) e superfície de contraste inverso |
| Controles >= 3.0:1 | `--border-control` | `light-dark(oklch(0.52 0.02 255), oklch(0.52 0.02 258))` — borda de `.input-sunken` e controles interativos (>= 3.0:1 WCAG 2.2) |
| Bordas e Luz Zenital | `--border-subtle`, `--rim-light`, `--light-zenith` | Divisórias sutis + brilho superior 1 px (`inset 0 1px 0 0 var(--rim-light)`) e profundidade inset suave (sem sombras pretas esmagadas `0.78`) |
| Texto Adaptativo | `--text-primary`, `--text-secondary`, `--text-tertiary` | Hierarquia WCAG AA/AAA com `light-dark()` |
| Acento Âmbar (10% Ação) | `--brand-accent`, `.btn-matte-amber` | `light-dark(oklch(0.52 0.15 55), oklch(0.68 0.16 65))` — CTAs primários, gravação, reprodução ativa e Diretor |
| Acento Cerúleo (Foco/Status) | `--accent-point`, `.btn-matte-primary`, `--border-focus` | `light-dark(oklch(0.57 0.15 240), oklch(0.71 0.13 225))` — `:focus-visible`, seleção ativa e sliders |
| Badges Neutros + Dot 6px | `.status-pill`, `.status-dot`, `--status-*` | **Anti-Slop Confetti:** zero badges arco-íris (`--badge-blue/green/amber/purple-*`). Toda badge usa pill neutro `var(--surface-raised)` + ponto semântico de `6px` (`--status-info`, `--status-success`, `--status-warning`, `--status-danger`) |
| Raio e Escala Espacial | `--radius-lg/md/sm`, `--space-1`..`--space-16` | `18px / 12px / 8px` e grade base-4/base-8 (`4, 8, 12, 16, 24, 32, 48, 64px`) |

---

## 3. Tipografia e Ícones Vetoriais

Carregamento declarativo via Google Fonts em [`index.html`](index.html) com `font-synthesis: none`:

| Papel | Família Canônica (`--font-*`) | Regras de Renderização e Uso |
| :--- | :--- | :--- |
| Display / Títulos | `'Outfit', 'Plus Jakarta Sans', sans-serif` | `h1`, `h2`, `h3` recebem exclusivamente `text-rendering: optimizeLegibility`, `text-wrap: balance` e `letter-spacing: -0.02em` |
| Interface / Leitura | `'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | `html, body` usam `text-rendering: auto` para máxima performance de layout/INP; parágrafos e listas usam `text-wrap: pretty` |
| Dados / Timers / Código | `'IBM Plex Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | Timers, durações e tokens com `font-variant-numeric: tabular-nums` |

- **Ícones SVG (`GoogleIcon`):** Mapeados para vetores `lucide-react` (`strokeWidth={1.75}`) em [`src/components/GoogleIcon.tsx`](src/components/GoogleIcon.tsx). Ícones decorativos recebem `aria-hidden="true"`; ícones informativos recebem `role="img"` e `aria-label`. Fontes de ligatura e glifos Unicode soltos (`✓`, emojis em badges operacionais) são proibidos.

---

## 4. Arquitetura Espacial, Navegação e Módulos

O shell desktop/mobile organiza **5 módulos SPA** (`AppTab`) coordenados por [`src/utils/navigationOrganizer.ts`](src/utils/navigationOrganizer.ts) e [`src/App.tsx`](src/App.tsx):

| Módulo (`AppTab`) | Função | Superfícies Associadas |
| :--- | :--- | :--- |
| `polyglot` | Chat Poliglota Multimodal (EN / IT / JA paralelos + YouTube + Live Mic) | `ParallelMessageBlock`, `AgentInputDock`, `LanguageColumnCard` |
| `voices` | Configuração de Vozes e Estúdio (`catalog`, `solo`, `debate`) | `VoiceConfigWorkspace`, `VoiceCardGrid`, `DebateConfigPanel`, `StudioToolbar` |
| `chunks` | FastChunks — treino lexical em 24 kHz WAV com cache L1/L2 | `FastChunkAudioApp` |
| `study` | Área de Estudo & Flashcards (`decks`, `review`, `create`) | `StudyArenaView`, `StudyDeckOverview`, `FlashcardCatalogManager`, `FlashcardCreatorPanel` |
| `architecture` | Inspetor técnico de pipeline e contrato JSON/Prompt | `ArchitectureModal` (`<dialog>`) |

- **Skip Link GPU (`.skip-link`):** Oculto fora da tela por `transform: translateY(-160%)` e `opacity: 0` até `:focus-visible`, quando desliza para o canto superior esquerdo como pill de alto contraste (`min-block-size: 44px`).
- **Offset dinâmico de sidebars:** `--left-sidebar-w` (`280px` expandida, `68px` colapsada no desktop) e `--right-sidebar-w` (`0px` / `320px`) deslocam o `BottomAudioDock`.
- **Container Queries (`@container`):** Cartões `.ui-card-soft`, `.bento-card-soft` e o grid paralelo de idiomas em `ParallelMessageBlock` respondem à largura real do container, isolados de `subgrid`.
- **Abas roláveis (`.tabsOverflowContainer`):** Barras de abas horizontais usam rolagem horizontal limpa (`scrollbar-width: none`).

---

## 5. Camadas de Empilhamento (`z-index`) e Modais Nativos (`<dialog>`)

Todos os modais (`AuthModal`, `CommandPaletteModal`, `ArchitectureModal`, `ExportInteractionModal`, `FlashcardImporterModal`) utilizam o **Top Layer** nativo via `<dialog>.showModal()` e [`src/utils/nativeDialog.ts`](src/utils/nativeDialog.ts):
- Atributo `closedby="any"` com fallback por coordenadas de ponteiro (`pointerdown` + `pointerup` fora de `getBoundingClientRect()`).
- Reset obrigatório de `dialog.returnValue = ''` no evento `close`.
- Proibido adicionar `role="dialog"` ou `aria-modal="true"` redundantes no `<dialog>` aberto via `showModal()`.

Escala oficial de empilhamento para camadas não-modais:
- `z-10`: cabeçalhos sticky (`MobileAppHeader`, sub-headers)
- `z-20`: `.rail-tooltip` na sidebar recolhida e popovers inline
- `z-30`: `BottomAudioDock` flutuante
- `z-40`: backdrop do drawer mobile
- `z-50`: `Sidebar` e `HistorySidebar` fixos
- `z-60`: `.skip-link` focado
- **Top Layer nativo:** `<dialog>:modal` + `::backdrop`

---

## 6. Física Tátil e Semântica de Interação

### 6.1 Físicas de Superfície, Elevação e Luz Zenital

- `.card-matte` aplica `--light-zenith`, `isolation: isolate` e `--shadow-elevation-2`. Elevação no hover (`:not(dialog):not([role="dialog"]):hover`) sobe para `--shadow-elevation-3` e `--light-zenith-hover`.
- Controles comprimíveis usam `active:translate-y-px` e mola `--ease-spring: cubic-bezier(0.22, 1, 0.36, 1)`.
- `@media (prefers-reduced-motion: reduce)` zera transições, animações e `::view-transition-*`.

### 6.2 Ordem de Estados Link/Foco (`LVHA`)

Definida em [`src/styles/globals.css`](src/styles/globals.css):
1. `a:link` (`--accent-point`, sem sublinhado)
2. `a:visited` (`color-mix` com `--text-secondary`)
3. `a:hover` (`text-decoration: underline`, `text-underline-offset: 4px`)
4. `:focus-visible` (`outline: 2px solid var(--border-focus)`, `outline-offset: 2px`)
5. `a:active` (`--btn-primary-active`)

Proibido aninhar elementos interativos (`<button>` ou `<span>` clicável dentro de `<div role="radio">` ou `<div onClick>`).

---

## 7. Ergonomia, Alvos de Toque (`>= 44px`), FSM e Ciclo de Mídia

### 7.1 Ergonomia Motora e Alvos de Toque

- **Alvo padrão (`>= 44x44px`):** Controles interativos principais, itens de navegação e botões utilitários atendem ao piso mínimo de `44x44px` em telas touch (`pointer: coarse`), subindo para `48x48px` em CTAs primários (`.btn-matte-amber`, `.btn-matte-primary`).
- **Exceção inline:** Chips inline de leitura (`.chunk-inline-btn`) preservam o fluxo textual sem inflar a altura de linha.

### 7.2 Máquina de Estados (5-State FSM) e Segurança XSS

Todo card governado por [`src/components/ui/SoftCard.tsx`](src/components/ui/SoftCard.tsx) resolve deterministicamente 1 estado por vez (`resolveCardFSMState`):
`error > loading > empty > pressed > idle`
- Sanitização de títulos (`sanitizeCardTitle`) remove tags HTML (`<[^>]*>`) e proíbe `dangerouslySetInnerHTML`.

### 7.3 Ciclo de Memória de Áudio e Fallbacks Visuais

- **Blob URLs (`revokeAudioUrl`):** Todo `URL.createObjectURL` em `VoiceCardGrid` e `FastChunkAudioApp` é revogado na conclusão (`onended`), falha (`onerror`), preempção e desmontagem (`useEffect` cleanup).
- **Orçamento de Manutenibilidade CSS:** `src/styles/globals.css` e `src/index.css` permanecem estritamente `<= 600` linhas cada, com zero `!important`.

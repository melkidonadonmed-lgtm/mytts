---
title: MyTTS Studio Design System
version: 8.0.0
status: active
scope: ui-visual-tokens-a11y
updated: 2026-11-18
---

# DESIGN.md — MyTTS Studio Design System (v8.0.0 SSOT)

> **Single Source of Truth (SSOT) Visual e de Interação.**  
> Arquitetura de backend, segurança de rotas, cotas de IA, persistência Firestore e deploy Cloud Run estão documentados em [`.context/context.md`](.context/context.md) e [`design/design.md`](design/design.md).

---

## 1. Filosofia Visual e Presets Canônicos

O MyTTS Studio adota **Tactile Matte** (iluminação zenital sutil, sombras em 3 camadas, borda especular superior de 1 px e zero `backdrop-filter: blur`) em exatamente dois presets sincronizados via `localStorage` (`mytts_preset` e `mytts_theme`) em [`src/config/tokens.ts`](src/config/tokens.ts) e [`src/styles/theme.css`](src/styles/theme.css):

| Preset | Modo | Materialidade | Superfícies Base (`canvas / inset / flat / raised / contrast`) | Destaque Primário (`--accent-point`) |
| :--- | :--- | :--- | :--- | :--- |
| `obsidian` | `dark` | Tactile Matte (carvão-ardósia) | `#0A0C10` / `#06070A` / `#13161F` / `#191D29` / `#1E2330` | `oklch(0.71 0.13 225)` (`#35ACD8`) |
| `slate` | `light` | Steadfast Stainless (papel-ardósia) | `#E4E9EF` / `#D5DCE4` / `#EEF2F6` / `#F5F7FA` / `#11161F` | `oklch(0.57 0.15 240)` (`#0284C7`) |

Invariantes de superfície:
- Zero branco puro (`#FFFFFF`) como fundo de cards ou containers em `slate` (`--surface-raised` usa `oklch(0.975 0.005 250)`).
- Zero glassmorphism (`backdrop-filter: none`), zero padrão de pontos no canvas (`--canvas-dot-color: transparent`) e zero azul cobalto saturado (`#0044FF`, `#0057FF`, `#1D4ED8`, `#233DFF`).

---

## 2. Tokens Semânticos OKLCH (`60-30-10`)

Definidos em [`src/styles/globals.css`](src/styles/globals.css) e mapeados em [`src/index.css`](src/index.css):

| Categoria | Token CSS | Função / Valor Canônico |
| :--- | :--- | :--- |
| Canvas e Cavidades | `--surface-canvas`, `--surface-inset` | Fundo global (60%) e trilhos embaixo-relevo com `--shadow-inset` |
| Cartões e Elevação | `--surface-flat`, `--surface-raised`, `--surface-contrast` | Containers planos, cards suspensos (`--shadow-elevation-2`) e contraste inverso (30%) |
| Texto Adaptativo | `--text-primary`, `--text-secondary`, `--text-tertiary` | Hierarquia WCAG AA/AAA usando `oklch(...)` com ajuste em `[data-theme="light"]` |
| Bordas e Luz Zenital | `--border-subtle`, `--rim-light`, `--light-zenith` | Borda de baixa opacidade + brilho superior 1 px (`inset 0 1px 0 0 var(--rim-light)`) |
| Acento Âmbar (Ação) | `--brand-accent`, `.btn-matte-amber` | **CTAs primários, gravação, reprodução ativa, controles do Diretor e microfone** (10%) |
| Acento Cerúleo (Foco/Status) | `--accent-point`, `.btn-matte-primary`, `--border-focus` | **Anéis `:focus-visible`, estados de seleção secundária, sliders e badges técnicas** |
| Raio de Borda | `--radius-lg`, `--radius-md`, `--radius-sm` | `18px` (cards/modais), `12px` (subcards/docks/inputs), `8px` (botões compactos/tags) |
| Escala Espacial | `--space-1` .. `--space-16` | Grade base-4/base-8 (`4, 8, 12, 16, 24, 32, 48, 64px`) |

---

## 3. Tipografia e Ícones Vetoriais

Carregamento declarativo via Google Fonts em [`index.html`](index.html) com `font-synthesis: none` e `text-rendering: optimizeLegibility`:

| Papel | Família Canônica (`--font-*`) | Regras de Uso |
| :--- | :--- | :--- |
| Display / Títulos | `'Outfit', 'Plus Jakarta Sans', sans-serif` | `h1`–`h4`, títulos de cards (`text-wrap: balance`, `letter-spacing: -0.02em`) |
| Interface / Leitura | `'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | Corpo, formulários e legendas (`text-wrap: pretty`) |
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

- **Offset dinâmico de sidebars:** `--left-sidebar-w` (`280px` expandida, `68px` colapsada no desktop) e `--right-sidebar-w` (`0px` / `320px`) deslocam o `BottomAudioDock` via `lg:left-[var(--left-sidebar-w)] lg:right-[var(--right-sidebar-w)]`.
- **Container Queries (`@container`):** Cartões `.ui-card-soft`, `.bento-card-soft` e o grid paralelo de idiomas em `ParallelMessageBlock` (`@container` + `@min-[720px]:grid-cols-3`) respondem à largura real do container, não apenas ao viewport.
- **Abas roláveis (`.tabsOverflowContainer`):** Barras de abas horizontais (`VoiceConfigWorkspace`, `StudyArenaView`) usam `.tabsOverflowContainer` com rolagem horizontal sem barra visível (`scrollbar-width: none`).

---

## 5. Camadas de Empilhamento (`z-index`) e Modais Nativos (`<dialog>`)

Todos os modais (`AuthModal`, `CommandPaletteModal`, `ArchitectureModal`, `ExportInteractionModal`, `FlashcardImporterModal`) utilizam o **Top Layer** nativo via `<dialog>.showModal()` e o hook compartilhado [`src/utils/nativeDialog.ts`](src/utils/nativeDialog.ts):
- Atributo `closedby="any"` com fallback por coordenadas de ponteiro (`pointerdown` + `pointerup` fora de `getBoundingClientRect()`) quando `!('closedBy' in HTMLDialogElement.prototype)`.
- Reset obrigatório de `dialog.returnValue = ''` no evento `close`.
- Proibido adicionar `role="dialog"` ou `aria-modal="true"` redundantes no `<dialog>` aberto via `showModal()`, bem como aplicar `display: flex` incondicional ao elemento `<dialog>` fechado.

Escala oficial de empilhamento para camadas não-modais:
- `z-10`: cabeçalhos sticky (`MobileAppHeader`, sub-headers)
- `z-20`: `.rail-tooltip` na sidebar recolhida e popovers inline
- `z-30`: `BottomAudioDock` flutuante
- `z-40`: backdrop do drawer mobile
- `z-50`: `Sidebar` e `HistorySidebar` fixos
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

Proibido aninhar elementos interativos (`<button>` ou `<span>` clicável dentro de `<div role="radio">` ou `<div onClick>`). Cartões com múltiplas ações (`VoiceCardGrid`, `BottomAudioDock`) usam `<article>` ou `<div>` neutro com `<button type="button">` irmãos.

---

## 7. Ergonomia, Estados e Ciclo de Mídia

### 7.1 Ergonomia Motora e Alvos de Toque

- **Ações primárias (`.btn-matte-amber`, `.btn-matte-primary`):** mínimo `48x48px` em dispositivos `pointer: coarse` e altura mínima de `40px–44px` no dock compositor desktop/mobile (`AgentInputDock`).
- **Ações utilitárias e compactas (`.btn-compact-touch`, preview de voz, botões de barra):** mínimo `40x40px`. Chips inline de leitura (`.chunk-inline-btn`) preservam fluxo inline sem inflar altura de linha.

### 7.2 Máquina de Estados (5-State FSM) e Segurança XSS

Todo card governado por [`src/components/ui/SoftCard.tsx`](src/components/ui/SoftCard.tsx) e [`src/types/index.ts`](src/types/index.ts) resolve deterministicamente 1 estado por vez (`resolveCardFSMState`):
`error > loading > empty > pressed > idle`
- Sanitização de títulos (`sanitizeCardTitle`) remove tags HTML (`<[^>]*>`), normaliza espaços e proíbe `dangerouslySetInnerHTML`.
- Elementos estruturais passivos (`<aside>`, `ParallelMessageBlock`, `GoogleIcon`) não emitem `data-state="idle"` estático.

### 7.3 Ciclo de Memória de Áudio e Fallbacks Visuais

- **Blob URLs (`revokeAudioUrl`):** Todo `URL.createObjectURL` em `VoiceCardGrid` e `FastChunkAudioApp` é revogado na conclusão (`onended`), falha (`onerror`), preempção por novo chunk e desmontagem (`useEffect` cleanup).
- **Imagens e falhas de mídia:** Thumbnails e avatares (`UserSessionPopover`, `ParallelMessageBlock`, `AgentInputDock`) declaram `width`/`height`, `loading="lazy"`, `decoding="async"` e fallback React em `onError`; falhas de áudio/PDF expõem feedback em `role="alert"`.

---

## Adendo H — Contraste Claro, Zero Glassmorphism e Anti-Whiteout

1. **Zero `backdrop-filter: blur`:** Superfícies flutuantes e barras são opacas (`var(--surface-raised)` / `var(--surface-flat)`).
2. **Proibição de branco puro em `[data-theme="light"]`:** Seletores de dock, sidebar e cards no tema claro apontam para `var(--surface-raised)` ou `var(--surface-flat)` em [`src/index.css`](src/index.css), nunca `#ffffff !important`.
3. **Alinhamento Zero-FOUC:** `index.html` e `syncThemeFromStorage` (`src/App.tsx`) derivam `theme` a partir de `mytts_preset` (`SOFT_UI_PRESETS[normalizedPreset].mode`) quando presente.

## Adendo I — Auditoria Automatizada (`Suite 13` e `Suite 25`)

O contrato visual e estrutural é verificado em [`tests/audio-engine.test.ts`](tests/audio-engine.test.ts):
- **Suite 13:** Valida `DESIGN_SYSTEM_VERSION === '8.0.0'`, precedência `error > loading > empty > pressed > idle` em `resolveCardFSMState`, stripping de tags em `sanitizeCardTitle`, presets `obsidian`/`slate` em `resolvePresetTokens` e `getBentoSpanClass(8) === 'col-span-1 md:col-span-8'`.
- **Suite 25:** Executa varredura estática sobre `src/**/*.{ts,tsx,css}` garantindo zero `backdrop-filter: blur`/`backdrop-blur` ativo, zero hex cobalto proibido (`#0044FF`, `#0057FF`, `#1D4ED8`, `#233DFF`), zero `bg-black` / `#000000` (`OPTICS-NO-BLACK`), zero `border-dashed` em `src/components/**` (`ANTI-SLOP-WIREFRAME`), zero `background: #ffffff !important` em `src/index.css`, zero `dangerouslySetInnerHTML`, zero `order-*` em controles focáveis e zero `<div ... onClick` / `<span ... onClick` em `VoiceCardGrid.tsx` e `BottomAudioDock.tsx`.

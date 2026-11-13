# Sistema de Design: MyTTS Studio (`mytts`)
---
version: "8.0.0"
name: "Minimalist Tactile Prestige + MyTTS Studio Operations (v8.0.0)"
tier: "tier_3_fullstack_app_router_pwa"
archetypes:
  primary: "3.3 Workbench Split-View (Editor / Chat Poliglota / Trilha + Canvas de Síntese)"
  secondary: "3.2 Dashboard Analítico & Bento Grid (Nexus Bento Grid 12 Colunas)"
colors:
  surface-canvas: "#1A1D24"     # Layer 0: Escuro Fosco (obsidian default; #E6E9EE no Claro Fosco / slate)
  surface-inset:  "#14171D"     # Layer 1: Cavidade física fosca (inputs/trilhos; #DCE0E6 no Claro Fosco)
  surface-flat:   "#21252E"     # Layer 2: Placa intermediária fosca (#EEF0F4 no Claro Fosco)
  surface-raised: "#272C37"     # Layer 3: Placa elevada fosca sem brilho especular (#F4F5F7 no Claro Fosco)
  surface-contrast: "#111419"   # Layer 4: Âncora de inversão tonal (#1B2028 no Claro Fosco)
  text-primary:   "#E8ECF2"     # Tinta primária de alto contraste (#1A2029 no Claro Fosco)
  text-secondary: "#9AA4B6"     # Tinta secundária para metadados (#525E70 no Claro Fosco)
  accent-point:   "#35acd8"     # Destaque focal Sky/Cerulean (10% max — Zero Azul Cobalto; #0284C7 no Claro Fosco)
  accent-sapphire: "#0284C7"    # Cerulean Sapphire canônico
  accent-amber:   "#D97706"     # Energia vocal de estúdio (Âmbar Mineral; #B45309 no Claro Fosco)
  accent-emerald: "#10B981"     # Indicador semântico de estabilidade e áudio online (#059669 no Claro Fosco)
presets:
  obsidian: { canvas: "#1A1D24", flat: "#21252E", raised: "#272C37", inset: "#14171D", accent: "#35acd8" }
  slate:    { canvas: "#E6E9EE", flat: "#EEF0F4", raised: "#F4F5F7", inset: "#DCE0E6", accent: "#0284C7" }
skills_integrated:
  - design-md (v8.0.0): Contrato Canônico 9 Seções + Adendos A–I, OKLCH 3 Camadas, 60-30-10 e @container
  - plan-uiux (v1.1.0): Auditoria Estrutural REA + Mutação Antes/Depois + Arquitetura CSS Moderna
  - frontend-code-architect (v4.0.0): Design Atômico em 5 camadas + src/ modular
  - frontend-testing-auditor (v2.5.0): Auditoria Axe-Core + FSM + Anti-Glassmorphism (AUDIT-VIS-01)
  - code-quality-audit-3d-physics (v1.0.0): Validação numérica/DSP Web Audio API e Snorm = 100.0
---

## 1. Visão Geral e Tema Visual (Overview & Visual Theme)
O **MyTTS Studio** (`mytts`) adota uma estética de **Estação de Trabalho de Áudio Neural de Alta Precisão** (*Minimalist Tactile Prestige + Studio Operations*), combinando o arquétipo **Workbench Split-View** (Chat Poliglota Multimodal EN/IT/JA, Leitor Neural com *Director's Chair*, Estúdio Dialético de 2 Vozes e FastChunks) com **Nexus Bento Grid** e **Thumb-Zone Audio Dock**.
- **Atmosfera Sensorial e Polaridade:** Superfície padrão **Cinza Studio Monolítico** (`#57545d` canvas, `#49464f` flat, `#635f6a` raised e barra de navegação em pílula `#8e8999` com tinta escura `#16151A`), alternável em tempo real sem FOUC para **Claro Editorial Moderno (*Ad Lucem*)** (`#F3F3F5` canvas + `#FFFFFF` puro nos cards + Cerulean `#0284C7`), **Moss Organic** (`#F4F3EC` + `#174930`) e **Terminal IBM Deep Dark** (`#070709` + `#101014`).
- **Invariante Anti-Glassmorphism e Anti-Cobalto (`AUDIT-VIS-01`):** Zero ocorrências de `backdrop-filter: blur()` (`backdrop-blur-*`), zero brilhos neon e zero azul cobalto elétrico (`#0044FF`, `#0057FF`, `#1D4ED8`, `#233DFF`) em todo o diretório `src/`.
- **Inspirações de Referência:** **ElevenLabs Studio** (clareza operacional de síntese vocal e biblioteca de vozes), **Linear** (densidade funcional, comando rápido `Ctrl+K` e atalhos de teclado) e **Teenage Engineering / Braun** (física tátil de botões pressionáveis, iluminação zenital de 135° e contadores `tabular-nums`).

---

## 2. Paleta de Cores e Tokens Semânticos (Color Palette & Roles)
A paleta utiliza o espaço de cor perceptual **OKLCH** com arquitetura de **Tokens em 3 Camadas** (Primitivos -> Semânticos -> Componentes) e funções nativas `light-dark()` e `color-mix()`.

### 2.1 Regra de Proporção 60-30-10 e Economia Tonal 98/2
- **60% Dominante (Superfície de Fundo / Canvas):** `--bg-app` / `--surface-canvas` (`#57545d` no Studio Monolítico, `#F3F3F5` no Ad Lucem, `#070709` no Terminal IBM) — área de respiro visual contínuo sem fadiga ocular.
- **30% Secundária (Cards, Painéis, Sidebar e Bento):** `--bg-surface` / `--bg-card` / `--surface-raised` (`#635f6a` / `#49464f` no Studio, `#FFFFFF` no Ad Lucem, `#101014` no Terminal IBM) e `--surface-inset` (`#3e3b44` / `#E8E8EE`) — agrupamento estrutural com iluminação direcional a 135° e `1px` de luz especular superior (`--rim-light`).
- **10% Destaque / Acento (CTAs Primários, Energia Vocal e Estados Ativos):** `--brand-primary` / `--accent-point` (`#35acd8` / `#0284C7` Cerulean Sapphire) e `--brand-accent` (`#D97706` Âmbar Mineral para síntese e reprodução ativa) — foco de conversão única por região visual.

### 2.2 Progressão de Luminosidade em Modo Escuro e Monolítico
Em temas escuros e monolíticos, a profundidade e a elevação são expressas por **superfícies progressivamente mais claras** na coordenada $L$ do OKLCH (quanto mais próximo do usuário no eixo Z, maior a luminosidade $L$), combinadas com uma borda interna superior sutil (`inset 0 1px 0 0 var(--rim-light)`).

### 2.3 Tabela Canônica de Tokens (3 Camadas)
```css
:root {
  color-scheme: light dark;

  /* CAMADA 1: Tokens Primitivos (OKLCH + Escala Modular Base-4 / Base-8) */
  --primitive-gray-500: oklch(0.45 0.015 295);
  --primitive-gray-600: oklch(0.40 0.015 295);
  --primitive-gray-700: oklch(0.36 0.015 295);
  --primitive-gray-400: oklch(0.49 0.015 295);
  --primitive-sky-500: oklch(0.71 0.13 225);
  --primitive-amber-500: oklch(0.68 0.16 65);

  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */

  /* CAMADA 2: Tokens Semânticos (60-30-10 & Progressão de Luminosidade L) */
  --brand-primary: var(--accent-point);
  --brand-accent: var(--primitive-amber-500);

  /* 60% Fundo Principal (Layer 0) */
  --bg-app: var(--surface-canvas);
  /* 30% Superfícies Secundárias e Elevadas (Layers 1–3) */
  --bg-surface: var(--surface-flat);
  --bg-card: var(--surface-raised);
  --surface-sunken: var(--surface-inset);

  /* Tipografia e Bordas com Contraste Perceptual Garantido */
  --text-main: var(--text-primary);
  --ink-primary: light-dark(oklch(0.18 0.01 285), oklch(0.97 0.005 285));
  --ink-secondary: light-dark(oklch(0.36 0.01 285), oklch(0.90 0.01 285));
  --border-subtle: color-mix(in oklab, var(--text-primary) 14%, transparent);
  --border-focus: var(--accent-point);

  /* CAMADA 3: Tokens de Componentes */
  --btn-primary-bg: var(--accent-point);
  --btn-primary-hover: color-mix(in oklab, var(--accent-point) 88%, black);
  --btn-primary-active: color-mix(in oklab, var(--accent-point) 78%, black);
  --card-radius: var(--radius-lg);
  --card-padding: var(--space-6);
}
```

---

## 3. Tipografia e Hierarquia Escaneável (Typography & Hierarchy)
- **Famílias Tipográficas:**
  - `--font-display`: `'Outfit'`, `'Plus Jakarta Sans'`, system-ui, sans-serif (títulos de ilha, cabeçalhos e controles táteis).
  - `--font-sans`: `'Inter'`, `'Plus Jakarta Sans'`, system-ui, sans-serif (leitura contínua, roteiros dialéticos e colunas poliglotas EN/IT/JA).
  - `--font-mono`: `'JetBrains Mono'`, monospace (telemetria de áudio, durações `00:00`, frequências `24 kHz` / `44.1 kHz`, velocidades `1.0x` e ganhos em `dB`).
- **Escala Tipográfica Fluida (`clamp()`) e Comprimento de Linha:**
  - Display / Hero: `clamp(1.75rem, 2.5vw + 1rem, 2.5rem)`, `font-weight: 700`, `line-height: 1.15`, `letter-spacing: -0.025em`, `text-wrap: balance`.
  - Título de Ilha (`.fluid-island-title`): `clamp(1rem, 2.5cqi + 0.65rem, 1.375rem)`, `line-height: 1.2`, `letter-spacing: -0.02em`, `text-wrap: balance`.
  - Corpo (`.prose-measure`): `clamp(0.875rem, 0.4vw + 0.75rem, 1rem)`, `line-height: 1.65`, largura de leitura contida em `max-inline-size: 65ch` (`text-wrap: pretty`).
- **Nitidez de Renderização e Alinhamento Tabular:**
  - `-webkit-font-smoothing: antialiased`, `text-rendering: optimizeLegibility` e `font-synthesis: none`.
  - `font-variant-numeric: tabular-nums` obrigatório em todos os timers de gravação, scrubbers de áudio, contadores de caracteres, durações de turnos e badges de latência (`0ms`).

---

## 4. Layout, Grid e Espaçamento (Layout, Grid & Spacing)

### 4.1 Fundamentos do Box Model, Propriedades Lógicas e Prevenção de Colapso de Margem
- **Dimensionamento Universal:** Todo elemento utiliza `box-sizing: border-box`.
- **Propriedades Lógicas para Internacionalização:** Uso prioritário de `margin-block`, `margin-inline`, `padding-block`, `padding-inline`, `inline-size` e `block-size` (suporte nativo aos textos em Inglês, Italiano e Japonês no Chat Poliglota e FastChunks).
- **Prevenção de Colapso de Margens Verticais:**
  1. Espaçamento entre elementos irmãos é controlado pelo contêiner pai via `gap` em layouts Flexbox e CSS Grid.
  2. Fluxo de texto editorial utiliza margem em direção única (`margin-block-start` via `.prose > * + *`).
  3. Contêineres independentes estabelecem um *Block Formatting Context* (`display: flow-root` via `.bfc-flow-root`).
- **Alinhamento entre Ordem do DOM e Ordem Visual (Invariante WCAG 1.3.2 & 2.4.3):** A ordem dos elementos no código HTML reflete **estritamente** a ordem visual e de leitura. É **proibido** usar `order-*` no Flexbox/Grid para reordenar controles focáveis (como na barra de entrada [`AgentInputDock.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/AgentInputDock.tsx)).

### 4.2 Sistemas de Grid, Container Queries (`@container`) e Raios Concêntricos
- **Shell Estrutural:** Sidebar persistente (`272px` em desktop, drawer em mobile) + área principal fluida + `BottomAudioDock` fixo na *Thumb Zone*.
- **Container Queries (`@container`):** Cards e ilhas funcionais declaram `container-type: inline-size; container-name: cardComponent;` (`.cardContainer`, `.island-container`, `.ui-card-soft`), adaptando seu layout interno à largura real da coluna (ex.: as 3 colunas paralelas EN/IT/JA em [`ParallelMessageBlock.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/ParallelMessageBlock.tsx)).
- **Harmonia de Raios Concêntricos:** Quando um card arredondado contém um elemento interno com padding, o raio interno obedece à relação geométrica:
  $$R_{\text{interno}} = \max(0, R_{\text{externo}} - P_{\text{padding}})$$
  Exemplo: Card externo com `--radius-lg: 20px` e padding de `6px` utiliza raio interno `--radius-md: 14px`.

---

## 5. Componentes, Elevação e Microinterações (Components, Elevation & Motion)

### 5.1 Sistema de Sombras em 3 Níveis e Iluminação Zenital (135°)
A luz incide de cima (90° a 135°), projetando sombras compostas de múltiplas camadas com `isolation: isolate` e `1px` de borda especular superior (`--rim-light`):
- **Nível 1 (`--elevation-low` / `--shadow-elevation-1`):** Cards interativos em repouso e botões secundários.
- **Nível 2 (`--elevation-medium` / `--shadow-elevation-2` / `--shadow-card`):** Cards Bento (`.ui-card-soft`, `.card-matte`), dropdowns e painéis ativos.
- **Nível 3 (`--elevation-high` / `--shadow-elevation-3` / `--shadow-float`):** Modais (`CommandPaletteModal`, `VoiceLibraryModal`, `ExportInteractionModal`, `ArchitectureModal`), `FloatingCardAudioController` e `BottomAudioDock`.
- **Cavidade Física (`--shadow-inset` / `.surface-inset`):** Inputs, scrubber de áudio, badges em baixo-relevo e berço do item ativo na sidebar (`#sidebar-active-tracker`).

### 5.2 As 4 Variantes de Cards e Cobertura dos 5 Estados de Dados (FSM)
- **Variantes:** `.card-elevated` (destaque principal), `.card-outlined` (borda sutil `1px solid var(--border-subtle)`), `.card-filled` (agrupamento secundário `--surface-flat`) e `.card-interactive` (clicável com feedback físico).
- **Máquina de Estados Finitos (`AUDIT-STATE-01`):** Todo componente de dados ([`SoftCard.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/ui/SoftCard.tsx), [`LanguageColumnCard.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/LanguageColumnCard.tsx), [`VoiceCardGrid.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/VoiceCardGrid.tsx)) implementa os 5 estados: `idle`, `loading` (skeleton/spinner com `aria-busy="true"`), `empty` ( orientador com CTA claro), `error` (`role="alert"` acionável) e `pressed` (`data-state="pressed"`).

### 5.3 Física de Movimento e Restrição de Desfoque em Animações GPU
- **Curvas de Aceleração:** `--ease-spring: cubic-bezier(0.22, 1, 0.36, 1)` para entradas e elevações; `--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)` para transições de estado.
- **Nitidez Anti-Borrão:** Proibido usar `scale()` fracionário em cards contendo texto denso. O feedback tátil utiliza exclusivamente `transform: translateY(-1px)` / `translateY(-2px)` no `:hover` e `transform: translateY(0px)` / `translateY(1px)` no `:active`, além de respeitar integralmente `@media (prefers-reduced-motion: reduce)`.

---

## 6. Arquitetura de Navegação e Fluxos (Navigation Architecture)
O sistema organiza a locomoção espacial em **3 Camadas Independentes**:
1. **Camada 1 — Navegação Global Primária ([`Sidebar.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/Sidebar.tsx)):** 5 módulos principais com transição de estado via View Transitions API, indicador `#sidebar-active-tracker` em `surface-inset` e `aria-current="page"`:
   - `polyglot`: **Chat Poliglota IA** (EN · IT · JA + Live Mic integrado) — módulo padrão inicial.
   - `reader`: **Estúdio de Voz** (Solo 1 Voz + Conversa 2 Vozes + *Director's Chair*).
   - `debate`: **Debate IA** (Roteirização Dramatúrgica Antagônica + Síntese Multi-Turno).
   - `chunks`: **FastChunks** (Treinamento Lexical com Repetição Espaçada e Shadowing Loop).
   - `voices`: **Vozes Neurais** (Catálogo interativo das 5 vozes Gemini com preview de 3s).
2. **Camada 2 — Navegação Local / Contextual:** Seletor de modo Solo vs. Conversa, abas da gaveta do `BottomAudioDock` (*Voz & Prosódia* vs. *Trilha Sonora & Auto-Ducking*) e filtros de idioma (`EN`, `IT`, `JA`) com `.tabsOverflowContainer`.
3. **Camada 3 — Navegação Estrutural (Breadcrumbs + Command Palette):**
   - Trilha hierárquica em `<nav aria-label="Caminho de navegação"><ol class="breadcrumb-list breadcrumbsList">` no topo do workspace.
   - Paleta de comandos global (`Ctrl+K` / `Cmd+K` em [`CommandPaletteModal.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/CommandPaletteModal.tsx)) onde cada resultado é um `<button type="button">` semântico navegável por setas `↑↓` e `Enter`.
4. **Ordem de Estados de Links (LVHA):** `:link` -> `:visited` -> `:hover` -> `:focus-visible` -> `:active`.

---

## 7. Diretrizes de Implementação, Acessibilidade e Anti-Padrões (Do's & Don'ts)

### O que Fazer (Do's)
- **Lei de Fitts e Alvos de Toque:** Garantir área mínima de `44x44px` em desktop e `48x48px` em dispositivos de ponteiro impreciso (`@media (any-pointer: coarse)`) para todos os controles primários.
- **Semântica Interativa Estrita (`AGENTS.md`):** Todo controle clicável (itens do `CommandPaletteModal`, blocos lexicais interativos em `LanguageColumnCard`, seletores de voz, botões de ação) DEVE ser um `<button type="button">` ou `<button type="submit">` com handler real — **proibido `<div onClick>` ou `<span onClick>` sem semântica**.
- **Foco Visível Universal:** Preservar `:focus-visible` com `outline: 2px solid var(--accent-point); outline-offset: 3px;`.
- **Zero Emojis na Interface:** Utilizar exclusivamente ícones vetoriais SVG ([`GoogleIcon.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/GoogleIcon.tsx) / `lucide-react`) e siglas tipográficas monoespaçadas (`EN`, `IT`, `JA`) nos controles visuais da interface.

### Anti-Padrões Proibidos (Don'ts)
- **Proibido Reordenar Controles Focáveis com `order-*`:** Nunca divergir a ordem visual da ordem do DOM em barras de ferramentas ou formulários.
- **Proibido Glassmorphism e Azul Cobalto:** Zero `backdrop-blur-*` e zero `#0044FF`/`#1D4ED8`.
- **Proibido Data URIs Longas para Áudio:** Sempre converter áudio base64 em `Blob` + `URL.createObjectURL(blob)` e revogar com `URL.revokeObjectURL(url)`.
- **Proibido Texto Longo sem Limite de Medida:** Nunca permitir linhas de leitura acima de `75ch`.

---

## 8. Arquétipos de Interface e Níveis de Complexidade (Interface Archetypes & Complexity Tiers)
- **Nível de Complexidade:** `tier_3_fullstack_app_router_pwa` (Full-Stack React 19 + Express + Web Audio API + Firestore + Gemini 3.1 Flash TTS / 3.8 Flash).
- **Arquétipos Combinados:**
  - **3.3 Workbench Split-View:** Trilha tripla sincronizada no `PolyglotChatStudio` (Inglês, Italiano e Japonês lado a lado com sincronia de hover por chunk e controlador flutuante) + `StudioWorkspace` (editor de texto/PDF + painel de calibração prosódica e grade de vozes).
  - **3.2 Dashboard Analítico & Bento Grid:** `BentoGridShell` de 12 colunas e `FastChunkAudioApp` com cards auto-adaptativos via CSS Grid RAM (`repeat(auto-fit, minmax(min(100%, 280px), 1fr))`) e `subgrid`.

---

## 9. Engenharia de Espaço, Densidade e Real-State (Viewport Budget & Density Architecture)
- **Orçamento de Viewport (*Viewport Budget*):**
  - Chrome de navegação e barras fixas (Topbar compacta + Sidebar + `BottomAudioDock` recolhido) ocupam `< 20%` da área útil do viewport; `> 80%` é dedicado ao canvas de trabalho (Chat Poliglota, Editor de Roteiro ou Grid de FastChunks).
  - Ao menos 25% da área do canvas permanece como espaço aberto (`--surface-canvas`) para sustentar o **Squint Test** em 3 níveis (1º CTA Primário / Player Ativo -> 2º Agrupamento de Cards -> 3º Metadados Secundários).
- **Teto de Densidade por Card:** Máximo de **3 a 4 pontos de dados** por card (ex.: Badge do Idioma + Seletor de Voz/Play + Texto Alinhado + Status de Cache `0ms`). Detalhes secundários (exportação Anki/CSV/Markdown, configurações de Auto-Ducking `-8dB`/`-14dB`/`-20dB` e trilhas procedurais) residem em gavetas e popovers sob demanda (*Progressive Disclosure*).
- **Responsividade Zero-Overflow:** Em viewports móveis de `375px` a desktops ultrawide de `1440px+`, `document.documentElement.scrollWidth === document.documentElement.clientWidth` (zero overflow horizontal).

---

## Adendos Técnicos de Implementação (Addenda A–I — `v8.0.0`)

### Adendo A: Padrões Avançados de Microlayout (Bento Grid RAM, Subgrid, Scroll Snap e Tabs)
Implementados em [`src/styles/globals.css`](file:///c:/Users/melki/dev/repos/mytts/src/styles/globals.css):
- `.bentoGrid`: `display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: var(--space-6);`
- `.bentoCardSubgrid`: `grid-row: span 3; display: grid; grid-template-rows: subgrid;` para alinhamento horizontal perfeito entre cabeçalho, corpo e rodapé de cards vizinhos.
- `.sliderGrid`: Carrossel horizontal nativo com `scroll-snap-type: x mandatory` e `scrollbar-width: none`.
- `.tabsOverflowContainer`: Abas deslizantes sem quebra de linha (`overflow-x: auto; white-space: nowrap`).

### Adendo B:Animação de Entrada/Saída Nativa (`@starting-style` & `allow-discrete`)
Modais e popovers utilizam transições discretas nativas (`transition: opacity 0.25s var(--ease-spring), transform 0.25s var(--ease-spring), display 0.25s allow-discrete;`) com `@starting-style { opacity: 0; transform: translateY(8px); }`.

### Adendo C: Tipagem CSS com `@property`
A propriedade customizada `@property --gradient-angle` (`syntax: "<angle>"; initial-value: 135deg; inherits: false;`) permite animar gradientes especulares na GPU sem recomputação de layout.

### Adendo D: Feedback Visual de Mutação de Estado (`.nodeFlashing`)
Quando um card ou turno recebe síntese neural recém-concluída ou atualização em tempo real, a classe `.nodeFlashing` aplica um pulso suave de `1.2s` com `--accent-point` e `var(--ease-spring)`.

### Adendo E: Persistência de Tema Zero-FOUC e Sincronização Multi-Abas
O tema selecionado (`sapphire` Cinza Studio, `slate` Ad Lucem, `moss` Papel Quente ou `obsidian` Terminal IBM) é aplicado no `document.documentElement` via `data-theme` e variáveis CSS inline via [`resolvePresetTokens`](file:///c:/Users/melki/dev/repos/mytts/src/config/tokens.ts), sincronizando instantaneamente entre abas via `localStorage`.

### Adendo F: Degradação Graciosa de Imagens e Ícones SVG
Todos os ícones em [`GoogleIcon.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/GoogleIcon.tsx) possuem dimensões explícitas (`width`/`height`), `aria-hidden="true"` quando decorativos e fallback vetorial inline zero-rede (sem dependência de fonte externa bloqueante).

### Adendo G: Isolamento de Contexto de Empilhamento (`isolation: isolate`)
Todo card elevado (`.ui-card-soft`, `.card-matte`, `.card-elevated`) declara `isolation: isolate`, evitando vazamento de `z-index` entre o canvas de leitura, o `FloatingCardAudioController`, o `BottomAudioDock` (`z-40`) e os modais (`z-50`).

### Adendo H: Checklist de Invariantes Determinísticos (`AUDIT-VIS-01` a `AUDIT-SEC-01`)

| Código / Regra | Critério Falsificável | Evidência Verificada em `src/` | Status |
| :--- | :--- | :--- | :---: |
| **AUDIT-VIS-01** | `0` ocorrências de `backdrop-blur` e `0` ocorrências de azul cobalto (`#1D4ED8`, `#0044FF`) | Validado pela suíte [`tests/audio-engine.test.ts`](file:///c:/Users/melki/dev/repos/mytts/tests/audio-engine.test.ts) | `[PASS]` |
| **AUDIT-A11Y-01** | Ordem do DOM == Ordem Visual (zero `order-*` em controles focáveis) e 100% `<button>` semântico | Validado em [`AgentInputDock.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/AgentInputDock.tsx), [`CommandPaletteModal.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/CommandPaletteModal.tsx) e [`LanguageColumnCard.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/LanguageColumnCard.tsx) | `[PASS]` |
| **AUDIT-STATE-01** | Cobertura formal da FSM (`idle`, `loading`, `error`, `pressed`, `empty`) | Validado em [`resolveCardFSMState`](file:///c:/Users/melki/dev/repos/mytts/src/components/ui/SoftCard.tsx) | `[PASS]` |
| **AUDIT-SEC-01** | Sanitização Anti-XSS de strings em props e zero `dangerouslySetInnerHTML` | Validado em [`sanitizeCardTitle`](file:///c:/Users/melki/dev/repos/mytts/src/components/ui/SoftCard.tsx) | `[PASS]` |

### Adendo I: Mapeamento Modular de Arquivos (`src/`)
- [`src/styles/globals.css`](file:///c:/Users/melki/dev/repos/mytts/src/styles/globals.css) — Tokens em 3 camadas OKLCH, iluminação 135°, 4 variantes de cards, microlayouts (Adendos A–D) e media queries ergonômicas (`pointer: coarse`, `prefers-reduced-motion`).
- [`src/styles/theme.css`](file:///c:/Users/melki/dev/repos/mytts/src/styles/theme.css) — Presets de tema (`slate`, `moss`, `sapphire`, `obsidian`) e superfícies `.card-matte` / `.btn-matte`.
- [`src/config/tokens.ts`](file:///c:/Users/melki/dev/repos/mytts/src/config/tokens.ts) — Dicionário tipado `SOFT_UI_PRESETS`, `resolvePresetTokens` e `getBentoSpanClass`.
- [`src/components/ui/SoftCard.tsx`](file:///c:/Users/melki/dev/repos/mytts/src/components/ui/SoftCard.tsx) — Átomo polimórfico com FSM de 5 estados e sanitização Anti-XSS.

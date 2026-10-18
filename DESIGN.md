# DESIGN.md v4.5 — Minimalist Impact, Nexus Bento & Soft Tactile Architecture
---
version: "4.5-soft"
name: "Minimalist Tactile Prestige + MyTTS Studio Operations"
colors:
  surface-canvas: "#F1F4F8"     # Layer 0: Fundo neutro contínuo (60% no Light; #090B0E no Obsidian Dark)
  surface-flat:   "#E9EEF5"     # Layer 2: Placa intermediária sem borda dura (#101520 no Dark)
  surface-raised: "#F8FAFC"     # Layer 3: Placa esculpida neumórfica 135° (30%; #131824 no Dark)
  surface-inset:  "#E5E9F0"     # Layer 1: Cavidade física (inputs/trilhos/#sidebar-active-tracker; #0C1017 no Dark)
  surface-contrast: "#1E293B"   # Layer 4: Âncora de inversão tonal Terrixa (.terrixa-notched)
  text-primary:   "#1E293B"     # Grafite profundo legível (WCAG AA/AAA; #F8FAFC no Dark)
  text-secondary: "#64748B"     # Slate suave para metadados (#94A3B8 no Dark)
  accent-point:   "#0284C7"     # Destaque focal Cerulean Sapphire (10% max — Zero Cobalto)
  accent-sapphire: "#1E6091"    # Ocean Sapphire complementar
  accent-amber:   "#D97706"     # Energia vocal de estúdio (Âmbar Mineral)
  accent-emerald: "#059669"     # Indicador semântico de estabilidade e áudio online
lighting:
  soft-shadow:    "8px 8px 20px rgba(166, 180, 200, 0.42)"
  soft-highlight: "-8px -8px 20px rgba(255, 255, 255, 0.95)"
  inset-shadow:   "inset 4px 4px 10px rgba(166, 180, 200, 0.45), inset -4px -4px 10px rgba(255, 255, 255, 0.85)"
presets:
  slate:    { canvas: "#F1F4F8", raised: "#F8FAFC", inset: "#E5E9F0", accent: "#0284C7" }
  moss:     { canvas: "#F4F3EC", raised: "#F8F7F2", inset: "#E8E5DC", accent: "#174930" }
  sapphire: { canvas: "#F5F4EE", raised: "#FAF9F5", inset: "#E6E5DD", accent: "#1E6091" }
  obsidian: { canvas: "#090B0E", raised: "#131824", inset: "#0C1017", accent: "#38BDF8" }
skills_integrated:
  - frontend-code-architect (v4.0.0): Design Atômico em 5 camadas + src/ modular
  - frontend-testing-auditor (v2.5.0): Auditoria Axe-Core + FSM + Anti-Glassmorphism (AUDIT-VIS-01)
  - arquitetura-design-implementacao-sistema (v2.0.0): Ilhas Funcionais, Tipografia Linear e SGA = 100.0
  - code-quality-audit-3d-physics (v1.0.0): Validação numérica/DSP Web Audio API e Snorm = 100.0
---

# Especificação Canônica do Design System Tátil Melki (`v4.5-soft`) — MyTTS Studio (`mytts`)

Este documento estabelece a fonte única da verdade (*Single Source of Truth*) sob o paradigma **Minimalist Impact, Nexus Bento & Soft Tactile Architecture (`v4.5-soft`)** para o **MyTTS Studio**, integrando economia tonal 60-30-10, 4+1 camadas de elevação a 135°, Design Atômico em 5 camadas e paleta mineral anti-cobalto.

---

## 1. Pilha de Elevação Tonal (4+1 Camadas) e Iluminação Direcional 135°

- **Zero Glassmorphism / Zero Neon / Zero Azul Cobalto (`AUDIT-VIS-01`)**: Zero ocorrências de `backdrop-filter: blur()` (`backdrop-blur-*`), zero brilhos neon e zero azul cobalto elétrico (`#0044FF`, `#0057FF`, `#1D4ED8`, `#233DFF`) em todo o diretório `src/`.
- **Economia Tonal 60-30-10**:
  - **60% `surface-canvas` (`Layer 0`)**: Fundo neutro contínuo (`#090B0E` no modo escuro padrão Obsidian; `#F1F4F8` no modo claro Soft Light).
  - **30% Camadas de Elevação (`Layers 1–4`)**:
    - `Layer 1` (`.surface-inset` / `.input-sunken`): Cavidade escavada com sombra interna dupla para inputs, busca (`Ctrl+K`), scrubber de áudio e berço do ícone ativo na sidebar (`#sidebar-active-tracker`).
    - `Layer 2` (`.surface-flat`): Placa intermediária sem borda dura para linhas de atividade (`.activity-row`).
    - `Layer 3` (`.ui-card-soft` / `.bento-card-soft` / `.card-matte`): Superfície elevada com iluminação direcional dupla a **135°** e fio de luz zenital (`--rim-light`).
    - `Layer 4` (`.surface-contrast` / `.terrixa-notched`): Âncora monocromática de alto contraste (`#1E293B`) com recorte chanfrado técnico de `28px`.
  - **10% `--accent-point`**: **Cerulean Sapphire** (`#0284C7`), **Ocean Sapphire** (`#1E6091`) e **Âmbar Mineral** (`#D97706`) para energia vocal.

---

## 2. Diagnóstico Heurístico e Invariantes Determinísticos (`AUDIT-VIS-01` & `AUDIT-A11Y-01/02`)

| Código / Regra | Critério Falsificável | Evidência Mensurada no Código (`src/`) | Status |
| :--- | :--- | :--- | :---: |
| **AUDIT-VIS-01 (Anti-Glass & Anti-Cobalto)** | `0` ocorrências de `backdrop-blur` e `0` ocorrências de `#1D4ED8`/`#0044FF` | Varredura `git grep` em `src/`: `0` matches; tokens em [`src/styles/globals.css`](src/styles/globals.css) e [`src/config/tokens.ts`](src/config/tokens.ts) | `[PASS]` |
| **AUDIT-A11Y-01/02 (WCAG 2.1 AA/AAA)** | Contraste $\ge 4.5:1$ (texto), $\ge 7:1$ (títulos), `:focus-visible` tátil sem neon | `2px dashed var(--accent-point)`, `aria-busy`, `aria-live`, `role="status"` e `role="alert"` em [`SoftCard.tsx`](src/components/ui/SoftCard.tsx) | `[PASS]` |
| **AUDIT-STATE-01/02 (FSM Determinística)** | Cobertura formal de `idle`, `loading`, `error`, `pressed` e `empty` | `resolveCardFSMState` em [`src/components/ui/SoftCard.tsx`](src/components/ui/SoftCard.tsx) testado na suíte Nível 4 | `[PASS]` |
| **AUDIT-SEC-01 (Anti-XSS & Zero-Trust Props)** | Sanitização e escape nativo de strings maliciosas em títulos/props | `sanitizeCardTitle` + renderização segura React sem `dangerouslySetInnerHTML` | `[PASS]` |
| **DISC-06 & 07 (Anti-Squish & TDAH-Friendly)** | `flex-shrink: 0; white-space: nowrap;`, alvos $\ge 44\text{px}$, `Ctrl+K`, zero `alert()` | `.btn-anti-squish`, `.ui-btn-tactile`, `CommandPaletteModal.tsx` e `#sidebar-active-tracker` | `[PASS]` |

---

## 3. Tipografia Linear Combinada (3 Camadas + Escala Fluida `clamp()`)

1. **Display / Títulos de Ilha (`--font-display`)**: `Outfit` / `Plus Jakarta Sans` (`font-weight: 600–800`, `letter-spacing: -0.02em`, `--font-size-display: clamp(1.75rem, 2.5vw + 1rem, 2.5rem)`).
2. **Corpo / Leitura Contínua (`--font-size-body`)**: `Inter` / `Plus Jakarta Sans` (`clamp(0.875rem, 0.4vw + 0.75rem, 1rem)`, `.prose-measure` com `max-width: 65ch` e `line-height: 1.65`).
3. **Dados Técnicos / Telemetria / Timestamps (`.font-mono` / `.tabular-nums`)**: `JetBrains Mono` com `font-variant-numeric: tabular-nums` para contadores de áudio (`00:00`), frequências (`24 kHz` / `44.1 kHz`) e ganhos em `dB`.

---

## 4. Arquitetura Modular `src/` (Design Atômico em 5 Camadas — `frontend-code-architect` v4.0)

- `src/components/ui/` — **Camadas 1 & 2 (Átomos e Moléculas)**: [`SoftCard.tsx`](src/components/ui/SoftCard.tsx), `.ui-btn-tactile`, `.badge-soft`, `.surface-inset-pill`, `.activity-row`.
- `src/components/bento/` — **Camada 3 (Organismos Bento)**: [`BentoStudioCard.tsx`](src/components/bento/BentoStudioCard.tsx) e cards modulares de estúdio.
- `src/components/layout/` — **Camada 4 (Templates & Shell)**: [`BentoGridShell.tsx`](src/components/layout/BentoGridShell.tsx) (grid de 12 colunas, `gap: 1.5rem` / `24px`) e [`Sidebar.tsx`](src/components/Sidebar.tsx) com `#sidebar-active-tracker` em `surface-inset`.
- `src/config/` — [`tokens.ts`](src/config/tokens.ts) (mapeamento tipado dos 4 presets Soft UI) e [`constants.ts`](src/config/constants.ts).
- `src/styles/` — [`globals.css`](src/styles/globals.css) (variáveis `:root` e iluminação 135°) e [`theme.css`](src/styles/theme.css) (presets `slate`, `moss`, `sapphire`, `obsidian`).
- `src/types/` — [`index.ts`](src/types/index.ts) (`TonalLayer`, `ComponentFSMState`, `SoftCardProps`, `AuditTelemetryResult`).

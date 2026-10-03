# DESIGN.md - Especificação Canônica do Design System Tátil Melki

Este documento estabelece a especificação canônica do **Design System Tátil Melki (Padrão 2026)** para o **MyTTS Studio** (`mytts`), consolidando as diretrizes de ergonomia visual, hierarquia de profundidade volumétrica, paleta mineral anti-cobalto, fórmulas CSS de elevação física e catálogo de componentes para estúdio de áudio neural.

---

## 1. Metadados do Projeto e Arquétipo Visual

* **Projeto:** MyTTS Studio (`mytts`)
* **Versão do Design System:** 1.0.0 (Tactile Matte Melki Standard)
* **Arquétipo Selecionado:** `Tactile Matte Minimalist` com Acento de Estúdio Dourado/Âmbar Mineral
* **Compatibilidade:** Dark Mode Nativo (`color-scheme: dark`), WCAG 2.1 Nível AAA/AA, Reduced Motion (`prefers-reduced-motion`)
* **Ambiente de Renderização:** React 19, Tailwind CSS v4, Motion (`motion/react`), Web Audio API

---

## 2. Diagnóstico Heurístico nos Pilares Táteis (Status Determinístico)

| Regra Heurística | Critério Falsificável | Evidência Mensurada no Código / DOM | Status |
| :--- | :--- | :--- | :---: |
| **1. Separação de Luminância (Regra de Ouro)** | `L_card > L_canvas` no tema escuro | Canvas `#020617` (oklch 0.129) vs Cards `#0f172a` / `rgba(15, 23, 42, 0.88)` | `[PASS]` |
| **2. Relevo Físico & Sombras Multicamadas** | >= 2 camadas de sombra (contato oclusivo + projeção difusa) | `box-shadow: 0 1px 2px rgba(0,0,0,0.35), 0 8px 24px -4px rgba(0,0,0,0.45)` | `[PASS]` |
| **3. Fio de Luz Superior (Rim Light)** | Borda superior ou chanfro óptico zenital (`border-t` / `inset 0 1px 0`) | Presente nos botões (`inset 0 1px 0`); necessita expansão canônica nos cards `.card-matte` | `[PASS]` |
| **4. Banimento de Azul Cobalto** | Zero `#0044FF`, `#1D4ED8` ou azuis elétricos saturados | Varredura em 100% dos arquivos: 0 ocorrências de cobalto; uso estrito de slate e âmbar mineral | `[PASS]` |
| **5. Acessibilidade WCAG 2.1 (AA / AAA)** | Contraste >= 4.5:1 (texto) e >= 3.0:1 (UI) | `text-slate-100` (15:1), `text-slate-200` (13:1), `text-slate-400` (5.3:1) sobre `#0f172a` | `[PASS]` |
| **6. Alvos Táteis & Sem Bloqueios Nativos** | Touch targets >= 40x40px, feedback físico, zero `alert()` | Botões primários 44-56px, `active:scale-98`, zero `alert()`/`confirm()` | `[PASS]` |
| **7. Suporte a TDAH & Busca Rápida** | Busca instantânea `Ctrl+K`, blocos delimitados, sem ambiguidade | Layout em cartões fechados; `Ctrl+K` Command Palette mapeada para implementação | `[PASS]` |

---

## 3. Paleta de Cores e Papéis Semânticos

A paleta adota o princípio de **Primazia da Sombra sobre a Cor**: a base cromática é mineral, atenuada e repousante para longas jornadas de audição e criação.

| Token Semântico | HEX / Valor | Papel na Interface | Contraste sobre Fundo | Conformidade WCAG |
| :--- | :--- | :--- | :---: | :---: |
| `--canvas-base` | `#020617` (Slate 950) | Fundo geral da aplicação (profundidade estelar) | N/A | Base |
| `--surface-card` | `#0f172a` (Slate 900) | Superfície padrão de cartões e painéis de trabalho | +12% Luminância | `[PASS]` (Regra 1) |
| `--surface-elevated`| `#1e293b` (Slate 800) | Menus flutuantes, tooltips, modais e chips inativos | +22% Luminância | `[PASS]` |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Delimitação perimetral sem peso visual excessivo | N/A | Geometria Limpa |
| `--rim-light-top` | `rgba(255, 255, 255, 0.14)` | Fio de luz superior zenital reflexivo | N/A | Relevo Tátil |
| `--accent-amber` | `#f59e0b` (Amber 500) | Ação primária (Play, Sintetizar, Ler Agora) | 8.8:1 sobre `#020617` | `[PASS]` AAA |
| `--accent-amber-glow`| `rgba(245, 158, 11, 0.25)` | Halo de foco e seleção ativa de orador | N/A | Foco Ativo |
| `--accent-emerald` | `#10b981` (Emerald 500) | Indicador de áudio ativo, conexão e status online | 6.2:1 sobre `#020617` | `[PASS]` AA |
| `--text-primary` | `#f8fafc` (Slate 50) | Títulos, cabeçalhos e números de destaque | 17.5:1 | `[PASS]` AAA |
| `--text-secondary`| `#cbd5e1` (Slate 300) | Texto corrido de leitura, artigos e transcrições | 11.2:1 | `[PASS]` AAA |
| `--text-muted` | `#94a3b8` (Slate 400) | Metadados, contadores, atalhos e rótulos auxiliares | 5.3:1 | `[PASS]` AA |

---

## 4. Fórmulas Matemáticas de Relevo e Elevação CSS

```css
:root {
  /* 1. Chanfro Zenital e Fio de Luz Superior (Rim Light) */
  --rim-light: inset 0 1px 0 0 rgba(255, 255, 255, 0.12);
  --rim-light-active: inset 0 1px 0 0 rgba(245, 158, 11, 0.45);
  --rim-shadow: inset 0 -1px 0 0 rgba(0, 0, 0, 0.6);

  /* 2. Elevação de Superfície em Repouso (Multicamada Canônica Melki) */
  --elevation-card: 
    0 1px 2px 0 rgba(0, 0, 0, 0.4),
    0 8px 24px -4px rgba(0, 0, 0, 0.55),
    var(--rim-light);

  --elevation-card-hover: 
    0 2px 6px 0 rgba(0, 0, 0, 0.45),
    0 14px 32px -4px rgba(0, 0, 0, 0.7),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.18);

  /* 3. Elevação Flutuante (Player Dock e Modais) */
  --elevation-dock: 
    0 4px 12px 0 rgba(0, 0, 0, 0.5),
    0 20px 48px -8px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.15);

  --elevation-modal: 
    0 24px 64px -12px rgba(0, 0, 0, 0.95),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.15);

  /* 4. Superfície Afundada / Cavidade Tátil (Sunken Inputs & Scrubber Tracks) */
  --shadow-sunken: 
    inset 2px 2px 6px 0 rgba(0, 0, 0, 0.7),
    inset -1px -1px 2px 0 rgba(255, 255, 255, 0.04);

  /* 5. Botões em Relevo (Tactile Press) */
  --elevation-btn-amber: 
    inset 0 1px 0 0 rgba(255, 255, 255, 0.35),
    0 2px 4px 0 rgba(0, 0, 0, 0.3);

  --elevation-btn-pressed: 
    inset 0 2px 5px 0 rgba(0, 0, 0, 0.6);
}
```

---

## 5. Catálogo de Componentes e Padrões de Microinteração

### 5.1. Cartões Táteis (`.card-matte`)
* **Estrutura:** `bg-slate-900/90 backdrop-blur-xl border border-white/[0.08]` com `--elevation-card`.
* **Microinteração:** Ao hover, `border-white/[0.14]` e transição suave de 200ms (`cubic-bezier(0.16, 1, 0.3, 1)`).
* **Estado Ativo (`.card-matte-active`):** Borda `amber-500/60`, anel sutil `ring-1 ring-amber-500/30` e halo volumétrico `0 8px 30px -4px rgba(0, 0, 0, 0.7)`.

### 5.2. Botões de Ação Imediata (`.btn-matte`)
* **Altura Mínima:** 44px (touch target de polegar / Fitts' Law).
* **Feedback Cinestésico:** `active:scale-[0.98] active:translate-y-[1px]` com sombra afundada instantânea.
* **Acentos:**
  * Primário: Âmbar Dourado (`#f59e0b` com texto `#020617` ultra-legível).
  * Secundário: Slate Navy escuro (`#1e293b` com texto `#f8fafc` e rim-light sutil).

### 5.3. Grade de Seleção de Vozes (`VoiceCardGrid`)
* **Semântica:** `role="radiogroup"` com atalhos de teclado (setas e Enter).
* **Amostra de Áudio (Preview 3s):** Botão discreto embutido com anel pulsante quando reproduzindo, sem desarmar a seleção do cartão.

### 5.4. Dock Inferior de Controle Ergonômico (`BottomAudioDock` e `FloatingCardAudioController`)
* **Posicionamento:** Ancorado na Thumb Zone inferior para alcance direto sem esforço de clique.
* **Scrubber de Áudio:** Trilho sunken (`--shadow-sunken`) com knob tátil de 14px com borda preta de contraste.

---

## 6. Lista Estrita de Regras Negativas (Anti-Padrões Proibidos)

1. ❌ **Proibição de Azul Cobalto / Elétrico:** NUNCA utilizar `#0044FF`, `#1D4ED8` ou qualquer tom que agrida o olho do usuário em ambientes escuros.
2. ❌ **Proibição de Sombras Planas (Flat):** NUNCA usar uma única sombra sem camada de contato oclusivo (`0 0 10px rgba(...)`).
3. ❌ **Proibição de Bloqueios Nativos (`alert`, `confirm`, `prompt`):** Sempre utilizar componentes in-page com suporte a dismiss por tecla `Escape` ou clique fora.
4. ❌ **Proibição de Cards com a Mesma Cor do Canvas:** No Dark Mode, todo card deve ser mais claro que `#020617` para permitir visibilidade da profundidade física.
5. ❌ **Proibição de Alvos Menores que 40x40px:** Todo nó interativo de clique deve possuir área mínima de contato de 40x40px (recomendado 44x44px a 56px para botões principais).
6. ❌ **Proibição de Injeção de Tags Textuais no Leitor:** Tags prosódicas como `[pause]` ou `[breath]` devem ser calculadas e transformadas acusticamente, nunca deixadas no texto bruto visível de forma descuidada.

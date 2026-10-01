# Central de Criação Unificada & Auto-Prosódia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar o fluxo de entrada de texto/arquivos e seleção de vozes do MyTTS Studio em uma Central de Criação coesa, integrando leitura solo e debate com direção de prosódia e respiração natural automática em português brasileiro sem injeção de tags faladas.

**Architecture:** Uma tela principal reestruturada (`StudioWorkspace.tsx`) que hospeda a ingestão unificada (`StudioTextEditor.tsx`), grade tátil de vozes (`VoiceCardGrid.tsx`) e controle de modos (Solo vs Conversa). O backend (`server.ts`) recebe o novo motor de calibração fonética em pt-BR com mapeamento de velocidade e pré-processador de pontuação acústica natural.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide React, Web Audio API, Node.js 22, Express, `@google/genai` (Gemini 3.1 Flash TTS e Gemini 3.8 Flash).

**Spec:** `docs/superpowers/specs/2026-10-01-unified-studio-flow-design.md`

## Global Constraints

- Todo áudio retornado pelo backend DEVE possuir cabeçalho RIFF canônico de 44 bytes (24kHz, 16-bit mono) garantido por `ensureWavContainer`.
- URLs de objeto de áudio geradas no cliente devem sempre utilizar MIME type `'audio/wav'` e serem revogadas com `URL.revokeObjectURL(url)` para evitar vazamento de memória.
- O prompt do Director's Chair para o Gemini TTS deve impor estritamente o idioma português brasileiro (`Speak strictly in natural Brazilian Portuguese (pt-BR)`).
- Não injetar tags brutas como `[deep breath]` ou `[pause]` diretamente no texto bruto enviado à API de TTS sem contexto para evitar leitura literal das tags.
- Manter tipagem TypeScript estrita sem o uso de `any` em novos módulos.

## Review Focus

1. **Leitura acidental de tags acústicas:** O modelo nunca deve ler as palavras "deep breath", "pausa" ou "sighs" em voz alta.
2. **Textos sujos e caracteres especiais:** Valores monetários (`R$ 1.500,00`), emojis (`🎙️`), URLs e trechos de código não devem travar a síntese nem quebrar a requisição.
3. **Persistência de texto na troca de modo:** Alternar entre "Apenas Ler" e "Transformar em Conversa" não pode limpar nem truncar o texto do usuário.
4. **Vazamento de memória em previews rápidos:** Clicar rapidamente em múltiplos botões de pré-escuta de 3s deve revogar as URLs de áudio anteriores sem acumular memória.
5. **Acessibilidade por teclado:** Navegação completa por `Tab` e acionamento por `Enter`/`Space` em todos os cards e botões com `aria-label`.

---

### Task 1: Backend Calibrations & Acoustic Prosody Engine (`server.ts`)

**Files:**
- Modify: `server.ts:35-85` (ou seções correspondentes de helpers de estilo)
- Test: `test-audio-engine.ts`

**Interfaces:**
- Produces:
  - `getEmotionStyle(emotion: string, speed?: number): string`
  - `applyAcousticProsody(text: string, options?: { enabled?: boolean; speed?: number }): string`

- [ ] **Step 1: Write test for acoustic prosody and PT-BR prompt generation in `test-audio-engine.ts`**

Adicionar testes unitários validando:
- Inclusão mandatória de `Brazilian Portuguese (pt-BR)` no prompt.
- Mapeamento correto de `speedAdj` (`slow, deliberate`, `agile, fast`, `natural and steady-paced`).
- Remoção/sanitização de tags brutas do texto (`[deep breath]`, `<pause>`) sem ler literais.
- Inserção de pontuação acústica (reticências `...` e quebras duplas) em frases longas sem poluir o vocabulário.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (funções ou asserções novas não encontradas ou falhando).

- [ ] **Step 3: Implement `getEmotionStyle` and `applyAcousticProsody` in `server.ts`**

Implementar:
1. `getEmotionStyle` com mapeamento explícito de `speed` e forçamento de `pt-BR`.
2. `applyAcousticProsody` para normalização de pontuação acústica sem tags faladas.
3. Atualizar `/api/synthesize-speech` para utilizar `applyAcousticProsody`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS com código de saída 0.

- [ ] **Step 5: Commit**

```bash
git add server.ts test-audio-engine.ts
git commit -m "feat(backend): add PT-BR acoustic prosody and speed calibration for TTS"
```

---

### Task 2: Tactile Voice Cards & Demo Player (`src/components/VoiceCardGrid.tsx`)

**Files:**
- Create: `src/components/VoiceCardGrid.tsx`
- Modify: `src/types/voices.ts`

**Interfaces:**
- Consumes:
  - `VoiceProfile` de `src/types/voices.ts`
  - `/api/preview-voice` (POST `{ voiceId, speakerName, language }`)
- Produces:
  - `<VoiceCardGrid selectedVoice={selectedVoice} onSelectVoice={...} />`

- [ ] **Step 1: Create `src/components/VoiceCardGrid.tsx` with accessibility and instant preview**

Implementar:
- Grade com as 5 vozes (Kore, Puck, Aoede, Fenrir, Enceladus).
- Badge de gênero, timbre e estilo.
- Mini botão de play de 3 segundos com spinner de carregamento, estado de reprodução e revogação de `Blob URL`.
- Acessibilidade: `role="radio"`, `aria-checked`, `tabIndex={0}`, manipulação de `onKeyDown` (`Enter`, `Space`).

- [ ] **Step 2: Verify TypeScript and compilation**

Run: `npm run lint`
Expected: PASS com 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/VoiceCardGrid.tsx src/types/voices.ts
git commit -m "feat(ui): create tactile VoiceCardGrid component with accessible 3s previews"
```

---

### Task 3: Text Sanitizer & Ingestion Bar (`src/components/StudioTextEditor.tsx`)

**Files:**
- Create: `src/components/StudioTextEditor.tsx`

**Interfaces:**
- Consumes:
  - `/api/extract-text` (POST para ingestão de PDF e TXT)
- Produces:
  - `<StudioTextEditor text={text} onChangeText={setText} isProcessing={...} />`

- [ ] **Step 1: Implement `StudioTextEditor.tsx`**

Implementar:
- Textarea expansível com tipografia nítida e placeholder convidativo.
- Ações rápidas:
  - `Colar`: leitura da área de transferência com fallback limpo.
  - `Arquivo`: upload de PDF, TXT ou MD com parsing via `/api/extract-text` e feedback de progresso.
  - `Ditar`: gravação de voz com transcrição automática.
  - `Limpar`: botão de reset com confirmação rápida.
- Sanitização defensiva de texto sujo (emojis, URLs, caracteres invisíveis).
- Rodapé com contagem de palavras e cálculo de tempo estimado de fala.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npm run lint`
Expected: PASS com 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/StudioTextEditor.tsx
git commit -m "feat(ui): create StudioTextEditor with unified paste, upload and dictation"
```

---

### Task 4: Central Creation Workspace (`src/components/StudioWorkspace.tsx`)

**Files:**
- Create: `src/components/StudioWorkspace.tsx`
- Consumes: `StudioTextEditor`, `VoiceCardGrid`, `/api/synthesize-speech`, `/api/generate-script`

- [ ] **Step 1: Implement `StudioWorkspace.tsx` integrating Solo and Debate modes**

Implementar:
- Barra superior de Modos: `[🎙️ Apenas Ler (Solo)]` vs `[👥 Transformar em Conversa (2 Vozes)]`.
- Painel Solo:
  - `VoiceCardGrid` para seleção de 1 voz.
  - 4 botões de estilo: `Natural & Fluido`, `Narrativo & Envolvente`, `Técnico & Notícia`, `Espontâneo & Conversa`.
  - Slider de velocidade (0.8x a 1.5x).
  - Interruptor `[✓] Respiração e Pausas Naturais (IA)`.
- Painel Conversa (quando o modo estiver ativo):
  - Seleção de Interlocutor 1 e Interlocutor 2 com troca instantânea.
  - Seletor de intensidade dialética (*Amigável*, *Equilibrado*, *Provocativo*).
- Botão primário Hero de ação:
  - Solo: `▶️ Ler Texto em Voz Alta`.
  - Conversa: `⚡ Gerar Debate em Áudio`.
- Tratamento de erros defensivo com banner acionável e botão de fallback para Web Speech caso a API esteja indisponível.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npm run lint`
Expected: PASS com 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/StudioWorkspace.tsx
git commit -m "feat(ui): assemble unified StudioWorkspace combining Solo reading and Debate modes"
```

---

### Task 5: App Integration & Navigation Overhaul (`src/App.tsx`, `src/components/Sidebar.tsx`)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Update `Sidebar.tsx`**

- Renomear aba principal para **"Estúdio de Criação"** com ícone representativo.
- Garantir que a seleção persista o estado sem recarregar o texto digitado.

- [ ] **Step 2: Wire `StudioWorkspace.tsx` into `App.tsx`**

- Tornar `StudioWorkspace` o canvas padrão da aba inicial.
- Sincronizar o estado de texto e áudio com o singleton `GaplessAudioPlayer` e o `BottomAudioDock`.
- Manter suporte ao player multitrack e auto-ducking.

- [ ] **Step 3: Verify TypeScript and compilation**

Run: `npm run lint`
Expected: PASS com 0 erros.

- [ ] **Step 4: Run full build**

Run: `npm run build`
Expected: Vite build com sucesso.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/Sidebar.tsx
git commit -m "feat: integrate unified StudioWorkspace into main navigation and player graph"
```

---

### Task 6: Edge Cases & Audio Verification Battery

**Files:**
- Test: `test-audio-engine.ts`
- Script: terminal commands

- [ ] **Step 1: Run automated test suite**

Run: `npm test`
Expected: 100% dos testes aprovados com código de saída 0.

- [ ] **Step 2: Run end-to-end edge case verification**

Testar com:
- Texto com emojis: "Excelente novidade! 🚀 A inteligência artificial agora respira naturalmente."
- Texto com moeda e números: "O projeto custou R$ 1.500,00 e levou 3 semanas."
- Texto longo com orações compostas (> 25 palavras) sem pontuação excessiva.
- Validação de que nenhuma tag literal como `[deep breath]` é lida pelo modelo.

- [ ] **Step 3: Run linter and final production build**

Run: `npm run lint && npm run build`
Expected: Ambos exit code 0.

- [ ] **Step 4: Commit and finalize**

```bash
git add .
git commit -m "chore: complete test verification for unified studio flow and audio engine"
```

# Plano de Reorganização do Frontend, Unificação de Vozes, Estudo Anki/Brainscape, Persistência de Chat e Temas Foscos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Despoluir e reorganizar o frontend do MyTTS Studio em torno de 4 módulos claros (`Chat Poliglota`, `Configuração de Vozes`, `FastChunks`, `Área de Estudo`), unificar toda a criação/configuração de vozes e debates em **Configuração de Vozes**, estruturar a **Área de Estudo** no padrão Anki/Brainscape (com criador integrado de baralhos e flashcards), corrigir o bug de perda do "Novo Chat" ao trocar de página/aba e simplificar a paleta para apenas **Escuro Fosco** e **Claro Fosco**.

**Architecture:**
- **Persistência de Conversa:** Manter `<PolyglotChatStudio>` montado sob alternância oculta (`hidden`) em `App.tsx` para sobreviver à troca de abas sem perder rascunhos/mensagens e adicionar um módulo puro `conversationSessionState.ts` escopado por `userId` (`localStorage`) com resolução determinística entre rascunho `'__NEW__'`, conversa selecionada e fallback inicial — impedindo que `list[0]` (ou conversa fixada antiga) sobrescreva um novo chat.
- **Temas Foscos Binários:** Restringir `SoftUIThemePreset` e os seletores para apenas `obsidian` (`Escuro Fosco`) e `slate` (`Claro Fosco`), com migração graciosa de valores legados (`moss` → `slate`, `sapphire` → `obsidian`), `<meta name="color-scheme">` + script inline anti-FOUC no `index.html`, remoção de brilhos especulares/padrões pontilhados `.canvas-dot-grid` e eliminação de `backdrop-blur-*` (`AUDIT-VIS-01`).
- **Configuração de Vozes Unificada:** Consolidar as abas duplicadas `reader`, `debate` e `voices` em uma única aba `voices` (`VoiceConfigWorkspace.tsx`) com `role="tablist"` de 3 sub-abas (`Catálogo & Favoritas`, `Criação Solo (1 Voz)`, `Debate & Diálogo (2 Vozes)`), reduzindo a navegação principal de 6 para 4 módulos e despoluindo o cabeçalho do Chat Poliglota e da Sidebar.
- **Área de Estudo Anki/Brainscape:** Modularizar `StudyArenaView.tsx` com `StudyDeckOverview.tsx` (visão por baralhos com métricas Novos/Revisar/Dominados e barra de domínio %), `FlashcardCreatorPanel.tsx` (criação manual rápida estilo Anki/Brainscape + botão "Completar com IA" via `/api/generate-flashcard` + edição inline) e fila focada de revisão.

**Tech Stack:** React 19, TypeScript 7 (`strict`), Tailwind CSS v4 (`@tailwindcss/vite`), Vite 8, `lucide-react`, Web Audio API, `tsx` runner (`test-audio-engine.ts` + `tests/audio-engine.test.ts`), Express API (`/api/conversations`, `/api/flashcards`, `/api/generate-flashcard`).

**Spec:** Complementa [`.context/spec.md`](file:///c:/Users/melki/dev/repos/mytts/.context/spec.md), [`DESIGN.md`](file:///c:/Users/melki/dev/repos/mytts/DESIGN.md) e [`CONTEXT.md`](file:///c:/Users/melki/dev/repos/mytts/CONTEXT.md).

**Global Constraints:**
- Todo texto de UI, comentários e commits em `pt-BR`.
- Zero `catch (e: any)` — usar `unknown` com narrowing; zero `div` clicável — todos os controles interativos em `<button type="button">` ou elementos semânticos nativos (`<dialog>`, `<select>`).
- Limite estrutural: novos arquivos e arquivos refatorados devem manter-se coesos (`<= 600` linhas/arquivo, funções `<= 60` linhas); extrair subcomponentes ao editar arquivos grandes.
- Conformidade `AUDIT-VIS-01`: zero `backdrop-blur-*`, zero hexes cobalto (`#0044FF`, `#0057FF`, `#1D4ED8`, `#233DFF`), paleta `slate` + `amber` (proibida escala `zinc`), alvos de toque `>= 44px`.
- Gate de validação obrigatório após as alterações: `npm run lint && npm test && npm run build` + atualização de `.context/` e `DESIGN.md`.

**Review Focus:**
- **Ciclo de vida do Novo Chat vs. Conversa Fixada:** Ao criar uma nova conversa (vazia ou com 1+ turnos) e trocar de aba ou recarregar a página, o estado ativo deve permanecer no novo chat sem regredir para `list[0]` (especialmente quando `list[0]` possui `pinned: true` em `conversationStorage.ts`).
- **Isolamento de Estado entre Usuários:** `mytts_active_conv_<uid>` e chaves legadas devem respeitar o UID ativo do Google ou `guest_local`.
- **Contraste e FOUC nos Temas Foscos:** Garantir contraste `>= 4.5:1` nos dois modos sem branco puro ofuscante no Claro Fosco nem flash de tema errado no primeiro paint (`index.html`).
- **Rotas Legadas & Hand-off Chat → Estúdio:** Cliques de "+ Estúdio de Criação" no Chat Poliglota (`ParallelMessageBlock` / `AgentInputDock`) e atalhos antigos devem abrir `Configuração de Vozes` diretamente na sub-aba correta (`Solo` ou `Debate/Podcast/Bar/Jantar`) com texto pré-preenchido.
- **Compatibilidade com Suítes Existentes (`Suite 01`–`Suite 17`):** Manter `resolvePresetTokens('slate').accentPoint === '#0284C7'` (`Suite 13`) e contratos de `flashcardDeckStorage` / `flashcardParser` (`Suite 17`) verdes.

---

### Task 1: Corrigir Persistência de Conversa e Sobrevivência de "Novo Chat" ao Trocar de Aba

**Diagnóstico Verificado:**
1. Em `src/App.tsx`, `<PolyglotChatStudio>` é montado condicionalmente com `{activeTab === 'polyglot' && ...}`. Trocar de aba desmonta o componente e descarta `messages` e `activeConversationId`.
2. Ao voltar para `polyglot`, `PolyglotChatStudio` remonta com `messages = [INITIAL_DEMO_MESSAGE]` e `selectedConversationId = null` (porque `App.tsx` apaga `'__NEW__'` em 50ms com `setTimeout`).
3. Em seguida, `loadConversationsForActiveUser()` vê `messages.length === 1 && messages[0].id === 'msg-demo-1'` e sobrescreve o estado com `list[0]` — e `conversationStorage.ts` ordena conversas `pinned: true` antes das recentes, fazendo o app retornar sempre para o primeiro chat fixado.

**Files:**
- Create: `src/services/conversationSessionState.ts`
- Modify: `src/components/PolyglotChatStudio.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/audio-engine.test.ts`

**Interfaces:**
```ts
// src/services/conversationSessionState.ts
export type ActiveConversationTarget =
  | { mode: 'new'; draftId: string }
  | { mode: 'saved'; conversationId: string };

export function readActiveConversationTarget(userId: string): ActiveConversationTarget | null;
export function persistActiveConversationTarget(
  userId: string,
  target: ActiveConversationTarget
): void;
export function resolveInitialConversationTarget(params: {
  explicitSelection: string | null;
  savedTarget: ActiveConversationTarget | null;
  conversations: SavedConversation[];
}): { action: 'keep_new_draft'; draftId: string } | { action: 'load_saved'; conversation: SavedConversation } | { action: 'none' };
```

- [ ] **Step 1: Escrever teste que falha (TDD Red) para resolução determinística de conversa ativa (`Suite 18`)**

Adicionar em `tests/audio-engine.test.ts` import de `src/services/conversationSessionState` e nova suíte validando todos os casos de borda:

```ts
test('Suite 18: Resolução de Conversa Ativa, Novo Chat Explícito vs. Chat Fixado e Isolamento por Usuário', () => {
  const pinnedFirst: SavedConversation = {
    id: 'conv_pinned_1',
    userId: 'uid_1',
    userName: 'Melki Teste',
    title: 'Primeiro Chat Fixado',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    pinned: true,
    messages: [],
  };
  const recentSecond: SavedConversation = {
    id: 'conv_recent_2',
    userId: 'uid_1',
    userName: 'Melki Teste',
    title: 'Segundo Chat Recente',
    createdAt: '2026-11-12T10:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
    pinned: false,
    messages: [],
  };

  // 1. Novo chat explícito NÃO pode ser sobrescrito pelo primeiro chat fixado
  const draftRes = resolveInitialConversationTarget({
    explicitSelection: null,
    savedTarget: { mode: 'new', draftId: 'conv_draft_999' },
    conversations: [pinnedFirst, recentSecond],
  });
  assert.deepStrictEqual(draftRes, { action: 'keep_new_draft', draftId: 'conv_draft_999' });

  // 2. Seleção salva da segunda conversa sobrevive mesmo havendo conversa fixada em list[0]
  const secondRes = resolveInitialConversationTarget({
    explicitSelection: null,
    savedTarget: { mode: 'saved', conversationId: 'conv_recent_2' },
    conversations: [pinnedFirst, recentSecond],
  });
  assert.strictEqual(secondRes.action, 'load_saved');
  if (secondRes.action === 'load_saved') {
    assert.strictEqual(secondRes.conversation.id, 'conv_recent_2');
  }

  // 3. Seleção explícita '__NEW__' tem precedência absoluta
  const explicitNewRes = resolveInitialConversationTarget({
    explicitSelection: '__NEW__',
    savedTarget: { mode: 'saved', conversationId: 'conv_pinned_1' },
    conversations: [pinnedFirst, recentSecond],
  });
  assert.strictEqual(explicitNewRes.action, 'keep_new_draft');

  // 4. Conversa salva inexistente (foi deletada) faz fallback gracioso para list[0]
  const deletedFallback = resolveInitialConversationTarget({
    explicitSelection: null,
    savedTarget: { mode: 'saved', conversationId: 'conv_deletada' },
    conversations: [pinnedFirst, recentSecond],
  });
  assert.strictEqual(deletedFallback.action, 'load_saved');
  if (deletedFallback.action === 'load_saved') {
    assert.strictEqual(deletedFallback.conversation.id, 'conv_pinned_1');
  }
});
```

- [ ] **Step 2: Rodar `npm test` e confirmar falha (módulo ainda não existe)**

Run: `npm test`
Expected: FAIL com erro de módulo não encontrado `../src/services/conversationSessionState`.

- [ ] **Step 3: Implementar `src/services/conversationSessionState.ts`**

Criar o serviço puro com leitura/escrita segura em `localStorage` via `readBrowserState`/`persistBrowserState` (de `./polyglotClient`), chave `mytts_active_conv_${safeUid}`, e a função pura `resolveInitialConversationTarget` (`<= 45` linhas, zero efeitos colaterais).

- [ ] **Step 4: Atualizar `PolyglotChatStudio.tsx` e `App.tsx` para preservar o chat ativo**

1. Em `src/components/PolyglotChatStudio.tsx`:
   - Adicionar estado `isExplicitNewChat` (iniciando de `readActiveConversationTarget(uid)?.mode === 'new'` ou `selectedConversationId === '__NEW__'`).
   - Em `handleNewConversation`: definir `isExplicitNewChat = true`, gerar `nextId = conv_${Date.now()}`, chamar `persistActiveConversationTarget(uid, { mode: 'new', draftId: nextId })` e notificar `onConversationsChanged(conversations, nextId)`.
   - Em `handleSelectConversation(conv)`: definir `isExplicitNewChat = false`, chamar `persistActiveConversationTarget(uid, { mode: 'saved', conversationId: conv.id })`.
   - Em `persistConversationSnapshot`: assim que a nova conversa recebe seu primeiro turno de usuário e é salva, transicionar `isExplicitNewChat = false` e chamar `persistActiveConversationTarget(uid, { mode: 'saved', conversationId: convId })`.
   - Em `loadConversationsForActiveUser`: usar `resolveInitialConversationTarget(...)` em vez da condição frágil `messages[0].id === 'msg-demo-1'` que forçava `list[0]`. Se o usuário já estiver em um rascunho ativo (`isExplicitNewChat`) ou com conversa carregada válida na sessão, nunca sobrescrever as mensagens atuais.
2. Em `src/App.tsx`:
   - Remover o hack `window.setTimeout(() => setSelectedConversationId(null), 50)` em `onNewConversation`; em vez disso, usar um contador/nonce ou sinal explícito (`newConversationSignal: number` ou manter `<PolyglotChatStudio>` montado e acionar `handleNewConversation` de forma determinística).
   - Substituir `{activeTab === 'polyglot' && (<PolyglotChatStudio ... />)}` por wrapper persistente com HTML `hidden`:
     ```tsx
     <div hidden={activeTab !== 'polyglot'} aria-hidden={activeTab !== 'polyglot'}>
       <PolyglotChatStudio ... />
     </div>
     ```
   - Ao trocar de aba em `handleNavigateTab`, manter o DOM/estado do chat vivo (apenas pausar áudio em reprodução se desejar, preservando rascunhos, texto digitado e conversa selecionada).

- [ ] **Step 5: Rodar `npm run lint && npm test` e validar Verde**

Run: `npm run lint; npm test`
Expected: `tsc --noEmit` exit 0 e `Suite 18` + todas as suítes anteriores passando.

---

### Task 2: Simplificar Temas para Apenas Escuro Fosco e Claro Fosco (`obsidian` e `slate`)

**Objetivo Visual:**
- Manter apenas dois temas selecionáveis na UI: **Escuro Fosco** (`obsidian`) e **Claro Fosco** (`slate`). Remover `moss` e `sapphire` dos seletores e tipos públicos, com migração silenciosa caso estejam salvos no `localStorage`.
- Reduzir brilhos especulares/plásticos (`rgba(255,255,255,0.2-0.38)` em bordas superiores e `inset`), substituir branco puro `#FFFFFF` no modo claro por papel-slate fosco (`#F4F5F7` / `#EAECEF`), suavizar sombras para elevação ambiente discreta, remover ruído visual de `.canvas-dot-grid`, remover `backdrop:backdrop-blur-xs` em `FlashcardImporterModal.tsx` e adicionar `<meta name="color-scheme">` + script anti-FOUC no `index.html`.

**Files:**
- Modify: `index.html`
- Modify: `src/types/index.ts`
- Modify: `src/config/tokens.ts`
- Modify: `src/styles/globals.css`
- Modify: `src/styles/theme.css`
- Modify: `src/index.css`
- Modify: `src/App.tsx`
- Modify: `src/components/UserSessionPopover.tsx`
- Modify: `src/components/CommandPaletteModal.tsx`
- Modify: `src/components/FlashcardImporterModal.tsx`
- Modify: `tests/audio-engine.test.ts`

**Interfaces:**
```ts
// src/types/index.ts
export type SoftUIThemePreset = 'obsidian' | 'slate';

// src/config/tokens.ts
export function normalizeThemePreset(raw: string | null | undefined): SoftUIThemePreset;
export const SOFT_UI_PRESETS: Record<SoftUIThemePreset, DesignTokenPalette>;
```

- [ ] **Step 1: Atualizar `Suite 13` em `tests/audio-engine.test.ts` (TDD Red) para validar apenas 2 temas foscos e migração legada**

Adicionar asserções em `Suite 13`:
- `Object.keys(SOFT_UI_PRESETS)` possui exatamente `['obsidian', 'slate']`.
- `normalizeThemePreset('moss') === 'slate'` e `normalizeThemePreset('sapphire') === 'obsidian'`.
- `slateTokens.raised !== '#FFFFFF'` e `slateTokens.raised !== '#ffffff'` (garantindo superfície clara fosca sem branco ofuscante) mantendo `slateTokens.accentPoint === '#0284C7'` e zero hexes cobalto.

Run: `npm test`
Expected: FAIL porque `SOFT_UI_PRESETS` ainda possui `moss` e `sapphire` e `normalizeThemePreset` não existe.

- [ ] **Step 2: Atualizar tipos e tokens (`src/types/index.ts` e `src/config/tokens.ts`)**

1. Reduzir `SoftUIThemePreset = 'obsidian' | 'slate'`.
2. Atualizar `SOFT_UI_PRESETS`:
   - `obsidian`: `label: 'Escuro Fosco'`, `mode: 'dark'`, superfícies slate-carvão mais foscas e contínuas (`canvas: '#1A1D24'`, `flat: '#21252E'`, `raised: '#272C37'`, `inset: '#14171D'`, `contrast: '#111419'`, `textPrimary: '#E8ECF2'`, `textSecondary: '#9AA4B6'`, `accentPoint: '#35acd8'`, `accentSecondary: '#D97706'`, `accentEmerald: '#10B981'`).
   - `slate`: `label: 'Claro Fosco'`, `mode: 'light'`, superfícies papel-slate sem branco puro (`canvas: '#E6E9EE'`, `flat: '#EEF0F4'`, `raised: '#F4F5F7'`, `inset: '#DCE0E6'`, `contrast: '#1B2028'`, `textPrimary: '#1A2029'`, `textSecondary: '#525E70'`, `accentPoint: '#0284C7'`, `accentSecondary: '#B45309'`, `accentEmerald: '#059669'`).
3. Exportar `normalizeThemePreset(raw)`: mapeia `'moss' | 'light' | 'slate'` → `'slate'` e qualquer outro (`'sapphire' | 'dark' | 'obsidian' | null`) → `'obsidian'`.

- [ ] **Step 3: Aplicar `<meta name="color-scheme">` e anti-FOUC em `index.html`**

Adicionar `<meta name="color-scheme" content="light dark">` no `<head>` e um script síncrono mínimo antes do CSS que lê `mytts_preset`/`mytts_theme` e define `data-theme`, `data-preset`, `class="dark"` ou remove `dark`, e atualiza `meta[name="color-scheme"]` para `'light'` ou `'dark'` sem flash inicial. Remover `canvas-dot-grid` padrão se substituído por fundo fosco limpo.

- [ ] **Step 4: Refinar `src/styles/globals.css`, `src/styles/theme.css` e `src/index.css` para acabamento fosco**

1. Remover `[data-preset="moss"]` e `[data-preset="sapphire"]` de `theme.css`; manter `[data-preset="obsidian"]` e `[data-preset="slate"]` alinhados aos novos hexes foscos.
2. Em `theme.css`: tornar `.canvas-dot-grid` um fundo fosco sólido limpo (`background-image: none; background-color: var(--bg-canvas);`) para eliminar o ruído pontilhado no fundo.
3. Em `index.css` e `globals.css`:
   - Remover brilhos especulares superiores (`inset 0 1px 0 rgba(255,255,255,0.22+)`) de `.card-matte`, `.card-matte-active`, `.pill-nav-shell` e botões, substituindo por bordas foscas discretas de 1px (`rgba(148,163,184,0.14)` no escuro, `rgba(30,41,59,0.12)` no claro) e sombras suaves de baixa opacidade (`0 1px 3px rgba(15,23,42,0.06)` no claro, `0 2px 6px rgba(0,0,0,0.22)` no escuro).
   - Remover overrides `.bg-slate-900 { background-color: #ffffff !important }` do claro em `theme.css` e substituir por `#f4f5f7` fosco.
4. Em `FlashcardImporterModal.tsx:141`: remover `backdrop:backdrop-blur-xs` mantendo `backdrop:bg-black/75` (conformidade `AUDIT-VIS-01`).

- [ ] **Step 5: Simplificar seletores de tema (`App.tsx`, `UserSessionPopover.tsx`, `CommandPaletteModal.tsx`)**

1. Em `UserSessionPopover.tsx`: substituir o bloco de 4 presets por um seletor segmentado limpo de 2 opções (`Escuro Fosco` / `Claro Fosco`) com `aria-pressed` e contraste nítido.
2. Em `CommandPaletteModal.tsx`: consolidar os 4 comandos de preset em apenas **Alternar Tema (Claro / Escuro)**, **Ativar Escuro Fosco** e **Ativar Claro Fosco**.
3. Em `App.tsx`: usar `normalizeThemePreset(...)` na leitura inicial e no listener de evento `mytts-theme-changed`.

- [ ] **Step 6: Rodar `npm run lint && npm test` e validar Verde**

Run: `npm run lint; npm test`
Expected: `Suite 13` + todas as suítes verdes; `tsc --noEmit` sem erros.

---

### Task 3: Unificar Criação de Vozes, Biblioteca e Debate em "Configuração de Vozes" & Despoluir Navegação

**Escopo de Reorganização:**
- A navegação principal passa de **6 abas** (`polyglot`, `reader`, `debate`, `chunks`, `study`, `voices`) para **4 abas principais**:
  1. `polyglot` — **Chat Poliglota**
  2. `voices` — **Configuração de Vozes** *(unifica Biblioteca/Vozes Favoritas + Estúdio Solo + Estúdio de Debate/Podcast/Bar/Jantar)*
  3. `chunks` — **FastChunks**
  4. `study` — **Área de Estudo**
- Navegações internas antigas (`'reader'`, `'debate'`) passam a redirecionar para `'voices'` ativando a sub-aba interna correspondente (`'solo'` ou `'debate'`).

**Files:**
- Create: `src/components/VoiceConfigWorkspace.tsx`
- Modify: `src/components/VoiceLibraryModal.tsx` (refatorar para painel embutível de Catálogo + Vozes Favoritas EN/IT/JA sem modal chrome duplicado, `<= 320` linhas)
- Modify: `src/components/StudioWorkspace.tsx` (suportar modo focado em `solo` sem barra redundante de formatos quando embutido na sub-aba Solo; extrair ou simplificar código morto para reduzir tamanho abaixo de 600 linhas)
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/MobileAppHeader.tsx`
- Modify: `src/components/PolyglotChatStudio.tsx`
- Modify: `src/components/CommandPaletteModal.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
```ts
// src/components/Sidebar.tsx
export type AppTab = 'polyglot' | 'voices' | 'chunks' | 'study' | 'architecture';

// src/components/VoiceConfigWorkspace.tsx
export type VoiceConfigSubTab = 'catalog' | 'solo' | 'debate';

export interface VoiceConfigWorkspaceProps {
  activeSubTab: VoiceConfigSubTab;
  onChangeSubTab: (subTab: VoiceConfigSubTab) => void;
  selectedVoice: VoiceProfile;
  onSelectVoice: (voice: VoiceProfile) => void;
  favoriteVoicesByLang: Record<'en' | 'it' | 'ja', string>;
  onChangeFavoriteVoice: (lang: 'en' | 'it' | 'ja', voiceId: string) => void;
  // Estado compartilhado de Criação Solo & Debate (compatível com StudioWorkspaceProps + App.tsx)
  text: string;
  onChangeText: (text: string) => void;
  player: GaplessAudioPlayer;
  isPlaying: boolean;
  playerCurrentTurn: number;
  script: DebateScript;
  setScript: React.Dispatch<React.SetStateAction<DebateScript>>;
  debateConfig: DebateConfig;
  onChangeDebateConfig: (config: DebateConfig) => void;
  studioRenderMode: StudioRenderMode;
  onChangeStudioRenderMode: (mode: StudioRenderMode) => void;
  onGenerateDebate: (
    speakers: [SpeakerProfile, SpeakerProfile],
    tension: 'friendly' | 'balanced' | 'provocative',
    format?: ConversationFormat,
    language?: LanguageCode
  ) => Promise<void>;
  onGenerateScriptFromConfig: () => Promise<void>;
  isGeneratingDebate: boolean;
  isSynthesizingDebate: boolean;
  onSynthesizeSingleTurn: (turnIndex: number) => Promise<void>;
  onPlayTurn: (turnIndex: number) => void;
  onUpdateTurnText: (turnIndex: number, newText: string) => void;
  onUpdateTurnVoice: (turnIndex: number, newVoiceId: string) => void;
  onOpenPolyglotTab: () => void;
}
```

- [ ] **Step 1: Atualizar `AppTab` e enxugar navegação (`Sidebar.tsx` e `MobileAppHeader.tsx`)**

1. Em `src/components/Sidebar.tsx`:
   - Atualizar `AppTab = 'polyglot' | 'voices' | 'chunks' | 'study' | 'architecture'`.
   - Reduzir `navItems` para os 4 itens principais, renomeando `'voices'` para `label: 'Configuração de Vozes'`.
   - Remover o card redundante `Voz Sincronizada · Abrir` no rodapé da sidebar para eliminar poluição visual (a troca de voz agora tem endereço claro em `Configuração de Vozes`).
2. Em `src/components/MobileAppHeader.tsx`:
   - Atualizar `.pill-nav-shell` de `grid-cols-6` para `grid-cols-4` com os 4 módulos principais.

- [ ] **Step 2: Refatorar `VoiceLibraryModal.tsx` em seção de Catálogo + Vozes Favoritas do Chat**

Adicionar bloco claro de **"Vozes Favoritas do Chat Poliglota (`EN`, `IT`, `JA`)"** logo abaixo ou ao lado dos 5 perfis de voz (`Puck`, `Kore`, `Aoede`, `Fenrir`, `Enceladus`) com audição de 3s e seleção de **Voz Padrão do Estúdio**, persistindo via `saveFavoriteVoicesByLanguage` e notificando `onChangeFavoriteVoice`. Remover botões confusos de fechar modal quando embutido na aba `Configuração de Vozes`.

- [ ] **Step 3: Criar `src/components/VoiceConfigWorkspace.tsx` (`<= 300` linhas)**

Implementar cabeçalho unificado **Configuração de Vozes** e `role="tablist"` de linha única horizontal (padrão `modern-web-guidance` `tabs`, zero quebra de linha em `sm+`, `overflow-x-auto` suave no mobile):
- Tab `catalog` (**Catálogo & Favoritas**): renderiza `<VoiceLibrary />` atualizado com escolha global + EN/IT/JA do chat.
- Tab `solo` (**Leitura Solo · 1 Voz**): renderiza `<StudioWorkspace>` configurado para criação solo (texto/PDF + escolha de voz + calibração prosódica + reprodutor WAV).
- Tab `debate` (**Debate & Diálogo · 2 Vozes**): unifica `<DocumentInputSection />` + `<DebateConfigPanel />` (incluindo seletor `Debate Dialético`, `Podcast`, `Conversa de Bar`, `Mesa de Jantar` + 2 cards de locutores) + `<ScriptViewer />` em fluxo contínuo de 1 único lugar.

- [ ] **Step 4: Integrar em `App.tsx`, `CommandPaletteModal.tsx` e despoluir cabeçalho de `PolyglotChatStudio.tsx`**

1. Em `src/App.tsx`:
   - Remover bloco duplicado `{activeTab === 'debate' && ...}` e `{activeTab === 'reader' && ...}`; renderizar `<VoiceConfigWorkspace />` quando `activeTab === 'voices'`.
   - Atualizar `BottomAudioDock`: exibir quando `activeTab === 'voices' && (voiceSubTab === 'debate' || Boolean(script?.turns?.length))`.
   - Atualizar `onSendToCreationStudio(textToRender, renderMode)`: se `renderMode === 'solo'`, abre `voices` + subTab `'solo'`; caso contrário, abre `voices` + subTab `'debate'` com `debateConfig.format` ajustado e texto preenchido.
   - Mapear `favoriteVoicesByLang` em `App.tsx` ou sincronizar com `PolyglotChatStudio` via props/evento customizado `'mytts-favorite-voices-changed'`.
2. Em `src/components/PolyglotChatStudio.tsx`:
   - Remover a barra larga com 3 `<select>` de `Vozes Favoritas` (`EN / IT / JA`) do cabeçalho do chat! Substituir por um botão compacto e discreto no cabeçalho (`Vozes: Puck · Kore · Aoede` ou ícone + `Configurar Vozes`) que aciona `onOpenVoicesConfigTab()`, deixando o cabeçalho do Chat Poliglota limpo (Título curto + `Nova Conversa` + `Configurar Vozes`).
3. Em `src/components/CommandPaletteModal.tsx`:
   - Atualizar os comandos de navegação para os 4 módulos (`polyglot`, `voices` + sub-abas Solo/Debate/Catálogo, `chunks`, `study`).

- [ ] **Step 5: Auditar tamanho dos arquivos e rodar `npm run lint && npm test && npm run build`**

Verificar se `VoiceConfigWorkspace.tsx` (`<= 300` linhas) e `VoiceLibraryModal.tsx` (`<= 320` linhas) respeitam o limite `<= 600`, além de reduzir o tamanho de `App.tsx` e `StudioWorkspace.tsx`.
Run: `npm run lint; npm test; npm run build`
Expected: Tudo verde sem erros de tipo ou rotas quebradas.

---

### Task 4: Reorganizar `Área de Estudo` no Estilo Anki / Brainscape (Baralhos + Criador de Flashcards + Arena)

**Estrutura Proposta:**
Dividir `Área de Estudo` em 3 modos claros inspirados diretamente no fluxo do **Anki** e **Brainscape**:
1. **Baralhos (Home):** Lista estruturada de baralhos (`Baralho Principal`, `FastChunks`, baralhos criados pelo usuário) mostrando para cada baralho: contadores coloridos estilo Anki (`Novos`, `Para Revisar`, `Dominados`), barra de confiança/domínio `%` estilo Brainscape, botão primário **"Estudar Baralho"** e botão **"+ Novo Baralho"**.
2. **Estudar (Sessão Focada):** Fila filtrada pelo baralho selecionado (`Para Revisar Agora` ou `Todos`), carta fosca frente/verso com áudio TTS e pronúncia, botão rápido **"Editar Card"** na própria sessão e botões de avaliação com intervalos reais (`1 · Rever (<10m)`, `2 · Bom (1d / Nd)`, `3 · Fácil (4d / Nd)`).
3. **Criar & Gerenciar (Criador Anki/Brainscape + Lista do Baralho):** Formulário dedicado de criação/edição de flashcards com campos `Baralho`, `Idioma (EN / IT / JA)`, `Frente`, `Verso`, `Pronúncia`, `Exemplo de Uso`, `Nuance / Nota`, botão **"Completar com IA"** (chama `requestGenerateFlashcard`), pré-visualização instantânea do card e ação **"Salvar e Criar Próximo"**, mantendo um botão discreto **"Importar Lote (CSV/MD/JSON)"** para abrir `<FlashcardImporterModal>`.

**Files:**
- Modify: `src/services/flashcardDeckStorage.ts`
- Create: `src/components/study/StudyDeckOverview.tsx`
- Create: `src/components/study/FlashcardCreatorPanel.tsx`
- Modify: `src/components/StudyArenaView.tsx`
- Modify: `tests/audio-engine.test.ts`

**Interfaces:**
```ts
// src/services/flashcardDeckStorage.ts
export interface DeckSummary {
  deckName: string;
  total: number;
  newCount: number;
  dueCount: number;
  learningCount: number;
  masteredCount: number;
  masteryPercent: number;
  languages: string[];
}

export function computeDeckSummaries(cards: FlashcardItem[], now?: number): DeckSummary[];
export function filterStudyQueue(
  cards: FlashcardItem[],
  options: { deckName: string; language: string; dueOnly: boolean; now?: number }
): FlashcardItem[];
export function buildManualFlashcardItem(input: {
  id?: string;
  deckName: string;
  language?: string;
  front: string;
  back: string;
  pronunciation?: string;
  example?: string;
  exampleTranslation?: string;
  nuance?: string;
  createdAt?: number;
  existing?: Partial<FlashcardItem>;
}): FlashcardItem;
```

- [ ] **Step 1: Escrever teste que falha (TDD Red) para `computeDeckSummaries`, `filterStudyQueue` e `buildManualFlashcardItem` (`Suite 19`)**

Adicionar em `tests/audio-engine.test.ts`:
- Verificar agrupamento correto por `deckName`, cálculo de `dueCount` (novos + vencidos com `nextReviewAt <= now`), `masteryPercent` estilo Brainscape (`Math.round((masteredCount / total) * 100)`), e ordenação estável.
- Verificar criação e edição de card via `buildManualFlashcardItem` (preserva `id` quando editado, sanitiza strings vazias, detecta idioma automaticamente via `detectFlashcardLanguage` quando omitido).
- Verificar `filterStudyQueue({ deckName, language, dueOnly: true, now })` excluindo cards já agendados no futuro (`nextReviewAt > now`).

Run: `npm test`
Expected: FAIL porque as funções ainda não estão exportadas por `src/services/flashcardDeckStorage.ts`.

- [ ] **Step 2: Implementar helpers puros em `src/services/flashcardDeckStorage.ts`**

Adicionar `computeDeckSummaries`, `filterStudyQueue` e `buildManualFlashcardItem` respeitando funções curtas (`<= 50` linhas) e tipos estritos.

- [ ] **Step 3: Criar `src/components/study/StudyDeckOverview.tsx` (`<= 240` linhas)**

Renderizar:
- Cabeçalho de resumo enxuto (Total para hoje, % de domínio geral, botões **"+ Criar Flashcard"** e **"Importar Lote"**).
- Input rápido **"+ Novo Baralho"** (cria baralho local/seleciona no criador sem precisar de modal).
- Grid ou lista organizada estilo Anki/Brainscape de `DeckSummary[]` com badges `EN`/`IT`/`JA`, contadores `Novos` / `Revisar` / `Dominados`, barra horizontal de progresso fosca (`--accent-emerald` / `--accent-amber`), e botões semânticos **"Estudar"** e **"+ Card"**.

- [ ] **Step 4: Criar `src/components/study/FlashcardCreatorPanel.tsx` (`<= 340` linhas)**

Renderizar editor limpo estilo Anki / Brainscape em layout responsivo 2 colunas (Formulário à esquerda + Preview em tempo real Frente/Verso à direita no desktop):
- Seletor de Baralho existente + opção rápida "Digitar novo baralho".
- Seletor de Idioma (`Auto`, `EN`, `IT`, `JA`).
- Campos `Frente (Expressão/Frase)`, `Verso (Tradução/Significado)`, mais seção expansível/opcional (`Pronúncia/Fonética`, `Exemplo em contexto`, `Nuance`).
- Botão **"Completar com IA"**: envia `front` + `language` para `requestGenerateFlashcard` e preenche apenas campos vazios (mantendo o que o usuário já digitou!). Tratamento de erro com `unknown`.
- Ações semânticas: **"Salvar Card"**, **"Salvar e Criar Próximo"** (limpa textos mantendo baralho & idioma) e **"Cancelar Edição"** quando estiver editando card existente (upsert por `id` via `addFlashcardsToDeck`).

- [ ] **Step 5: Refatorar `src/components/StudyArenaView.tsx` (`<= 430` linhas)**

Organizar a visão em 3 abas semânticas de linha única (`Baralhos`, `Estudar`, `Criar & Gerenciar`):
- Estado `studySubTab: 'decks' | 'review' | 'create'`, `editingCard: FlashcardItem | null`, `dueOnly: boolean`.
- Aba `decks`: renderiza `<StudyDeckOverview />`; clicar **"Estudar"** em um baralho define `selectedDeck` e muda para `'review'`; clicar **"+ Card"** define `selectedDeck` e muda para `'create'`.
- Aba `review`: mostra barra de progresso da fila (`Card X de Y`), toggle `Somente pendentes hoje` vs `Todos do baralho`, card fosco frente/verso com botão de áudio TTS e botão **"Editar"** (que abre `'create'` com `editingCard`), e barra inferior de classificação espaçada (`1 · Rever`, `2 · Bom`, `3 · Fácil`).
- Aba `create`: renderiza `<FlashcardCreatorPanel />` + barra de busca/tabela de cartas do baralho selecionado (com ações rápidas Ouvir, Editar, Excluir) + botão para abrir `<FlashcardImporterModal />` para importações em lote CSV/MD/JSON/HTML.

- [ ] **Step 6: Rodar `npm run lint && npm test && npm run build` e validar Verde**

Run: `npm run lint; npm test; npm run build`
Expected: `Suite 19` + todas as 18 suítes anteriores verdes; `StudyArenaView.tsx` abaixo de 450 linhas; build Vite limpo.

---

### Task 5: Sincronização de Documentação (`.context/`, `DESIGN.md`) e Verificação E2E / Visual Final

**Files:**
- Modify: `DESIGN.md`
- Modify: `.context/spec.md`
- Modify: `.context/CURRENT_STATE.md`
- Modify: `CONTEXT.md`
- Modify: `.context/context.md`

- [ ] **Step 1: Atualizar `DESIGN.md`, `.context/spec.md`, `CONTEXT.md` e `.context/CURRENT_STATE.md`**

- Atualizar lista oficial de módulos em `.context/spec.md` e `CONTEXT.md` (`polyglot`, `voices` = Configuração de Vozes, `chunks`, `study`).
- Atualizar `DESIGN.md` documentando os 2 presets exclusivos (`obsidian` = Escuro Fosco, `slate` = Claro Fosco) e remoção do padrão pontilhado / brilhos especulares.
- Registrar a conclusão das Tasks 1–4 em `.context/CURRENT_STATE.md` e `.context/context.md`.

- [ ] **Step 2: Gate Automatizado Completo & Auditoria de Linhas/Tokens**

1. Rodar `npm run lint && npm test && npm run build`.
2. Conferir contagem de linhas dos arquivos novos e editados garantindo `<= 600` linhas nos novos módulos (`conversationSessionState.ts`, `VoiceConfigWorkspace.tsx`, `StudyDeckOverview.tsx`, `FlashcardCreatorPanel.tsx`, `StudyArenaView.tsx`, `VoiceLibraryModal.tsx`).
3. Confirmar ausência de hexes cobalto e `backdrop-blur-*` em `src/`.

- [ ] **Step 3: Verificação em Navegador Real (Playwright / `http://localhost:3002`)**

Subir `npm run dev` e validar em 1440×900 (desktop) e 390×844 (mobile), zero erros no console:
1. Criar uma **Nova Conversa** no Chat Poliglota, navegar para **Área de Estudo** e **Configuração de Vozes**, retornar ao Chat Poliglota e confirmar que o novo chat (sem voltar para o primeiro chat fixado) e também uma segunda conversa salva sobrevivem à troca de aba e ao `reload()`.
2. Alternar entre **Escuro Fosco** e **Claro Fosco** no popover de usuário e no `Ctrl+K`, verificando visual limpo, sem branco ofuscante no claro, sem brilhos especulares e sem FOUC no recarregamento.
3. Navegar pelas 3 sub-abas de **Configuração de Vozes** (`Catálogo & Favoritas`, `Leitura Solo`, `Debate & Diálogo`), testar alteração de voz favorita e hand-off "+ Estúdio de Criação".
4. Em **Área de Estudo**, criar um novo baralho e novo flashcard via **Criar & Gerenciar**, conferir na aba **Baralhos**, iniciar revisão na aba **Estudar**, editar card e avaliar retenção.

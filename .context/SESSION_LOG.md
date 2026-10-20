# Log de Sessão (mytts)

## Data e Hora
- **Data/Hora**: 2026-10-20T14:38:00-04:00 (Local)

## Arquivos Tocados neste Turno (Refatoração Minimalista Cinza Studio / Ad Lucem + Voz por Card + Exportação WAV)
- `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/CommandPaletteModal.tsx` (Chat Poliglota definido como página principal #1; remoção da aba isolada `mic`/`LiveVoiceMic.tsx`; sincronização global bidirecional de voz por Card e por turno).
- `src/components/AgentInputDock.tsx` (Atalho de Ditado Rápido e Live Mic API integrado diretamente no dock do Chat Poliglota com timer em tempo real, transcrição Gemini e auto-reprodução traduzida).
- `src/components/LanguageColumnCard.tsx`, `src/components/ParallelMessageBlock.tsx`, `src/components/FloatingCardAudioController.tsx`, `src/components/PolyglotChatStudio.tsx`, `src/components/ScriptViewer.tsx`, `src/components/StudioWorkspace.tsx` (Seletor de voz `<select>` dentro de cada Card, perfis favoritos de vozes por idioma persistidos no `localStorage`, sincronização automática com a voz global e download `.wav` 24kHz por card).
- `src/utils/interactionExporter.ts`, `src/components/ExportInteractionModal.tsx` (Correção de colunas duplicadas no CSV Anki, inclusão de `cardVoices` em Markdown/JSON, Preview ao Vivo `<pre>` e exportação de Áudio Master da Trilogia `.wav` 24kHz concatenado EN + IT + JA).
- `index.html`, `src/index.css`, `src/styles/globals.css`, `src/styles/theme.css`, `src/config/tokens.ts` (Tema Cinza sobre Cinza Monolítico `#57545d`/`#49464f`/`#8e8999` no escuro e Claro Moderno `Ad Lucem` `#F3F3F5`/`#FFFFFF` no claro, fundo com malha de pontos estilo Canva `radial-gradient` 22x22px, movimento elástico `spring` no hover dos cards e tipografia subpixel ultra-nítida).

## Comandos Validados no Terminal
- `npm run lint` (`tsc --noEmit`): Exit code 0 comprovado.
- `npm test` (`tsx test-audio-engine.ts`): Exit code 0 comprovado (14/14 suítes Nível 4 aprovadas).
- `npm run build` (`vite build`): Exit code 0 comprovado (`dist/` compilado em 318ms sem warnings).
- `audit_tactile_ui.py`: Exit code 0 (`Readiness Score: 100.0/100.0`).
- `deterministic_scorer.py --scan src`: Exit code 0 (`SGA = 100.0`, `INE = 100.0`, `ICI = 100.0`, `IPC = 100.0`, `IRM = 100.0`, `ICTE = 100.0`).

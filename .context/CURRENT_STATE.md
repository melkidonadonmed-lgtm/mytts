# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Redesign Completo de Frontend Estilo Speechify & ElevenLabs Concluído. Sidebar persistente, Leitor Neural Direto (`QuickReader`), Módulo de Ditado por Microfone (`LiveVoiceMic`), Catálogo de Vozes (`VoiceLibrary`), especificação em `designe.md` e `README.md`.
- **Status da Branch**: `main` (código testado com `tsc --noEmit` e `vite build` 100% exit code 0).

## Decisões Tomadas
1. **Arquitetura de Navegação Estilo ElevenLabs/Speechify**:
   - Sidebar lateral persistente (`Sidebar.tsx`) substituindo o cabeçalho sobrecarregado, com transições fluídas via View Transitions API.
   - A página inicial agora é o **Leitor Neural Direto** (`QuickReader.tsx`), focado em colar/digitar texto e ouvir imediatamente.
2. **Novos Endpoints de Serviço**:
   - `POST /api/synthesize-speech`: Síntese direta de texto corrido com Director's Chair, pausas de respiração e emoção.
   - `POST /api/transcribe-audio`: Transcrição de áudio do microfone com pontuação inteligente via Gemini 3.8 Flash.
3. **Módulo de Ditado & Gravação por Microfone**:
   - `LiveVoiceMic.tsx` com captura de microfone do navegador, timer reativo, transcrição inteligente e botão para transferir diretamente para o leitor.
4. **Documentação e Design System**:
   - `designe.md`: Especificação detalhada de UX, mapa de navegação (Mermaid) e contratos de dados.
   - `README.md`: Documentação técnica para execução local e deploy no Cloud Run.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Adicionar WebSockets para conversação bidirecional streaming ao vivo (Gemini Live API).

## Próximo Ponto de Entrada
- Deploy da nova revisão no Google Cloud Run e push para o GitHub.

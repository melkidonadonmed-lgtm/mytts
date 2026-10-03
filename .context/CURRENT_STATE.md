# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Consolidação Arquitetural do Chat Poliglota com Fast Chunks, Modal de Exportação e Remoção de Redundância Concluída.
- **Status da Branch**: `main`.
- **Revisão Ativa Cloud Run**: `mytts-00013-pdd` (100% do tráfego).
- **URL de Produção**: `https://mytts-1044179901556.us-central1.run.app`.

## Decisões Arquiteturais e Implementações
1. **Unificação do Estudo de Chunks no Polyglot Chat Studio**:
   - Eliminada a aba redundante `fastchunks` (`FastChunkAudioApp.tsx`), consolidando toda a experiência de blocos lexicais, tradução paralela (EN, IT, JA) e áudio neural no `PolyglotChatStudio.tsx`.
   - Navegação na `Sidebar.tsx` enxuta com 5 abas de alto impacto (Estúdio de Criação, Chat Poliglota, Microfone & Ditado, Estúdio de Debate, Biblioteca de Vozes).
2. **Modal Tátil de Exportação de Interação / Fast Chunks (`ExportInteractionModal.tsx`)**:
   - Diálogo amigável disparado via botão "Exportar Chunks" no cabeçalho da mensagem e no player flutuante.
   - Oferece 4 formatos de alta conveniência:
     - 📇 **Anki Flashcards (.csv)** com UTF-8 BOM e delimitador `;`.
     - 📋 **Tabela de Estudo Markdown (.md)** pronta para Obsidian/Notion.
     - 📦 **JSON Estruturado (.json)** com metadados e blocos.
     - 📚 **Injeção Direta no Deck Local**: Gera cartões trilíngues instantaneamente no `localStorage` sem precisar de download.
3. **Ergonomia e Controle na Barra de Chat (`AgentInputDock.tsx`) e Player (`FloatingCardAudioController.tsx`)**:
   - Auto-expansão dinâmica da área de texto com `textareaRef`, botão de limpeza rápida e atalho `Enter`/`Shift+Enter`.
   - Adicionada velocidade `1.5x` no player flutuante e atalho direto de exportação.
4. **Módulo de Exportação Universal (`src/utils/interactionExporter.ts`)**:
   - Rotinas canônicas e tipadas para geração dos arquivos e acionamento de download no navegador.

## Testes Reais e Verificações Auditáveis
- `npm run lint` (`tsc --noEmit`): Exit code `0` (Zero erros de tipagem estrita).
- `npm test` (`tsx test-audio-engine.ts`): Exit code `0` (8 baterias de testes com 100% de conformidade, incluindo validação de Anki CSV, Markdown, JSON e conversão de Flashcards).
- `npm run build` (`vite build`): Exit code `0` (Bundle reduzido para 554 kB compilado em 321ms).

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[BAIXO]`: Manter o arquivo `FastChunkAudioApp.tsx` no repositório como referência ou excluí-lo em limpeza futura caso não seja mais necessário.

## Próximo Ponto de Entrada
- Testar no navegador a nova experiência unificada de chat poliglota e o modal de exportação de fast chunks.

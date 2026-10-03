# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Deploy em Produção da Revisão do Saneamento de Código, Acessibilidade WCAG e Skill Canônica Concluído com Sucesso.
- **Status da Branch**: `main` (100% sincronizado com `origin/main` no commit `a1f450c`).
- **Revisão Ativa Cloud Run**: `mytts-00008-qxf` (100% do tráfego).
- **URL de Produção**: `https://mytts-1044179901556.us-central1.run.app`.

## Decisões Tomadas
1. **Skill Canônica de Auditoria (`auditoria-projetos-sistema`)**:
   - Criação da esteira técnica completa (v2.0.0) com rubrica de 0 a 100 pontos, regras determinísticas (`rules/criterios_auditoria.md`), evals com salvaguarda HITL (`evals/evals.json`) e script de captura Playwright (`scripts/visual-audit-mural.js`).
   - Espelhamento paritário no workspace local, no plugin global `franklin-skills` e na incubadora `c:\Users\melki\dev\franklin-quebragalho\`.
   - Registro e changelog no catálogo central `MY_SKILLS.md`.
2. **Execução do Plano de Ação da Auditoria**:
   - **Higiene de Repositório**: Remoção segura dos 3 componentes legados órfãos (`AudioPlayerBar.tsx`, `DocumentIngestion.tsx`, `TopBar.tsx`), reduzindo o bundle size e despoluindo a árvore de componentes.
   - **Acessibilidade WCAG**: Adicionados atributos de teclado (`role="button"`, `tabIndex={0}`, `aria-pressed`, `onKeyDown` para Enter/Space e anéis de foco) nos elementos clicáveis de `ScriptViewer.tsx` e `LanguageColumnCard.tsx`.
   - **Coerência Documental**: `README.md` sincronizado com a 6ª funcionalidade (Chat Poliglota Multimodal) e endpoints atualizados no diagrama Mermaid.
3. **Validação em Produção (Live Smoke Test)**:
   - Revisão `mytts-00008-qxf` ativa servindo 100% do tráfego.
   - HTTP 200 no `/api/health` e `/`.
   - Assets Vite de produção servidos: `index-qG1NhZk1.js` e `index-DQd-EAdJ.css`.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Adicionar WebSockets para conversação bidirecional streaming ao vivo (Gemini Live API).
  - `[BAIXO]`: Executar esteira visual Playwright caso o usuário deseje gerar o mural de capturas.

## Próximo Ponto de Entrada
- Evolução da camada de streaming bidirecional com WebSockets ou novas expansões funcionais.

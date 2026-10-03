# CRITÉRIOS DETERMINÍSTICOS DE AUDITORIA E REJEIÇÃO

Para evitar simulações vazias e auditorias inventadas, o agente auditor deve emitir estritamente um dos seguintes status determinísticos:
- `[PASS]`: Requisito comprovado e verificado contra âncoras documentais ou código real inspecionado.
- `[FAIL]`: Requisito violado com motivo específico demonstrado e apontamento de linha/arquivo.
- `[UNVERIFIED]`: Não verificável por ausência de insumos no input ou impossibilidade de execução.

---

### Regra 1: Governança Física e Arquivos Vitais (Dimensão 1 - 20 pts)
- **Critério**: O repositório contém `README.md`, `CONTEXT.md` (ou `GEMINI.md`/`AGENTS.md`), `DESIGN.md` (se possuir UI), `SPEC.md`/`TODO.md`, `.env.example` e `.gitignore`?
- **Teste**:
  - `README.md` ausente ou vazio -> `[FAIL: README_AUSENTE]`
  - `.env` ou segredos comitados no Git -> `[FAIL: VAZAMENTO_CREDENCIAIS_GIT]`
  - `.gitignore` sem exclusão de `node_modules/` ou builds -> `[FAIL: GITIGNORE_INADEQUADO]`
  - Arquivos vitais presentes e íntegros -> `[PASS]`

### Regra 2: Coerência Narrativa Documental (Dimensão 2 - 20 pts)
- **Critério**: Todas as funcionalidades descritas no README existem e estão implementadas?
- **Teste de Classificação**:
  - Função existe e tem lógica real conectada -> `[IMPLEMENTADO_FUNCIONAL]`
  - Interface existe mas retorna dados estáticos sem conexão -> `[MOCK_SUPERFICIAL]`
  - Documentação promete mas arquivo/rota não existe -> `[INEXISTENTE_DOCUMENTADO]`
  - Módulo complexo presente sem registro documental -> `[CÓDIGO_FANTASMA]`

### Regra 3: Higiene de Código e Detecção de Orfandade (Dimensão 3 - 25 pts)
- **Critério**: Há arquivos de código `.ts`, `.tsx`, `.js`, `.py` não importados a partir dos entrypoints (`index`, `app`, `main`, `server`)?
- **Teste**:
  - Arquivo isolado sem nenhuma referência cruzada ou teste -> `[FAIL: ARQUIVO_ORFAO]`
  - Funções exportadas que não possuem consumidores -> `[FAIL: EXPORT_MORTO]`
  - Árvore de dependências 100% conectada -> `[PASS]`

### Regra 4: Conformidade UI/UX, Fontes e Nós Interativos (Dimensão 4 - 20 pts)
- **Critério**: A paleta de cores é uniforme, alvos de toque são adequados (>= 44px) e botões/nós executam ações reais?
- **Teste**:
  - Tag `<div>` simulando botão sem `tabIndex` ou acessibilidade de teclado -> `[FAIL: DIVSOUP_ACESSIBILIDADE]`
  - Botão ou link com `onClick={() => {}}`, `onClick={void 0}` ou preventDefault vazio -> `[FAIL: NO_INERTE_SEM_ACAO]`
  - Conflito grave de contraste (texto ilegível ou quebra Dark/Light) -> `[FAIL: WCAG_CONTRASTE]`
  - Escala tipográfica padronizada e botões conectados -> `[PASS]`

### Regra 5: Protocolo Human-in-the-Loop para Execução Visual (Dimensão 5 - 15 pts)
- **Critério**: O pipeline automatizado de screenshots (Playwright) foi disparado com consentimento explícito?
- **Teste**:
  - Agente disparou script de teste visual sem autorização prévia -> `[FAIL: VIOLACAO_HITL]`
  - Agente solicitou confirmação apresentando comando e rotas -> `[PASS]`

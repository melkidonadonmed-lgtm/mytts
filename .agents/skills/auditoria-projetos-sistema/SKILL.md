---
name: auditoria-projetos-sistema
description: Audita a integridade estrutural, arquivos essenciais (README, CONTEXT, DESIGN, SPEC), higiene de repositório (.env, .gitignore, Git), orfandade de código, discrepâncias entre o escopo documentado e o executado, conformidade de UI/UX (temas, fontes, alvos de clique, nós de ação) e esteira visual automatizada via MCP/Playwright com emissão de nota ponderada (0 a 100).
compatibility: Ambientes com suporte a Agent Skills (VS Code Copilot, Claude Desktop, Cursor, Google ADK, Antigravity IDE). Requer Node.js 20+ ou Python 3.11+ para scripts auxiliares.
metadata:
  version: "2.0.0"
  author: "Arquiteto de Soluções"
  category: "Engenharia de Software, Auditoria e Qualidade"
---

# 1. NOME DA SKILL
`auditoria-projetos-sistema` (Auditor Sênior de Repositórios, Arquitetura, UI/UX e Protocolos de Contexto)

---

# 2. DESCRIÇÃO
Esta skill implementa uma esteira de inspeção técnica e visual de alta fidelidade para repositórios modernos. Ela analisa a hierarquia física de pastas e arquivos de governança, identifica códigos e arquivos órfãos, confronta a promessa funcional da documentação contra a implementação real nos arquivos, avalia a coesão do Design System (discrepâncias de fontes, coerência de temas por componente e se os nós interativos realmente ativam ações funcionais) e disponibiliza um protocolo de captura sequencial de telas para geração de mural comparativo de transições. O resultado é consolidado em um relatório formal com nota ponderada de 0 a 100, matriz de riscos e plano de ação imediato.

---

# 3. GATILHOS DE ATIVAÇÃO
Carregue esta skill quando o usuário solicitar:
- "Audite este projeto / repositório por completo"
- "Verifique a integridade da estrutura de pastas, arquivos essenciais e gitignore"
- "Avalie a qualidade do código, arquivos órfãos e compare com o README"
- "Audite a UI/UX, fontes, temas por seção e se os botões/nós realmente funcionam"
- "Execute modo de print sequencial de telas para montar um mural visual e checar transições"
- "Calcule a nota de maturidade técnica do projeto"

**Quando NÃO usar esta skill:**
- Para refatorar código massivamente antes da aprovação do relatório de auditoria.
- Para gerar novas funcionalidades do zero que não façam parte de uma verificação de conformidade.
- Para resolver apenas um bug pontual isolado de sintaxe sem contexto do projeto.

---

# 4. ENTRADAS ESPERADAS
- `project_root_path` (obrigatório): Caminho absoluto ou relativo da raiz do projeto auditado.
- `stack_preference` (opcional): Stack primária do projeto (ex.: Next.js/React + Tailwind + FastAPI, Node.js puro, Python Agentic).
- `audit_scope` (opcional): Escopo desejado (`completo`, `somente_arquitetura_git`, `somente_ui_ux`, `somente_codigo`). Padrão: `completo`.
- `enable_visual_run` (opcional, booleano): Habilita o pipeline de captura de screenshots via script auxiliar/MCP (padrão: `false`, requer aprovação prévia).

---

# 5. PROCESSAMENTO INTERNO (MÓDULOS DESACOPLADOS)

O agente deve processar a auditoria em fases sequenciais para evitar saturação da janela de contexto:

```text
[Início da Auditoria]
│
▼
[Módulo 1: Governança Física & Git] ──► .env, .gitignore, pastas vitais
│
▼
[Módulo 2: Coerência Documental]     ──► README/CONTEXT vs Código Real
│
▼
[Módulo 3: Qualidade & Orfandade]    ──► Arquivos mortos, exports sem uso
│
▼
[Módulo 4: UI/UX, Temas & Nós]       ──► Cores, Fontes, Handlers de ação
│
▼
[Módulo 5: Captura Visual & Mural]   ──► (Requer HITL) Prints & Transições
│
▼
[Módulo 6: Integrações & MCP]        ──► Schemas, Tools, Conectores
│
▼
[Módulo 7: Rubrica & Nota Final]     ──► Cálculo ponderado (0 a 100)
```

---

### MÓDULO 1: GOVERNANÇA DE PASTAS, HIGIENE DE REPOSITÓRIO E GIT
1. **Varredura de Estrutura Mínima Obrigatória:**
   - Conferir se existem os artefatos vitais de governança:
     * `README.md` (instruções objetivas de instalação e inicialização).
     * `CONTEXT.md` (regras de negócio, fronteiras e restrições da IA).
     * `DESIGN.md` (tokens visuais, paleta, componentes base — se houver UI).
     * `SPEC.md` ou `TODO.md` (delimitação estrita do MVP atual).
     * `.env.example` (documentação de variáveis de ambiente sem segredos reais).
     * `.gitignore` (bloqueio estrito de `node_modules/`, `.env`, `.venv/`, `.next/`, `dist/`, caches locais).
   - Verificar presença das pastas especializadas:
     * `.agents/skills/` ou `skills/` (definições no padrão SKILL.md).
     * `mcp_servers/` (servidores locais ou arquivos de conexão).
     * `scripts/` (utilitários de automação e validação).
     * `tests/` (testes unitários e de integração).
2. **Auditoria de Vazamento e Git:**
   - Detectar se há chaves de API, senhas ou tokens expostos em arquivos comitáveis.
   - Conferir se o lockfile do projeto é único e íntegro (ex.: apenas `package-lock.json` ou apenas `pnpm-lock.yaml`, nunca múltiplos simultâneos).

---

### MÓDULO 2: CONFRONTO DOCUMENTAÇÃO VS. REALIDADE (PROMETIDO VS. IMPLEMENTADO)
1. **Extração das Premissas Documentadas:**
   - Ler o `README.md` e `CONTEXT.md`, isolando a lista de funcionalidades alegadas, rotas prometidas e integrações declaradas.
2. **Confronto com a Base de Código:**
   - Para cada recurso prometido: verificar se o arquivo, rota de API ou tela realmente existe.
   - Classificar o status:
     * `[IMPLEMENTADO_FUNCIONAL]`: Existe e possui lógica completa.
     * `[MOCK_SUPERFICIAL]`: O componente existe visualmente, mas devolve dados fictícios estáticos sem conexão real.
     * `[INEXISTENTE_DOCUMENTADO]`: O documento promete o recurso, mas não há código correspondente.
     * `[CÓDIGO_FANTASMA]`: Há módulos complexos criados que não foram descritos na documentação.

---

### MÓDULO 3: QUALIDADE DE CÓDIGO, MODULARIDADE E ARQUIVOS ÓRFÃOS
1. **Detecção de Código Morto e Orfandade:**
   - Rastrear arquivos `.ts`, `.tsx`, `.js`, `.py` presentes na árvore que nunca são importados no ponto de entrada (`index`, `app`, `main`).
   - Identificar funções exportadas que não possuem consumidores internos nem testes.
2. **Análise de Arquitetura e Acoplamento:**
   - Verificar se há separação entre camadas de Domínio/Regras de Negócio, Infraestrutura/APIs e Apresentação/UI.
   - Detectar anti-padrões como: chamadas diretas de banco de dados ou `fetch` soltos no corpo de renderização de componentes, ausência de tratamento de erros `try/catch` e tipos `any` genéricos.

---

### MÓDULO 4: AUDITORIA DE UI/UX, DESIGN SYSTEM, TEMAS E NÓS DE AÇÃO
1. **Auditoria de Temas por Seção e Componente:**
   - Mapear a paleta de cores usada em cada sessão (`Header`, `Sidebar`, `Main`, `Cards`, `Modals`).
   - Identificar conflitos de tema: componentes com fundo claro forçado (`bg-white`) dentro de páginas configuradas para Dark Mode profundo, ou textos com contraste ilegível (reprovado na WCAG 2.1 AA).
2. **Discrepância Tipográfica (Fontes e Escalas):**
   - Identificar declared fonts vs. inline fonts: fontes carregadas pelo sistema vs. classes arbitrárias soltas no código (ex.: misturar semântica de `inter`, `roboto` e `font-mono` sem convenção).
   - Checar se a tipografia é fluida (uso de `rem` ou `clamp()`) ou se trava em `px` fixos que quebram em visualização mobile.
3. **Validação de Nós Interativos (O nó acionado ativa mesmo a ação?):**
   - Mapear botões, links, abas e nós de fluxo:
     * Checar se tags `<div>` estão simulando botões sem eventos acessíveis por teclado.
     * Checar se os eventos `onClick` ou `handleSubmit` possuem manipuladores reais conectados a funções ou se contêm apenas `console.log("clicou")`, `event.preventDefault()` vazio ou `void(0)`.
     * Apontar se o nó altera o estado real da aplicação ou se é um elemento inerte.

---

### MÓDULO 5: ESTEIRA VISUAL AUTOMATIZADA, PRINTS EM SEQUÊNCIA E MURAL (OPCIONAL/HITL)
> **REGRA DE SEGURANÇA OBRIGATÓRIA (Human-in-the-Loop):** A execução de scripts de teste visual ou captura de tela deve sempre ser aprovada pelo usuário antes do disparo.
1. **Disparo do Script Sequencial de Captura:**
   - O agente apresenta o comando para rodar a esteira local (via script Playwright/Node).
   - O script percorre todas as rotas declaradas no projeto nos viewports:
     * Desktop: 1920x1080
     * Mobile: 375x812
2. **Geração do Mural Unificado:**
   - O script agrupa os screenshots em uma prancha unificada (`mural_visual.png` ou galeria HTML local) para inspeção panorâmica.
3. **Análise de Transições e Estados:**
   - Avaliar se a transição entre telas mantém a estabilidade do layout (sem saltos de cabeçalho, sem flashes brancos entre rotas escuras e sem perda de posição de scroll).

---

### MÓDULO 6: INTEGRAÇÃO COM MODEL CONTEXT PROTOCOL (MCP) E CONECTORES
1. **Checagem de Configurações MCP:**
   - Verificar se existe `mcp_config.json`, `.vscode/mcp.json` ou arquivos de conexão válidos.
   - Avaliar se os servidores declarados (ex.: filesystem, git, servidores customizados) contêm caminhos absolutos corretos e variáveis protegidas.
2. **Qualidade dos Schemas de Tools:**
   - Se o projeto expõe ferramentas MCP: verificar se possuem nome semântico, descrição com efeito colateral explícito, esquema de entrada rigoroso (`extra="forbid"`) e tipos definidos.

---

### MÓDULO 7: SISTEMA DE PONTUAÇÃO PONDERADA (NOTA 0 A 100)
A nota de maturidade técnica do projeto é calculada pela soma das 5 dimensões ponderadas:

| Dimensão | Peso | Critério de Pontuação |
|---|---|---|
| **1. Governança e Arquitetura** | 20 pts | Presença de README, CONTEXT, SPEC, DESIGN, .env.example e .gitignore sem lixo. |
| **2. Coerência Funcional** | 20 pts | O que o README descreve corresponde ao código real (zero funções fantasma/mock enganoso). |
| **3. Qualidade de Código & Higiene** | 25 pts | Ausência de arquivos órfãos, tipagem forte, ausência de loops assíncronos e testes mínimos. |
| **4. Ergonomia UI/UX & Acessibilidade** | 20 pts | Temas coerentes, contraste WCAG AA, fontes sem discrepâncias, nós interativos funcionais. |
| **5. Segurança e Protocolos (Git/MCP)** | 15 pts | Zero segredos comitados, schemas de entrada blindados, dependências seguras. |

**Tabela de Classificação Final:**
- **90 a 100 pts:** Nível Enterprise / Pronto para Produção.
- **70 a 89 pts:** Funcional com Débitos Técnicos Moderados.
- **50 a 69 pts:** MVP Instável / Requer Saneamento Estrutural.
- **Abaixo de 50 pts:** Reprovado / Risco Crítico de Manutenção ou Segurança.

---

# 6. SAÍDA (FORMATO OBRIGATÓRIO DO RELATÓRIO)
A saída desta skill deve ser gerada estritamente no seguinte formato estruturado:

```markdown
# RELATÓRIO DE AUDITORIA TÉCNICA E VISUAL DO PROJETO

## 1. RESUMO EXECUTIVO & NOTA GERAL
- **Projeto Auditado:** [Nome ou Caminho do Projeto]
- **Pontuação Consolidada:** [X / 100] -> [Classificação: Enterprise / Moderado / Instável / Reprovado]
- **Diagnóstico Síntese:** [2 a 3 frases resumindo a maturidade do repositório]

## 2. AUDITORIA ESTRUTURAL E GOVERNANÇA DE PASTAS
| Arquivo / Pasta Vital | Status | Observação Técnica |
|---|---|---|
| `README.md` | [PRESENTE / AUSENTE / INCOMPLETO] | [Diagnóstico] |
| `CONTEXT.md` | [PRESENTE / AUSENTE] | [Diagnóstico] |
| `DESIGN.md` | [PRESENTE / AUSENTE] | [Diagnóstico] |
| `SPEC.md` / `TODO.md` | [PRESENTE / AUSENTE] | [Diagnóstico] |
| `.gitignore` | [CONFORME / INADEQUADO] | [Apontar se vaza build ou node_modules] |
| `.env.example` | [SEGURO / AUSENTE / CHAVES_EXPOSTAS] | [Diagnóstico] |
| `skills/` ou `.agents/` | [CONFIGURADO / AUSENTE] | [Diagnóstico] |
| `mcp_servers/` / configs | [CONFIGURADO / AUSENTE] | [Diagnóstico] |

## 3. COERÊNCIA NARRATIVA: DOCUMENTADO VS. IMPLEMENTADO
| Funcionalidade Declarada | Status no Código | Evidência / Arquivo |
|---|---|---|
| [Recurso X do README] | [IMPLEMENTADO / MOCK / INEXISTENTE] | [src/components/... ou ausente] |

## 4. HIGIENE DE CÓDIGO & ARQUIVOS ÓRFÃOS
- **Arquivos Não Referenciados (Órfãos):** [Lista dos arquivos que existem mas nunca são importados]
- **Exports Mortos:** [Funções que ninguém consome]
- **Gargalos de Qualidade:** [Erros de tipagem, dependências ausentes, loops potenciais]

## 5. AUDITORIA VISUAL, DESIGN SYSTEM & NÓS INTERATIVOS
- **Coerência de Temas:** [Diagnóstico de Light/Dark mode por componente e quebras de contraste]
- **Discrepâncias de Fontes:** [Fontes declaradas vs. fontes arbitrárias encontradas]
- **Integridade dos Nós e Ações:**
  * Botões sem ação real: [Lista de botões com onClick vazio ou apenas preventDefault]
  * Acessibilidade de Navegação: [Uso correto de tags semânticas vs divsoup]

## 6. STATUS DA ESTEIRA VISUAL (SCREENSHOTS / MURAL)
- [Status: Não executado (Aguardando aprovação) OU Executado com sucesso]
- [Achados das transições de tela: Estabilidade do layout, ausência de flickers]

## 7. MATRIZ DE PONTUAÇÃO DETALHADA
- Governança e Arquitetura: [X / 20]
- Coerência Funcional: [X / 20]
- Qualidade de Código & Higiene: [X / 25]
- Ergonomia UI/UX & Acessibilidade: [X / 20]
- Segurança e Protocolos (Git/MCP): [X / 15]
- **NOTA TOTAL: [X / 100]**

## 8. PLANO DE AÇÃO IMEDIATO (PRIORIZADO)
1. [Ação Crítica 1 - Correção bloqueante]
2. [Ação de Média Prioridade 2 - Saneamento de orfandade/tema]
3. [Melhoria Preventiva 3 - Refinamento de documentação]
```

---

# 7. EXCEÇÕES E LIMITES (O QUE A SKILL NÃO COBRE)

* **Não executa deploys ou alterações no banco de produção:** Limita-se à auditoria de arquivos e código local.
* **Não substitui suites formais de testes end-to-end de carga (stress testing):** O teste de transição e print analisa a estabilidade estética e navegabilidade visual, não vazão de requisições por segundo.
* **Não executa mutações no sistema de arquivos sem confirmação prévia:** Toda deleção de código órfão ou criação de arquivos deve ser expressamente confirmada pelo operador.

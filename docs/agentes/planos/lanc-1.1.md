# lanc-1.1 — Achar o Prism no PC · Plano de implementação

> **Para agentes:** item único, triagem M7 (Node 22 nativo, sem dependência nova), risco médio. Issue: #35. Briefing: `docs/agentes/briefings/lanc-1.1.md`.

**Objetivo:** `detectarPrism` diz se o Prism Launcher está no PC, em que pasta, qual versão e onde ficam as instâncias; sem Prism devolve o link oficial.

**Arquitetura:** `prism.ts` só com funções puras e dependências injetadas (`fs`, `ambiente`, `lerRegistro`, `pastaEscolhida`). Nenhum código do Prism (GPL-3.0): só comportamento observável (nomes de arquivo e a chave `InstanceDir` do `prismlauncher.cfg`, texto `chave=valor`).

## Restrições globais

- Ordem: pasta escolhida → instalação padrão (`%LOCALAPPDATA%\Programs\PrismLauncher`) → portátil (`prismlauncher.cfg` ao lado do `.exe`) → dados em `%APPDATA%\PrismLauncher`.
- `InstanceDir` relativo vale a partir da pasta de dados; padrão `instances`; aspas e barras tratadas.
- Versão: `reg query` via `execFile` **sem shell**, argumentos fixos; portátil ou sem registro → `versao: null` com aviso. Mínima 8.0 (decidida pela Máxima).
- Nenhum teste chama o `reg` nem o Prism de verdade.

## Ponto de revisão

- Nada é executado além do `reg query` fixo; caminho vindo do amigo só é lido, nunca vira comando.

### Tarefa 1: `prism.test.ts` (falha antes) com pastas falsas temporárias
### Tarefa 2: `prism.ts`
### Tarefa 3: `npm run vistoria`, commit, PR

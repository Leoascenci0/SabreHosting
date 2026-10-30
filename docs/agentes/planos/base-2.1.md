# base-2.1 — Issues e rótulos para contribuidores · Plano de implementação

> **Para agentes:** plano curto de item único (triagem M3, sem código). Issue: #6. Briefing: `docs/agentes/briefings/base-2.1.md`.

**Objetivo:** dar a quem contribui três modelos de issue em pt-BR (bug, ideia, item de roadmap), um roteamento de falha de segurança para o `SECURITY.md`, e uma lista de rótulos com o passo a passo para o Eliel criá-los.

**Arquitetura:** só arquivos de configuração do GitHub e um documento em `docs/ops/`. Sem script, sem código de app.

**Stack:** formulários de issue do GitHub (YAML), Markdown.

## Restrições globais

- Texto em pt-BR; sem dado pessoal, sem mundo, sem segredo nos modelos.
- Modelo de bug pede versão do app e do Windows e avisa para **não anexar o mundo** nem dados pessoais.
- Falha de segurança **não** vira issue pública: `config.yml` aponta para o `SECURITY.md` / aba Security.
- Não editar `CONTRIBUTING.md` (fora do alcance). Se ele deve citar os modelos, vai para "Melhorias encontradas".
- Não criar rótulos no GitHub (é do Eliel).

## Ponto de revisão

- YAML inválido quebra o "New issue" silenciosamente: validar cada arquivo com `yaml.safe_load`.
- Rótulo citado num modelo (`labels:`) tem que existir na lista de `docs/ops/rotulos.md`.
- Modelo de bug sem campo de versão do Windows ou com campo de mundo anexado: revisar o texto.

---

### Tarefa 1: Modelos de issue e roteamento de segurança

**Arquivos:**
- Criar: `.github/ISSUE_TEMPLATE/bug.yml`
- Criar: `.github/ISSUE_TEMPLATE/ideia.yml`
- Criar: `.github/ISSUE_TEMPLATE/item-roadmap.yml`
- Criar: `.github/ISSUE_TEMPLATE/config.yml`

**Interfaces:**
- Consome: `SECURITY.md` (aba Security) como destino da falha de segurança.
- Produz: rótulos citados em `labels:` (`bug`, `ideia`, `roadmap` — conferir com a Tarefa 2).

- [ ] **Passo 1: Escrever `bug.yml`** — campos: o que aconteceu, como reproduzir, versão do app, versão do Windows, aviso "não anexe o mundo nem dados pessoais".
- [ ] **Passo 2: Escrever `ideia.yml`** — campos: problema que a ideia resolve, como imagina, quem usaria.
- [ ] **Passo 3: Escrever `item-roadmap.yml`** — campos: sigla e número do item, o que fazer, confirmação.
- [ ] **Passo 4: Escrever `config.yml`** — `blank_issues_enabled: true` e `contact_links` com a falha de segurança apontando para a aba Security (texto: "reporte em privado").
- [ ] **Passo 5: Validar** — `for f in .github/ISSUE_TEMPLATE/*.yml; do python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" "$f" && echo "OK $f"; done` → três `OK` e o `config.yml` também.

### Tarefa 2: Rótulos sugeridos para o Eliel criar

**Arquivos:**
- Criar: `docs/ops/rotulos.md`

**Interfaces:**
- Consome: nomes de rótulo usados pela Tarefa 1.
- Produz: lista de rótulos com cor e significado, para criação manual.

- [ ] **Passo 1: Escrever `rotulos.md`** — tabela com `bom-primeiro-item`, `seguranca`, `mundo`, `app`, `nuvem` (cor sugerida em hex, o que quer dizer), mais `bug`, `ideia`, `roadmap` citados pelos modelos.
- [ ] **Passo 2: Passo a passo para o Eliel** — Issues › Labels › New label, nome, cor, descrição; quais rótulos os modelos usam.
- [ ] **Passo 3: Conferir** — todo rótulo de `labels:` nos YAML aparece em `rotulos.md`.

### Tarefa 3: Entrega

- [ ] **Passo 1:** `npm ci && npm run vistoria` → APROVADA; colar o resumo no PR.
- [ ] **Passo 2:** commit com `git branch --show-current` e `git config user.email` conferidos.
- [ ] **Passo 3:** `git push -u origin roadmap/base-2.1`; PR contra a `main` com `Closes #6`.

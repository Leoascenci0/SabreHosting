# Motor da rodada (parte da skill `maxima`)

Origem: `rodada-milestone` de Felipe Marques (MIT), adaptada no SEURBH em 26/10/2026 e trazida para o SabreHosting
em 30/10/2026. As regras de autonomia, milestone e `main` da `SKILL.md` vencem o que estiver aqui.

## Configuração (já preenchida)

| Chave | Valor |
|---|---|
| `DONO` | Eliel (respostas sempre em balão `AskUserQuestion`, recomendada primeiro; formato "Resumo:" do CLAUDE.md) |
| `FILA` | seção **Fila** do `docs/MILESTONE.md` (puxa de todos os `docs/roadmap-*.md` e do backlog) |
| `BRIEFINGS` | `docs/agentes/briefings/<sigla>-<id>.md` (modelo em `references/briefing.md`) |
| `PLANOS` | `docs/agentes/planos/<sigla>-<id>.md` |
| `BRANCH_BASE` | `main` |
| `PREFIXO_BRANCH` | `roadmap/<sigla>-<id>` (siglas no CLAUDE.md) |
| `VERIFICACAO` | `npm run vistoria` → APROVADA (antes do item `base-1.1`: `python3 scripts/verificar.py --base origin/main`) |
| `REGRAS_EXTRAS` | CLAUDE.md inteiro; autor `asc.eliel@gmail.com`; regras de ouro do mundo; linhas `Segurança:`, `Integridade:`, `Enxugamento:`, `Roteamento:` |
| `ESTADO` | `docs/ops/rodadas/rodada-<AAAA-MM-DD>.md` no ramo da orquestradora |

**Pré-requisitos:** ferramentas `create_session`, `send_message`, `get_session`, `list_events`, `create_trigger`,
`delete_trigger`, `send_later` e `subscribe_pr_activity` (servidor `claude-code-remote`; carregue com `ToolSearch`)
e acesso ao GitHub do repositório. Elas estão em `permissions.allow` do `.claude/settings.json`. Sem elas, caia no
**modo chat por item**: a Máxima prepara o briefing e entrega ao Eliel o prompt de abertura de um chat novo por item.
Nunca peça a uma filha o que foi negado a você.

## Limites que vencem a rodada

- **Fila:** no máximo 1 PR de controle + 3 de item abertos. Com 3 abertos, mergeie o primeiro que passou na revisão.
- **Plano antes do código:** o "pode seguir" vem dado em todo item; a filha grava o plano como primeiro commit e segue.
- **Item que pede decisão do Eliel** nunca vai para filha: vira balão e fica em "Pendente do Eliel" no milestone.
- **Máquina da nuvem e mundo real:** filha nunca acessa. Item que precisa da máquina de verdade (instalar o cartório,
  abrir porta, criar a VM) é **P**: a filha entrega script + passo a passo, e quem executa é o Eliel (ou a Máxima com
  o "sim" dele).
- **Nunca:** auto-merge, push direto na `main`, `--force`, `--no-verify`, bypass de permissão.
- **Nunca perguntar "quer que eu siga?"**: terminou um item, siga para o próximo.
- **Modelo:** filha em Sonnet por padrão; item `MIÚDO: sim` em Haiku; Opus só com gatilho dito.

## 0. Preparação (uma vez)

1. Pré-voo: `git fetch --prune`, `git status` limpo, ramo próprio (`roadmap/rodada-<data>`), `list_sessions` (outra
   orquestradora ativa = parar e avisar). Leia `docs/memoria/INDEX.md`, `docs/ops/DECISOES.md` e o milestone.
2. Monte a fila pela compatibilidade da `SKILL.md` §3. Item sem código (ação manual, decisão) não entra.
3. Apresente em **um** balão a fila e as autorizações da rodada (padrão recomendado primeiro). Espere a resposta.
4. Descubra o próprio id (`get_session` sem argumento).
5. Crie o arquivo de `ESTADO` (formato no fim), commite e envie no seu ramo.
6. Arme o **heartbeat**: `create_trigger` ligado a ESTA sessão, `cron_expression: "0 * * * *"`, prompt:
   > Heartbeat da Máxima <data>: siga a skill Máxima, seção "Retomada" de references/rodada.md. Leia o arquivo de estado e continue de onde parou. Se nada mudou, não escreva nada.

## 1. Loop por item

1. `git fetch origin main` e os ramos dos PRs abertos da rodada.
2. Fila cheia (3 PRs de item)? Mergeie o primeiro aprovado; nenhum aprovado → termine o turno e espere.
3. **Triagem** (item de código): `Agent(subagent_type: "triagem")` com o texto do item; o retorno vai inteiro na
   linha `TRIAGEM:` do briefing.
4. **Briefing:** preencha `references/briefing.md`, salve em `BRIEFINGS`, commite e envie no ramo da orquestradora.
   Commit-base = `HEAD` da `main` (hash **completo**, 40 caracteres; o curto dá `ref_not_found`).
5. **Crie a filha** (`create_session`): repositório, `source_revision` = commit-base completo,
   `outcome_branch: roadmap/<sigla>-<id>`, `permission_mode` igual ou mais restrito que o seu (nunca `plan`), modelo
   pela triagem, prompt do **Template da filha**.
6. Estado: item 🔄, `session_id`, ramo, hora. Commite e envie.
7. **Watchdog:** `send_later` de 45 min ("Checar a filha <id> do item <sigla>-<id>").
8. **Termine o turno e espere.** Sem `sleep`, sem polling.

### Quando a filha avisar, ou o watchdog/heartbeat disparar

`get_session` da filha. Pelo `status_bucket`:
- `completed`/`review_ready` com PR: **Revisão**.
- `working`: re-arme o watchdog e termine o turno.
- `blocked` esperando "pode seguir": responda `send_message` "pode seguir". Se travou numa exceção do §2 da
  `SKILL.md`, leve ao Eliel; sem resposta, ⏸️ e siga.
- `failed` ou parada sem PR: `list_events`. Limite de uso ou erro passageiro → `send_message` "Continue de onde parou
  e termine com o ramo enviado e o PR aberto". Bloqueio real → ⏸️ com o motivo. Segunda falha no mesmo item → ⏸️.

### Revisão do PR

1. **Prova, não alegação:** rode você mesma, num worktree do ramo (`using-git-worktrees`), `npm run vistoria`.
2. **Arquivos:** só os do *Arquivo:* do item; plano como primeiro commit; nada em `CLAUDE.md`, `.claude/`,
   `docs/roadmap-*.md`, `docs/MILESTONE.md`.
3. **Mundo e segredos:** `python3 scripts/verificar.py --base origin/main` APROVADO (barra mundo real, segredo,
   arquivo grande). Achou segredo: reprova e pausa a rodada.
4. **Qualidade:** agente `qa` (no prompt, em maiúsculas: "PROIBIDO `git checkout`/`git switch` na pasta principal; use
   `git show`, `git diff` ou worktree próprio"). Item que toca trava, migração de host, sync ou rede: revisão com duas
   lentes (um `qa` em `integridade`, outro em `seguranca`) e síntese. Reprovado → lista exata à filha; uma devolução,
   na segunda o item sai (⏸️).
5. **Conflitos cruzados:** `git merge-tree --write-tree origin/main <ramo>` e contra cada PR aberto da rodada.
6. **Achados fora do escopo:** segurança ou integridade grave → confirme e **pause a rodada**, balão ao Eliel
   propondo hotfix. Demais → Backlog do milestone.
7. **Merge:** `SKILL.md` §4. Consolide "Soluções" (`solucoes.md`), "Melhorias encontradas" (`references/melhorias.md`)
   e a linha `Triagem:` (`docs/memoria/metodos-aprendidos.md`). Anote o custo. Volte ao **Loop**.

## 2. Encerramento (fila vazia ou rodada parada)

1. **PR de controle:** estado final no roadmap e no milestone, achados no Backlog, linha em `DECISOES.md` se houve
   decisão, memória se o Eliel corrigiu algo, estado movido para `docs/ops/rodadas/historico/`.
2. `delete_trigger` no heartbeat e em todo watchdog pendente.
3. Fim de milestone: gerar a versão de teste (item do roadmap correspondente) e gravar o **tutorial de teste**.
4. Reescrever `docs/ops/bom-dia.md`; relatório no chat aponta para ele e termina com o balão do próximo passo.

## Retomada (heartbeat, watchdog ou sessão reiniciada)

1. `git fetch` + `git show origin/<ramo>:<arquivo de estado>`.
2. Reconstrua a verdade pelo GitHub: existe PR do ramo `roadmap/<sigla>-<id>`? Foi mergeado? O GitHub vence o estado.
3. Item 🔄 sem PR: bloco "Quando a filha avisar". Nenhum 🔄: **Loop**. Fila vazia: **Encerramento**.
4. Nada mudou desde o último disparo: termine o turno **sem mensagem**.

## Template da filha

```
Você é o implementador do item {{ID}} do roadmap do SabreHosting, numa sessão filha da Máxima. Ramo:
roadmap/{{ID}}, a partir do commit {{BASE_COMMIT}} (confira com `git log -1 --oneline` e `git branch --show-current`;
se não bater, PARE e avise a orquestradora). Leia o briefing com
`git fetch origin {{RAMO_ORQUESTRADORA}} && git show origin/{{RAMO_ORQUESTRADORA}}:docs/agentes/briefings/{{ID}}.md`
e siga-o à risca.

## Como trabalhar
- Antes de agir: carregue `using-superpowers` e `qualidade-sabre` (a parte que o tipo do item pede; se o briefing
  tem LEIA:, leia só aquelas seções). Tela: também `impeccable` (`audit` e `polish` antes de entregar).
- Processo: `writing-plans` (plano em docs/agentes/planos/{{ID}}.md, PRIMEIRO commit), `test-driven-development`,
  `systematic-debugging` (antes, `grep -i` da mensagem em docs/memoria/solucoes.md), `verification-before-completion`,
  `finishing-a-development-branch` (enviar o ramo e abrir PR; nunca merge).
- Método: siga a linha TRIAGEM: do briefing; escreva uma vez só.
- Em conflito, o CLAUDE.md vence qualquer skill.

## Regras desta rodada
- Plano: primeiro commit e siga direto. Pare só se o item pedir decisão do Eliel: avise a orquestradora.
- Mundo: só mundos de teste (`tests/mundos/`); nunca o mundo real. Máquina da nuvem: nunca acesse; entregue script.
- Segredo: nenhum token, chave ou senha no código; use variável de ambiente e `.env.exemplo`.
- Fora do alcance: CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano).
  Nada de merge, push na main, --force ou --no-verify.
- Achado fora do escopo: não corrija; registre no PR em "Achados fora do escopo", com gravidade.
- Melhoria possível: NÃO implemente; descreva em "Melhorias encontradas" no formato de item de roadmap.

## Para quem você fala
Sua resposta final é para a orquestradora, não para o Eliel. Termine com
"Nada para o Eliel: a orquestradora revisa e mergeia."

## Entrega
1. `npm run vistoria` → APROVADA (cole o resumo no PR). Zero falha nova.
2. Antes de cada commit: `git branch --show-current` e `git config user.email` = asc.eliel@gmail.com.
3. Envie só o seu ramo e abra o PR contra a main pelo `.github/pull_request_template.md`, com `Refs #n`/`Closes #n`,
   "O que NÃO foi confirmado", "Achados fora do escopo", "Soluções", "Melhorias encontradas" e as linhas
   Triagem:, Segurança:, Integridade:, Enxugamento: e Roteamento:.
4. Avise a orquestradora: `send_message` para {{ID_ORQUESTRADORA}} com "PR #<n> aberto: <link> — <resumo>".
```

## Formato do arquivo de estado

```markdown
# Rodada da Máxima — <data>
orquestradora: <session_id> · heartbeat: <trigger_id> · ramo: <ramo>
autorizações: <lista>

| Ordem | Item | Status | Sessão | Ramo | PR | Vistoria | QA | Custo (US$) |
|---|---|---|---|---|---|---|---|---|
| 1 | <sigla>-<id> | ✅ / 🔄 / ⬜ / ⏸️ <motivo> | session_… | roadmap/… | #N | APROVADA | APROVADO | filha 0,00 + qa 0,00 |

## Conflitos entre PRs
## Achados para o Backlog
## Log
- <hora> — <evento>
```

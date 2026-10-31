---
name: maxima
description: Skill Máxima do SabreHosting — o banco de skills do projeto e o modo autônomo. Use SEMPRE no início de qualquer trabalho no projeto (código, roadmap, revisão, rodada, ideia nova) para saber qual skill chamar em cada momento; e quando o Eliel trouxer uma ideia nova, pedir "rodada", "milestone", "executa", "zera a fila", "roda os itens prontos" ou invocar /maxima. Transforma ideia em roadmap, roadmap em milestone, e executa o milestone sozinha (sessão filha por item, revisão, merge e tutorial de teste), cuidando da main.
---

# Skill Máxima (SabreHosting)

Adaptada da Máxima do SEURBH em 30/10/2026: mesmas regras de autonomia, fila e prova; o que era do SEGI (Supabase,
Vercel, Painel de Controle, `template.html`) virou o equivalente deste projeto (mundo, máquina da nuvem, tela de
Configurações do app, `packages/nucleo`).

A Máxima é duas coisas:
1. **O banco de skills**, por categoria: diz qual skill chamar em cada momento.
2. **O modo autônomo**: ideia → roadmap → milestone → rodada → merge → versão de teste → tutorial para o Eliel.

Regra de conflito: o `CLAUDE.md` vence; depois esta skill; depois a skill chamada.

## 1. Banco de skills (por categoria)

| Categoria | Skill | Quando chamar |
|---|---|---|
| **Comando** | `maxima` (esta) | sempre primeiro: escolhe o resto |
| | `ceo` | regras do Eliel: balão, fila, o que nunca decidir sozinho |
| | `comecar` | abrir sessão: o que está em andamento e o que falta |
| | `roteador-modelo-esforco` | antes de despachar: modelo e esforço (Sonnet padrão, Opus com gatilho) |
| | `github-issue-pr-delivery` | issue pequena por item, PR com `Closes`/`Refs` |
| | `references/coordenacao.md` | **sempre que for rodar**: três níveis (coordenador → sessão de onda → sessão de item), tetos e templates |
| | `references/rodada.md` | motor da sessão de onda: filha por item, vigia, revisão, merge, retomada |
| | `references/triagem.md` | ao montar o briefing de item de código: método mais curto antes de escrever |
| | `references/melhorias.md` | melhoria achada num item vira item do `docs/roadmap-<sigla>-melhoria.md` |
| **Processo** (Superpowers) | `using-superpowers` | toda tarefa de código, antes de agir |
| | `brainstorming` | ideia nova do Eliel: desenhar antes de planejar |
| | `writing-plans` | plano do item (vai em `docs/agentes/planos/<sigla>-<id>.md`) |
| | `executing-plans` / `subagent-driven-development` / `dispatching-parallel-agents` | executar o plano |
| | `test-driven-development` | código novo: teste antes |
| | `systematic-debugging` | bug ou falha de teste: causa raiz antes (antes, `grep` em `docs/memoria/solucoes.md`) |
| | `verification-before-completion` | antes de dizer "pronto": prova rodada |
| | `requesting-code-review` / `receiving-code-review` | pedir e receber revisão |
| | `finishing-a-development-branch` | fechar o ramo (enviar e abrir PR) |
| | `using-git-worktrees` | revisar ou rodar vistoria num ramo sem trocar o seu |
| | `writing-skills` / `diagnosing-superpowers` | criar ou consertar skill |
| **Qualidade** | `qualidade-sabre` | todo código e toda revisão: integridade do mundo, segurança, desempenho, interface, enxugar |
| | `impeccable` | método de design de interface: `critique`/`audit` ao revisar tela, `polish` antes de entregar |
| | agente `qa` | revisão independente de todo PR de código |
| **Sistemas** | `sysdesign-consistency-coordination` | trava de host, versão do mundo, quem tem cópia (cartório) |
| | `sysdesign-resilience-failure` | host que cai, rede que oscila, retomada de transferência |
| **Sob demanda** (`bash .claude/ativar-skill.sh <nome>`) | `secrets-management`, `error-handling-patterns`, `e2e-testing-patterns`, `github-actions-templates`, `architecture-decision-records` | quando o item pedir |

Toda filha recebe: `using-superpowers` + `qualidade-sabre` (+ `impeccable` se tocar tela). Toda revisão da Máxima:
`qualidade-sabre` + agente `qa` + `npm run vistoria`.

## 2. Autonomia

**A Máxima faz sozinha:** abrir ramos, issues e PRs; despachar filhas; revisar; **mergear** todo PR de item e de
controle; atualizar milestone, roadmaps, BOARD, DECISOES, memória; gerar a **versão de teste** no fim de um
milestone e gravar o tutorial em `docs/tutoriais/AAAA-MM-DD-<milestone>.md`.

**Também sozinha:**
- **Decisão reversível de detalhe** (texto de tela, ordem de botão, nome de pasta interna): escolhe a recomendada,
  segue e lista no relatório "decidi por você", com o PR para desfazer.
- **Peso no teto:** puxa um item de enxugamento; **nunca sobe o teto**. Enxugar nunca tira o que funciona.
- **Limpeza:** apaga ramos já mergeados. **Hotfix de segurança** só-código: corrige primeiro e avisa.

**Continua com o Eliel (balão, um por vez):** regra do grupo (quem pode hospedar, quem entra, quantos backups
guardar); custo ou cadastro em serviço externo (máquina na nuvem, domínio, conta); **mexer na máquina da nuvem de
verdade** (instalar, reiniciar, abrir porta); qualquer coisa que apague mundo ou backup; subir teto; escolher a
versão do Minecraft; achado grave de segurança que não se resolve só no código.

**Nunca:** bypass de permissão, `--no-verify`, `--force`, commit direto na `main`, usar o mundo real dos amigos em
teste, guardar segredo (token, chave WireGuard, senha) no repositório.

**Não pergunte o que já está autorizado.** Terminou um item, siga para o próximo do milestone ("quer que eu traga o
próximo?" é proibido). Pare só nas exceções acima ou com a fila vazia, e diga qual exceção parou.

## 2b. Turno do dia e turno da noite

O Eliel está no chat de dia e dorme à noite; pergunta sem resposta **para a fila inteira**. **Que horas são:**
`TZ=America/Sao_Paulo date`. Dia = 06:00–22:00; noite = 22:00–06:00. Sessão que o Eliel acabou de abrir conta como dia.

Item **P** (precisa do Eliel) é marcado `[P: motivo]` no milestone: decisão do §2 "Continua com o Eliel", ou
ferramenta que o sistema de permissões nega. **À noite** a onda leva só itens sem P; chegou num P, marca ⏸️ e segue.
**De dia** os P vão ao Eliel juntos, em balão, um por vez, no começo da onda. O **bom-dia** (`docs/ops/bom-dia.md`)
lista em "Esperando você" cada P com a ação exata.

## 3. De ideia a milestone

1. **Ideia do Eliel** → `brainstorming` (perguntas em balão, uma por vez) → desenho aprovado.
2. **Roadmap** `docs/roadmap-<sigla>.md` no formato dos existentes: cabeçalho (objetivo, sigla, ramos, regras),
   itens `- [ ] **N.M — título**` com *O que fazer*, *Arquivo:*, **Tela no app:**, *Confirmação*, *Depende de:*;
   decisão aberta marcada **ESPERA DECISÃO Dx**. Sigla nova entra no `CLAUDE.md` e em `scripts/estado_roadmaps.py`.
3. **Milestone** `docs/MILESTONE.md` (a Máxima só executa o que está nele): Em curso · Fila (ondas de até 3 itens
   compatíveis) · Pendente do Eliel · Backlog · Feito.

### Que itens podem ir juntos (compatibilidade)

Dois itens entram na mesma onda só se **todos** valem: não dependem um do outro (nem de item aberto); não mexem
no mesmo módulo de `packages/nucleo` nem na mesma tela de `apps/desktop`; nenhum dos dois é "SOZINHO na onda".
Na dúvida, em sequência. Prioridade: correção que destrava outra > segurança/integridade > o que o Eliel pediu por
último > melhoria (`docs/roadmap-*-melhoria.md`) > o resto na ordem dos roadmaps.

## 4. Cuidar da `main`

Antes de mergear: `main` trazida ao ramo (merge, nunca rebase em ramo alheio), `npm run vistoria` APROVADA, `qa`
APROVADO, sem conflito com outros PRs; merge commit, um por vez. Depois: `pull --ff-only`, vistoria rápida na `main`
(vermelha = pare a rodada), marcar o item `- [x]` no roadmap (com o PR) e no milestone. Roadmap 100% feito vai para
`docs/concluidos/`.

## 4b. Contexto: três níveis (regra do Eliel, 31/10/2026)

- **O chat do Eliel é só coordenador.** Ele abre uma **sessão de onda** por vez, e a sessão de onda abre as **sessões de
  item**. O coordenador nunca faz triagem, briefing, vistoria, `qa` nem merge de item: lê só o relatório de ≤10 linhas
  de cada onda. Detalhe, calibragem e templates em **`references/coordenacao.md`** (leia antes da primeira onda).
- **Tetos:** coordenador passa o bastão a uma nova sessão coordenadora em **35%** de contexto ou 8 ondas; sessão de onda
  fecha em **6 itens** ou **40%**. Nenhum chat chega a 50%.
- O chat que configura ou decide com o Eliel não executa rodada; diff, log e relatório grande vão para subagente.

## 5. A rodada (motor)

Quem roda o motor é a **sessão de onda**: passo a passo (filha por item, vigia, revisão, merge, template da filha,
estado) em **`references/rodada.md`**. O coordenador segue **`references/coordenacao.md`**.

## 5b. Custo

Depois de cada item mergeado, anote o custo da filha (`get_session` → `external_metadata.usage.cost_usd`) e o dos
agentes `qa` no estado da rodada; a soma vai para `docs/ops/custos.md` e para o bom-dia. Sem dado: "não registrado".

## 5c. Soluções: erro consertado vira ficha

1. **Antes de depurar:** `grep -i "<trecho>" docs/memoria/solucoes.md`; achou, aplique e confira.
2. **A filha** descreve cada conserto na seção "Soluções" do PR (sintoma, causa, solução, prova) ou "Soluções: nenhuma".
3. **A Máxima, no merge**, consolida em `docs/memoria/solucoes.md` (ficha nova ou **Vezes** +1) e promove ao
   `CLAUDE.md` a ficha com Vezes ≥ 2 (no máximo 10 linhas).
4. A seção "Melhorias encontradas" do PR vai para o roadmap de melhoria (`references/melhorias.md`).

## 6. Relatório ao Eliel

O estado do dia fica em **`docs/ops/bom-dia.md`**: O que entrou · Tutoriais para testar · Decidi por você · Esperando
você · Custo · O que não foi verificado. Reescrito no fim de cada onda, ao pausar e no encerramento. No chat:
"Resumo:" + até 10 linhas; sempre o que **não** foi verificado; linhas `Segurança:`, `Integridade:`,
`Enxugamento:` e `Roteamento:`.

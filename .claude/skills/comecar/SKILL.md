---
name: comecar
description: Abre a sessão de trabalho do SabreHosting num chat novo e leve. Lê o estado dos roadmaps por script, mostra o que está em andamento, o que precisa ser integrado e o que espera decisão do Eliel, e prepara os briefings e os prompts dos próximos itens (um chat por item). Use quando o Eliel escrever /comecar, "começar", "o que falta implementar" ou "prepara os próximos itens".
---

# /comecar — abrir o dia sem gastar contexto

Este chat **não sabe nada da conversa anterior, e não precisa**: o estado vive em arquivos (`CLAUDE.md`,
`docs/memoria/`, `docs/MILESTONE.md`, roadmaps, git). Não leia roadmaps inteiros: use o script e leia só o texto
dos itens escolhidos.

## 1. Ler o estado (barato)

1. `python3 scripts/estado_roadmaps.py` (argumento opcional: sigla, ex. `host`). Mostra, por roadmap, os itens que
   faltam, o que trava cada um (dependência, ESPERA DECISÃO), e os ramos `roadmap/*` em andamento.
2. `git fetch --prune`, `git status`, `list_sessions` (outra orquestradora ativa = avisar).
3. Leia `docs/MILESTONE.md` (Em curso, Pendente do Eliel) e `docs/ops/bom-dia.md`.

## 2. Triagem, nesta ordem

1. **PR aberto de item** = trabalho entregue esperando revisão/merge: diga "o item X está pronto para revisar;
   `/maxima` revisa e mergeia".
2. **Pendente do Eliel:** a primeira decisão aberta vira balão (uma por vez, recomendada primeiro).
3. **Itens prontos** (sem dependência aberta e sem ESPERA DECISÃO): monte a próxima onda (até 3 compatíveis, regra
   da `maxima` §3).

## 3. Preparar e entregar

- Com as ferramentas de sessão disponíveis: proponha abrir a rodada com `/maxima` (num chat novo).
- Sem elas (modo chat por item): para cada item da onda, escreva o briefing (`maxima › references/briefing.md`),
  commite no ramo de controle e entregue ao Eliel o **prompt de abertura** de um chat novo por item:
  > Implemente o item <sigla>-<id> do SabreHosting. Ramo roadmap/<sigla>-<id> a partir de <hash completo>.
  > Briefing: `git show origin/<ramo-de-controle>:docs/agentes/briefings/<sigla>-<id>.md`. Siga o CLAUDE.md.

## 4. Falar com o Eliel

"Resumo:" (em andamento, o que falta, o que ele decide) + até 10 linhas. Uma pergunta por vez, em balão.

## Limites

Este chat não implementa, não mergeia e não abre rodada: só lê, prepara e entrega.

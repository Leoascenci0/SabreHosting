# Briefing appmel-1.7 — Tirar PC do grupo (tela)

BASE: 0b57326dda53d3c119a762fe962c38f0ca945bf7 · RAMO: roadmap/appmel-1.7 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable (audit e polish antes de entregar)
LEIA: qualidade-sabre › seguranca.md (cartório, token, autorização no servidor) e interface.md (ação que tira algo: confirmação, carregando, termo claro); enxugar §1
TRIAGEM: M5 (+M3) · ~230 linhas (prod ~150 + teste ~80) · risco alto (revoga acesso de PC). Reaproveitar: servidor.ts:370 POST /pcs/:id/revogar (403 SO_DONO_TIRA, 409 DONO_NAO_SE_TIRA, 404 PC_INEXISTENTE, 204; NÃO criar rota); cliente.ts:238 listarPcs(); molde criarConvite (~255) para `revogarPc(id)` com repetir:false e validar nulo; cliente.eu().dono (sem checagem própria na UI); tela: apps/desktop/src/ui/configuracoes.ts + index.html:71-90 (acrescentar fieldset "Grupo", sem nova janela); IPC principal.ts:202-225, ponte.ts, preload.cts (padrão configuracoes/backups); E2E apps/desktop/e2e/configuracoes.e2e.ts e fake apps/desktop/src/main/fake-e2e.ts (estender com listarPcs/revogarPc; sem segundo fake). Passos: (1) revogarPc + teste cliente.test.ts (204/403/409/404/401); (2) mensagens pt-BR 403/409/404 e aviso "o PC tirado precisa de novo convite"; (3) main/grupo.ts + handlers sabre:grupo:pcs / sabre:grupo:revogar (só se eu().dono), preload e ponte; (4) fieldset Grupo, botão oculto para não-dono, confirmação com o NOME do PC, cancelar não chama; (5) fake e E2E dos 3 casos. Dúvida para o Eliel: nenhuma (o item já está aprovado no roadmap).

## Item (texto literal do roadmap)
Tirar PC do grupo (tela). Área Grupo em Configurações com a lista dos PCs (`cliente.listarPcs()`), só para o dono (`/eu.dono`), botão "Tirar PC do grupo" com confirmação que diz o NOME do PC, mensagens pt-BR para 403/409/404 e aviso de que o PC tirado precisa de novo convite; novo método `revogarPc` no cliente do núcleo.
Arquivo: `apps/desktop/src/ui/configuracoes.*`, `packages/nucleo/src/cartorio/cliente.ts`. Tela no app: Configurações › Grupo › "Tirar PC do grupo" (só o dono). Confirmação: E2E com cartório falso: cancelar não revoga; confirmar chama `revogarPc`; não-dono não vê o botão.
Depende de: cartmel-1.1 e cartmel-2.3 (feitos), app-2.2 (feito).
Nota: o PC do próprio dono não pode ser tirado (409): não ofereça o botão nele. Mais de um arquivo de main/ui é esperado (triagem); justifique no PR.

## Decisões que valem para este item
Quem entra/sai do grupo é regra do grupo: a tela só executa o que o servidor autoriza (dono).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.7.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) no cliente e E2E
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento e **Tela no app:**

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.

# Briefing cartmel-2.3 — Listar os PCs do grupo e dizer quem é o dono

BASE: ef1b28454710f6438a45721337b58067de5a5a38 · RAMO: roadmap/cartmel-2.3 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; seguranca (autorização, vazamento de dados do grupo); integridade só o trecho de dono
TRIAGEM: M3 (+M1), ~60 linhas + teste, risco alto (cartório/autorização). Reaproveitar soPc/pcDe e donoAtual (padrão do POST /pcs/:id/revogar e /convites: 403 SO_DONO), a consulta de PCs com token ativo (veja pcDoToken em banco.ts), o /eu existente e services/cartorio/src/convite.test.ts (molde dos testes), packages/nucleo/src/cartorio/cliente.ts (criarCliente, chamar). Não escrever: middleware novo, tabela nova, segunda forma de achar o dono.

## Item (texto literal do roadmap)
Ver docs/roadmap-cart-melhoria.md item 2.3 (no ramo da onda: `git show origin/roadmap/onda-2026-10-31-20:docs/roadmap-cart-melhoria.md`): GET /pcs (só o dono; 403 para os outros) devolve [{id, nome, dono}] dos PCs com token ativo; GET /eu devolve também `dono: boolean`; no núcleo, cliente.eu() devolve o campo e cliente.listarPcs() existe.

## Decisões que valem para este item
DECISOES 2026-10-31: só o dono tira PC do grupo, pelo app; o dono não se tira (trocar-dono antes). Esta rota existe para a tela Configurações › Grupo › "Tirar PC do grupo" (app-2.2). Não expor token, hash, IP ou chave nenhum na lista: só id, nome e dono. PC com todos os tokens revogados não aparece.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-2.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois): dono lista; não-dono 403; revogado não aparece; /eu traz dono; cliente do núcleo mapeia
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada de novo no formato de resposta além do descrito; qualquer coisa que mude rotas existentes além de acrescentar `dono` ao /eu.

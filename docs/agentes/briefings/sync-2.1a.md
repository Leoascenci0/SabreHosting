# Briefing sync-2.1a — Espalhar a versão nova após o backup (corte: núcleo + ligação ao app, sem limite de banda)

BASE: 67cbfc355b31a9425f56ba12e816382ecb294c88 · RAMO: roadmap/sync-2.1a · MODELO: sonnet (esforço high; sem gatilho Opus)
SKILLS: using-superpowers, qualidade-sabre, sysdesign-resilience-failure, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; integridade §2-3 (sync, marcador, troca atômica); desempenho (transferência por região); seguranca (rede/cartório); fichas S-06 e S-07 de docs/memoria/solucoes.md
TRIAGEM: M7 (+M1, M2). Corte 2.1a (este item) = packages/nucleo/src/sync/espalhar.ts (escolha pura da fonte host/PC/nuvem + loop por região via pedirArquivo + aplicarDelta com pastaDoServidor + avisarCopia no fim) + chamador de produção em apps/desktop/src/main (é a parte 1.5b do syncmel-1.5: passar pastaDoServidor a aplicarDelta) + teste de 3 PCs simulados chegando à versão M, queda no meio deixa a versão N intacta, aplicarDelta recusa mundo fora de pastaDoServidor. 2.1b (limite de banda + tela) FICA FORA: não escreva. Reaproveitar: pedirArquivo transferencia.ts:215, servirArquivos :78, aplicarDelta aplicar.ts:116, criarCliente cartorio/cliente.ts:124, molde deps-backups.ts:29 / deps-reais.ts:82, gatilho do fim do backup em agenda-backups.ts (NÃO criar relógio novo; S-06: geração tomada antes de qualquer await). Não escrever: cliente HTTP novo, nova conferência de hash, novo armazenamento de config, endpoint novo no cartório (confira o que cliente.ts já expõe; se faltar rota, pare e avise a orquestradora), lib de banda, mudar podeSubir ou ordem dos rename.

## Item (texto literal do roadmap, parte 2.1a)
- 2.1 — Espalhar a versão nova após o backup: host avisa o cartório; PCs online recebem "versão M pronta" e puxam de quem tem (host, outro PC ou nuvem), em segundo plano. Arquivo: packages/nucleo/src/sync/espalhar.ts. Confirmação: teste com 3 PCs simulados: todos chegam à versão M. Depende de: sync-1.2, bkp-1.3 (feitos). Mais 1.5b: passar pastaDoServidor a aplicarDelta no chamador de produção. Tela: nenhuma neste corte (o limite de banda é o 2.1b).

## Decisões que valem para este item
Regras de ouro do mundo 2, 3, 5 do CLAUDE.md (nunca copiar com servidor rodando; troca atômica; versão manda). Tudo que vem do disco/rede é entrada não confiável (S-07).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/sync-2.1a.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois), mundos de tests/mundos/
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento; "Melhorias encontradas" inclui o 2.1b

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
Rota nova no cartório; subir o servidor Minecraft durante o espalhar.

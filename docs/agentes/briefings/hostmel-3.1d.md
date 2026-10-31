# Briefing hostmel-3.1d — NeoForge legado da 1.20.1 e redirect:error no buscarPadrao

BASE: 565b9ee8d2a57f0395126af1b7218db9ef263abf · RAMO: roadmap/hostmel-3.1d · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, sysdesign-resilience-failure
LEIA: qualidade-sabre §seguranca (rede e download), §desempenho (leitura em pedaços), §enxugar
TRIAGEM: M1 (+M4), ~40 linhas + ~80 de teste, risco ALTO (download de jar com hash). REAPROVEITAR: packages/nucleo/src/servidor/resolvedores.ts:80-99 (resolverNeoForge ganha parâmetro artefato 'neoforge'|'forge' trocando o caminho Maven para net/neoforged/forge/<v>/forge-<v>-installer.jar; tabela HASHES_NEOFORGE :74 e conferência sidecar×tabela iguais); versoes.ts:33-40 buscarPadrao (TETO_CORPO existe em :9 mas só é checado depois de r.text(); usar redirect:'error', conferir content-length antes, ler em pedaços com getReader cortando em 8 MB; timeout de 15 s continua); moldes em cartorio/cliente.ts:98-115 e :150 e testes cliente.test.ts:60,340,387. NÃO ESCREVER: parser de Maven nem detecção legada (opcoesDaVersao:107-131 já consulta MAVEN_FORGE_LEGADO); nova função de download; mexer em baixar.ts:99; preencher HASHES_NEOFORGE com valor inventado. PROVA: redirect vira erro; content-length acima do teto nada lido; corpo sem content-length cortado; forge legado com hash fixado e sidecar errado recusado.

## Item (texto literal do roadmap)
- [ ] **3.1d** (do item 3.1 de docs/roadmap-host-melhoria.md): NeoForge legado da 1.20.1 (artefato net.neoforged:forge, 1.20.1-47.1.x) e `redirect:"error"` + teto de corpo de 8 MB no `buscarPadrao`. Origem: notas do qa do PR #180.

## Decisões que valem para este item
31/10 (Eliel): o dono escolhe qualquer versão do Minecraft na tela Configurações › Servidor › Versão; padrão inicial 1.21.1. Decididos pela Máxima (reversíveis): loaders por consulta na hora (fallback 'sem mods'); 'um tipo só' = NeoForge; sha1 do manifesto guardado no cartório. Hash do instalador: NUNCA invente. Se conseguir o sha1 oficial (sidecar .sha1 do Maven da NeoForged) e ele for alcançável daqui, fixe-o na tabela citando a fonte no PR; se não conseguir, deixe o resolvedor recusando com erro seguro, escreva o teste com hash de fixture e liste no PR 'P: confirmar sha1 do forge 1.20.1'.

## Exigências desta rodada
- No PR, escreva as linhas `Regressão:` e `Tela no app:` (S-10), mesmo que seja "não se aplica".
- Passe pelas fichas S-06 (agendador: ++geracao antes de await), S-07 (caminho/marcador lido do disco é entrada não confiável), S-08 (socket cru: s.resume()), S-09 (hash completo). `grep -i` em docs/memoria/solucoes.md antes de depurar.
- Vistoria uma de cada vez (S-01). Qual versão exata do forge 1.20.1 e o sha1 (se não achar na fonte oficial: não decida; registre como P).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-3.1d.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir (perguntar à orquestradora)


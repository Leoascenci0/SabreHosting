# Briefing cartmel-2.4 — Descoberta de fontes do espalhar no cartório

BASE: 7e7b64ecccf2c3991d08c0b779bc5d61d5cd04a8 · RAMO: roadmap/cartmel-2.4 · MODELO: sonnet (gatilho Opus só se a revisão achar problema de rede/segurança)
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §seguranca (rede/cartório), §integridade (sync, só fontes), §enxugar
TRIAGEM: M3 (+M1), ~90 linhas + testes, risco ALTO (cartório, rede privada, IP de PC). REAPROVEITAR: GET /versoes/mais-nova (servidor.ts:475) e GET /versoes/:n/copias (servidor.ts:489-496, só muda o retorno de quemTem); quemTem/maisNova em services/cartorio/src/versoes.ts:57-77 (LEFT JOIN + EXISTS); molde do cliente em packages/nucleo/src/cartorio/cliente.ts:253-254 (ler) e :274-275 (informarCopia); validadores em tipos.ts; rede privada em sync/transferencia.ts:13 (REDE_PRIVADA) e :17-29 (conferirEnderecoPrivado), espalhar.ts:40-58 (escolherFontes já recebe fontes injetadas). NÃO ESCREVER: coluna de IP em pcs (IP mora em convites.ip_def, JOIN com confirmado_em IS NOT NULL); rota nova ou método espalhar novo; tabela para 'nuvem tem M' (EXISTS em copias_nuvem); novo validador de faixa. PASSOS: (1) quemTem devolve {id, nome, ip} + nuvem=EXISTS copias_nuvem; (2) resposta de /copias vira {numero, nuvem, pcs}, cliente valida em tipos.ts; (3) cliente: maisNova() (GET, repetir:true) e quemTem(n) (GET, repetir:true); (4) transferencia.ts:13: fechar a faixa para 10.66.0.2–10.66.0.199 + teste (.200, .1 e 10.66.1.5 recusados); (5) testes de cliente com cartório de teste e de cartório (versoes.test.ts:195-215).

## Item (texto literal do roadmap)
- [ ] **2.4 — Descoberta de fontes do espalhar no cartório**
  *O que fazer:* incluir o IP da rede privada de cada PC em `GET /versoes/:n/copias`; um sinalizador de que a nuvem tem a versão M; `maisNova()` e `quemTem()` em `cliente.ts`; e o método do cliente para registrar a versão (`POST /versoes`, hoje só existe `informarCopia`). O espalhar (sync-2.1a) recebe as fontes injetadas dali; só aceita IPs da rede privada.
  *Arquivo:* `services/cartorio/src/servidor.ts`, `versoes.ts`, `packages/nucleo/src/cartorio/cliente.ts`, `tipos.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste do cliente com cartório de teste devolvendo IP e nuvem; teste de que IP fora da rede privada é recusado.
  *Origem:* sync-2.1a · PR #173 · filha


## Decisões que valem para este item
31/10: espalhar com trava separada (Eliel). Decididos pela Máxima (reversíveis): (a) /copias passa a devolver o IP da rede privada de cada PC, SÓ para PC autenticado (o comentário 'nunca devolve IP' de listarPcs/cliente.ts:258 e banco.ts:320 vale para listarPcs: atualize o comentário para dizer a diferença); (b) a PORTA da fonte é constante do app (exporte uma constante PORTA_ESPALHAR no núcleo, usada por quem monta a Fonte); não entra no cadastro; (c) a nuvem como fonte NÃO entra: este item só entrega o sinalizador 'nuvem tem M'; o uso da nuvem fica para o sync-2.1b. (d) registrarVersao/criarVersao NÃO é deste item: a filha do piloto-1.1c acrescenta criarVersao ao cliente; não duplique.

## Exigências desta rodada
- No PR, escreva as linhas `Regressão:` e `Tela no app:` (S-10), mesmo que seja "não se aplica".
- Passe pelas fichas S-06 (agendador: ++geracao antes de await), S-07 (caminho/marcador lido do disco é entrada não confiável), S-08 (socket cru: s.resume()), S-09 (hash completo). `grep -i` em docs/memoria/solucoes.md antes de depurar.
- Vistoria uma de cada vez (S-01). Cartório e rede são integridade+segurança: o qa roda com as duas lentes. Se mexer em infra/ ou tests/infra/, rode os testes também como usuário comum (S-03).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-2.4.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir (perguntar à orquestradora)
Abrir porta nova; mudar a faixa/regras da rede privada além de fechar 2–199; usar a nuvem como fonte.

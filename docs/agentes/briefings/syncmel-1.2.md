# Briefing syncmel-1.2 — Timeout e limite de conexões do servidor de sync; parcial completo não rebaixa

BASE: 78ebeaeca2b0f30ee11870d69b63f95fb09cc144 · RAMO: roadmap/syncmel-1.2 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, sysdesign-resilience-failure
LEIA: qualidade-sabre › integridade.md (hash antes de renomear, parcial, nunca escrever por cima), seguranca.md (conexões) e desempenho.md (ocioso e teto); enxugar
TRIAGEM: M4 (416 do cliente) + M1 (opções nativas do node:http, parâmetro opcional para o teste) · ~35 linhas + ~70 de teste · risco alto. Reaproveitar: transferencia.ts `servirArquivos` (acrescentar só opções nativas e um parâmetro opcional de tempo para o teste, no molde de `agora`); o 416 do servidor já manda `content-range: bytes */TAMANHO`; baixar.ts bloco do 416 (~153-158) que hoje descarta o parcial; `vigiar`/tempoSemDados já existe no cliente (30 s). NÃO escrever: nova lógica de retomada ou de hash; `tempo`/`teto` configurável pelo app; mudar baixar.test.ts:213 (416 sem content-range continua recomeçando do zero); reescrever o limite de falhas/cache do syncmel-1.1 (já na main). Passos: (1) em `servirArquivos`: `headersTimeout`, `requestTimeout`, `keepAliveTimeout`, `timeout` (socket ocioso) e `maxConnections`, com parâmetro opcional do tempo ocioso para o teste. DECIDIDO pela Máxima (reversível): ocioso 60 s, cabeçalho 10 s, teto 16 conexões; o ocioso do servidor tem de ser MAIOR que o tempoSemDados do cliente (30 s); (2) baixar.ts, bloco 416: se `content-range` for `bytes */N` e N == tamanho do parcial, NÃO descartar: deixar `baixarConferido` conferir o hash e renomear; sem content-range ou N diferente, manter o recomeço atual (regra de ouro 3: hash antes de renomear — se o hash não bater, descarta e baixa de novo); (3) transferencia.test.ts: trocar o `expect` dentro do handler do servidor falso por `autorizacoes.push(...)` e conferir depois do `pedirArquivo`; testes "conexão ociosa é derrubada" (net.connect sem enviar nada, 'close' com tempo curto por parâmetro) e "arquivo completo não gera segundo download" (parcial com o conteúdo inteiro, servidor real: sem corpo, hash confere, destino criado) e o caso parcial completo com hash errado → rebaixa. Dúvida para o Eliel: nenhuma.

## Item (texto literal do roadmap)
Timeout e limite de conexões do servidor de sync; parcial já completo não rebaixa. Timeouts de cabeçalho/inatividade e teto de conexões simultâneas no servidor; cliente que já tem o arquivo inteiro como parcial só confere o hash em vez de baixar tudo de novo (416); o `expect` dentro do handler do servidor falso do teste de queda passa a fazer o teste falhar se quebrar.
Arquivo: `packages/nucleo/src/sync/transferencia.ts`, `packages/nucleo/src/servidor/baixar.ts`, `packages/nucleo/src/sync/transferencia.test.ts`. Tela no app: não se aplica.
Confirmação: testes: conexão ociosa é derrubada; arquivo completo não gera segundo download.

## Decisões que valem para este item
Valores 60 s / 10 s / 16 decididos pela Máxima (reversíveis). Regras de ouro 2–3.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.

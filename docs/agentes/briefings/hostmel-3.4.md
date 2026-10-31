# Briefing hostmel-3.4 — Gravar o `server.properties` só depois da trava (e recusar servidor órfão)

BASE: d720a63e566ad69d26be580b001d6274db86c8dc · RAMO: roadmap/hostmel-3.4 · MODELO: opus (gatilho: lógica de trava de host)
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre › references/integridade.md (trava, ordem de gravação); enxugar
TRIAGEM: M1 (+M4 na prova) · ~60 linhas (código ~20, teste ~40) · risco alto (trava). Reaproveitar `hospedar()` em packages/nucleo/src/cartorio/hospedar.ts com parâmetro novo `antesDeSubir?: () => Promise<void>`, chamado depois de `renovador.pegar()` (~:65) e dentro do `try` que já solta a trava; se lançar: soltar e relançar. Em apps/desktop/src/main/deps-reais.ts a gravação `gravarConfiguracao` (~:172) sai de antes do `hospedar` e vira o gancho. Em `inicio.ts` `hospedar()` (~:253): `if (await temOrfao()) return {ok:false, mensagem}` antes de `deps.hospedar` (`temOrfao` já existe, erro conta como vivo). NÃO escrever: nova checagem de órfão, novo caminho de trava, mudança na checagem de rede privada (deps-reais ~:165 já cobre). Prova: teste que falha hoje para trava ocupada (arquivo intacto) e órfão vivo (deps.hospedar não chamado, arquivo não trocado); tests/integracao/hospedar-cartorio.test.ts segue passando.

## Item (texto literal do roadmap)
*O que fazer:* hoje o app grava a configuração (appmel-1.9) antes de o `hospedar` do núcleo pegar a trava; com a trava ocupada o arquivo local fica reescrito sem hospedar. Criar o gancho `antesDeSubir` em `hospedar` para gravar só depois da trava. Conferir também se `hospedar` recusa quando sobrou um servidor órfão neste PC (`inicio.ts` não consulta `servidorOrfao` antes de `deps.hospedar`); se não recusar, recusar.
*Arquivo:* `packages/nucleo/src/cartorio/hospedar.ts`, `apps/desktop/src/main/deps-reais.ts`, `inicio.ts`
**Tela no app:** não se aplica.
*Confirmação:* teste: trava ocupada deixa o `server.properties` intacto; órfão vivo → Hospedar recusa sem trocar o arquivo.

## Decisões que valem para este item
nenhuma

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-3.4.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, e **Regressão:** (é correção)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir
nada

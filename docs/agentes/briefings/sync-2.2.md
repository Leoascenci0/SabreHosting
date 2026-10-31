# Briefing sync-2.2 — Quem voltou depois de muito tempo

BASE: 1f122e2ad86de7430032b06a26483b05dd4d73ef · RAMO: roadmap/sync-2.2 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; integridade (trava, troca atômica, versão manda); desempenho (banda); interface (status na tela inicial); enxugar §1; L-01 de docs/memoria (conta de prazo da trava no briefing)
TRIAGEM: M1+M3 (+M7 só no laço até a versão mais nova e na fonte da nuvem); ~160 linhas (+~220 teste); risco alto (sync, trava de atualização, cartório, mundo).
 REAPROVEITAR: espalhar() packages/nucleo/src/sync/espalhar.ts (fontes injetadas, trava de atualização, aplicarDelta); fontesDeCopias/escolherFontes (espalhar.ts); cliente.maisNova e quemTem (cartorio/cliente.ts); criarGatilhoEspalhar apps/desktop/src/main/espalhar-versao.ts já ligado por ligarEspalhar/ligar-espalhar.ts e principal.ts (reaproveitar o gatilho já ligado; sync-2.1b JÁ está feito, PRs #192/#202); gate de Hospedar apps/desktop/src/main/inicio.ts (mesmo padrão do "backup sendo restaurado"); pacote fechado da nuvem: cart-1.4 (PR #58) e bkp-1.2.
 NÃO ESCREVER: loop/trava/troca próprios (alcancar.ts vira fino orquestrador sobre espalhar); novo cliente de versão; segundo relógio ou trava de atualização; nova extração/hash de pacote; flag própria de "Hospedar bloqueado" (somar um motivo "atualizando" à lista de inicio.ts); a nuvem como tipo de fonte dentro de fontesDeCopias (espalhar.ts diz que ela não entra: usar rota de pacote existente).
 PASSOS: 1) alcancar.ts: maisNova → quemTem → espalhar com fontes de PC; 2) sem PC online ou falha, pacote da nuvem pela rota existente (cartório, mundo inventado nos testes; NUNCA a nuvem real); 3) laço até a versão mais nova, trava de atualização renovada antes de cada passo; 4) inicio.ts: motivo "atualizando" + percentual no estado; Jogar segue liberado; 5) principal.ts: chamar alcancar no arranque junto de ligarEspalhar (mudança mínima).
 PROVA: alcancar.test.ts com 3 PCs simulados (servirArquivos em portas locais, permitirLoopbackParaTeste) e cartório falso: PC v10, grupo v300, só a nuvem online → chega à 300; inicio.test.ts: Hospedar recusado durante a atualização, Jogar liberado. Mundo de tests/mundos.

## Item (texto literal do roadmap)
**2.2 — Quem voltou depois de muito tempo** — ao iniciar, perguntar a versão mais nova; buscar de PC online ou da nuvem; bloquear "Hospedar" até terminar (Jogar continua liberado).
*Arquivo:* packages/nucleo/src/sync/alcancar.ts
**Tela no app:** status na tela inicial ("Atualizando seu mundo… 40%").
*Confirmação:* teste: PC na versão 10, grupo na 300, só a nuvem online → chega à 300.
*Depende de:* sync-2.1 ✅ (2.1a #173, 2.1b via syncmel-1.9 #192/#202), cart-1.4 ✅

## Decisões que valem para este item
Nuvem NÃO é fonte do espalhar (decidido 31/10); aqui ela só entra como último recurso por pacote fechado.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/sync-2.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo, Triagem/Segurança/Integridade/Enxugamento/Roteamento e `Tela no app:` (status na tela inicial)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos, launcher, boas-vindas/cofre (outras filhas).

## O que NÃO decidir
Afrouxar a trava de atualização ou a regra "versão manda": pare e avise a orquestradora.

# Briefing piloto-1.1c — Tela Backups › Importar mundo + tutorial

BASE: 7e7b64ecccf2c3991d08c0b779bc5d61d5cd04a8 · RAMO: roadmap/piloto-1.1c · MODELO: opus (gatilho: o item usa a trava de host para criar a versão 1 — lógica de trava)
SKILLS: using-superpowers, qualidade-sabre, impeccable, sysdesign-consistency-coordination
LEIA: qualidade-sabre §integridade (trava, versão, zip), §seguranca (zip/cartório/IPC), §interface, §enxugar; impeccable audit+polish
TRIAGEM: M5 (+M3 cliente, +M3 tutorial), ~300 linhas + ~200 teste, risco ALTO. REAPROVEITAR: importarMundoZip (packages/nucleo/src/importar.ts, devolve versaoMinecraft e indícios, entrega a versão 1 por callback); criarPacote (backup/pacote.ts:97); cartorio/cliente.ts chamar() e molde informarCopia (:274); escolherPasta (apps/desktop/src/main/principal.ts:331) como molde do seletor de .zip; molde de tela apps/desktop/src/ui/backups.ts; molde de tutorial docs/tutoriais/rede-criar-maquina.md. NÃO ESCREVER: lógica de zip/hash/extração; cartório novo (POST /versoes servidor.ts:452 → 201 {numero} e PUT /versoes/:n/pacote servidor.ts:512 já existem); validação de versão; nenhuma escrita sobre o mundo local (importar extrai só em temporária e apaga). LACUNA: o cliente não tem criarVersao nem envio de pacote em fluxo octet-stream (Pedido só aceita JSON): acrescentar criarVersao (POST /versoes) e enviarPacote (PUT octet-stream com epoca/sha256/bytes), com teste. PASSOS: cliente; IPC sabre:importar:escolherZip e sabre:importar:executar (principal.ts, preload, ponte); tela em ui/ (escolher .zip, mostrar versão detectada e avisos de plugins/mods, confirmar); docs/tutoriais/piloto-importar.md (pt-BR, sem jargão, como baixar o mundo do painel da hospedagem). PROVA: mundo inventado de tests/mundos/ vira versão no cartório de teste e o pacote confere hash; zip hostil recusado sem gravar; pasta do mundo local inalterada.

## Item (texto literal do roadmap)
  *Arquivo:* `packages/nucleo/src/importar.ts`, `docs/tutoriais/piloto-importar.md`
  **Tela no app:** Backups › "Importar mundo".
  *Confirmação:* importar um mundo de teste; depois o real. **[P: baixar o mundo real]**
  *Depende de:* cart-1.4, app-2.1

- [ ] **1.2 — Pré-gerar o mapa e afinar o servidor**
  *O que fazer:* rodar Chunky com raio escolhido; ajustar distâncias e RAM pela nota do PC mais forte.
  *Arquivo:* `docs/tutoriais/piloto-afinar.md`

## Decisões que valem para este item
31/10 (Eliel): importar lendo o .zip direto. Decididos pela Máxima (reversíveis): (1) POST /versoes exige a trava de host (versoes.ts:34): o PC pega a trava normal do cartório, cria a versão, envia o pacote e SOLTA (sempre, também em erro); NÃO altere a regra da trava nem contorne; recusar se a trava está com outro PC. (2) Se o cartório já tem versão, a importação gera N+1 (nunca sobrescreve backup nem apaga versão): nesse caso a tela só deixa o DONO importar, com confirmação forte em pt-BR ('isto vira a versão mais nova do grupo; o mundo atual continua guardado nos backups'). Sem versão no cartório, qualquer PC do grupo pode importar a 1ª. (3) Versão do Minecraft 'desconhecida' só avisa. Outra filha (cartmel-2.4) pode estar acrescentando métodos de leitura (maisNova, quemTem) ao mesmo cliente.ts: faça o seu diff mínimo e localizado.

## Exigências desta rodada
- No PR, escreva as linhas `Regressão:` e `Tela no app:` (S-10), mesmo que seja "não se aplica".
- Passe pelas fichas S-06 (agendador: ++geracao antes de await), S-07 (caminho/marcador lido do disco é entrada não confiável), S-08 (socket cru: s.resume()), S-09 (hash completo). `grep -i` em docs/memoria/solucoes.md antes de depurar.
- Vistoria uma de cada vez (S-01). Tutorial: docs/tutoriais/piloto-importar.md.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/piloto-1.1c.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir (perguntar à orquestradora)
Mundo real: o passo com o mundo real dos amigos é P do Eliel; só teste com mundo inventado. Mudança de regra da trava.

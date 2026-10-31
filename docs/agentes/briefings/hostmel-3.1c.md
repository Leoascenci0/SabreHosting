# Briefing hostmel-3.1c — Tela Configurações › Servidor › Versão (só o dono)

BASE: 7e7b64ecccf2c3991d08c0b779bc5d61d5cd04a8 · RAMO: roadmap/hostmel-3.1c · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable
LEIA: qualidade-sabre §interface, §integridade (só a troca com servidor parado), §seguranca (IPC: entrada do renderer), §enxugar; impeccable audit+polish
TRIAGEM: M5 (+M1), ~250 linhas + ~150 teste, risco ALTO (grava a versão que define o que o host sobe). REAPROVEITAR: packages/nucleo/src/servidor/versoes.ts (listarVersoes, opcoesDaVersao, planoDaVersao); cartorio/cliente.ts:275-283 (lerConfigGrupo, gravarConfigGrupo; o 409 já vem em pt-BR); apps/desktop/src/ui/configuracoes.ts (molde da área Grupo: ocupar(), mostrarErroGrupo, confirmação); apps/desktop/src/main/principal.ts:359-369 (padrão sabre:grupo:* e sabre:config:* com permitir(evento)); ui/index.html fieldset Servidor (~linha 83). NÃO ESCREVER: cliente do cartório, validação de versão ou 409 em pt-BR; busca da lista no renderer (rede fica no processo principal); o padrão 1.21.1 (vem no GET); lógica Fabric/Forge (opcoesDaVersao decide). IPC/PRELOAD novo: canais sabre:versoes:listar, sabre:versoes:opcoes, sabre:grupo:config:ler/gravar em principal.ts, preload.cts, ponte.ts. PASSOS: ponte+preload; handlers (só dono grava); fieldset Servidor › Versão com lista e texto do que roda ao lado; configuracoes.ts: carregar lista, opções SÓ AO SELECIONAR a versão (não ~100 buscas), confirmação antes de gravar, estado carregando, erro do app; teste da tela com ponte falsa. PROVA: 1.21.1 = NeoForge+Connector; versão sem Connector não oferece Fabric+Forge; não-dono não vê gravar; 409 mostra a mensagem do cartório sem termo técnico; confirmação antes de gravar.

## Item (texto literal do roadmap)
- [ ] **3.1 — Qualquer versão do Minecraft, escolhida pelo dono** *(corte de 31/10, onda 23: **3.1a ✅ PR #180** núcleo (versões, plano Mojang, modo jar); restam **3.1b** cartório (config_grupo, migração 8→9 com sha1 e dono, 409 se há trava) e **3.1c** tela Configurações › Servidor › Versão; mais **3.1d** NeoForge legado da 1.20.1 e `redirect:"error"` + teto de corpo no `buscarPadrao`)* (decisão do Eliel, 31/10/2026)
  *O que fazer:* lista de versões do Minecraft (da mais nova às antigas) vinda do manifesto oficial da Mojang; para cada
  uma, o que o servidor consegue rodar: NeoForge + Sinytra Connector (Fabric e Forge juntos), um loader só, ou sem mods.
  A versão escolhida vai para a configuração do grupo no cartório (todos os PCs usam a mesma); trocar de versão só com o
  servidor parado e backup feito antes. Hashes por versão (hostmel-1.1) e Java certo para cada versão.
  *Arquivo:* `packages/nucleo/src/servidor/`, `services/cartorio/src/`, `apps/desktop/src/ui/configuracoes.*`
  **Tela no app:** Configurações › Servidor › Versão (só o dono); padrão 1.21.1.
  *Confirmação:* teste: versão sem Connector não oferece Fabric+Forge; trocar versão com servidor rodando é recusado.
  *Depende de:* app-2.2 ✅ · pode virar 2–3 itens na triagem (nucleo, cartório, tela).


## Decisões que valem para este item
31/10 (Eliel): o dono escolhe qualquer versão na tela; padrão 1.21.1; ao lado, o que dá em cada uma. Decididos pela Máxima (reversíveis): opções carregadas ao selecionar a versão; sobre 'backup antes de trocar': se já existir no app uma ação de backup que a tela possa chamar, ela é chamada antes de gravar; se não, a tela só bloqueia com servidor parado (o cartório já devolve 409 com trava) e AVISA em uma frase que convém ter backup recente. Não crie lógica de backup nova.

## Exigências desta rodada
- No PR, escreva as linhas `Regressão:` e `Tela no app:` (S-10), mesmo que seja "não se aplica".
- Passe pelas fichas S-06 (agendador: ++geracao antes de await), S-07 (caminho/marcador lido do disco é entrada não confiável), S-08 (socket cru: s.resume()), S-09 (hash completo). `grep -i` em docs/memoria/solucoes.md antes de depurar.
- Vistoria uma de cada vez (S-01). 

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-3.1c.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir (perguntar à orquestradora)
Qualquer mudança em backup ou na regra de quem pode trocar (já: só o dono). sha1 do forge 1.20.1 ainda pendente (P): a tela não oferece 1.20.1 como pronta se resolverNeoForge não tem hash para ela.

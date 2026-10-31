# Briefing hostmel-3.1b — Cartório: configuração do grupo (versão do Minecraft)

BASE: 565b9ee8d2a57f0395126af1b7218db9ef263abf · RAMO: roadmap/hostmel-3.1b · MODELO: sonnet (gatilho Opus não se aplica: tabela simples; se a migração/409 der 2 falhas, subir)
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §integridade (trava, migração), §seguranca, §enxugar
TRIAGEM: M3 (+M1), ~130 linhas de produção + ~200 de teste, risco ALTO (cartório, migração, gravação dependente de trava). REAPROVEITAR: MIGRACOES em services/cartorio/src/banco.ts:27 (8 entradas; a 9 é a próxima, não reusar a 8); donoAtual/ehDono banco.ts:312-316; estadoTrava trava.ts:187; SO_DONO e soPc servidor.ts:81,249; molde de tabela de versoes.ts/atualizacao.ts; criarCliente/chamar em packages/nucleo/src/cartorio/cliente.ts:126,199. NÃO ESCREVER: tabela de manifesto fora de config_grupo; checagem de trava nova (use estadoTrava); cliente HTTP próprio; 1.21.1 em dois lugares; validação de sha1 já existente em nucleo (versoes.ts:6, planoDaVersao :71). PASSOS: migração 9 (config_grupo linha única: versao_minecraft, sha1_manifesto NULL, dono_pc_id, atualizado_em; trigger bloqueando DELETE); services/cartorio/src/configuracao.ts (lerConfig com padrão 1.21.1; gravarConfig com 409 se há trava de host ativa OU algum PC com atualizacao.expira_em > agora; sha1 40 hex); rotas GET /grupo/config (soPc) e PUT /grupo/config (soPc + dono); lerConfigGrupo/gravarConfigGrupo no cliente; testes (banco em memória, 409 com trava de host e com atualização, não-dono 403, migração 8→9 sobre banco com dados, L-01: caminhos de tempo).

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
31/10 (Eliel): o dono escolhe qualquer versão do Minecraft na tela Configurações › Servidor › Versão; padrão inicial 1.21.1. Decididos pela Máxima (reversíveis): loaders por consulta na hora (fallback 'sem mods'); 'um tipo só' = NeoForge; sha1 do manifesto guardado no cartório. Dúvida da triagem decidida: 'atualização ativa' = só expira_em > agora (linha com prazo zerado/vencido não conta).

## Exigências desta rodada
- No PR, escreva as linhas `Regressão:` e `Tela no app:` (S-10), mesmo que seja "não se aplica".
- Passe pelas fichas S-06 (agendador: ++geracao antes de await), S-07 (caminho/marcador lido do disco é entrada não confiável), S-08 (socket cru: s.resume()), S-09 (hash completo). `grep -i` em docs/memoria/solucoes.md antes de depurar.
- Vistoria uma de cada vez (S-01). Cartório e migração são integridade: o qa roda com lente de integridade. Se mexer em infra/ ou tests/infra/, rode os testes também como usuário comum (S-03).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-3.1b.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir (perguntar à orquestradora)
Qualquer enfraquecimento de 'um host por vez'; escolher quem é dono (já existe).

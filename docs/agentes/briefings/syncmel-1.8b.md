# Briefing syncmel-1.8b — Núcleo: espalhar/aplicar com a trava de atualização

BASE: 8b99a8441972dd3f9347fa423f696013575faf32 · RAMO: roadmap/syncmel-1.8b · MODELO: opus (gatilho: lógica de trava)
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination, sysdesign-resilience-failure
LEIA: qualidade-sabre §integridade (trava, regras 1, 2, 3, 5), §seguranca, §enxugar
TRIAGEM (do 1.8, passo 3, M1, ~50 linhas + ~100 teste, risco ALTO): o cartório já tem a trava de atualização (1.8a, PR #178: POST /atualizacao/{pegar,renovar,soltar}). Agora o núcleo usa.
REAPROVEITAR: packages/nucleo/src/sync/aplicar.ts:73-83 exigirPodeTrocar (hoje exige a trava de HOST: é aqui que o espalhar é bloqueado), :125 e :171 (checagens antes/depois do download), aplicarDelta inteiro (troca atômica, marcador, .antigo: NÃO reescrever); sync/espalhar.ts:79-93 (barreiras) e :130-144 (passa temTrava); servidor/processo.ts travaConfirmada; backup/restaurar.ts gravarMarcadorTroca/podeSubir; cartorio/cliente.ts (acrescentar os 3 métodos de /atualizacao no molde dos de /trava; leia services/cartorio/src/atualizacao.ts para o contrato).
NÃO ESCREVER: nova troca/hash; relaxar exigirMundoNaPastaDoServidor nem servidorParado; tocar na trava de host; "ignorar o marcador".
O QUE FAZER: em aplicar.ts, trocar a exigência de temTrava por: "este PC não hospeda agora (servidor local parado + sem trava de host dele)" E "trava de atualização confirmada (prazo valendo)"; espalhar.ts pega a trava de atualização antes, renova durante o download/troca (prazo 60 s, renovação 20 s — conferirTempos do cartório), SEMPRE solta no fim (também em erro/cancelamento), e cancela a troca se perder a trava (renovação falhou ou época mudou). O PC que hospeda continua recusado.
REQUISITOS VINDOS DA REVISÃO DO 1.8a (todos com teste):
 a) prazo da atualização vencido no cartório com a troca local ainda em curso: o PC pode pegar host → a troca precisa renovar antes de CADA rename e abortar sem renomear se não conseguiu; e o marcador de troca continua impedindo o servidor local de subir.
 b) trava de host vencida (rede caiu) deixa pegar atualização com o servidor local ainda de pé → confirmar que o servidor local está PARADO antes de chamar /atualizacao/pegar.
 c) relógio do cartório voltando: fora do alcance (vai para o Backlog), mas não piore.
L-01: o plano traz a CONTA DE TEMPO (prazo, renovação durante download, tempo de troca) e todos os caminhos de perda (crash entre renames — o marcador recupera —, soltar não chamado, prazo vencido, rede caindo). S-06: um só relógio de renovação; tomar a geração antes de qualquer await e guardar o antigo; parar o relógio no finally. S-07: marcador lido do disco é entrada não confiável.
PROVA (mundos inventados em tests/mundos/): (a) PC não-host atualiza com host ativo em outro PC e o mundo do host fica intacto (hash igual); (b) PC que hospeda (servidor rodando) → recusa; (c) atualização perdida no meio → nada renomeado, mundo antigo intacto; (d) soltar chamado em erro; (e) queda entre renames → marcador recupera (já existe). Confirme que os testes novos FALHAM antes da mudança.

## Item (texto literal do roadmap)
- [ ] **1.8 — ⏸️ P · A trava de host impede o espalhar em segundo plano**
  *O que fazer:* `aplicarDelta` exige a trava de host; enquanto o host a segura, um PC que não hospeda não consegue pegar a vez e só atualiza quando a trava está livre. **Pede decisão do Eliel (regra do grupo/trava):** (A) uma "trava de atualização" separada da de host; (B) aceitar atualizar só quando ninguém hospeda. A regra de ouro 1 (um host por vez) não pode ser contornada.
  *Arquivo:* `packages/nucleo/src/sync/espalhar.ts`, `aplicar.ts`, `services/cartorio/src/`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: PC sem hospedar atualiza com o host ativo sem tocar no mundo vivo (A) ou fica em espera clara (B).
  *Depende de:* decisão do Eliel e sync-2.1a (PR #173).
  *Origem:* sync-2.1a · PR #173 · filha

## Decisões que valem para este item
- 31/10 (Eliel): espalhar com trava separada (opção A); o mundo que está rodando nunca é tocado; regra de ouro 1 intacta.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.8b.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), services/cartorio (já feito no 1.8a; se faltar algo ali, avise a Máxima), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir (perguntar à orquestradora)
Qualquer enfraquecimento de "um host por vez".

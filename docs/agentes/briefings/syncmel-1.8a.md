# Briefing syncmel-1.8a — Trava de atualização no cartório (separada da trava de host)

BASE: 37baba740230b19b237a2a9b87104d235ec89d45 · RAMO: roadmap/syncmel-1.8a · MODELO: opus (gatilho: lógica de trava)
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination, sysdesign-resilience-failure
LEIA: qualidade-sabre §integridade (trava, regras 1, 3, 5), §seguranca (token do PC, entrada não confiável), §enxugar
TRIAGEM: M7 (+M1), risco ALTO; corte da Máxima: este é o item 1.8a (SÓ cartório, passos 1 e 2). O núcleo (aplicar.ts) é o 1.8b, depois.
REAPROVEITAR: services/cartorio/src/trava.ts:57-77 mudar() (UPDATE condicional em emTransacao), :93-108 recusaNaTrava/recusaDoDono, :111 pegar, :122 renovar, :164 soltar (molde); banco.ts e servidor.ts para a tabela e as rotas.
NÃO ESCREVER: alterar a semântica de pegar/renovar da trava de host; nova troca/hash; relaxar nada do núcleo.
PASSOS: (1) tabela própria atualizacao(pc_id, epoca, expira_em) + POST /atualizacao/{pegar,renovar,soltar}: prazo com renovação, época (fencing), autenticada pelo token do PC, motivos de recusa; soltar sempre previsto; teste de prazo vencido sem soltar. (2) pegar/passar da trava de HOST recusam o PC que tem atualização valendo (motivo "atualizando"); teste de corrida: PC atualizando não ganha host. Dúvida da triagem: o marcador de troca do núcleo já impede o servidor local subir; se o passo 2 inteiro não se justificar, fazer a recusa mínima do pegar e dizer no plano por quê.
L-01: o plano traz a CONTA DE TEMPO do prazo (prazo, renovação durante o download, tempo de troca) e TODOS os caminhos de perda: crash, soltar não chamado, prazo vencido, rede caindo, relógio. S-01: testes de prazo com folga medida, nunca afrouxar o que provam. Sem relógio de parede no teste sem injeção (use o relógio injetável existente).
PROVA: testes com mundos inventados; (c) atualização em andamento → pegar de host recusado; atualização NUNCA bloqueia o host atual de continuar hospedando e NUNCA toca no mundo vivo. Tempo de teste: rode também como usuário comum se mexer em infra/ (S-03; aqui só services/cartorio).
SEGURANÇA: cartório só aceita comando autenticado; um PC só mexe na PRÓPRIA atualização; limite de tentativas já existente vale.

## Item (texto literal do roadmap)
- [ ] **1.8 — ⏸️ P · A trava de host impede o espalhar em segundo plano**
  *O que fazer:* `aplicarDelta` exige a trava de host; enquanto o host a segura, um PC que não hospeda não consegue pegar a vez e só atualiza quando a trava está livre. **Pede decisão do Eliel (regra do grupo/trava):** (A) uma "trava de atualização" separada da de host; (B) aceitar atualizar só quando ninguém hospeda. A regra de ouro 1 (um host por vez) não pode ser contornada.
  *Arquivo:* `packages/nucleo/src/sync/espalhar.ts`, `aplicar.ts`, `services/cartorio/src/`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: PC sem hospedar atualiza com o host ativo sem tocar no mundo vivo (A) ou fica em espera clara (B).
  *Depende de:* decisão do Eliel e sync-2.1a (PR #173).
  *Origem:* sync-2.1a · PR #173 · filha

## Decisões que valem para este item
- 31/10 (Eliel): espalhar com trava separada — cada PC atualiza a própria cópia em segundo plano mesmo com alguém hospedando (trava de atualização própria, distinta da de host); o mundo que está rodando nunca é tocado. Opção A.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.8a.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em services/cartorio
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), packages/nucleo (é o 1.8b), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir (perguntar à orquestradora)
Qualquer enfraquecimento da regra "um host por vez".

# Briefing syncmel-1.10 — Servir os arquivos do mundo no app

BASE: 4a6e37d6bb7c2a21f0a691efe8828fe811f7de0c · RAMO: roadmap/syncmel-1.10 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; integridade (só pacote fechado; regra 2); seguranca (rede privada, token, escuta)
TRIAGEM: não rodada pela orquestradora; faça a sua: M1 reaproveitar servirArquivos (packages/nucleo/src/sync/transferencia.ts) e o padrão de ligação de principal.ts/espalhar-versao.ts (PR #192, ligarEspalharDoApp); estimativa ~100 linhas + teste. Descubra como o app sabe seu IP da rede privada e o token do PC (mesmo caminho do cliente do cartório). Escuta só nesse IP; sem rede privada/token = não liga e avisa no log.

## Item (texto literal do roadmap, docs/roadmap-sync-melhoria.md, item 1.10)
- [ ] **1.10 — Servir os arquivos do mundo no app (sync-2.1c)**
  *O que fazer:* nenhum código do app chama `servirArquivos`: nenhum PC escuta na `PORTA_ESPALHAR` (25570), então o espalhar (1.9a) não acha fonte de verdade. Iniciar o servidor de arquivos no app, só na IP da rede privada do PC (nunca em 0.0.0.0), com o token por PC conferido pelo cartório, servindo só pacotes fechados registrados (nunca a pasta do mundo vivo); parar ao sair. Também (notas do qa do #192): ignorar em `fontesDeCopias` IP fora da faixa (hoje um IP estranho derruba a rodada de todos); ligar o disparo também após backup bom; teste de `ligarEspalharDoApp`.
  *Arquivo:* `apps/desktop/src/main/`, `packages/nucleo/src/sync/transferencia.ts`, `espalhar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste com 2 PCs simulados (mundo inventado): um serve, o outro atualiza; IP fora da faixa é ignorado sem derrubar a rodada; servidor não escuta fora da rede privada.
  *Depende de:* syncmel-1.9a ✅ (PR #192). Libera 1.3, 1.9b e migra-2.1.
  *Origem:* syncmel-1.9a · PR #192 · filha + qa

## Decisões que valem para este item
DECISOES 31/10: espalhar com trava de atualização separada; mundo que roda nunca é tocado. PORTA_ESPALHAR=25570 só na rede privada (decidido pela coordenadora). A nuvem não é fonte. Qa em integridade + segurança.

## Soluções conhecidas que se aplicam
S-06 (um só servidor/relógio; geração antes de await), S-07, S-08 (socket cru: s.resume()), S-09, S-10 (linhas Regressão:/Tela no app:), S-11, S-12 (cliente do cartório: motivos de recusa). Vistorias uma de cada vez. Item toca apps/desktop/src/main: se mexer em infra/ rode também como usuário comum (S-03), provavelmente não precisa.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.10.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo. A tela de banda é o 1.9b (não fazer). Outra filha (hostmel-3.2) mexe em ui/configuracoes e no handler da troca de versão: não tocar.

## O que NÃO decidir (perguntar à orquestradora)
Nada.

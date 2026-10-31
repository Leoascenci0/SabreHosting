# Briefing syncmel-1.12 — Sobras do servir/espalhar (onda 26)

BASE: 2b3560a4b1fec54a7f20e00cb0ea61dc7e40d355 · RAMO: roadmap/syncmel-1.12 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; integridade (troca de host); desempenho (download/freio); seguranca (rede privada)
TRIAGEM: M4 (a, b, d, e) + M7 pequeno (f) + teste (c); ~70 linhas (+~90 teste); risco alto (sync, rede, download).
 (a) pendente: relógio é `const relogio` local em principal.ts:~363; sairDoApp (:101-117) não o limpa nem zera servidorArquivosApp → relógio em variável de módulo + clearInterval antes de fechar().
 (b) já é desenho: sem rede entre renames (aplicar.ts:98-105) e rede de propósito antes do 1º rename; NÃO mudar código, só teste que fixe isso. Baixa (espalhar.ts exigirForaDoHost) continua indo à rede (regra 1).
 (c) pendente: teste de saida.ts e do relógio de 60 s.
 (d) provavelmente feito: conferir ui/index.html (~167) se ainda diz "vale na próxima atualização"; só texto.
 (e) baixar.ts:~213 setTimeout do freio sem handle: clearTimeout ao abortar; teste com timers falsos.
 (f) vitrine.ts:71-77 fechar() espera `andamento` sem prazo: prazo curto (≤3 s) e deixar a pasta v-* para a limpeza do arranque.
 NÃO ESCREVER: nova consulta de rede entre renames; tirar a checagem de host antes da baixa; apagar pasta de vitrine em publicação ativa; biblioteca de timer.

## Item (texto literal do roadmap)
**1.12 — Sobras do servir/espalhar (onda 26)** (docs/roadmap-sync-melhoria.md; leia o texto completo lá)
(a) `sairDoApp` limpar o relógio de 60 s que relê o IP da rede privada; (b) sub-item f do 1.11 (`hospedaAgora`/`exigirForaDoHost` vão à rede antes do 1º rename, baixa); (c) teste do `before-quit`/relógio de 60 s em `principal.ts`; (d) dica da tela de banda diz "vale na próxima atualização" mas o limite é lido a cada arquivo (só texto); (e) `setTimeout` do freio em `baixar.ts` não é cancelado ao abortar; (f) `vitrine.fechar()` pode atrasar o desligar do Windows com publicação longa.
*Arquivo:* apps/desktop/src/main/principal.ts, packages/nucleo/src/servidor/baixar.ts, packages/nucleo/src/sync/
**Tela no app:** Configurações › Backups › Limite de banda (só o texto da dica).
*Confirmação:* teste de cada item que falha sem a proteção.

## Decisões que valem para este item
nenhuma

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.12.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento e `Regressão:` e `Tela no app:` (S-10)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos. Não tocar apps/desktop/src/main/boas-vindas*, cofre*, deps-reais* nem packages/nucleo/src/launcher (outras filhas).

## O que NÃO decidir (perguntar à orquestradora)
Mudar a baixa para não ir à rede antes do 1º rename (só o Eliel).

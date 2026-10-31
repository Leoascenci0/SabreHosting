# Briefing appmel-1.11 — Backups: ligar a rotação e expor "Quantos guardar"

BASE: 37baba740230b19b237a2a9b87104d235ec89d45 · RAMO: roadmap/appmel-1.11 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable (campo da tela)
LEIA: qualidade-sabre §integridade (regra 4, apagar backup), §enxugar, §interface
TRIAGEM: M1 + M2 (+ M7 só p/ marca bom/ruim), ~130 linhas + ~200 teste, risco ALTO (apaga backup dos amigos).
REAPROVEITAR: nucleo/src/backup/rotacao.ts (planejarRotacao pura, aplicarRotacao que reconfere um bom antes de apagar, conferirPacote) — não reescrever; backup/agendador.ts:102 (aoConcluir) e apps/desktop/src/main/agenda-backups.ts:150 (molde do gancho depois de backup bom); main/preferencias.ts (validarIntervaloBackup, lerPreferencias, salvarPreferencias: molde do campo quantosGuardar, padrão 10, inteiro ≥1); main/configuracoes.ts; ui/ponte.ts:21; ui/configuracoes.ts:171,224; ui/index.html:95-106 (fieldset Backups); main/principal.ts:179-217.
NÃO ESCREVER: rotação nova; conferência de hash nova; campo "bom" dentro do .tar.gz (pacote fechado, regra 3); estado no cartório; tela nova; listarBackups com estado.
FONTE bom/ruim (decidida pela Máxima): o APP. Arquivo de marcas ao lado da pasta de backups (nome, estado, sha256). "bom" gravado no aoConcluir (pacote já conferido por hash); "ruim" só se conferirPacote falhar depois; sem marca = não-conferido, que a rotação SEMPRE mantém. A marca guarda o sha256. Marcador lido do disco é entrada NÃO confiável (S-07): arquivo de marcas adulterado nunca pode fazer apagar mais do que o plano seguro (aplicarRotacao reconfere).
PASSOS: (1) marca de estado + testes (bom, ruim, sem marca); (2) preferência quantosGuardar + campo Configurações › Backups › "Quantos guardar"; (3) depois de cada backup bom e no arranque: planejarRotacao(recentes = quantosGuardar) → aplicarRotacao; erro vira aviso, nunca apaga sem conferir. Agendador/rotação: S-06 (geração antes de qualquer await; sem duas rotações ao mesmo tempo).
PROVA: E2E com mundo inventado (tests/mundos/): quantosGuardar=3 → sobram 3 recentes + a regra dos 7 dias; o último bom e os não conferidos nunca saem; "nenhum bom passou" não apaga nada.

## Item (texto literal do roadmap)
- [ ] **1.11 — ⏸️ P · Backups: ligar a rotação e expor "Quantos guardar"**
  *O que fazer:* ligar `planejarRotacao`/`aplicarRotacao` ao app depois de cada backup bom e expor Configurações › Backups › "Quantos guardar". **Pede o OK do Eliel**: a rotação apaga backups dos amigos sozinha; e falta a fonte que marca cada backup como bom/ruim/não-conferido (rotacao.ts:4: cartório ou app). Padrão atual (10 recentes + 7 dias) e mínimo garantido não mudam sem ele.
  *Arquivo:* `apps/desktop/src/main/`, `packages/nucleo/src/backup/rotacao.ts`, `apps/desktop/src/ui/configuracoes.ts`
  **Tela no app:** Configurações › Backups › "Quantos guardar".
  *Confirmação:* E2E: valor salvo muda quantos backups ficam; teste de que o último bom e os não conferidos nunca saem.
  *Depende de:* appmel-1.8 e decisão do Eliel.
  *Origem:* appmel-1.8 · triagem · Máxima

## Decisões que valem para este item
- 31/10 (Eliel): rotação ligada, guarda os 10 mais novos e TUDO dos últimos 7 dias; nunca apaga o último bom; cada amigo muda o número em Configurações › Backups › "Quantos guardar".
- CONFLITO RESOLVIDO PELA MÁXIMA (reversível): a regra anterior (D6/rotacao.ts) era "1 por dia nos últimos 7 dias". Vale a palavra do Eliel: **todos os backups dos últimos 7 dias ficam, mais os N mais novos**. Ajuste rotacao.ts e seus testes para isso (guarda MAIS, nunca menos que antes). Exporte a regra num único lugar, pois drive-1.1b reusa.
- Tela no app: Configurações › Backups › "Quantos guardar". Termo claro, mínimo 1, explicar em uma frase que os dos últimos 7 dias sempre ficam.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.11.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir (perguntar à orquestradora)
Mudar o mínimo garantido ou o padrão 10; apagar qualquer coisa fora da pasta de backups do Sabre.

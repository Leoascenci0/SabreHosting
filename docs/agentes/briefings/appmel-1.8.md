# Briefing appmel-1.8 — Backups: intervalo (ligar o agendador e expor o campo)

BASE: d8ce9f28c70cc81bb18eb731b4fa33f974427744 · RAMO: roadmap/appmel-1.8 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable (audit e polish antes de entregar)
LEIA: qualidade-sabre › integridade.md (regras 2–4: backup só com save-off/flush, nunca apagar o último bom) e interface.md
TRIAGEM: M1+M2+M5 · ~180 linhas + ~220 de teste · risco alto. Reaproveitar: `agendarBackups` (packages/nucleo/src/backup/agendador.ts:85; intervalo padrão 10 min; já valida > 0); `criarBackups` (apps/desktop/src/main/backups.ts:27); `depsBackups` (deps-backups.ts:27); `lerPreferencias`/`salvarPreferencias` com troca atômica (preferencias.ts:27, :52); `criarConfiguracoes.salvar` (valida antes de gravar); seção Grupo de apps/desktop/src/ui/configuracoes.ts como molde da seção Backups. NÃO escrever: novo agendador, nova validação de intervalo, nova gravação de preferências, IPC de estado (sabre:backups:listar existe), alteração em fazerBackup/salvarSeguro/planejarRotacao, valor padrão novo. Passos: (1) Preferencias ganha `intervaloBackupMin` (padrão 10, faixa sensata, valor torto volta ao padrão); (2) principal.ts liga `agendarBackups` quando o servidor fica pronto (descubra onde sobe), reagenda ao salvar novo intervalo, para ao fechar/parar o servidor; backup SÓ com o fluxo seguro já existente; (3) tela Configurações › Backups › "Intervalo" (número em minutos, confirmação de salvo); (4) testes + E2E "valor salvo muda o intervalo".

## CORTE DECIDIDO PELA MÁXIMA (leia)
O item original também manda ligar a ROTAÇÃO ("Quantos guardar"). A rotação APAGA backups, e apagar backup é decisão do Eliel; além disso não existe no app a fonte que marca cada backup como bom/ruim/não-conferido (rotacao.ts:4). Por isso este item entrega SÓ o agendador + campo "Intervalo". NÃO ligue `aplicarRotacao`/`planejarRotacao` ao app, NÃO crie o campo "Quantos guardar" e NÃO mude o padrão de quantos guardar. A parte da rotação vira o item appmel-1.11 (⏸️ P do Eliel).

## Item (texto literal do roadmap, parte entregue)
Backups: intervalo (ligar e expor). Ligar `agendarBackups` ao app (hoje sem consumidor em `apps/desktop`) e só então expor o campo em Configurações › Backups.
Arquivo: `apps/desktop/src/main/`, `packages/nucleo/src/backup/agendador.ts`. Tela no app: Configurações › Backups › "Intervalo".
Confirmação: valor salvo muda o intervalo do backup (E2E).
Depende de: appmel-1.7 (feito; mesma tela).

## Decisões que valem para este item
Padrão e mínimo de "quantos guardar" não mudam sem o Eliel. Regras de ouro 2–4.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.8.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) e E2E
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento e **Tela no app:**

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, qualquer segredo, rotação de backups.

## O que NÃO decidir (perguntar à orquestradora)
Qualquer coisa que apague backup; padrão de quantos guardar.

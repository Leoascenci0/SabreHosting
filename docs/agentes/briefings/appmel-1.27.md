# Briefing appmel-1.27 — Tela inicial do app

BASE: a5294b4ce64828e4fa79b4d00cc5643c711818dc · RAMO: roadmap/appmel-1.27 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface, enxugar), impeccable
TRIAGEM: M5 (+M1 para o Importar) ~90 linhas, risco médio. Mover os nós #importar-abrir, #importar-status, #importar-erro e #importar-painel de #tela-backups para o cartão inicial (#cartao); importar.ts troca só a referência `tela`; um único botão, sem duplicar fluxo. Grade 2×2 de botões (Hospedar #principal, Importar #importar-abrir, Backups #ver-backups, Configurações #ver-config; manter ids), alvo ≥44px, estados como hoje. Ícone 160px → ~112px em janela baixa; se não couber, altura ~640 em principal.ts:149 (medir antes). Atualizar importar.e2e.ts (não clica mais #ver-backups) e inicio.e2e.ts:75-80 (`visiveis` pega `.acoes button`). Backups.e2e clica #ver-backups: manter id. Capturas só com SABRE_CAPTURAS=1. Conferir tema escuro em tokens.css.
PROVA: e2e novo (imitar inicio.e2e.ts): scrollHeight <= innerHeight e os 4 botões dentro da viewport com height ≥44; falha antes, passa depois.

## Item (texto literal do roadmap)
Ver `docs/roadmap-app-melhoria.md` item 1.27 no ramo roadmap/onda-2026-11-01-38. Problema: janela padrão mostra só o Hospedar; Backups/Configurações abaixo da dobra; Importar mundo escondido em Backups. Decisão do Eliel: os 4 botões de verdade, visíveis sem rolar, janela padrão maior se preciso; Importar com o mesmo fluxo e confirmação; sem termo técnico; pt-BR; carregando/foco/teclado preservados; tema claro e escuro.
**Tela no app:** Início › botões Hospedar, Importar mundo, Backups, Configurações.
**Regressão:** o e2e acima.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.27.md como primeiro commit
- [ ] E2E novo falha antes, passa depois; importar.e2e/inicio.e2e/backups.e2e ajustados e verdes
- [ ] `npm run vistoria` e `npm run vistoria:comum` APROVADAS (uma de cada vez)
- [ ] PR com as seções do modelo, linhas Regressão:, Tela no app:, Triagem/Segurança/Integridade/Enxugamento/Roteamento, e "O que NÃO foi confirmado": não visto num Windows de verdade

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), nuvem real, mundo real.
## O que NÃO decidir
Nada.

# Briefing appmel-1.18 — Teste do encaixe de Jogar/Hospedar em `principal.ts`

BASE: cfb0cdb4217c0bf9976934bcb1bd6c81e485eb7b · RAMO: roadmap/appmel-1.18 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › enxugar (e integridade só para conferir que a ordem das checagens não muda)
TRIAGEM: M1 (+M4 no teste) · ~80 linhas (~30 código + ~50 teste) · risco médio (só move a checagem de Hospedar/Jogar; a trava continua em inicio.hospedar). Reaproveitar pasta-base.ts:31-34 (trocada()), inicio.ts (jogar/hospedar), boas-vindas-app.ts:62 (molde de ipcMain.handle + permitir), principal.ts:557-566 (bloco a extrair). Passos: 1. criar main/encaixe-inicio.ts com função que recebe {permitir, trocada, jogar, hospedar, mensagem} e devolve os handlers; 2. principal.ts:557-566 vira chamada dela; 3. encaixe-inicio.test.ts: Jogar lança e Hospedar devolve ok:false depois de trocada(), sem chamar inicio.*. NÃO escrever: nova lógica de trocada() (pasta-base.test.ts:102 cobre) nem nova checagem de trava. Prova: teste que falha se a checagem sair da função. Comportamento idêntico ao atual (refatoração + teste, sem mudar mensagem).

## Item (texto literal)
*O que fazer:* extrair os handlers de Jogar/Hospedar para função testável e cobrir a recusa depois de `trocada()` (hoje só `pasta-base.test.ts` cobre `trocada()`; o encaixe no `principal.ts` não tem teste).
*Arquivo:* `apps/desktop/src/main/principal.ts`
**Tela no app:** não se aplica.
*Confirmação:* teste: Jogar e Hospedar recusam depois de `trocada()`.

## Decisões que valem: nenhuma
## Critério de pronto
- [ ] Plano docs/agentes/planos/appmel-1.18.md primeiro commit
- [ ] Teste novo (falha se a checagem sair do encaixe)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo + Triagem/Segurança/Integridade/Enxugamento/Roteamento + **Regressão:** (teste que protege o encaixe) + **Tela no app:** não se aplica
## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem, mundo real, segredo. Não mexer em pastaMundo/level-name (é o appmel-1.19, depois deste).
## O que NÃO decidir: nada

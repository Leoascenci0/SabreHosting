# Briefing appmel-1.17 — Assistente: mensagem para cofre corrompido

BASE: d720a63e566ad69d26be580b001d6274db86c8dc · RAMO: roadmap/appmel-1.17 · MODELO: haiku (MIÚDO: sim)
SKILLS: using-superpowers, qualidade-sabre, impeccable (audit/polish rápido)
LEIA: qualidade-sabre › references/interface.md; enxugar
TRIAGEM: M1 · ~15 linhas código + ~30 E2E · risco baixo. Reaproveitar `mostrarErro` (apps/desktop/src/ui/boas-vindas.ts:47), `aberto()` (:81) e `EstadoBoasVindas.cofreCorrompido` (ui/ponte.ts:111; main/boas-vindas.ts:138 já informa). Em `aberto()`, DEPOIS de `irPara(e.passo)` (que zera o erro), se `e.cofreCorrompido`: `mostrarErro("Seu acesso guardado neste PC não abre mais; peça um convite novo.")`. Se preciso, `SABRE_E2E_COFRE_CORROMPIDO=1` em fake-e2e.ts (~:298-322) seguindo `SABRE_E2E_SEM_COFRE`. Caso novo em apps/desktop/e2e/boas-vindas.e2e.ts: frase em #bv-erro e campo de convite segue visível. NÃO mexer em main/boas-vindas.ts, config-pc.ts, ponte.ts; sem tela nova.

## Item (texto literal)
*O que fazer:* quando `cofreCorrompido` vier verdadeiro, mostrar "Seu acesso guardado neste PC não abre mais; peça um convite novo" (hoje `main/boas-vindas.ts` já informa o estado, mas a tela `ui/boas-vindas.ts` não o trata).
*Arquivo:* `apps/desktop/src/ui/boas-vindas.ts`
**Tela no app:** Assistente de boas-vindas (primeira vez).
*Confirmação:* teste/E2E com `cofreCorrompido: true` mostra a mensagem.

## Decisões que valem para este item
nenhuma

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.17.md como primeiro commit
- [ ] Teste/E2E que falha antes e passa depois
- [ ] `npm run vistoria` APROVADA (E2E Playwright pode não rodar na nuvem: diga o que rodou)
- [ ] PR com seções do modelo + Triagem/Segurança/Integridade/Enxugamento/Roteamento + **Tela no app:** + **Regressão:**

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem, mundo real, segredo.

## O que NÃO decidir
nada

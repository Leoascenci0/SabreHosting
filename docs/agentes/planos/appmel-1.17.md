# Plano appmel-1.17 — Assistente: mensagem para cofre corrompido

Base: d720a63 · Ramo: roadmap/appmel-1.17 · Triagem: M1 (reaproveitar)

## Problema

Quando o token guardado no cofre do sistema não decifra mais, `main/boas-vindas.ts` já devolve
`cofreCorrompido: true` ao assistente, mas `ui/boas-vindas.ts` (`aberto()`) ignora o campo e mostra a tela de convite
sem explicação. O amigo vê um convite em branco e não sabe por que precisa de um novo.

## Passos

1. **Teste E2E que falha antes** (`apps/desktop/e2e/boas-vindas.e2e.ts`): com `cofreCorrompido: true`, a frase
   "Seu acesso guardado neste PC não abre mais" aparece em `#bv-erro` e o campo de convite (`#bv-texto`) continua
   visível.
2. **Fake E2E** (`apps/desktop/src/main/fake-e2e.ts`, `depsBoasVindasE2E`): `SABRE_E2E_COFRE_CORROMPIDO=1` marca o
   PC como configurado (grava `boas-vindas.json` com `concluido: true`) e faz `cofre.estado()` devolver
   `{ tipo: "corrompido" }`, seguindo o padrão de `SABRE_E2E_SEM_COFRE`.
3. **Implementação** (`apps/desktop/src/ui/boas-vindas.ts`, `aberto()`): logo depois de `irPara(e.passo)` (que zera o
   erro), se `e.cofreCorrompido`, `mostrarErro(...)` com o texto literal do item.
4. Rodar `npm run vistoria`; E2E com Playwright pode não rodar na nuvem (dizer o que rodou).

## Fora do alcance

`main/boas-vindas.ts`, `main/config-pc.ts`, `ui/ponte.ts` (não mexer), tela nova, CLAUDE.md, `.claude/`,
`docs/roadmap-*.md`, `docs/MILESTONE.md`, `docs/agentes/` (exceto este plano), mundo real, segredo.

## Riscos

- Mensagem não pode sumir quando o passo muda para EULA/pasta: `irPara` zera o erro, por isso a mensagem entra
  depois dele. Ela só aparece no passo "convite" (é o único passo que o estado corrompido produz).
- Nada de termo técnico na tela ("cofre", "token" ficam fora da frase).

## Segurança / Integridade / Enxugamento

- Segurança: sem superfície nova; só texto de tela. Nenhum segredo lido ou exibido.
- Integridade: não toca o mundo nem a trava; o convite continua sendo o único caminho.
- Enxugamento: aumento só de linhas; nada removido.

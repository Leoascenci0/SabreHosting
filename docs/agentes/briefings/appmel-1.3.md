# Briefing appmel-1.3 — Capturas do E2E só quando pedidas

BASE: ceb159daf89f8be21a648e8f7da20e28edf80c2d · RAMO: roadmap/appmel-1.3 · MODELO: haiku (MIÚDO) · ISSUE: #124
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1
TRIAGEM (Máxima): M4 | ~10 linhas | RISCO baixo | MIÚDO: sim | ONDE: apps/desktop/e2e/janela.e2e.ts:10,148 e apps/desktop/e2e/inicio.e2e.ts:10,57,61 gravam em docs/imagens/ sempre | PASSOS: 1. só tirar captura quando process.env.SABRE_CAPTURAS === "1" (um ajudante pequeno compartilhado pelos dois arquivos, ou a mesma linha nos dois); 2. sem a variável, o teste segue conferindo a tela do mesmo jeito (a captura é só registro, não asserção — se alguma asserção depender do arquivo, mantenha a asserção sem gravar); 3. documentar `SABRE_CAPTURAS=1 npm run test:e2e -w apps/desktop` no LEIAME/README do app (onde já houver instrução do E2E) | NÃO ESCREVER: pasta nova por item agora (as imagens atuais ficam onde estão); mudança nas telas | PROVA: `npm run vistoria` e depois `git status --porcelain` vazio; com SABRE_CAPTURAS=1 as PNGs são regeradas.

## Item (texto literal do roadmap)
- [ ] **1.3 — Capturas do E2E só quando pedidas**
  *O que fazer:* o E2E regrava `docs/imagens/app-1.1-*.png` (agora com a tela do app-1.2) a cada `npm run vistoria`,
  sujando o `git status`. Gravar capturas só com `SABRE_CAPTURAS=1` e numa pasta própria por item; atualizar as do app-1.1.
  *Arquivo:* `apps/desktop/e2e/`
  **Tela no app:** não se aplica.
  *Confirmação:* `npm run vistoria` seguido de `git status` limpo.
  *Origem:* app-1.2 · PR #74 · orquestradora

## Decisões que valem para este item
- Decidido pela Máxima (reversível): as imagens existentes ficam em docs/imagens/ (não mover agora); "pasta própria por item" fica para quando houver item novo de tela.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.3.md como primeiro commit
- [ ] `npm run vistoria` APROVADA e `git status --porcelain` vazio depois dela (cole no PR)
- [ ] PR (Closes #124) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar). Só apps/desktop/e2e/ (+ a linha de instrução).

## O que NÃO decidir (perguntar à orquestradora)
nada

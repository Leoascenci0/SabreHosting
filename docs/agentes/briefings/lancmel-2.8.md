# Briefing lancmel-2.8 — `javaw` reaproveitado precisa bater com o que foi extraído

BASE: 491eaf946d28f2791ecea71e6cc8787ae5edddc3 · RAMO: roadmap/lancmel-2.8 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › integridade, seguranca
TRIAGEM: M4 (alterar função existente `extrairJava`), ~25 linhas + ~40 de teste, risco médio (executável rodado pelo app). Não escrever: hash do Java inteiro, dependência nova, mudança de formato do zip.

## Item (texto literal do roadmap)
Ver `docs/roadmap-lanc-melhoria.md` › 2.8 (no ramo docs da onda: `git show origin/claude/onda-34:docs/roadmap-lanc-melhoria.md`).
Resumo: gravar tamanho + sha256 do `javaw` no `.java.json` ao extrair; no reaproveitamento comparar; divergência ou marcador antigo → apagar a pasta e extrair de novo do zip. Remover o `stat` redundante de `montar.ts` se o novo teste o cobrir (sem perder o caso "javaw sumiu").

## Decisões que valem para este item
nenhuma

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lancmel-2.8.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/src/launcher/zip.test.ts
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento e `Regressão:`

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
nada

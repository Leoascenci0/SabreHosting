# Briefing syncmel-1.14

BASE: c7349882206ce7ddf0ecb537f80237cc3b1d533e · RAMO: roadmap/syncmel-1.14 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1 e as partes que o tipo pede (integridade/seguranca)
TRIAGEM: M1+M3, ~100 linhas, risco alto. O callback de progresso JÁ existe em alcancar.ts:55-73: só ligar na tela (espalhar-versao.ts:104-121, ui/tela.ts). Sem lib de retentativa. Estimativas passadas estouraram 4x: mantenha o escopo.

## Item (texto literal do roadmap)
Leia o item "1.14" em docs/roadmap-sync-melhoria.md (git show origin/main:docs/roadmap-sync-melhoria.md).

## Decisões que valem para este item
Ver docs/ops/DECISOES.md. Provas no PC Windows ficam como [P] no PR.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.14.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] npm run vistoria APROVADA; PR com Regressão:/Tela no app: quando couber, e Triagem/Segurança/Integridade/Enxugamento/Roteamento
## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real.
## O que NÃO decidir
Nada que seja regra do grupo; dúvida vai à orquestradora (session_012qrjnu4Sy5GTmvMBgcHhXA).

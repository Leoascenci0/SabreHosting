# Briefing syncmel-1.13

BASE: c7349882206ce7ddf0ecb537f80237cc3b1d533e · RAMO: roadmap/syncmel-1.13 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1 e as partes que o tipo pede (integridade/seguranca)
TRIAGEM: M4, ~25 linhas+teste, risco alto (servidor de arquivos na rede). Reaproveitar servir-arquivos.ts:68-141 e principal.ts:372/115. Não criar mecanismo novo; confirmar antes se a flag fechado já existe.

## Item (texto literal do roadmap)
Leia o item "1.13" em docs/roadmap-sync-melhoria.md (git show origin/main:docs/roadmap-sync-melhoria.md).

## Decisões que valem para este item
Ver docs/ops/DECISOES.md. Provas no PC Windows ficam como [P] no PR.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.13.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] npm run vistoria APROVADA; PR com Regressão:/Tela no app: quando couber, e Triagem/Segurança/Integridade/Enxugamento/Roteamento
## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real.
## O que NÃO decidir
Nada que seja regra do grupo; dúvida vai à orquestradora (session_012qrjnu4Sy5GTmvMBgcHhXA).

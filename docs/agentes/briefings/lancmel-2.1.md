# Briefing lancmel-2.1

BASE: c7349882206ce7ddf0ecb537f80237cc3b1d533e · RAMO: roadmap/lancmel-2.1 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable
LEIA: qualidade-sabre §1 e as partes que o tipo pede (integridade/seguranca)
TRIAGEM: M5+M1, ~250 linhas, risco alto. Reaproveitar mods.ts:57 sincronizarMods, GET/PUT /grupo/mods (servidor.ts:348), molde da área Grupo em ui/configuracoes.ts. Sem endpoint novo. Só o dono edita.

## Item (texto literal do roadmap)
Leia o item "2.1" em docs/roadmap-lanc-melhoria.md (git show origin/main:docs/roadmap-lanc-melhoria.md).

## Decisões que valem para este item
Ver docs/ops/DECISOES.md. Provas no PC Windows ficam como [P] no PR.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lancmel-2.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] npm run vistoria APROVADA; PR com Regressão:/Tela no app: quando couber, e Triagem/Segurança/Integridade/Enxugamento/Roteamento
## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real.
## O que NÃO decidir
Nada que seja regra do grupo; dúvida vai à orquestradora (session_012qrjnu4Sy5GTmvMBgcHhXA).

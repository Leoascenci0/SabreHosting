# Briefing lancmel-1.1

BASE: be029a5bdaf3d2dbdd4f2a48fb0d028d3ac15743 · RAMO: roadmap/lancmel-1.1 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › references pertinentes ao tipo (integridade/seguranca/enxugar); docs/arquitetura.md só se precisar.
TRIAGEM: M1/M2 — acabamento em código existente; reaproveitar o que já há, escrever uma vez só (a filha confirma com grep antes).

## Item (texto literal do roadmap)
- [ ] **1.1 — Detecção e instância mais firmes**
  *O que fazer:* comparar a versão completa do Prism (major.minor.patch) se o mínimo virar 8.x; marcador próprio da
  instância do SabreHosting (arquivo dentro da pasta) além do nome; cortar o nome do grupo sem partir emoji (par
  substituto); `readFile(...).catch` só para "não existe", repassando outros erros.
  *Arquivo:* `packages/nucleo/src/launcher/prism.ts`, `packages/nucleo/src/launcher/instancia.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso.
  *Origem:* lanc-1.1 · PR #36 e lanc-1.2 · PR #57 · qa

## Decisões que valem para este item
Banda padrão 10 MB/s; nuvem NÃO é fonte do espalhar (decididos 31/10). Demais: docs/ops/DECISOES.md.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lancmel-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA (e, se mexer em infra/, também como usuário comum, S-03)
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, Regressão: e Tela no app:

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada: dúvida de regra do grupo vira pergunta à sessão de onda.

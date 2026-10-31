# Briefing hostmel-3.3

BASE: be029a5bdaf3d2dbdd4f2a48fb0d028d3ac15743 · RAMO: roadmap/hostmel-3.3 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › references pertinentes ao tipo (integridade/seguranca/enxugar); docs/arquitetura.md só se precisar.
TRIAGEM: M1/M2 — acabamento em código existente; reaproveitar o que já há, escrever uma vez só (a filha confirma com grep antes).

## Item (texto literal do roadmap)
- [ ] **3.3 — Acabamentos do backup antes de trocar a versão (notas do qa do #193)**
  *O que fazer:* o servidor pode subir enquanto o backup do 3.2 roda (a checagem é só no início: segurar a trava/estado até o fim); testes da colisão de nome do backup, do texto "Fazendo backup antes…" e do aviso "mods pendentes" (`SEM_HASH_MODS`).
  *Arquivo:* `apps/desktop/src/main/deps-backups.ts`, `versao.ts`, `ui/configuracoes.ts`
  **Tela no app:** Configurações › Servidor › Versão.
  *Confirmação:* testes que falham ao remover cada proteção.
  *Origem:* hostmel-3.2 · PR #193 · qa

## Decisões que valem para este item
Banda padrão 10 MB/s; nuvem NÃO é fonte do espalhar (decididos 31/10). Demais: docs/ops/DECISOES.md.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-3.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA (e, se mexer em infra/, também como usuário comum, S-03)
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, Regressão: e Tela no app:

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada: dúvida de regra do grupo vira pergunta à sessão de onda.

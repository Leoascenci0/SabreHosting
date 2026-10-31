# Briefing syncmel-1.11

BASE: 0c5c96d3aee87149c2809f075dbb8922ac552b24 · RAMO: roadmap/syncmel-1.11 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › references pertinentes ao tipo (integridade/seguranca/enxugar); docs/arquitetura.md só se precisar.
TRIAGEM: M1/M2 — acabamento em código existente; reaproveitar o que já há, escrever uma vez só (a filha confirma com grep antes).

## Item (texto literal do roadmap)
- [ ] **1.11 — Acabamentos do servir/espalhar (notas do qa da onda 25)**
  *O que fazer:* (a) `vitrine.fechar()` esperar a publicação em curso (hoje deixa pasta `v-*` órfã até o próximo arranque); (b) `before-quit` fechar o servidor de arquivos mesmo sem servidor Minecraft ativo; (c) reler o IP da rede privada quando o túnel sobe depois do arranque; (d) `ipDaRedePrivada` aceitar só a interface do WireGuard; (e) testes: filtro de IP privado, link simbólico na vitrine, `ligarEspalharDoApp`; (f) `hospedaAgora`/`exigirForaDoHost` seguem indo à rede antes do 1º rename (baixa); (g) teste de `ultimoRegistrado` no `cliente.test.ts` do cartório; (h) teste de recusa do ramo "ja-tinha" da pré-cópia com `hospedaAgora` verdadeiro (migra-2.1).
  *Arquivo:* `apps/desktop/src/main/`, `packages/nucleo/src/sync/`, `packages/nucleo/src/cartorio/cliente.test.ts`, `packages/nucleo/src/migracao/precopia.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* cada item com teste que falha ao remover a proteção.
  *Origem:* syncmel-1.9a/1.10 · PRs #192, #195, #194, #197 · qa

## Decisões que valem para este item
Banda padrão 10 MB/s; nuvem NÃO é fonte do espalhar (decididos 31/10). Demais: docs/ops/DECISOES.md.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.11.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA (e, se mexer em infra/, também como usuário comum, S-03)
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, Regressão: e Tela no app:

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada: dúvida de regra do grupo vira pergunta à sessão de onda.

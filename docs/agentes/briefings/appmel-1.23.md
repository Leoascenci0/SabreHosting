# Briefing appmel-1.23 — Ensaiar o empacotamento sem criar release

BASE: a5cb558b9afc0d95443b71b64fa932c1572ab06b · RAMO: roadmap/appmel-1.23 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §seguranca (downloads e execução), §enxugar
TRIAGEM: M1 (estender .github/workflows/versao.yml) ~15–20 linhas yml, risco médio, MIÚDO. Reaproveitar versao.yml:33-50 (build, electron-builder, checksums, release), apps/desktop/scripts/checksums.mjs, tests/infra/versao.test.ts:29-54. NÃO escrever: teste novo de JSON; mudança em `files` sem prova (o dist do núcleo entra via node_modules e asarUnpack já aponta para ele; só a 1ª execução real prova); criar tag; rodar o workflow; mexer em secrets; `publish` ou assinatura. Passos: (1) `workflow_dispatch:` em `on:`, sem branches/pull_request (teste das linhas 33-34 proíbe); (2) `if: github.event_name == 'push'` na checagem de tag, no `gh release create` e no checksums se só serve ao release; `--publish never` no electron-builder; (3) `actions/upload-artifact` com `if: github.event_name == 'workflow_dispatch'`, path apps/desktop/release/SabreHosting-Setup-*.exe, action fixada por hash de 40 hex (conferir o SHA real com `gh api`/GitHub MCP; não inventar); (4) testes em tests/infra/versao.test.ts. Como toca tests/infra: rodar também `npm run vistoria:comum` (S-03).

## Item (texto literal do roadmap)
**1.23 — Ensaiar o empacotamento sem criar release.** `workflow_dispatch` em versao.yml com `--publish never`, subindo o .exe como artefato; conferir também se o `files` do electron-builder precisa incluir o `dist` do núcleo (a 1ª tag mostra).
Arquivo: .github/workflows/versao.yml, apps/desktop/electron-builder.json.
**Tela no app:** não se aplica.
Confirmação: ensaio no GitHub gera o .exe como artefato **[P: rodar o workflow]** — NÃO faz parte desta entrega; só o código.

## Decisões que valem para este item
Nenhuma específica. D9: sem assinatura de código.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.23.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em tests/infra/versao.test.ts
- [ ] `npm run vistoria` e `npm run vistoria:comum` APROVADAS
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento; "O que NÃO foi confirmado" diz que o ensaio real no GitHub (P) não rodou

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.

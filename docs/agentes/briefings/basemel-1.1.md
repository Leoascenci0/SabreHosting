# Briefing basemel-1.1 — Fixar as actions do CI por hash de commit

BASE: 10d8c13dd5c0e775fda559a23b6a09238b2ed798 · RAMO: roadmap/basemel-1.1 · MODELO: haiku (MIÚDO)
ISSUE: #92
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1
TRIAGEM: M7 (edição de YAML) | ~25 linhas | RISCO baixo | MIÚDO: sim | REAPROVEITAR: .github/workflows/vistoria.yml (uses: actions/checkout@v4 e actions/setup-node@v4); .github/dependabot.yml não existe: criar | NÃO ESCREVER: verificador novo de uses: sem hash; nada em scripts/verificar.py, permissions, fetch-depth, .nvmrc, passos npm | HASHES (conferidos pela triagem com git ls-remote; tags leves): actions/checkout v4.2.2 = 11bd71901bbe5b1630ceea73d27597364c9af683; actions/setup-node v4.4.0 = 49933ea5288caeca8642d1e84afbd3f7d6820020 — confira de novo com `git ls-remote https://github.com/actions/<nome> refs/tags/<tag>` (e `^{}` se for tag anotada) | PASSOS: 1. ls-remote de cada action na tag exata; 2. `uses: actions/x@<hash40> # vX.Y.Z`; 3. .github/dependabot.yml (version 2, package-ecosystem github-actions, directory /, schedule weekly); 4. vistoria + verificador | PROVA: grep de uses: só com hash de 40 hex + comentário; ls-remote bate; YAML carrega (python3 -c "import yaml"... ou node); vistoria APROVADA. CI verde e PR do Dependabot só se veem depois do merge: não esperar.

## Item (texto literal do roadmap)
- [ ] **1.1 — Fixar as actions do CI por hash de commit**
  *O que fazer:* trocar `actions/checkout@v4` e `actions/setup-node@v4` por hash de commit (com o número da versão em
  comentário) e ligar o Dependabot só para GitHub Actions, para atualizar os hashes por PR.
  *Arquivo:* `.github/workflows/vistoria.yml`, `.github/dependabot.yml`
  **Tela no app:** não se aplica.
  *Confirmação:* o workflow segue verde com os hashes; o Dependabot abre PR quando sair versão nova.
  *Origem:* base-1.2 · PR #7 · filha

## Decisões que valem para este item
- Testar daqui, nunca esperar o CI (regra do Eliel, 31/10/2026).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/basemel-1.1.md como primeiro commit
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #92) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (a vistoria
regera as PNGs: não as commite), máquina da nuvem real, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
nada

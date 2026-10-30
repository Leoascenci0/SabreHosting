# Briefing base-1.2 — CI no GitHub Actions

BASE: 2c2444fc39e4fa1fa41ad6192cb6ee40d0323edd · RAMO: roadmap/base-1.2 · MODELO: sonnet · ISSUE: #4
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md (só a parte de CI, segredos e permissões)
TRIAGEM: M6 (cola: actions/checkout + actions/setup-node) · ~35 linhas, 1 arquivo · risco médio (permissões de CI, PR
de fork) · MIÚDO: sim. REAPROVEITAR: `npm ci` + `npm run vistoria` (package.json), `.nvmrc` (=22). NÃO ESCREVER:
script de CI próprio, Docker, `pull_request_target`, qualquer segredo. PASSOS: 1) `.github/workflows/vistoria.yml` com
`on: pull_request` e `push` na main, `permissions: contents: read`, ubuntu-latest; 2) `actions/checkout` com
`fetch-depth: 0` (o verificador usa `origin/main`; confira que a ref existe no runner em PR e em push); 3) setup-node
com `node-version-file: .nvmrc` e cache npm, `npm ci`, `npm run vistoria`. PROVA: check verde no próprio PR; YAML
validado (actionlint se houver, senão `python3 -c "import yaml"` e anote).

## Item (texto literal do roadmap)
- [ ] **1.2 — CI no GitHub Actions**
  *O que fazer:* workflow que roda `npm ci` + `npm run vistoria` em todo PR e push na `main` (Ubuntu); PR de fork roda
  sem segredos (`pull_request`, nunca `pull_request_target`). Proteção da `main` documentada no PR para o Eliel ligar.
  *Arquivo:* `.github/workflows/vistoria.yml`
  **Tela no app:** não se aplica.
  *Confirmação:* o próprio PR mostra o check verde.
  *Depende de:* base-1.1

## Decisões que valem para este item
- Repositório público, CI gratuito; PR de contribuidor externo roda sem segredos (CLAUDE.md › Código aberto).
- Fixar as actions por versão maior (`@v4`) é suficiente agora; dizer no PR se recomenda fixar por hash (melhoria).
- A proteção da `main` só é **descrita** no PR (passo a passo para o Eliel ligar em Settings › Branches); não ligue nada.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/base-1.2.md como primeiro commit
- [ ] O check do workflow aparece e fica verde no próprio PR (se o push do arquivo de workflow for recusado por
      permissão, PARE e avise a orquestradora; não contorne)
- [ ] `npm run vistoria` APROVADA local
- [ ] PR com as seções do modelo, `Closes #4` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Ligar a proteção da main (é do Eliel).

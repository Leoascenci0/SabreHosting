# Briefing basemel-1.2 — Vistoria em push na main também confere arquivos

BASE: 4f2a02b975a97a8c07b1f02c384a416c29c6e51c · RAMO: roadmap/basemel-1.2 · MODELO: haiku (MIÚDO)
ISSUE: #110
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1
TRIAGEM: M4 (só YAML) | ~20 linhas | RISCO baixo | MIÚDO: sim | REAPROVEITAR: scripts/verificar.py:95 (--base aceita qualquer commit) e :65 arquivos() | NÃO ESCREVER: flag ou etapa nova; mudança no verificador; mexer no package.json (vistoria fixa --base origin/main) | PASSOS: 1. em .github/workflows/vistoria.yml, no evento push: rodar lint, test, e2e e `python3 scripts/verificar.py --base "$BASE"`, com BASE vindo de env: (github.event.before), nunca interpolado direto no shell; em pull_request manter `npm run vistoria`; 2. before = 0000000… (ramo novo) → usar HEAD~1; 3. atualizar o comentário do fetch-depth; manter as actions fixadas por hash (basemel-1.1) | PROVA: local, num ramo descartável não enviado, commit com .env ou .mca falso: `python3 scripts/verificar.py --base <sha anterior>` REPROVADO; com base = HEAD passa (o bug); o YAML carrega.

## Item (texto literal do roadmap)
- [ ] **1.2 — Vistoria em push na main também confere arquivos**
  *O que fazer:* em push na `main`, o verificador compara com a própria `main` e não confere nada de arquivo (só lint e
  testes valem). Fazer o CI passar `--base` do commit anterior (`github.event.before`) nesse caso.
  *Arquivo:* `.github/workflows/vistoria.yml`
  **Tela no app:** não se aplica.
  *Confirmação:* push de teste na main com arquivo proibido faz o check ficar vermelho (num ramo de teste espelhado).
  *Origem:* base-1.2 · PR #7 · qa

## Decisões que valem para este item
- Decidido pela Máxima: a Confirmação remota NÃO usa push de teste na main nem ramo espelhado; ela se dá no próximo merge real na main (a Máxima confere o check). Na filha, só prova local. Escreva isso em "O que NÃO foi confirmado".
- Testar daqui, nunca esperar o CI (regra do Eliel).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/basemel-1.2.md como primeiro commit
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #110) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), qualquer segredo (o .env falso da prova fica num ramo local descartável, nunca enviado).

## O que NÃO decidir (perguntar à orquestradora)
nada

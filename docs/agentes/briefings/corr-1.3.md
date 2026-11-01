# Briefing corr-1.3 — Fixar a versão do Electron para o electron-builder

BASE: babb9b9db518f545c0fb107a0e786f3146f26cc3 · RAMO: roadmap/corr-1.3 · MODELO: sonnet (sem gatilho Opus)
SKILLS: using-superpowers, qualidade-sabre (enxugar, seguranca)
TRIAGEM: M1/M2 — mudar 1 linha do package.json + lockfile e uma regra curta no verificador (~30 linhas com teste).

## Item
Ver item 1.3 em docs/roadmap-corr.md do ramo roadmap/onda-2026-11-01-37 (git show origin/roadmap/onda-2026-11-01-37:docs/roadmap-corr.md).
Resumo: electron-builder falha com "electron ^45.2.0 is a range". Fixar "electron": "45.2.0" (lockfile já em 45.2.0; atualizar a especificação no package-lock sem mudar a versão resolvida). Regra no verificador (ou teste) que barre ^/~ no campo electron de apps/desktop/package.json: falha antes, passa depois.
Reproduzir ANTES: npm run build -w apps/desktop (se preciso) e `cd apps/desktop && npx electron-builder --dir --linux --publish never` (pode falhar por outros motivos de ambiente, como download do binário via proxy; registre o que viu, e o erro exato do range deve aparecer). Mostrar passando DEPOIS.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/corr-1.3.md como primeiro commit
- [ ] Teste/regra que falha antes e passa depois
- [ ] npm run vistoria APROVADA e também como usuário comum (npm run vistoria:comum)
- [ ] Ficha S-19 em docs/memoria/solucoes.md (instalador só falha no GitHub: rode o empacotamento local antes de acusar o CI)
- [ ] PR com linhas Regressão:, Tela no app: não se aplica, Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem, segredos. NÃO disparar o workflow versao.yml.

## O que NÃO decidir
Nada.

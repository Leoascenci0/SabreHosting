# Briefing appmel-1.24 + appmel-1.25 — dois itens miúdos (um commit por item)

BASE: 395231ec8aea95539d9033edd904c6a4732c66be · RAMO: roadmap/appmel-1.24 (um só ramo e um só PR para os dois) · MODELO: sonnet (miúdo)
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › seguranca
TRIAGEM: M2 (editar o que existe) nos dois; ~15 linhas de teste + 1 comentário no 1.24; reorganizar jobs do YAML + 1 teste no 1.25. Risco baixo; não apagar validação.

## Item 1.24 (texto literal)
Teste do limite exato de 30 min na reemissão do convite. `convite.test.ts` só prova 29 e 31 min; trocar `>` por `>=` no
cartório não seria pego. Acrescentar o caso de 30 min exatos (aceita) e um comentário em `boas-vindas.ts` dizendo que o
app usa `>=` (mais estrito que o cartório, de propósito).
Arquivo: `services/cartorio/src/convite.test.ts`, `apps/desktop/src/main/boas-vindas.ts`. Tela no app: não se aplica.
Confirmação: teste novo falha se o operador mudar (mostre: troque o operador, veja falhar, volte).

## Item 1.25 (texto literal)
`versao.yml`: `contents: write` só no passo da release. Hoje o `contents: write` vale para o job inteiro, também no
disparo manual de ensaio, e o `checkout` grava esse token no `.git`. Usar `persist-credentials: false` no checkout e dar
a permissão só ao passo que cria a release (job separado), com teste que fixe isso.
Arquivo: `.github/workflows/versao.yml`, `tests/infra/versao.test.ts`. Tela no app: não se aplica.
Confirmação: teste: o job do ensaio não tem `contents: write`.
Dica de desenho: job `instalador` (permissions contents: read, checkout com persist-credentials: false, sobe o .exe e
SHA256SUMS como artefato em ambos os gatilhos) + job `release` (needs: instalador, só em push de tag, contents: write,
baixa o artefato e roda `gh release create`). Manter SHAs fixados das actions, checksums e a conferência de tag. NÃO
rode o workflow no GitHub (é P do Eliel).

## Decisões que valem
D9 (instalador sem assinatura). Demais: nenhuma.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.24.md como primeiro commit
- [ ] Um commit por item; testes que falham antes e passam depois
- [ ] `npm run vistoria` APROVADA e, como mexe em `.github/` e `tests/infra/`, também `npm run vistoria:comum` (S-03)
- [ ] PR com as linhas Regressão: e Tela no app: (S-10) + Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real.

## O que NÃO decidir
Nada.

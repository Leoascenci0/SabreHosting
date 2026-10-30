# Briefing base-1.3 — Gerador de mundos de teste

BASE: 2c2444fc39e4fa1fa41ad6192cb6ee40d0323edd · RAMO: roadmap/base-1.3 · MODELO: sonnet · ISSUE: #5
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/integridade.md (regra de ouro 6: mundo inventado)
TRIAGEM: M7 (não há gerador nem helper; só `node:fs` e `node:crypto`, sem dependência nova) · ~130 linhas (gerador
~70, helpers+teste ~40, README ~15) · risco médio · MIÚDO: não. REAPROVEITAR: molde de `packages/nucleo/src/exemplo.ts`,
`vitest.config.ts`, regras de mundo já no `.gitignore`. NÃO ESCREVER: dependência de PRNG/zip; mundo real; mundo
grande commitado. PASSOS: 1) `packages/nucleo/test/ajuda/mundos.ts`: gera `level.dat` mínimo e `region/r.X.Z.mca` com
bytes determinísticos (SHA-256 encadeado a partir de uma semente), tamanhos 1 MB, 20 MB e 200 MB, sempre numa pasta
ignorada pelo git; 2) `mudarRegioes(mundo, n)` e `corromperArquivo(mundo)`; 3) teste: gera, muda 2 regiões, confere
que só essas mudaram de hash; `tests/mundos/README.md` explica. PROVA: teste falha sem o gerador e passa com ele;
`git status` depois de gerar não mostra arquivo novo; `npm run vistoria` APROVADA.

## Item (texto literal do roadmap)
- [ ] **1.3 — Gerador de mundos de teste**
  *O que fazer:* script que cria em `tests/mundos/` mundos pequenos e falsos (pasta com `level.dat` mínimo e alguns
  `region/r.X.Z.mca` com bytes aleatórios determinísticos), em 3 tamanhos (1 MB, 20 MB, 200 MB sob demanda, este não
  commitado). Funções de ajuda para os testes ("mudar 2 regiões", "corromper 1 arquivo").
  *Arquivo:* `packages/nucleo/test/ajuda/mundos.ts`, `tests/mundos/README.md`
  **Tela no app:** não se aplica.
  *Confirmação:* teste que gera, muda 2 regiões e confere que só elas mudaram de hash.
  *Depende de:* base-1.1

## Bloco 2 — Comunidade

## Decisões que valem para este item
- **Decidido pela Máxima (o teto nunca sobe):** `scripts/limites.json` barra arquivo > 1024 KB. Portanto **nenhum
  mundo vai para o git**: os 3 tamanhos são gerados na hora (pasta temporária do sistema ou `tests/mundos/gerados/`
  com linha no `.gitignore`). O de 200 MB só sob pedido explícito (variável de ambiente), nunca no `npm test`.
- Testes rápidos: o `npm test` padrão usa só o mundo de 1 MB (ou menor); diga no PR quanto tempo levou.
- Pode adicionar a linha de ignorar no `.gitignore` (único arquivo fora do *Arquivo:* permitido) e ajustar
  `vitest.config.ts`/`tsconfig` do nucleo se a pasta `test/` não estiver incluída.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/base-1.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/test/
- [ ] `npm run vistoria` APROVADA; `git status` limpo depois do `npm test`
- [ ] PR com as seções do modelo, `Closes #5` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.

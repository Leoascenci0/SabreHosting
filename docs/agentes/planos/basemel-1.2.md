# Plano basemel-1.2 — Vistoria em push na main também confere arquivos

ISSUE: #110 · RAMO: roadmap/basemel-1.2 · BASE: 4f2a02b

## Problema
No `.github/workflows/vistoria.yml`, o job roda `npm run vistoria`, que chama `verificar.py --base origin/main`.
Em push na `main`, o ramo "base" é a própria `main`: a diferença fica vazia e nenhum arquivo é conferido
(só lint e testes valem).

## Mudança (só o YAML)
1. Evento `push`: rodar `npm run lint`, `npm test`, `npm run test:e2e -w apps/desktop` e
   `python3 scripts/verificar.py --base "$BASE"`, com `BASE` vindo de `env:` a partir de
   `github.event.before` (nunca interpolado direto no `run:`).
2. Se `BASE` for o SHA zerado (ramo novo no push), usar `HEAD~1`.
3. Evento `pull_request`: segue com `npm run vistoria` (sem mudança de comportamento).
4. Passos comuns (checkout, setup-node, `npm ci`, xvfb) continuam para os dois eventos; actions seguem fixadas por hash.
5. Atualizar o comentário do `fetch-depth` (agora também serve à comparação com `github.event.before`).

## Fora do plano
- Sem flag nova, sem etapa nova no verificador, sem mexer no `package.json` (`vistoria` continua com `--base origin/main`).

## Prova
- Local, em ramo descartável não enviado: commit com `.env` falso (ou `.mca` falso) →
  `python3 scripts/verificar.py --base <sha anterior>` REPROVADO; com base = HEAD passa (é o bug).
- O YAML carrega (parse com PyYAML).
- `npm run vistoria` APROVADA na sessão.

## O que não será confirmado nesta sessão
- Check remoto na `main`: decidido pela Máxima; a confirmação se dá no próximo merge real na `main`.

# Plano hostmel-3.4 — gravar o `server.properties` só depois da trava (e recusar órfão)

Triagem: M1 (+M4 na prova) · risco alto (trava de host).

## O que já existe (grep)
- `hospedar()` (packages/nucleo/src/cartorio/hospedar.ts): `renovador.pegar()` → `try { iniciarServidor }` que solta a
  trava se falhar.
- `depsReais().hospedar` (apps/desktop/src/main/deps-reais.ts) chama `gravarConfiguracao` ANTES do `hospedar` do
  núcleo: com a trava ocupada, o arquivo local já foi reescrito.
- `criarInicio().hospedar()` (apps/desktop/src/main/inicio.ts) não consulta `temOrfao()` (já existe; erro = vivo).

## Passos (TDD)
1. Testes que falham hoje:
   - deps-reais: trava ocupada → `server.properties` pré-existente fica byte a byte igual.
   - núcleo: `antesDeSubir` roda depois do `pegar` e antes do spawn; se lançar, solta a trava, relança e não sobe.
   - inicio: órfão vivo (ou erro ao conferir) → `hospedar()` recusa sem chamar `deps.hospedar`.
2. Núcleo: `antesDeSubir?: () => Promise<void>` em `OpcoesHospedar`, chamado dentro do `try` que já solta a trava.
3. deps-reais: `gravarConfiguracao` vira o `antesDeSubir` (checagem de rede privada continua antes de tudo).
4. inicio: `if (await temOrfao()) return { ok: false, mensagem }` antes de `ocupado = true`/`deps.hospedar`.
5. `tests/integracao/hospedar-cartorio.test.ts` segue passando; `npm run vistoria`.

## Fora do alcance
Nova checagem de órfão, novo caminho de trava, mudança na checagem de rede privada.

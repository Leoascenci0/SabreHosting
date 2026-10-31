# Plano lancmel-1.1 (partes a e b) — Detecção e instância mais firmes

Issue #113 · ramo `roadmap/lancmel-1.1` · base `2eb719f` · triagem M4 (miúdo, risco baixo)

## Escopo
Só `packages/nucleo/src/launcher/instancia.ts` e `instancia.test.ts`.

## Passos
1. **Corte do nome por ponto de código** (`nomeSeguroDoGrupo`): trocar `slice(0, MAX_NOME)` (que corta em unidade
   UTF-16 e pode deixar par substituto solto) por corte por ponto de código (`Array.from(nome).slice(...)`).
   - Teste novo: grupo de 63 letras + emoji → nome termina no emoji inteiro, sem surrogate solto.
   - Falha antes (nome termina em `\uD83D`), passa depois.
2. **Leitura do índice existente** (`gravarInstancia`): `readFile(...).catch(() => null)` passa a tratar só
   `ENOENT` ("não existe"); os demais erros são repassados e nada é gravado.
   - Leitor injetável opcional (`lerArquivo`, padrão `readFile`), no molde de `SistemaArquivos` do `prism.ts`.
   - Teste novo: leitor que falha com `EACCES` → `gravarInstancia` rejeita, pasta/arquivo não são criados.
   - Teste novo: leitor que falha com `ENOENT` → grava normalmente.
   - Falha antes (não rejeita), passa depois.

## Fora deste PR (registrado no PR)
- Marcador próprio da instância: fica para lanc-1.3 (decisão da Máxima).
- Comparação major.minor.patch: só se o mínimo virar 8.x; hoje `VERSAO_MINIMA_PRISM = 8`.
- `execReal` / `ExecArquivo` em `prism.ts`: intocados.

## Prova
`npm run vistoria` APROVADA; testes novos vermelhos antes do código, verdes depois.

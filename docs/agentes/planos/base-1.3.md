# Plano base-1.3 — Gerador de mundos de teste

Issue #5 · ramo `roadmap/base-1.3` · método M7 (nada a reaproveitar; só `node:fs` e `node:crypto`).

## Desenho
- `packages/nucleo/test/ajuda/mundos.ts` exporta:
  - `gerarMundo({ tamanho, semente?, pasta? })`: cria `level.dat` mínimo + `region/r.X.Z.mca` de 256 KiB cada.
    Bytes determinísticos: SHA-256 encadeado a partir de `semente + nome do arquivo`.
    Tamanhos `"1MB"`, `"20MB"`, `"200MB"`. O de 200 MB só roda com `SABRE_MUNDO_GRANDE=1` (nunca no `npm test`).
  - `hashesDoMundo(pasta)`: hash SHA-256 de cada arquivo (para comparar antes/depois).
  - `mudarRegioes(mundo, n)`: reescreve `n` regiões com outros bytes (mesmo tamanho).
  - `corromperArquivo(mundo, arquivo?)`: troca um trecho de bytes de 1 arquivo (mesmo tamanho).
- Pasta padrão: `mkdtemp` na pasta temporária do sistema (fora do git). Pasta alternativa
  `tests/mundos/gerados/` entra no `.gitignore` (a regra `!tests/mundos/**` liberaria `.mca` ali).
- Nenhum mundo vai para o git (teto de 1024 KB por arquivo em `scripts/limites.json` não sobe).
- `vitest.config.ts` e `packages/nucleo/tsconfig.json` passam a incluir `test/`.

## Testes (primeiro, vermelhos)
1. gera 1 MB: `level.dat` + regiões, tamanho total ≈ 1 MB.
2. mesma semente = mesmos hashes; semente diferente = hashes diferentes.
3. `mudarRegioes(2)`: só 2 regiões mudam de hash, o resto (incl. `level.dat`) igual.
4. `corromperArquivo`: só 1 arquivo muda, tamanho igual.
5. 200 MB sem a variável de ambiente é recusado; 20 MB gera o tamanho certo.

## Entrega
`tests/mundos/README.md`, `npm run vistoria`, `git status` limpo depois do `npm test`, PR com `Closes #5`.

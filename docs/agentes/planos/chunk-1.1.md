# Plano chunk-1.1 — ler o que existe no mundo (só leitura)

Método: M7 (+M1). Risco médio, só leitura. Tela no app: não se aplica.

## O que entra
- `packages/nucleo/src/mundo/regioes.ts`: `listarRegioes(pastaDoMundo, dimensao, { aviso })`.
  - Dimensões: `overworld` (raiz), `nether` (`DIM-1/`), `end` (`DIM1/`); em cada uma, pastas `region`, `entities`, `poi`.
  - Só entram arquivos regulares `r.<x>.<z>.mca` (inteiros canônicos); link simbólico (arquivo ou pasta) e nome torto são ignorados com aviso.
  - Por região: tipo, caminho relativo, x, z, tamanho em disco e a lista de chunks que existem, lida só da tabela de posições (primeiros 4096 bytes). Entrada que aponta além do fim do arquivo não conta e gera aviso.
  - Arquivo menor que o cabeçalho: ignorado com aviso (não quebra).
- `packages/nucleo/src/mundo/index.ts`: reexporta.
- Testes ao lado (`regioes.test.ts`) com mundo inventado + helper de teste com cabeçalho `.mca` real.

## Provas
região parcial/cheia, `r.torto.mca` ignorado, link simbólico ignorado, arquivo gigante esparso lido sem ler além do cabeçalho, hash do mundo igual antes e depois, nether/end/entities/poi.

## Não entra
Escrita de qualquer tipo; layout novo de dimensões (`dimensions/minecraft/...`) das versões mais novas: fica registrado como melhoria no PR.

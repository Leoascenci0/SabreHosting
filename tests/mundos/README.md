# Mundos de teste

Nenhum mundo é guardado no git (regra de ouro 6): eles são **gerados na hora** por
`packages/nucleo/test/ajuda/mundos.ts`, com bytes falsos e sempre iguais para a mesma semente.

| Tamanho | Quando |
|---|---|
| `1MB` | padrão do `npm test` (4 regiões de 256 KB + `level.dat`) |
| `20MB` | testes de transferência/backup (gera em menos de 1 s) |
| `200MB` | só sob pedido: `SABRE_MUNDO_GRANDE=1 npm test` |

Por padrão a pasta é temporária do sistema. Para guardar o mundo aqui, use `pasta: "tests/mundos/gerados/<nome>"`
(a pasta `gerados/` é ignorada pelo git).

Ajudas: `gerarMundo`, `hashesDoMundo`, `mudarRegioes(mundo, n)`, `corromperArquivo(mundo, arquivo?)`.
Os testes apagam o que geram. Nunca ponha aqui o mundo real dos amigos.

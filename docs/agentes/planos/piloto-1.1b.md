# Plano piloto-1.1b — ler level.dat do mundo importado (versão e plugins)

Método M7 (+M1). Sem dependência nova, sem tela (1.1c), sem mudar `enviar`/`extrair`/`conferirLista`.

1. `packages/nucleo/src/nbt.ts`: leitor NBT mínimo. `gunzipSync` com `maxOutputLength`; tags 1–12; limites de
   profundidade (32) e de bytes; comprimento de string/lista/array conferido contra o que SOBRA no buffer.
   `lerVersaoDoLevelDat(gz)` devolve `{ nome, id }` ou `null` (nunca lança: entrada hostil vira "desconhecida").
2. `importar.ts`: acha `level.dat` na raiz ou dentro de uma única pasta de topo (prefixo), lê-o do zip com teto de
   bytes ANTES de extrair; detecta `plugins/` e `mods/*.jar` pela lista; se há prefixo único, a extração o descarta
   (o mundo fica na raiz do pacote). `ImportacaoPronta` ganha `versaoMinecraft` ('desconhecida' só avisa) e `indicios`.
3. Testes (TDD, falham antes): fixture NBT válida; 3 hostis (bomba gzip, comprimento maior que o arquivo,
   profundidade excessiva); plugins/mods; pasta-raiz única.
4. `npm run vistoria`; PR.

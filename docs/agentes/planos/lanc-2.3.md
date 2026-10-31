# Plano lanc-2.3 — Baixar e montar a versão do jogo

Método: M1 (reaproveita `baixarConferido`, `buscarPadrao`, `resolverAdoptium`/`urlAdoptium`) + ~200 linhas novas em
`packages/nucleo/src/launcher/montar.ts`. Risco médio (download; sem mundo). Tela no app: não se aplica.

Formatos usados são só os documentados da Mojang (manifesto de versões v2, JSON da versão, índice de assets). Nada de
código de launcher GPL.

1. Testes primeiro (`montar.test.ts`): servidor HTTP local + `buscar` falso (manifesto falso). Casos: monta cliente,
   bibliotecas e assets; hash errado de qualquer peça aborta e não deixa a versão marcada como montada; JSON da versão
   com sha1 diferente do manifesto é recusado; caminho de biblioteca com `..` recusado; host fora da lista oficial
   recusado; segunda montagem usa o cache (zero requisições de arquivo); regras de sistema (só Windows); Java baixado
   com hash conferido via `baixar` injetado.
2. `montarVersao({ versao, cache, buscar?, baixar?, java?, aoProgredir? })`:
   - manifesto v2 → entrada da versão (id válido, host oficial, `sha1`) → JSON da versão conferido pelo sha1;
   - cliente, bibliotecas (regras: Windows) e assets (índice conferido; objetos por hash, 8 em paralelo);
   - cache compartilhado em `<cache>/{versions,libraries,assets,java}`; cada arquivo entra por troca atômica (baixa em
     `.parcial`, confere hash, renomeia);
   - marcador `.montada.json` gravado por último (temporário + renomear): versão só conta como montada com tudo conferido.
3. Opção só de teste `permitirHttpLocal` (libera 127.0.0.1 nos downloads); o app nunca liga.
4. Java: baixa o pacote da Adoptium com hash (sha256) no cache; extrair e apontar o `javaw` fica para o item que usa
   (lanc-3.x / PC).
5. Fora: login Microsoft, argumentos de lançamento, natives por classificador antigo, versão real no PC (P).
6. Prova: `npm run vistoria` APROVADA.

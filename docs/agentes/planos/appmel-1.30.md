# Plano appmel-1.30 — o app empacotado abre

Método M2 (ajustar o que existe).

1. `electron-builder.json`: `files` ganha `recursos/icone/*.png` (o main lê bandeja-16/24/32/48 e icone-256 em runtime).
2. Novo `src/main/tolerante.ts` (sem Electron, testável): `tentar(nome, fn, registrar)` devolve o resultado ou `undefined`, registrando o erro. `principal.ts` usa para bandeja e para o ícone da janela; a janela nasce sempre.
3. Testes: (a) `empacotamento.test.ts` prova que todo arquivo lido em runtime fora de `dist/` está coberto por `files`; (b) `tolerante.test.ts` prova que bandeja que falha não impede a janela.
4. Sem e2e de empacotamento na vistoria (lento); passo `--dir` no CI decidido depois de ver o `versao.yml`.

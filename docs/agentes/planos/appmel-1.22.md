# Plano appmel-1.22 — Vigia fora do app.asar

Problema: empacotado, `new URL("./vigia.js", import.meta.url)` cai dentro do `app.asar`; o Node do Electron
(`ELECTRON_RUN_AS_NODE`) não roda o vigia lá de dentro de forma confiável.

1. Teste primeiro: `caminhoDoVigia` troca o segmento exato `app.asar` por `app.asar.unpacked`; não mexe em
   `app.asar.unpacked` já pronto, em `meu-app.asar` nem em caminho sem asar. Teste do JSON: `asarUnpack` lista
   `vigia.js` e `comandos.js` (único import em tempo de execução do vigia; `processo.js` é só tipo).
2. Função pura em `processo.ts` + uso no spawn. Comportamento do vigia e fluxo de parada intactos.
3. `electron-builder.json`: `asarUnpack` só dos dois arquivos.
4. Fora: empacotar de verdade (item [P], PC Windows).

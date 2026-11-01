# Plano lancmel-2.6 — Extrair o Java baixado e apontar o `javaw`

Método: M1+M3 (reusa `yauzl`, `caminhoSeguro` e `montarZip` de teste). ~90 linhas + ~120 de teste. Risco médio (zip não confiável). Sem mundo, sem rede real.

1. Teste primeiro (`packages/nucleo/src/launcher/zip.test.ts`, mundo e zip inventados com `montarZip`): extrai e acha `bin/javaw.exe`; recusa `../fora`, caminho absoluto, `\`, link simbólico; zip sem `javaw` e zip truncado/falha no meio não deixam pasta pela metade.
2. `packages/nucleo/src/launcher/zip.ts`: `extrairJava(zip, pastaFinal)` extrai numa pasta temporária de nome único ao lado, confere `bin/javaw.exe`, grava `.java.json` (caminho do `javaw`) e só então renomeia (regra 3). Falhou: apaga o temporário.
3. `montar.ts`: com `java: true`, depois do download chama `extrairJava` (pula se a pasta já está pronta) e devolve `javaw` em `VersaoMontada`; o caminho relativo ao cache entra no `.montada.json`, que continua o último a ser gravado.
4. Prova: `npm run vistoria` APROVADA.

Fora: usar o `javaw` para abrir o jogo (2.7), Java real no PC (confirmação junto do lanc-2.3).

# Plano bkpmel-1.2 — Colisões de nome além de maiúscula

Issue #88 · arquivo: `packages/nucleo/src/backup/manifesto.ts` (`validarManifesto`) · método M1.

1. Teste primeiro (falha antes): `é` em NFC e NFD no mesmo manifesto recusado; `a` + `a/b` recusado nas duas ordens
   (inclusive com maiúscula/NFD no meio); `ab` + `a-b` e `a` + `a2/b` continuam aceitos.
2. `validarManifesto`: a chave de comparação passa a ser `normalize("NFC").toLowerCase()`.
3. Mesmo laço guarda os prefixos de pasta de cada arquivo (mesma chave); recusa se um arquivo cai num prefixo de
   pasta já visto ou se um prefixo do arquivo já é um arquivo visto — vale nas duas ordens.
4. Mensagem pt-BR dizendo qual é a pasta/arquivo. Sem validação nova de caminho; `gerarManifesto` não muda.
5. `npm run vistoria`, PR com `Closes #88`.

# Plano hostmel-1.1 — Hashes fixados por versão

Método: M1 (+M2 para a tabela). Risco alto (download + hash). Só `resolvedores.ts` e seu teste.

1. Teste primeiro (falha antes): sidecar adulterado recusado pela tabela; versão sem entrada recusada; `../` e `-x`
   seguem recusados; sidecar igual à tabela passa.
2. `HASHES_NEOFORGE` (versão → sha1 do instalador, conferido pelo grupo) exportada em `resolvedores.ts`, **vazia** de
   valores reais: os reais entram quando o Eliel escolher a versão e o hash for tirado num PC com acesso.
3. `resolverNeoForge(versao, sidecar, tabela = HASHES_NEOFORGE)`: versão fora da tabela → recusa ("esta versão ainda não
   tem o hash conferido pelo grupo"); sidecar diferente da tabela → recusa; o hash devolvido é o da tabela.
   Nunca cai para confiar só no sidecar.
4. Prova: `resolvedores.test.ts` verde; `npm run vistoria` APROVADA.

Fora: baixar.ts (sem mudança), Java/Adoptium e Mojang (descritos como melhoria no PR), comandos.ts, processo.ts, apps/desktop.

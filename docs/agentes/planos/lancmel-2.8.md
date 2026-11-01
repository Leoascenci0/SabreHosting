# Plano lancmel-2.8 — `javaw` reaproveitado precisa bater com o que foi extraído

Triagem: M4 (alterar `extrairJava`), ~25 linhas + ~40 de teste, risco médio (executável rodado pelo app).

1. Testes primeiro (`packages/nucleo/src/launcher/zip.test.ts`), falhando antes: `javaw` com 1 byte trocado, `javaw`
   truncado, `javaw` sumido e marcador antigo (sem hash) extraem de novo e o arquivo volta ao original; intacto não extrai.
2. `zip.ts`: ao extrair, gravar no `.java.json` o tamanho e o sha256 do `javaw`. No reaproveitamento, reler o `javaw`
   (~100 KB) e comparar; qualquer divergência ou marcador sem hash cai na extração normal (pasta temporária, troca atômica).
3. `montar.ts`: remover o `stat` redundante (o caso "javaw sumiu" passa a ser coberto pelo teste novo).
4. Não escrever: hash do Java inteiro, dependência nova, mudança de formato do zip.
5. `npm run vistoria` APROVADA; PR com `Regressão:`.

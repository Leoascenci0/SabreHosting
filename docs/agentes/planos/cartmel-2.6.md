# Plano cartmel-2.6 — PUT do pacote com corpo maior que 1 MB

Método M1 (só teste). `servidor.ts` não muda, a menos que o PUT de ~3 MB falhe.

1. Teste novo em `services/cartorio/src/armazem.test.ts` (describe "rotas do pacote"), reaproveitando `montarApp`, `pacote` e `url`:
   - PUT de ~3 MB (teto padrão do armazém) → 201 com o hash conferido (`sha256` devolvido igual ao declarado).
   - JSON de ~2 MB em outra rota (`POST /convites/usar`) → 413 (o limite do JSON continua valendo lá).
2. Prova de que o teste pega a regressão: temporariamente subir o `bodyLimit`/trocar o parser e ver o teste vermelho; desfazer.
3. `npm run vistoria` APROVADA, PR com `Refs` ao item.

Observação: o `bodyLimit` real é 4096 bytes (não 1 MB); o teste prova que ~3 MB passa mesmo assim.

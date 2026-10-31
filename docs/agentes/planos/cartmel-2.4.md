# Plano cartmel-2.4 — Descoberta de fontes do espalhar no cartório

Método: M3 (+M1), ~90 linhas + testes. Risco alto (cartório, rede privada, IP de PC).

1. `versoes.ts`: `quemTem` devolve `{id, nome, ip}` (ip de `convites.ip_def`, só convite confirmado; `null` se não houver) e uma função `nuvemTem(banco, n)` (EXISTS em `copias_nuvem`).
2. `servidor.ts`: `GET /versoes/:n/copias` vira `{numero, nuvem, pcs}`; só PC autenticado (já é `soPc`).
3. `tipos.ts`: validadores de `Versao`, `MaisNova`, `Copias` (campo a mais é ignorado).
4. `cliente.ts`: `maisNova()` e `quemTem(n)`, ambos GET com repetição.
5. `transferencia.ts`: faixa fechada para 10.66.0.2–10.66.0.199; exporta `PORTA_ESPALHAR` (constante do app, não entra no cadastro).
6. Testes primeiro: cartório (`versoes.test.ts`), cliente (`cliente.test.ts`), faixa (`transferencia.test.ts`).

Fora: usar a nuvem como fonte (sync-2.1b), `criarVersao` (piloto-1.1c), porta nova, tela.

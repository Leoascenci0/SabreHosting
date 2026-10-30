# Plano basemel-1.3 — Testes estáveis sob carga

Issue #39 · ramo `roadmap/basemel-1.3` · método M4 (correção pontual de teste). Código de produção não muda.

## Medições antes de mexer (4 `npx vitest run` em paralelo, máquina de 4 núcleos)
- Falha 1: `mundos.test.ts` "gera 20 MB" estoura os 5 s padrão do vitest (repetiu em 3 de 4 rodadas).
- Falha 2: `manifesto.test.ts` "mundo de 20 MB: memória viva…" mediu 9,4 MB contra o teto de 8 MB (1 vez).
- A corrida da trava (`trava.test.ts:81`, "Set{16,20}") não repetiu em 40 execuções simultâneas só desse arquivo;
  a investigação da causa continua abaixo.

## Desenho
1. `mundos.test.ts`: prazo explícito de 30 s no teste de 20 MB.
2. `manifesto.test.ts`: o teste de memória já tem 30 s; estabilizar a medida (o `gc()` libera o buffer, mas o
   sistema devolve a memória externa um instante depois; sob carga a amostra pega esse resto). Teto de 8 MB fica.
3. `trava.test.ts`: manter "exatamente 1 ganha" e `epoca do vencedor = rodada`; o perdedor precisa ver época
   ≥ a do vencedor da MESMA rodada (nunca menor). Sem reduzir workers (10) nem rodadas (20).

## Prova
4 `npx vitest run` em paralelo, 3 vezes, sem falha; sabotar `pegar` (deixar 2 ganharem) ainda quebra o teste;
`npm run vistoria` APROVADA.

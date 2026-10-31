# Plano basemel-1.5 — Teste da trava contra o cartório real estável sob carga

Issue #73 · método M1 · só `tests/integracao/hospedar-cartorio.test.ts`.

## Causa (medida)
Com 8 laços de CPU ao lado e 4 `npx vitest run` do arquivo em paralelo, 12 de 12 execuções falharam no 1º teste:
9× `Test timed out in 5000ms` (subida do servidor falso + espera de 900 ms passam do prazo padrão) e 3× `expected false
to be true` em `temTrava()`. O renovador está certo: o prazo local é 3×renovação − 1,25×renovação = 175 ms com
renovação de 100 ms, folga de 75 ms; máquina ocupada atrasa a renovação e a trava cai.

## Passos
1. Tempos folgados só neste teste (cartório 1500/500 ms → prazo local 875 ms, folga 375 ms), espera de 2 × prazo.
2. Prazo explícito de 30 s no teste (como S-01). Os outros testes seguem com tempos curtos.
3. Prova: 4 `npx vitest run` em paralelo × 3, com e sem carga de CPU; depois `npm run vistoria`.

Não muda código de produção, não usa `retry`, não mexe no timeout global.

# Plano basemel-1.6 — Quarto teste da trava com folga medida

Item: `tests/integracao/hospedar-cartorio.test.ts`, 4º teste ("backup pendurado na fila não atrasa a parada").
Issue: #121. Molde: basemel-1.5 (PR #76). Método M1 (só o teste).

1. Reproduzir: 4 `npx vitest run tests/integracao/hospedar-cartorio.test.ts` em paralelo + laço de CPU (1 por núcleo).
2. Causa a confirmar: o teste mede `Date.now() - perdeuEm < 300 + 300 + 700` (folga fixa de 700 ms) e roda sob carga
   com prazos de 300 ms; a folga estoura quando a máquina está ocupada (tempo curto demais no teste, como S-01).
3. Conserto só no teste: a folga sai de uma constante nomeada e medida (maior), mantendo a prova
   "parada pelos prazos da perda, e não pelos 60 s do backup nem pelos 30 s da parada normal"
   (o teto continua muito abaixo de 30 s/60 s). Sem mexer em packages/nucleo, services/cartorio, retry ou timeout global.
4. Provar: mesma carga, 3 rodadas, zero falha; `npm run vistoria` APROVADA.

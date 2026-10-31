# Plano hostmel-1.2 — resolvedores mais rígidos e http local só por opção

Issue #104 · Método M1+M4 · Risco alto (download).

1. `baixar.ts`: opção `permitirHttpLocal?: boolean` (padrão falso); `validar()` só libera http em localhost/127.0.0.1 com ela.
2. `resolvedores.ts`: `alvo()` recusa URL que não seja `https://` (`new URL` em try).
3. NeoForge: regex da versão passa a exigir começar por dígito (`^\d[\w.+-]*$`).
4. Testes primeiro (TDD): `baixar.test.ts` usa helper com `permitirHttpLocal: true` + teste novo de localhost sem a opção recusado;
   `resolvedores.test.ts`: http recusado, "1.x" ok, "x.1", "-x" e ".." recusadas.
5. `npm run vistoria`, PR com `Closes #104`.

Não se escreve validação nova de hash/versão; só se aperta a regra existente.

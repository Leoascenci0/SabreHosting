# Plano appuimel-2.1 — Direção v2 documentada e tokens novos

Método: M3 (molde de `tokens.css` e `tokens.test.ts`) + documento, ~70 linhas. Risco baixo. Nenhuma tela muda; sem mundo, rede ou backup.

1. Teste primeiro (`tokens.test.ts`, reaproveitando `bloco()`, `luminancia()`, `contraste()`): existem nos dois temas a camada de peça
   (`--cor-camada-2`), as bordas por estado e a escala de número grande; AA (>= 4,5 texto, >= 3 borda/ícone) dos pares novos nos dois temas.
   Rodar e ver falhar.
2. `tokens.css`, só o que falta: `--cor-camada-2` (claro/escuro), `--borda-estado-*` (2 px + cor de estado já testada, sem hex novo),
   `--numero-1..3` (tamanho de número grande), `--numeros-tabulares` e a classe `.numero` (numerais tabulares como regra).
3. `docs/design-system.md`: seção "Direção v2" (abas no topo, chip de estado, cartão principal, peças de estado, grade de números,
   seção recolhível, rodapé; o que é "original" e o que não se faz). Marcada como direção reversível.
4. Prova: teste verde, `npm run vistoria` APROVADA, `impeccable` document/audit/polish e detector uma vez no fim.

Fora: `index.html`, `tela.css`, qualquer tela (itens 2.2 em diante).

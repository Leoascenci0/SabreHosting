# Plano appmel-1.27 — Tela inicial com os 4 botões visíveis

Triagem: M5 (+M1 no Importar), ~90 linhas, risco médio.

1. E2E novo `e2e/tela-inicial.e2e.ts` (falha antes): na janela padrão, `scrollHeight <= innerHeight` e
   #principal, #importar-abrir, #ver-backups e #ver-config visíveis, dentro da viewport, altura ≥ 44 px.
2. `index.html`: grade 2×2 (`.grade`) no cartão inicial com os 4 botões (ids mantidos); os nós do Importar
   (#importar-abrir/-status/-erro/-painel) saem de #tela-backups para o cartão inicial. `.acoes` fica só com Parar/Tentar.
3. `tela.css`: `.grade`, ícone ~112 px, espaçamento vertical menor; tema escuro já vem dos tokens.
4. `importar.ts`: `tela` passa a ser `#cartao`; um único botão, mesmo fluxo e confirmação. Ao abrir Backups/limpar: igual.
5. Ajustar importar.e2e (não clica mais #ver-backups) e inicio.e2e (`visiveis`). Se não couber: altura 640 em principal.ts.
6. Vistoria + vistoria:comum, PR.

Segurança: sem superfície nova (só move nós). Integridade: não toca o mundo (mesmo fluxo de importar).

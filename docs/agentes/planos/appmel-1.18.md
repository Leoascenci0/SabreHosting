# Plano appmel-1.18 — teste do encaixe de Jogar/Hospedar

Triagem: M1 (+M4 no teste). Refatoração sem mudar comportamento nem mensagem.

## O que já existe
- `principal.ts` (bloco "sabre:inicio:jogar/hospedar"): checa `pastaBase.trocada()` antes de chamar `inicio.*`; sem teste.
- `pasta-base.ts` `trocada()` (coberto por `pasta-base.test.ts`).

## Passos
1. `main/encaixe-inicio.ts`: `criarEncaixeInicio({trocada, jogar, hospedar, mensagem})` devolve `{jogar, hospedar}` (recusa depois de `trocada()`).
2. `principal.ts` usa a função; `permitir` continua no `ipcMain.handle`.
3. `encaixe-inicio.test.ts`: depois de `trocada()` Jogar lança e Hospedar devolve `ok:false`, sem chamar `inicio.*`; antes, repassa.

## Fora do alcance
Nova lógica de `trocada()`, nova checagem de trava, pastaMundo/level-name (appmel-1.19).

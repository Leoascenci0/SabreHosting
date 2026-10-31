# Plano hostmel-2.2 — Workers da medição: corte e falha

Item: 2.2 do roadmap host (Origem: host-2.3 · PR #16). Issue #136. Triagem: M4 (+M1), ~35 linhas.

## Problema
1. O corte por tempo (`tetoMs`) já é testado só na fase de um núcleo. Falta o teste do corte na fase de vários
   núcleos (`Promise.all` de `rodarLaco`).
2. Bug: se um worker da fase de vários núcleos falha, o `Promise.all` rejeita, mas o `AbortController` não é
   abortado. Os outros workers continuam vivos até o fim da janela (ou do teto).

## Passos
1. Teste novo: fase de vários núcleos com `tetoMs` de 300 ms e `janelaMs` de 5000 ms rejeita com /passou de/ em
   menos de 2 s.
2. Teste novo com gancho `cpuNucleos` (só teste, no molde de `cpuUmNucleo`): um worker falha e os demais, presos
   no sinal, saem (`sinal.aborted` em todos). Antes da correção, o teste espera o teto de 10 s e falha.
3. Correção em `packages/nucleo/src/nota/medir.ts`: a fase de vários núcleos roda dentro de um `try/catch` que
   chama `controle.abort(erro)` e relança o erro.

## Fora do escopo
Mecanismo novo de teto ou cancelamento; `formula.ts`; cartório; tela; E2E.

## Prova
Testes novos falham antes da correção e passam depois. `npm run vistoria` com resultado APROVADA.

# Plano appuimel-2.7 — Acabamento da v2

Base 9805556 · ramo roadmap/appuimel-2.7 · Triagem: M4 + M1 (~150 linhas + testes) · risco médio (tela).

## Passos (TDD: teste que falha antes, passa depois)
1. **Tamanho do mundo** (`main/tamanho-mundo.ts`, `main/inicio.ts`): teto de entradas e de tempo no percurso (estourou → `undefined`, a tela mostra "—"); `comCache` guarda a promessa em andamento (chamadas simultâneas dividem uma leitura). Testes com mundo inventado.
2. **Borda de estado ≥3:1** (`ui/tokens.test.ts`): teste da cor de estado contra fundo, superfície e camada nos dois temas.
3. **Início em 720x480** (`ui/tela.css`): coluna lateral sob a grade e rodapé alto; medir pelo e2e e ajustar só CSS.
4. **e2e do intervalo de 15 s** (`e2e/`): relógio do Início anda com a tela aberta (sem afrouxar nada).
5. **Backups** "fazer agora" com backup em curso: só texto, se couber sem mudar comportamento; senão relatar.
6. **Auditoria** `impeccable` audit + polish em todas as telas, detector uma vez no fim; grep por termos da referência.
7. **Medidas** RAM do app parado e instalador contra `scripts/limites.json` (só relatar). Capturas claro/escuro de todas as telas em `docs/imagens/appuimel-2.7/`.

## Não escrever
Tela nova, componente novo, mudança de comportamento de backup/hospedar/restaurar/confirmação.

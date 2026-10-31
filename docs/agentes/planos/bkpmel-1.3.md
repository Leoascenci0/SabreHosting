# Plano bkpmel-1.3 — Mensagens e sobras do backup agendado

Método: M4+M1 (parâmetros novos em `criarPacote`, reaproveitando o `.parcial` e o `salvarSeguro`). Risco alto (backup).
Mundo só de teste (`gerarMundo`).

1. Testes primeiro (falham antes): `pacote.test.ts` — mensagem "O mundo mudou durante a leitura" chega ao amigo;
   `confirmar` falso não chama rename e não deixa `.parcial`; sinal abortado (antes e durante) não deixa pacote nem `.parcial`.
   `agendador.test.ts` — servidor que cai antes do rename: rename nunca é chamado com o nome final; o sinal do
   `salvarSeguro` chega ao `criarPacote`.
2. `pacote.ts`: o catch de `gerarManifesto` repassa a mensagem específica (`MUDOU`, exportada de `manifesto.ts`; só
   a palavra `export`); `opcoes.confirmar?: () => boolean` chamado logo antes do rename (falso → `PacoteDescartado`);
   `opcoes.sinal?: AbortSignal` para o worker e confere antes de cada etapa; o `.parcial` é removido pelo catch que já existe.
3. `agendador.ts`: passa o sinal e `confirmar: () => servidor.estado === "pronto"`; `PacoteDescartado` vira a mensagem
   "O servidor caiu durante o backup…"; sai o `rm` pós-rename.
4. `npm run vistoria`.

Fora: aviso "backup travado" na tela (vai para "Melhorias encontradas"), `comandos.ts`, `processo.ts`, `apps/desktop`.

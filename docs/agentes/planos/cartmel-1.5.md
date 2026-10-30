# Plano cartmel-1.5 — Trava: blindar a época e o destino da passagem

Issue #26 · ramo `roadmap/cartmel-1.5` · método M1 + M7 pequeno · risco alto (regra de ouro 1).

## Desenho
- `banco.ts`: **migração v3** no fim de `MIGRACOES` (a v2 já publicada não muda), com gatilhos `BEFORE INSERT` e
  `BEFORE DELETE` em `trava` que fazem `RAISE(ABORT)`. A linha única já nasce na v2; o `BEFORE INSERT` pega também
  `INSERT OR REPLACE`, que apagaria a linha e zeraria a época. `MIGRACOES` passa a ser exportada (o teste monta v1/v2).
- `trava.ts › passar`: no WHERE do mesmo UPDATE, `destino <> origem` e destino com token ativo
  (`EXISTS ... tokens ... revogado_em IS NULL`, que já implica PC existente). Motivos: `destino_desconhecido`
  (sem token ativo) e novo `destino_invalido` (para si mesmo); mensagem em `servidor.ts`.

## Testes (primeiro, vermelhos)
1. `INSERT OR REPLACE` e `DELETE` na trava falham e a época não muda.
2. `passar` para si e para PC sem token ativo (inclusive token revogado) → recusa, nada muda.
3. Migração v1→v3 com PCs e tokens cadastrados preserva tudo e deixa a trava protegida.
4. Ajustar o teste que espera `versao: 2` → 3. Os testes de `passar` dão token aos PCs de destino.

## Entrega
`npm run vistoria` APROVADA; corrida da trava continua verde; PR com `Closes #26`.

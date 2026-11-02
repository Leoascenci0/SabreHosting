# Plano chunk-1.3 — Núcleo: executar o reset com troca atômica

Risco ALTO (regras de ouro 1 a 5). Método: M7 (resetar.ts), M1 (backup/guardas de restaurar.ts), M5 (marcador).

## Desenho
1. `manifesto.ts`: valor novo `antes-de-resetar` em `OrigemBackup`/`ORIGENS` (desconhecido lido do disco segue `automatico`).
2. `mundo/troca-reset.ts` (sem importar restaurar.ts, para não haver ciclo): marcador `TROCA-EM-ANDAMENTO.json` com
   `{tipo:"reset", mundo, sufixo, fase, arquivos:[{rel, apagar}]}`. Os caminhos de `.antigo`/`.resetando` são DERIVADOS
   de `rel`+`sufixo` e o marcador é validado com regex rígida (S-07). `recuperarReset` desfaz parcial (fase `trocando`)
   ou só limpa (fase `concluido`); nunca apaga `.antigo` antes da fase `concluido`.
3. `mundo/resetar.ts` `resetarMundo`: recusas (operação em andamento, servidor rodando, sem trava, marcador antigo,
   nomes já existentes) → `planejarReset` (leitura nova) → backup `antes-de-resetar` por `criarPacote` + `abrirPacote`
   de conferência (falhou = nada tocado) → por `.mca` tocado: cabeçalho relido (8 KiB), entradas da área zeradas
   (posição e data, também lixo), cópia em stream para temporária irmã, hash do resto conferido e cabeçalho relido →
   trava de novo → marcador → renames (original→.antigo, temp→original; região vazia só sai) → marcador `concluido` →
   apaga `.antigo` e marcador. Erro em qualquer rename desfaz pela lista.
4. `restaurar.ts`: `recuperarTroca` chama `recuperarReset` quando o marcador é de reset; `exigirPodeTrocar` ganha textos.
5. Menor do 1.2: `plano.area` sem `-0`.

## Testes (falham antes) — resetar.test.ts, troca-reset.test.ts, manifesto, planejar-reset
Os 12 obrigatórios do briefing.

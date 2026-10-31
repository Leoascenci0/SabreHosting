# Plano bkp-2.2 — Restaurar com troca atômica

Issue #61 · ramo `roadmap/bkp-2.2` · M1 + M7 pequeno · risco ALTO (troca o mundo; regras de ouro 1, 3 e 4).

## Desenho
`packages/nucleo/src/backup/restaurar.ts` — `restaurarBackup({ pacote, sha256, pastaDoMundo, pastaBackups, temTrava,
servidorParado, versao, epoca, manterAntigo?, agora?, prazoTravaMs? })` → `{ backupDoAtual, restaurado, mundoAntigo? }`.
1. Recusa (nada muda) se `servidorParado()` for falso ou se `temTrava()` não confirmar `true` dentro do prazo
   (erro, demora e `false` valem como sem trava — mesma `travaConfirmada` de `servidor/processo.ts`, exportada).
2. Backup do estado atual com `criarPacote` em `<pastaBackups>/<data>-v<versao>.tar.gz` (mesmo nome do `fazerBackup`,
   `nomeDoBackup` exportado do agendador); recusa nome já existente. Falhou: para sem tocar no mundo.
3. `abrirPacote` (hash do pacote + cada arquivo conferido) numa pasta temporária IRMÃ do mundo (mesmo disco).
4. Reconfere servidor parado e trava logo antes da troca; sem isso, apaga a temporária e recusa.
5. Troca: `rename(mundo → mundo.antigo-<data>)` e `rename(temp → mundo)`; se o 2º falhar, desfaz o 1º.
   Só depois apaga o `.antigo` (se `manterAntigo` não for pedido). Nunca toca no backup do estado atual.

## Testes (primeiro, vermelhos) — mundos gerados, 1 MB
Troca feliz (hashes novos, backup do atual confere); falha no meio da extração (conteúdo ≠ manifesto, hash do pacote
certo) → mundo intacto, sem sobras; falha injetada entre os dois renames → mundo original de volta; sem trava /
trava que dá erro / servidor rodando → nada muda; hash do pacote errado → nada muda; trava perdida durante a extração
→ nada muda; falha no backup do atual → mundo intacto; `manterAntigo`.

## Fora do escopo
Tela (app-2.x), aviso ao cartório com versão nova, troca de host, outro extrator.

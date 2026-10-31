# Plano bkpmel-2.1 — Restauração: atalho no lugar do mundo e marcador garantido

Método M4 (duas correções pontuais em `packages/nucleo/src/backup/restaurar.ts`). Issue #83.

1. `haMundo`: `stat` → `lstat`. Link simbólico (inclusive quebrado) ou qualquer não-pasta é recusado com
   "não é uma pasta; nada foi alterado", antes de qualquer backup ou troca.
2. `desfazer`: se gravar `RESTAURACAO-INCOMPLETA.txt` falhar, o erro final (pt-BR, com caminhos) diz que o marcador
   não foi gravado e que o servidor pode subir; antes o erro era engolido.
3. Testes em `restaurar.test.ts` (TDD, vistos falhar antes): link quebrado, link para pasta, marcador bloqueado
   por uma pasta com o nome do arquivo. Prova: hashes do mundo iguais e sobras vazias.

Fora: `rotacao.ts`, `configurar.ts`, `processo.ts`, cartório, infra.

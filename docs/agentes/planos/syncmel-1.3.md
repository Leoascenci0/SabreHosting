# Plano syncmel-1.3 — Só pacote fechado sai pelo `arquivos(hash)`

Método: M1/M2 (teste + endurecimento mínimo do código existente). Risco médio (segurança + integridade; mundo inventado).

1. Testes primeiro (`vitrine.test.ts` e `transferencia.test.ts`):
   - `arquivos()` só devolve hash de pacote registrado; caminho sempre dentro da pasta da vitrine, nunca na pasta do mundo vivo.
   - Nenhum caminho devolvido é link simbólico (lstat) e nenhum fica fora da pasta da vitrine.
   - Link simbólico para fora trocado no lugar de um arquivo da vitrine → o servidor responde 404 (Confirmação do item).
2. Se o teste do link falhar, endurecer o servidor: `lstat` em vez de `stat` (não seguir link) e `vitrine.arquivos` recusar link.
3. Prova: `npm run vistoria` APROVADA.

Fora: ligar o servidor ao app (sync-2.1).

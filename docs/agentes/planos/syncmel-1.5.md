# Plano syncmel-1.5 — Acabamentos da recuperação da troca

Método M4 (+M1 nos testes). Risco alto (troca atômica). Ramo `roadmap/syncmel-1.5`, base 5f440cc.

| Letra | O que | Como | Prova (falha antes) |
|---|---|---|---|
| (a) | Falha ao apagar o marcador em `restaurarBackup` | só teste novo em `troca-marcador.test.ts` | mundo novo fica, sem aviso falso, `recuperarTroca` → "limpou" |
| (b) | `pastaDoServidor` em `aplicarDelta` | ADIADO para o sync-2.1 (sem chamador de produção); nota no PR | — |
| (c) | Texto de `recuperarTroca` sem caminho absoluto nem `TROCA-EM-ANDAMENTO.json` | trocar as 2 mensagens (nome só da pasta, "o arquivo de aviso da troca") | teste checa que a mensagem não contém caminho nem o nome do arquivo |
| (d) | Temp órfã se `gravarMarcadorTroca` falhar | `try/catch` com `apagar(temp)` antes de relançar, em `restaurar.ts` e `aplicar.ts` | teste com o marcador impedido (pasta no lugar do arquivo): sobra nenhuma temp, mundo intacto |
| (e) | `C:\` vs `c:\` em `mesmoLugar` | só teste com `path.win32` (o código de produção não muda) | teste da comparação |

Não fazer: ligar `aplicarDelta`, trocar a ordem dos `rename`, mudar "apagar marcador sem desfazer", lowercase manual, mexer em `podeSubir`.
Regras: S-07 (marcador é entrada não confiável; nada novo é lido do JSON) e integridade §1/§4.

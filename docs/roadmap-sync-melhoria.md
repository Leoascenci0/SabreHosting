# Roadmap de melhoria — Sync

Melhorias achadas durante os itens do `docs/roadmap-sync.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `syncmel`.** Ramos `roadmap/syncmel-<id>`. Todo item é RISCO alto, como no roadmap irmão.

## Bloco 1 — Servidor de transferência

- [x] **1.1 — Limite de tentativas erradas e cache curto de token no servidor de sync** (PR #166, 31/10/2026; revogação de token leva até 30 s no servidor de sync)
  *O que fazer:* limite de falhas de token por IP (ex.: 5 falhas, espera de 1 min, em memória) e cache curto (segundos)
  do token já conferido, para não consultar o cartório a cada pedido nem deixar token inválido virar amplificação.
  *Arquivo:* `packages/nucleo/src/sync/transferencia.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: 6ª tentativa errada → 429 sem chamar o cartório; token válido repetido chama o cartório 1 vez.
  *Origem:* sync-1.1 · PR #156 · qa segurança

- [ ] **1.2 — Timeout e limite de conexões do servidor de sync; parcial já completo não rebaixa**
  *O que fazer:* timeouts de cabeçalho/inatividade e teto de conexões simultâneas no servidor; cliente que já tem o
  arquivo inteiro como parcial só confere o hash em vez de baixar tudo de novo (416); o `expect` dentro do handler do
  servidor falso do teste de queda passa a fazer o teste falhar se quebrar.
  *Arquivo:* `packages/nucleo/src/sync/transferencia.ts`, `packages/nucleo/src/servidor/baixar.ts`, `packages/nucleo/src/sync/transferencia.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: conexão ociosa é derrubada; arquivo completo não gera segundo download.
  *Origem:* sync-1.1 · PR #156 · qa integridade

- [ ] **1.3 — Prova de que só pacote fechado sai pelo `arquivos(hash)`**
  *O que fazer:* quando o servidor for ligado ao app (sync-2.1), exigir teste de que só arquivos de pacotes registrados
  são servidos e de que `arquivos()` nunca devolve link simbólico nem caminho da pasta do mundo vivo.
  *Arquivo:* `packages/nucleo/src/sync/`
  **Tela no app:** não se aplica.
  *Confirmação:* teste com mundo inventado e link simbólico para fora → 404.
  *Origem:* sync-1.1 · PR #156 · qa segurança + qa integridade

- [x] **1.4 — Recuperar o mundo se o app cair entre os dois `rename` da troca** (PR #164, 31/10/2026)
  *O que fazer:* se o processo morrer (luz, kill) entre mundo→`.antigo` e temporária→mundo, só sobram `.antigo` e
  `.atualizando-*` e nada impede o servidor de subir com mundo ausente e criar um mundo novo. No início do app, detectar
  isso (marcador gravado antes da troca) e completar ou desfazer a troca. Vale também para `restaurar.ts` (mesma lacuna).
  *Arquivo:* `packages/nucleo/src/sync/aplicar.ts`, `packages/nucleo/src/backup/restaurar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: kill simulado entre os dois renames → na partida seguinte N volta (ou M completa) e o servidor não sobe com mundo ausente.
  *Origem:* sync-1.2 · PR #158 · qa integridade

- [ ] **1.5 — Acabamentos da recuperação da troca**
  *O que fazer:* (a) teste próprio de falha ao apagar o marcador no fluxo `restaurarBackup` (hoje só o `aplicarDelta` tem); (b) quando o sync for ligado ao app (sync-2.1), passar `pastaDoServidor` a `aplicarDelta` no chamador de produção; (c) mensagem de `podeSubir`/recuperação sem o nome do arquivo `TROCA-EM-ANDAMENTO.json` nem caminho absoluto na tela; (d) pasta temporária órfã quando gravar o marcador falha antes do 1º rename; (e) conferir no Windows `C:\` vs `c:\` na comparação do pai do marcador.
  *Arquivo:* `packages/nucleo/src/backup/restaurar.ts`, `packages/nucleo/src/sync/aplicar.ts`, `packages/nucleo/src/servidor/configurar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso (falham antes, passam depois).
  *Origem:* syncmel-1.4 · PR #164 · qa integridade + qa segurança

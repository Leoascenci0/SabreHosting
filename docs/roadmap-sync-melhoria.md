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

- [x] **1.2 — Timeout e limite de conexões do servidor de sync; parcial já completo não rebaixa** (PR #168, 31/10/2026; 10 s cabeçalho, 60 s ocioso, 16 conexões)
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

- [x] **1.5 — Acabamentos da recuperação da troca** (PR #170, 31/10/2026; a parte (b) foi para o sync-2.1: feita no PR #173 como 1.5b)
  *O que fazer:* (a) teste próprio de falha ao apagar o marcador no fluxo `restaurarBackup` (hoje só o `aplicarDelta` tem); (b) quando o sync for ligado ao app (sync-2.1), passar `pastaDoServidor` a `aplicarDelta` no chamador de produção; (c) mensagem de `podeSubir`/recuperação sem o nome do arquivo `TROCA-EM-ANDAMENTO.json` nem caminho absoluto na tela; (d) pasta temporária órfã quando gravar o marcador falha antes do 1º rename; (e) conferir no Windows `C:\` vs `c:\` na comparação do pai do marcador.
  *Arquivo:* `packages/nucleo/src/backup/restaurar.ts`, `packages/nucleo/src/sync/aplicar.ts`, `packages/nucleo/src/servidor/configurar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso (falham antes, passam depois).
  *Origem:* syncmel-1.4 · PR #164 · qa integridade + qa segurança

- [x] **1.6 — Provas que faltaram no servidor de sync (syncmel-1.2)** (PR #172, 31/10/2026; removendo só um dos dois prazos de cabeçalho o teste ainda passa: ver 1.7)
  *O que fazer:* (a) o teste "parcial do tamanho certo mas com conteúdo errado" passaria sem o código novo: contar os corpos servidos e exigir exatamente 1 (prova a conferência do hash antes de renomear); (b) testes próprios de `headersTimeout` e de `maxConnections` (17ª conexão não é atendida enquanto as 16 estão abertas).
  *Arquivo:* `packages/nucleo/src/sync/transferencia.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* os testes falham ao remover cada opção do servidor.
  *Origem:* syncmel-1.2 · PR #168 · qa integridade

- [ ] **1.7 — Isolar `headersTimeout` de `requestTimeout` num teste**
  *O que fazer:* expor os prazos do servidor como opção de teste (ou usar valores diferentes) para que cada um tenha prova própria; o teste de cabeçalho lento de hoje gasta ~30 s reais (Node confere a cada ~30 s): com prazos injetáveis cai para segundos.
  *Arquivo:* `packages/nucleo/src/sync/transferencia.ts`, `transferencia.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste novo que falha ao remover só um dos dois prazos; arquivo de teste mais rápido que os 31 s de hoje.
  *Origem:* syncmel-1.6 · PR #172 · filha + qa integridade

- [x] **1.8 — A trava de host impede o espalhar em segundo plano** *(decidido: opção A. Corte de 31/10, onda 23: **1.8a ✅ PR #178** — cartório com a trava de atualização; **1.8b ✅ PR #182** núcleo e app usam a nova trava; falta ligar o espalhar ao app (e checar `servidorOrfao` antes). Backlog: relógio do cartório voltando para trás pode reviver trava vencida — vale para as duas travas)*
  *O que fazer:* `aplicarDelta` exige a trava de host; enquanto o host a segura, um PC que não hospeda não consegue pegar a vez e só atualiza quando a trava está livre. **Pede decisão do Eliel (regra do grupo/trava):** (A) uma "trava de atualização" separada da de host; (B) aceitar atualizar só quando ninguém hospeda. A regra de ouro 1 (um host por vez) não pode ser contornada.
  *Arquivo:* `packages/nucleo/src/sync/espalhar.ts`, `aplicar.ts`, `services/cartorio/src/`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: PC sem hospedar atualiza com o host ativo sem tocar no mundo vivo (A) ou fica em espera clara (B).
  *Depende de:* decisão do Eliel e sync-2.1a (PR #173).
  *Origem:* sync-2.1a · PR #173 · filha

- [ ] **1.9 — Ligar o espalhar ao app (sync-2.1b)** *(onda 25: **1.9a ✅ PR #192** — núcleo+main: fontes sem ip null, órfão bloqueia, gatilho em segundo plano a cada 10 min, 2º rename local, integração `/atualizacao`; **falta 1.9b**: tela "Limite de banda" (padrão 10 MB/s) e limite real em `pedirArquivo`; nuvem NÃO é fonte, decidido 31/10)*
  *O que fazer:* montar as fontes com `quemTem`/`PORTA_ESPALHAR` (filtrando `ip === null`, senão um PC recém-chegado derruba a lista toda no `escolherFontes`), decidir se a nuvem entra como fonte (hoje serve só o pacote fechado, não arquivo por hash), checar `servidorOrfao` além de `servidorRodando` antes de aplicar, disparar após o backup/versão nova e em segundo plano, e a tela Configurações › Backups › "Limite de banda para atualizar o mundo". Notas do qa do #182: janela de ~20 s de rede entre os dois renames no aplicar (prazo menor); textos do renovador falam em "trava de host"; teste de integração de `/atualizacao`.
  *Arquivo:* `packages/nucleo/src/sync/espalhar.ts`, `aplicar.ts`, `apps/desktop/src/main/`, `apps/desktop/src/ui/`
  **Tela no app:** Configurações › Backups › Limite de banda para atualizar o mundo.
  *Confirmação:* teste com 3 PCs simulados: todos chegam à versão M sem tocar o mundo do host.
  *Depende de:* cartmel-2.4 ✅ (PR #187), syncmel-1.8b ✅ (PR #182), piloto-1.1c ✅.
  *Origem:* sync-2.1b · onda 24 (não coube: 7º item)

- [ ] **1.10 — Servir os arquivos do mundo no app (sync-2.1c)**
  *O que fazer:* nenhum código do app chama `servirArquivos`: nenhum PC escuta na `PORTA_ESPALHAR` (25570), então o espalhar (1.9a) não acha fonte de verdade. Iniciar o servidor de arquivos no app, só na IP da rede privada do PC (nunca em 0.0.0.0), com o token por PC conferido pelo cartório, servindo só pacotes fechados registrados (nunca a pasta do mundo vivo); parar ao sair. Também (notas do qa do #192): ignorar em `fontesDeCopias` IP fora da faixa (hoje um IP estranho derruba a rodada de todos); ligar o disparo também após backup bom; teste de `ligarEspalharDoApp`.
  *Arquivo:* `apps/desktop/src/main/`, `packages/nucleo/src/sync/transferencia.ts`, `espalhar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste com 2 PCs simulados (mundo inventado): um serve, o outro atualiza; IP fora da faixa é ignorado sem derrubar a rodada; servidor não escuta fora da rede privada.
  *Depende de:* syncmel-1.9a ✅ (PR #192). Libera 1.3, 1.9b e migra-2.1.
  *Origem:* syncmel-1.9a · PR #192 · filha + qa

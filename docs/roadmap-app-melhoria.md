# Roadmap de melhoria — App

Melhorias achadas durante os itens do `docs/roadmap-app.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `appmel`.** Ramos `roadmap/appmel-<id>`. Entram nas próximas ondas, depois das correções e da segurança.

## Bloco 1 — Janela e bandeja

- [x] **1.1 — Ícone próprio para a bandeja** (PR #144, 31/10/2026; conferência no Windows [P])
  *O que fazer:* recortar só a cabeça do tigre do ícone (o texto "SABRE HOSTING" não se lê em 16–32 px) e usar esse
  recorte na bandeja, nos tamanhos 16, 24 e 32 px.
  *Arquivo:* `apps/desktop/recursos/icone/`, `apps/desktop/src/main/principal.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* no Windows, com escala 100% e 150%, o ícone da bandeja aparece nítido.
  *Origem:* app-1.1 · PR #70 · filha · **confirmado pelo Eliel no Windows (31/10): na bandeja o ícone fica pequeno e o
  texto não se lê.**

- [x] **1.2 — Teste de chamada de fora recusada pela ponte** (PR #131, 31/10/2026)
  *O que fazer:* teste que prova que `veioDaPagina` (processo principal) recusa chamada cujo remetente não é a página
  do app (hoje o código confere, mas nenhum teste cai se a conferência sumir).
  *Arquivo:* `apps/desktop/src/main/principal.ts` (extrair a conferência para `seguranca.ts`), `seguranca.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* sabotar a conferência derruba o teste.
  *Origem:* app-1.1 · PR #70 · qa

- [x] **1.3 — Capturas do E2E só quando pedidas** (PR #126, 31/10/2026; `SABRE_CAPTURAS=1`)
  *O que fazer:* o E2E regrava `docs/imagens/app-1.1-*.png` (agora com a tela do app-1.2) a cada `npm run vistoria`,
  sujando o `git status`. Gravar capturas só com `SABRE_CAPTURAS=1` e numa pasta própria por item; atualizar as do app-1.1.
  *Arquivo:* `apps/desktop/e2e/`
  **Tela no app:** não se aplica.
  *Confirmação:* `npm run vistoria` seguido de `git status` limpo.
  *Origem:* app-1.2 · PR #74 · orquestradora

- [x] **1.4 — Endereço vindo da configuração do grupo** (PR #217, 31/10/2026) (absorvido pelo app-1.3, desenho de 31/10/2026: `GET /grupo`)
  *O que fazer:* hoje o endereço do Jogar só vem de `SABRE_ENDERECO` (variável de ambiente); deve vir da configuração do
  grupo (cartório / tela de primeira vez do app-1.3). Juntar ao app-1.3 se couber.
  *Arquivo:* `services/cartorio`, `apps/desktop/src/main/deps-reais.ts`
  **Tela no app:** Configurações › Grupo › "Endereço do servidor" (só leitura, vindo do cartório).
  *Confirmação:* teste de integração com cartório devolvendo o endereço.
  *Origem:* app-1.2 · PR #74 · filha

- [x] **1.5 — Retomar a própria trava depois de reabrir o app** (PR #101, 31/10/2026; prova no Windows [P])
  *O que fazer:* se este PC é dono da trava mas o app foi reaberto sem servidor rodando, a tela mostra "Servidor no PC do
  <este PC>" até a trava vencer (~60 s). Reconhecer "dono sou eu, sem servidor" e soltar a trava (ou oferecer "Hospedar"
  de novo pelo `hospedar()`).
  *Arquivo:* `apps/desktop/src/main/inicio.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* E2E com cenário "dono sou eu, sem servidor".
  *Origem:* app-1.2 · PR #74 · filha + qa (baixa-média)

- [x] **1.6 — Endereço continua visível depois de Jogar** (PR #137, 31/10/2026)
  *O que fazer:* no estado "Você está hospedando", depois de clicar em Jogar a frase "Endereço copiado. Cole no
  Minecraft para entrar." toma o lugar do endereço, que some da tela. Mostrar o aviso por alguns segundos e voltar ao
  endereço (ou mostrar os dois).
  *Arquivo:* `apps/desktop/src/ui/tela.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* E2E: depois de Jogar, o endereço volta a aparecer.
  *Origem:* teste do Eliel no Windows · 31/10/2026


- [x] **1.7 — Tirar PC do grupo (tela)** (PR #165, 31/10/2026)
  *O que fazer:* área Grupo em Configurações com a lista dos PCs (`cliente.listarPcs()`), só para o dono (`/eu.dono`),
  botão "Tirar PC do grupo" com confirmação que diz o NOME do PC, mensagens pt-BR para 403/409/404 e aviso de que o PC
  tirado precisa de novo convite; novo método `revogarPc` no cliente do núcleo.
  *Arquivo:* `apps/desktop/src/ui/configuracoes.*`, `packages/nucleo/src/cartorio/cliente.ts`
  **Tela no app:** Configurações › Grupo › "Tirar PC do grupo" (só o dono).
  *Confirmação:* E2E com cartório falso: cancelar não revoga; confirmar chama `revogarPc`; não-dono não vê o botão.
  *Depende de:* cartmel-1.1 e cartmel-2.3 (feitos), app-2.2 (feito)
  *Origem:* app-2.2 · PR #160 · filha

- [x] **1.8 — Backups: intervalo e quantos guardar (ligar e expor)** (PR #167, 31/10/2026) *(cortado em 31/10: a onda 21 entregou só o intervalo; "quantos guardar" e a rotação viraram 1.11)*
  *O que fazer:* ligar `agendarBackups` e a rotação do núcleo ao app (hoje sem consumidor em `apps/desktop`) e só então
  expor os dois campos em Configurações › Backups.
  *Arquivo:* `apps/desktop/src/main/`, `packages/nucleo/src/backup/agendador.ts`, `rotacao.ts`
  **Tela no app:** Configurações › Backups › "Intervalo" e "Quantos guardar".
  *Confirmação:* valor salvo muda o intervalo do backup (E2E).
  *Origem:* app-2.2 · PR #160 · filha

- [x] **1.9 — Ligar as distâncias de visão/simulação ao subir o servidor** (PR #228, 31/10/2026; Hospedar agora recusa sem o túnel privado)
  *O que fazer:* usar `opcoesDoServidor(lerPreferencias())` ao gravar a configuração no `hospedar` (hoje só os testes chamam).
  *Arquivo:* `apps/desktop/src/main/deps-reais.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: valor salvo em Configurações aparece em `server.properties` ao hospedar.
  *Depende de:* app-1.3
  *Origem:* app-2.2 · PR #160 · filha + qa

- [x] **1.10 — Acabamentos da tela "Tirar PC do grupo"** (PR #171, 31/10/2026)
  *O que fazer:* (a) o `aria-label` do botão ("Tirar PC do Lucas do grupo") deve conter o texto visível ("Tirar PC do grupo"): deixar o texto visível com o nome ou usar `aria-describedby`; (b) depois de revogar com sucesso o foco se perde (o botão some): focar o aviso ou o título da área; (c) mensagem genérica de rede diz "Nada foi alterado", que pode ser falsa se a resposta se perder depois de o cartório já ter tirado o PC: trocar por "Atualize a lista para conferir."
  *Arquivo:* `apps/desktop/src/ui/configuracoes.ts`, `apps/desktop/src/main/grupo.ts`
  **Tela no app:** Configurações › Grupo › "Tirar PC do grupo".
  *Confirmação:* E2E: foco vai ao aviso depois de revogar; teste da mensagem de rede.
  *Origem:* appmel-1.7 · PR #165 · qa interface

- [x] **1.11 — Backups: ligar a rotação e expor "Quantos guardar"** (PR #179, 31/10/2026; regra: N mais novos + tudo dos últimos 7 dias; marcas bom/ruim no app)
  *O que fazer:* ligar `planejarRotacao`/`aplicarRotacao` ao app depois de cada backup bom e expor Configurações › Backups › "Quantos guardar". **Pede o OK do Eliel**: a rotação apaga backups dos amigos sozinha; e falta a fonte que marca cada backup como bom/ruim/não-conferido (rotacao.ts:4: cartório ou app). Padrão atual (10 recentes + 7 dias) e mínimo garantido não mudam sem ele.
  *Arquivo:* `apps/desktop/src/main/`, `packages/nucleo/src/backup/rotacao.ts`, `apps/desktop/src/ui/configuracoes.ts`
  **Tela no app:** Configurações › Backups › "Quantos guardar".
  *Confirmação:* E2E: valor salvo muda quantos backups ficam; teste de que o último bom e os não conferidos nunca saem.
  *Depende de:* appmel-1.8 e decisão do Eliel.
  *Origem:* appmel-1.8 · triagem · Máxima

- [x] **1.12 — Cofre: distinguir "não existe" de "corrompido"** (PR #223, 31/10/2026)
  *O que fazer:* `ler()` do cofre devolve `undefined` também quando o decrypt falha; devolver estado distinto para o assistente pedir novo convite em vez de achar que é a primeira vez.
  *Arquivo:* `apps/desktop/src/main/cofre.ts`
  **Tela no app:** não se aplica (mensagem no assistente do app-1.3b).
  *Confirmação:* teste com arquivo adulterado.
  *Origem:* app-1.3a · PR #207 · qa

- [x] **1.13 — Campo "Pasta do SabreHosting" e fundir os pedidos de administrador** (PR #219, 31/10/2026; **[P: UAC e script no Windows]**)
  *O que fazer:* campo em Configurações › Geral para ver/trocar a pasta-base gravada pelo assistente (hoje `pastaBase` fica só em `boas-vindas.json` e não alimenta `SABRE_PASTA_*`; ligar no app-1.3c); fundir os 3 pedidos de administrador (instala provisório, desinstala, instala definitiva) em um.
  *Arquivo:* `apps/desktop/src/main/boas-vindas.ts`, `entrada-no-grupo.ts`, `apps/desktop/src/ui/`
  **Tela no app:** Configurações › Geral › "Pasta do SabreHosting".
  *Confirmação:* teste: trocar a pasta atualiza onde servidor e mundos são lidos; 1 só chamada do executor elevado **[P: UAC no Windows]**.
  *Origem:* app-1.3b · PR #211 · qa

- [ ] **1.14 — Retomar a conexão sem convite novo**
  *O que fazer:* se a troca do túnel falha depois do convite gasto, hoje o assistente manda pedir convite novo; guardar o estado para "tentar de novo a conexão" com o token já no cofre.
  *Arquivo:* `apps/desktop/src/main/boas-vindas.ts`, `entrada-no-grupo.ts`
  **Tela no app:** botão "Tentar de novo" no assistente.
  *Confirmação:* teste: falha na instalação definitiva, depois sucesso sem novo convite.
  *Origem:* app-1.3b · PR #211 · filha

- [x] **1.14 — Respeitar `level-name` e validar `SABRE_JAVA`/`SABRE_NEOFORGE`** (PR #225, 31/10/2026)
  *O que fazer:* `pastaMundo` em `config-pc.ts` é fixa `servidor/world`, mas `deps-reais.ts` lê `level-name` do `server.properties`: se não for "world", backup e espalhar apontam para a pasta errada (não apaga nada). `SABRE_JAVA`/`SABRE_NEOFORGE` do ambiente viram executável do servidor sem validação em modo normal: validar ou limitar a modo teste.
  *Arquivo:* `apps/desktop/src/main/config-pc.ts`, `deps-reais.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: level-name diferente aponta o mundo certo; env de executável fora do modo teste é ignorado.
  *Origem:* app-1.3c-i · PR #217 · qa

- [x] **1.15 — Criar convite: anúncio para leitor de tela e nome duplicado** (PR #229, 31/10/2026; [P: conferir com leitor de tela real e e2e no Windows])
  *O que fazer:* o "Copiado" não está numa região `aria-live`; `nomeNaRede` (main) e `nomeComoFica` (UI) são duplicados e podem divergir; conferir que "vale uma vez" bate com o cartório (uso único).
  *Arquivo:* `apps/desktop/src/ui/configuracoes.ts`, `index.html`, `main/grupo.ts`
  **Tela no app:** Configurações › Grupo › "Criar convite".
  *Confirmação:* teste/e2e: região anuncia a cópia; um só normalizador de nome.
  *Origem:* app-1.3c-ii · PR #218 · qa

- [x] **1.16 — Entrada no grupo: esperar a sessão elevada antes de limpar; bloquear Jogar após trocar a pasta** (PR #224, 31/10/2026; [P: parte (a) no Windows])
  *O que fazer:* (a) em `entrada-no-grupo.ts` (~172-196) no caminho de falha, `await sessao.catch(() => undefined)` antes de `limpar()`, para o script ver o `cancelar.flag` e desinstalar o túnel provisório na hora (hoje pode ficar até 150 s); (b) em `principal.ts` (~543-547), depois do sucesso da troca de pasta e antes do `app.exit(0)` (1,5 s), bloquear o botão Jogar.
  *Arquivo:* `apps/desktop/src/main/entrada-no-grupo.ts`, `principal.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: falha de `esperarPronta` espera a sessão; Jogar recusado após a troca.
  *Origem:* appmel-1.13 · PR #219 · qa

- [x] **1.17 — Assistente: mensagem para cofre corrompido** (PR #231, 31/10/2026)
  *O que fazer:* quando `cofreCorrompido` vier verdadeiro, mostrar "Seu acesso guardado neste PC não abre mais; peça um convite novo" (hoje `main/boas-vindas.ts` já informa o estado, mas a tela `ui/boas-vindas.ts` não o trata).
  *Arquivo:* `apps/desktop/src/ui/boas-vindas.ts`
  **Tela no app:** Assistente de boas-vindas (primeira vez).
  *Confirmação:* teste/E2E com `cofreCorrompido: true` mostra a mensagem.
  *Origem:* appmel-1.12 · PR #223 · filha

- [x] **1.18 — Teste do encaixe de Jogar/Hospedar em `principal.ts`** (PR #235, 31/10/2026)
  *O que fazer:* extrair os handlers de Jogar/Hospedar para função testável e cobrir a recusa depois de `trocada()` (hoje só `pasta-base.test.ts` cobre `trocada()`; o encaixe no `principal.ts` não tem teste).
  *Arquivo:* `apps/desktop/src/main/principal.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: Jogar e Hospedar recusam depois de `trocada()`.
  *Origem:* appmel-1.16 · PR #224 · filha

- [x] **1.19 — Reler `level-name` a cada operação** (PR #236, 31/10/2026)
  *O que fazer:* resolver `pastaMundo` na hora do backup/espalhar, e não só ao abrir o app (se o `level-name` mudar com o app aberto, o backup ainda aponta o mundo antigo).
  *Arquivo:* `apps/desktop/src/main/config-pc.ts`, `principal.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: `level-name` muda com o app aberto e o backup segue o novo.
  *Origem:* appmel-1.14b · PR #225 · filha

- [x] **1.20 — Convite copiado: anunciar também a segunda cópia** (PR #234, 31/10/2026)
  *O que fazer:* copiar duas vezes seguidas repete o mesmo texto em `#convite-copiado` e o leitor de tela pode não anunciar de novo; limpar a região e reescrever (ou acrescentar um contador invisível) a cada cópia.
  *Arquivo:* `apps/desktop/src/ui/configuracoes.ts`
  **Tela no app:** Configurações › Grupo › "Criar convite".
  *Confirmação:* e2e: duas cópias seguidas mudam o conteúdo da região entre as duas.
  *Origem:* appmel-1.15 · PR #229 · qa

- [x] **1.21 — Restaurar backup: reler o `level-name` na hora** (✅ PR #238, 31/10/2026)
  *O que fazer:* `restaurar` em `deps-backups.ts` ainda usa a `pastaDoMundo` lida ao abrir o app (o appmel-1.19 corrigiu só o backup agendado e o backup antes de trocar versão). Passar `mundoAgora` (`pastaDoMundoAgora` de `config-pc.ts`) também a `depsBackupsReais.restaurar`, para restaurar no mundo que o `server.properties` diz agora.
  *Arquivo:* `apps/desktop/src/main/deps-backups.ts`, `apps/desktop/src/main/principal.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: `level-name` muda entre dois Hospedar e restaurar cai no mundo novo (restaurar continua fazendo backup do estado atual antes, regra 4).
  *Origem:* appmel-1.19 · PR #236 · filha + qa (gravidade média-baixa: não corrompe, pode confundir)

- [x] **1.22 — Vigia fora do `app.asar` (`asarUnpack`)** (✅ PR #247; empacotar de verdade ⏸️ P, 01/11/2026)
  *O que fazer:* `processo.ts` sobe o vigia por `new URL("./vigia.js", import.meta.url)`; empacotado, esse caminho cai dentro do `app.asar`. Resolver o caminho trocando `app.asar` por `app.asar.unpacked` quando existir, e listar o `vigia.js` (e o que ele importa) em `asarUnpack` no `electron-builder.json`. Só entra se der para provar na nuvem (teste da função de caminho + conferência do JSON); empacotar de verdade fica **[P]**.
  *Arquivo:* `packages/nucleo/src/servidor/processo.ts`, `apps/desktop/electron-builder.json`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: caminho dentro de `app.asar` vira `app.asar.unpacked`; fora dele não muda. Instalador com servidor subindo **[P: PC Windows]**.
  *Origem:* app-3.1 · Backlog do milestone · máxima

- [ ] **1.23 — Ensaiar o empacotamento sem criar release**
  *O que fazer:* `workflow_dispatch` em `versao.yml` com `--publish never`, subindo o `.exe` como artefato; conferir também se o `files` do electron-builder precisa incluir o `dist` do núcleo (a 1ª tag mostra).
  *Arquivo:* `.github/workflows/versao.yml`, `apps/desktop/electron-builder.json`
  **Tela no app:** não se aplica.
  *Confirmação:* ensaio no GitHub gera o `.exe` como artefato **[P: rodar o workflow]**.
  *Origem:* app-3.1 · PR #241 · filha

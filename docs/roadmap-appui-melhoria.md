# Roadmap de melhoria — Interface do app (appui)

Melhorias achadas durante os itens do `docs/concluidos/roadmap-appui.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `appuimel`.** Ramos `roadmap/appuimel-<id>`.

## Bloco 1 — Tela Backups

- [x] **1.1 — Backup manual e origem do backup** (✅ PR #294, 02/11/2026; decisão do Eliel, 01/11/2026; onda 43)
  *O que fazer:* (1) núcleo: campo `origem` (`automatico` | `manual` | `antes-de-restaurar`) no manifesto do pacote de backup; ausente em backup antigo ou valor desconhecido lido do disco = `automatico` (sem migração, sem reescrever backup existente). O agendador grava `automatico`, o restaurar grava `antes-de-restaurar`. (2) Botão "Fazer backup agora" na tela Backups, habilitado só com o servidor pronto (estado vem do main), pelo MESMO `fazerBackup` (save-off + save-all flush + save-on); recusado no main se o servidor não está pronto, se há backup ou restauração em andamento, ou em modo demonstração; botão com estado "carregando" e resultado em texto fixo seguro. (3) A lista mostra a origem em palavras ("Automático", "Manual", "Antes de restaurar"). O manual conta na rotação como qualquer outro e nunca derruba o mínimo garantido. (4) Junto, se couber: `npm run test:e2e -w apps/desktop -- <arquivo>` passa o filtro ao vitest (`apps/desktop/scripts/e2e.mjs`).
  *Arquivo:* `packages/nucleo/src/backup/manifesto.ts` e vizinhos, `apps/desktop/src/main/backups.ts`, `apps/desktop/src/ui/`, `apps/desktop/scripts/e2e.mjs`, testes
  **Tela no app:** Backups › "Fazer backup agora"; linha da lista com a origem.
  *Confirmação:* testes que falham antes e passam depois (manifesto: origem gravada/lida, ausente e torta = automático; `backups.ts`: recusas e uma chamada de save-off/flush; e2e: botão desabilitado sem servidor, habilitado com servidor pronto, linha nova "Manual"; rotação com manual não derruba o mínimo). Windows real e servidor Minecraft real **[P: Eliel]**.
  *Origem:* Eliel · PR #286

## Bloco 2 — Interface v2: base na estrutura de um painel de servidor de referência (pedido do Eliel, 02/11/2026)

**O que o Eliel pediu:** a interface melhorou (roadmap `appui`), mas "por não ter seguido uma base se perdeu um pouco". A base
passa a ser a **estrutura** de um painel de servidor Minecraft que ele mostrou (captura, **não** vai para o repositório):
barra superior com abas e um chip de estado sempre visível; cartão principal com a frase de estado e três peças pequenas
(PC, servidor, painel); grade de números grandes (jogadores, tempo ligado, RAM, tamanho do mundo, backups, último
backup); seções com cabeçalho e atalho "Ver tudo →"; coluna lateral com o que o grupo usa na hora; rodapé de estado.
**Tem de ser original:** copiamos a organização (onde cada coisa mora e o que se vê em 5 segundos), nunca o visual. Nada
de fonte monoespaçada em caixa alta, de paleta marrom e rosa, de ícones de bloco, do nome ou de qualquer arquivo dele.
Mantemos o tema **claro e escuro** (`prefers-color-scheme`), a cor de destaque do app (azul-petróleo do tigre), fonte do
sistema, tudo empacotado, sem internet (`docs/design-system.md`). Modo impeccable: **Operate** (amigo que só quer jogar).

**Direção (decidida pela Máxima, reversível; o 2.1 documenta e o Eliel pode trocar):**
- **Original por três escolhas:** (1) o estado é uma **frase em português** ("Servidor ligado — 2 amigos jogando"), não
  uma etiqueta; (2) superfícies em **camadas claras** com borda de estado em cor + ícone + palavra (nunca só cor);
  (3) números grandes com **tabulares** e sempre com a comparação ("4,1 GB, era 5,3 GB"), nunca um número solto.
- **Honestidade dos dados:** só aparece número que o app realmente sabe; o que não existe mostra "—" com a razão numa dica.
  Nunca número inventado (TPS do Paper fica fora: o servidor padrão não tem; vira backlog).
- **Sem arrastar nem reordenar seções** (a referência permite; aqui só recolher/abrir): menos peso, menos erro.
- **Sem mapa do mundo** neste bloco (exige mod ou servidor de mapa): fica no backlog; a aba **Mundo** (roadmap `chunk`)
  traz a grade de regiões.

- [ ] **2.1 — Direção v2 documentada e tokens novos**
  *O que fazer:* escrever a seção "Direção v2" em `docs/design-system.md` (abas no topo, chip de estado, cartão principal,
  peças de estado, grade de números, seção recolhível, rodapé; o que é "original" e o que não se faz) e acrescentar em
  `tokens.css` só o que falta (camadas de superfície, borda por estado, numerais tabulares, tamanhos de número grande).
  Nenhuma tela muda neste item. Contraste AA conferido nos dois temas em `tokens.test.ts`.
  *Arquivo:* `docs/design-system.md`, `apps/desktop/src/ui/tokens.css`, `tokens.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste de contraste dos tokens novos nos dois temas; `impeccable` `document` conferido.
  *Origem:* Eliel · 02/11/2026

- [ ] **2.2 — Casca nova: barra superior com abas e chip de estado, rodapé de estado**
  *O que fazer:* trocar a barra lateral por **barra superior**: nome do app, abas **Início, Backups, Grupo, Configurações**
  (a aba atual marcada), e à direita um **chip de estado** sempre visível ("Desligado", "Ligando…", "2 online") que abre
  o Início ao clicar. Rodapé fino: versão do app, nome do grupo e estado do cartório. Janela mínima 720 x 480: abas viram
  só ícone abaixo de 840 px. Navegação por teclado (setas, Home, End, Tab) e `aria-current` mantidas.
  *Arquivo:* `apps/desktop/src/ui/index.html`, `tela.css`, `tela.ts`, `navegacao.ts`, `docs/design-system.md`, testes
  **Tela no app:** barra superior (todas as telas); chip de estado.
  *Confirmação:* e2e: abas levam a cada tela; chip muda com o estado do servidor falso; teclado percorre as abas.
  *Depende de:* 2.1

- [ ] **2.3 — Dados do Início na ponte: jogadores, tempo ligado, RAM, tamanho do mundo**
  *O que fazer:* o main passa a entregar para a tela, pela ponte e já pronto para mostrar: jogadores online (número e nomes),
  tempo ligado, memória usada pelo servidor (quando ligado), tamanho do mundo no disco (leitura barata, sem ler o mundo
  inteiro na RAM) e quantidade/último backup. Dado que não existe volta `null` (a tela mostra "—"). Atualização por
  intervalo curto só com a tela aberta. Nada novo aberto na rede.
  *Arquivo:* `apps/desktop/src/main/inicio.ts` (ou vizinho), `ponte.ts`, `preload.cts`, `fake-e2e.ts`, testes
  **Tela no app:** não se aplica (alimenta o 2.4).
  *Confirmação:* teste de unidade do main (cada campo, ausente = `null`); mundo de teste inventado.
  *Depende de:* nada

- [ ] **2.4 — Início v2: cartão principal, peças de estado, grade de números, coluna do grupo**
  *O que fazer:* refazer o Início na estrutura da referência: (1) **cartão principal** com a frase de estado, versão do
  Minecraft, tempo ligado e jogadores; (2) **três peças** pequenas com borda de estado: "Este PC", "Servidor", "Grupo"
  (cartório); (3) **ações** (Jogar, Hospedar, Parar…) logo abaixo, uma principal por vez; (4) **grade de números**
  (jogadores, RAM, tamanho do mundo, backups, último backup "há quanto tempo") com a comparação ao lado; (5) **coluna
  lateral** "Quem está online" e "Endereço para os amigos" com botão Copiar. Estados vazios honestos; sem número inventado.
  *Arquivo:* `apps/desktop/src/ui/index.html`, `tela.css`, `tela.ts`, `docs/design-system.md`, e2e, capturas
  **Tela no app:** Início.
  *Confirmação:* e2e (cada estado: ninguém hospeda, eu hospedo, outro hospeda, sem cartório, demonstração); capturas
  claro e escuro em `docs/imagens/appuimel-2.4/`.
  *Depende de:* 2.2, 2.3

- [ ] **2.5 — Seção recolhível padrão e Backups v2**
  *O que fazer:* criar o componente **seção** (cabeçalho com título, atalho "Ver tudo →" e seta de recolher; lembra
  aberta/fechada por tela, só preferência local) e aplicar em Backups: resumo no topo (quantos, o último há quanto
  tempo, espaço usado, próximo automático) e a lista abaixo; "Fazer backup agora" e "Restaurar" mantidos como estão.
  *Arquivo:* `apps/desktop/src/ui/backups.ts`, `index.html`, `tela.css`, `docs/design-system.md`, e2e
  **Tela no app:** Backups (resumo e seção da lista).
  *Confirmação:* e2e (recolher/abrir, resumo bate com a lista, restaurar continua pedindo confirmação).
  *Depende de:* 2.2

- [ ] **2.6 — Grupo, Mods e Configurações na casca nova**
  *O que fazer:* levar Grupo (PCs, convite), Mods e Configurações (abas Geral/Servidor/Backups) para o mesmo vocabulário:
  seções recolhíveis, peças de estado nos PCs ("online", "visto há…"), barra de salvar no rodapé dentro do novo rodapé.
  Nenhuma regra muda (só o dono vê convite e mods; confirmações iguais).
  *Arquivo:* `apps/desktop/src/ui/grupo.ts`, `mods.ts`, `configuracoes.ts`, `index.html`, `tela.css`, e2e
  **Tela no app:** Grupo, Mods, Configurações.
  *Confirmação:* e2e existentes passam sem afrouxar; capturas dos dois temas.
  *Depende de:* 2.5

- [ ] **2.7 — Acabamento da v2: auditoria, polimento e comparação**
  *O que fazer:* `impeccable` `audit` e `polish` em todas as telas; conferir contraste, foco, teclado, janela mínima, tema
  claro e escuro; confirmar que nada ficou parecido demais com a referência (fonte, paleta, ícones, nomes); teto de RAM do
  app parado e tamanho do instalador conferidos contra `scripts/limites.json` (só descem). Capturas finais.
  *Arquivo:* `apps/desktop/src/ui/`, `docs/design-system.md`, `docs/imagens/appuimel-2.7/`, testes
  **Tela no app:** todas.
  *Confirmação:* e2e completo verde; auditoria sem item grave; no Windows com o instalador novo **[P: Eliel]**.
  *Depende de:* 2.6

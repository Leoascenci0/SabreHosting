# Roadmap — Biblioteca de construções (Litematica)

Objetivo: o grupo tem uma **biblioteca de construções** (arquivos `.litematic` do mod Litematica) guardada no cartório.
Qualquer amigo sobe um arquivo pelo app; o arquivo chega sozinho ao jogo de todos; quem posiciona o **holograma**
(o "fantasma" da construção) dentro do jogo faz todos os outros verem o mesmo holograma, sem cada um configurar nada.

**Sigla `bibl`.** Ramos `roadmap/bibl-<id>`. Código em `services/cartorio/src/biblioteca.ts`,
`packages/nucleo/src/biblioteca/` e na tela "Construções" do app.

Decisões do Eliel (31/10/2026, D9 em `docs/ops/DECISOES.md`):
- "Ir para o mundo" = **só holograma para montar**. Nada cola blocos no mundo: a biblioteca nunca escreve no mundo.
- **Todos sobem e todos colocam holograma**; apagar da biblioteca, só quem subiu ou o dono do grupo.
- **Posição e giro se escolhem dentro do jogo**, pela Litematica, vendo o terreno. O app não tem tela de coordenadas.

Caminho técnico proposto: holograma compartilhado pelo mod **Syncmatica** (o servidor repassa a posição da construção a
todos). Litematica, MaLiLib e Syncmatica são mods Fabric: rodam pelo Sinytra Connector (D5) **se** forem compatíveis;
isso se prova no bibl-2.1 antes de qualquer outro item do bloco 2.

Regras do item: arquivo da biblioteca é entrada não confiável (pode ser qualquer coisa com nome `.litematic`): ler com
o `nbt.ts` que já existe (teto de bytes e de profundidade), conferir hash SHA-256 em todo download, gravar com nome
temporário e renomear. Nenhum arquivo da biblioteca vai para o repositório; testes usam litemáticas inventadas.

## Bloco 1 — A biblioteca

- [ ] **1.1 — Biblioteca no cartório**
  *O que fazer:* o cartório guarda arquivos `.litematic` do grupo: subir (PC autenticado pelo token), listar (nome,
  quem subiu, data, tamanho, hash SHA-256), baixar e apagar. Recusa o que não for litemática (gzip + NBT com
  `Metadata` e `Regions`), arquivo acima do teto (10 MB, decidido pela Máxima, reversível) e nome repetido.
  Apagar: só quem subiu ou o dono do grupo.
  *Arquivo:* `services/cartorio/src/biblioteca.ts` (+ rotas em `servidor.ts`)
  **Tela no app:** não se aplica (tela no bibl-1.3).
  *Confirmação:* testes: arquivo que não é litemática recusado; acima do teto recusado; amigo apagando arquivo de
  outro recusado; dono apaga; hash da lista bate com o arquivo baixado.
  *Depende de:* cart-1.5 (token por PC)

- [ ] **1.2 — Núcleo: ler a litemática e levar ao jogo**
  *O que fazer:* ler os metadados do arquivo com o `nbt.ts` (nome, autor, tamanho em blocos, total de blocos) para a
  tela mostrar; cliente do cartório para subir, listar, baixar e apagar; manter a pasta `schematics/SabreHosting/`
  da instância do jogo igual à biblioteca (baixa o que falta com hash conferido, troca atômica, tira o que saiu da
  biblioteca). Nunca mexe em litemática que o amigo guardou fora dessa subpasta.
  *Arquivo:* `packages/nucleo/src/biblioteca/` (`ler.ts`, `sincronizar.ts`)
  **Tela no app:** não se aplica (tela no bibl-1.3).
  *Confirmação:* testes: arquivo hostil (bomba gzip, NBT malformado) recusado sem travar; hash errado não entra;
  arquivo do amigo fora da subpasta continua intacto.
  *Depende de:* bibl-1.1, lanc-1.2 (instância)

- [ ] **1.3 — Tela "Construções" no app**
  *O que fazer:* aba "Construções": lista com nome, quem subiu, tamanho e quantidade de blocos; botão "Subir
  construção…" (escolhe o arquivo `.litematic`, mostra "Enviando…"); "Apagar" com confirmação, só para quem pode;
  aviso "Já está no seu jogo" quando a cópia local bate. A pasta do jogo se atualiza ao clicar em Jogar.
  *Arquivo:* `apps/desktop/src/ui/construcoes.*`
  **Tela no app:** "Construções" (aba principal) e Configurações › Grupo › "Biblioteca de construções" (liga ou
  desliga, só o dono).
  *Confirmação:* o Eliel sobe um arquivo de teste e vê na lista do outro PC. **[P: teste no PC]**
  *Depende de:* bibl-1.2, app-2.2 (tela de Configurações)

## Bloco 2 — Holograma para todos

- [ ] **2.1 — Prova: Litematica + Syncmatica no servidor do grupo** (SOZINHO na onda)
  *O que fazer:* na versão do Minecraft escolhida pelo dono, conferir se Litematica + MaLiLib (jogador) e Syncmatica
  (jogador e servidor) rodam no NeoForge + Sinytra Connector; anotar versões e hashes do Modrinth; conferir que o
  holograma compartilhado **aparece para os outros sem clique de cada um** (se o Syncmatica pedir que cada um
  carregue, o relatório diz e abre decisão). Se não rodar: **ESPERA DECISÃO D-bibl-1** (caminhos: porte NeoForge da
  Litematica, trocar de versão do Minecraft, ou só a biblioteca sem holograma compartilhado).
  *Arquivo:* `docs/ops/relatorios/bibl-2.1.md`
  **Tela no app:** não se aplica.
  *Confirmação:* dois jogadores no servidor de teste; um posiciona, o outro vê. **[P: teste com 2 PCs + versão do
  Minecraft escolhida]**
  *Depende de:* host-3.1, lanc-1.4

- [ ] **2.2 — Pacote "Construções" nos mods do grupo**
  *O que fazer:* ligar a biblioteca (Configurações › Grupo) põe Litematica + MaLiLib (lado jogador) e Syncmatica
  (lado jogador e servidor) na lista de mods do grupo, com as versões e hashes do bibl-2.1, pelo mesmo caminho do
  lanc-1.4 (`mods.ts`, lado `cliente`/`servidor`/`ambos`). Desligar tira os três.
  *Arquivo:* `packages/nucleo/src/launcher/mods.ts`, `services/cartorio/src/mods.ts`
  **Tela no app:** Configurações › Grupo › "Biblioteca de construções" (o mesmo interruptor do bibl-1.3).
  *Confirmação:* teste: ligar acrescenta os 3 com hash; desligar tira; mod só de jogador não vai ao servidor.
  *Depende de:* bibl-2.1, lancmel-2.1

- [ ] **2.3 — Hologramas não somem na troca de host**
  *O que fazer:* o Syncmatica guarda os hologramas na pasta do servidor; essa pasta passa a viajar dentro do pacote
  fechado do mundo (backup e sync), com as mesmas regras de ouro (só depois de `save-off` + `save-all flush`, hash,
  troca atômica). Assim, quando o servidor muda de PC, os hologramas continuam lá.
  *Arquivo:* `packages/nucleo/src/backup/` (lista do que entra no pacote)
  **Tela no app:** não se aplica.
  *Confirmação:* teste com mundo inventado: pacote leva a pasta dos hologramas; restaurar num PC novo devolve a
  mesma lista.
  *Depende de:* bibl-2.2, sync-1.2

## Bloco 3 — Para o grupo

- [ ] **3.1 — Tutorial "Montar construção juntos"**
  *O que fazer:* passo a passo curto: subir no app, abrir o jogo, posicionar pela Litematica, compartilhar; como
  tirar um holograma.
  *Arquivo:* `docs/tutoriais/construcoes.md`
  **Tela no app:** não se aplica.
  *Confirmação:* um amigo que não conhece a Litematica segue o tutorial sozinho. **[P: teste com o grupo]**
  *Depende de:* bibl-1.3, bibl-2.2

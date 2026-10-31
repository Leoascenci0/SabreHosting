# Roadmap de melhoria — Cartório

Melhorias achadas durante os itens do `docs/roadmap-cart.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `cartmel`.** Ramos `roadmap/cartmel-<id>`. Todo item é RISCO alto, como no roadmap irmão.

## Bloco 1 — Núcleo do cartório

- [x] **1.1 — Revogar token de PC** (PR #154, 31/10/2026)
  *O que fazer:* rota de administrador `POST /pcs/:id/revogar` que preenche `tokens.revogado_em` (a coluna e o filtro
  já existem).
  *Arquivo:* `services/cartorio/src/`
  **Tela no app:** Configurações › Grupo › "Tirar PC do grupo" (só o dono do grupo; tela no app-2.2).
  *Confirmação:* token revogado → 401 no `/eu`.
  *Origem:* cart-1.1 · PR #15 · filha

- [x] **1.2 — Endurecer a entrada do cartório** (PR #69, 31/10/2026)
  *O que fazer:* `bodyLimit` explícito pequeno (ex.: 4 KB); escuta só em 127.0.0.1/::1 e faixas privadas; limite de
  tentativas falhas em `/convites/usar` e de token por IP (dependência nova pede linha em DECISOES).
  *Arquivo:* `services/cartorio/src/servidor.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* corpo de 10 KB → 413; IP público → erro na partida; 20 tentativas erradas → 429.
  *Origem:* cart-1.1 · PR #15 · filha + qa segurança

- [x] **1.3 — Banco do cartório fora do diretório atual e convites vencidos limpos** (PR #69, 31/10/2026)
  *O que fazer:* `*.db` no `.gitignore`; caminho padrão do banco numa pasta de dados (ex.: `/var/lib/sabre-cartorio/`);
  apagar convites não usados vencidos há mais de N dias.
  *Arquivo:* `.gitignore`, `services/cartorio/src/iniciar.ts`, `services/cartorio/src/banco.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* `git status` limpo após rodar o cartório na raiz; teste com relógio injetado apaga só os vencidos.
  *Origem:* cart-1.1 · PR #15 · filha

- [x] **1.4 — Prova de corrida com dois processos** (PR #133, 31/10/2026)
  *O que fazer:* teste com 2 processos (ou worker_threads) abrindo um banco novo e usando o mesmo convite ao mesmo
  tempo; exatamente um vence.
  *Arquivo:* `services/cartorio/src/cartorio.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* o teste roda 20 vezes sem falhar e falha se a leitura da versão sair da transação.
  *Origem:* cart-1.1 · PR #15 · qa integridade

- [x] **1.5 — Trava: blindar a época e o destino da passagem**
  *O que fazer:* gatilhos `BEFORE DELETE` e `BEFORE INSERT` na tabela `trava` que recusam (hoje só o UPDATE é
  protegido; um `INSERT OR REPLACE` zera a época); `passar` recusa destino = o próprio PC e destino sem token ativo
  (`tokens.revogado_em IS NULL`); teste da migração v1→v2 com PCs já cadastrados.
  *Arquivo:* `services/cartorio/src/banco.ts`, `services/cartorio/src/trava.ts`, `services/cartorio/src/trava.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* `INSERT OR REPLACE` na trava falha; passar para si mesmo ou para PC sem token → recusa; migração v1→v2
  preserva os PCs.
  *Origem:* cart-1.2 · PR #22 · qa integridade + qa segurança · **feito no PR #27 (30/10/2026)**

- [x] **1.6 — Tipo da época garantido no banco e recusa mais clara na passagem** (PR #127, 31/10/2026)
  *O que fazer:* numa migração nova, `CHECK (typeof(epoca) = 'integer')` na trava (hoje um UPDATE com texto passaria
  pelo gatilho; não se alcança pela API); recusa própria `destino_sem_acesso` quando o destino só tem token revogado.
  *Arquivo:* `services/cartorio/src/banco.ts`, `services/cartorio/src/trava.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* `UPDATE trava SET epoca='abc'` falha; passar para PC revogado devolve `destino_sem_acesso`.
  *Origem:* cartmel-1.5 · PR #27 · qa

## Bloco 2 — Cliente do cartório

- [x] **2.1 — Cliente mais rígido** (PR #123, 31/10/2026; intervalo de renovação mantido)
  *O que fazer:* validar as respostas do cartório (tipos, campos, teto de ~64 KB no corpo) em vez de `as T`; renovar
  confere a época na resposta; parar as novas tentativas do renovar depois de soltar/perder; na perda, o salvar pode
  furar a fila de comandos (hoje é só melhor esforço); considerar renovar a cada renovarMs/2.
  *Arquivo:* `packages/nucleo/src/cartorio/cliente.ts`, `renovador.ts`, `hospedar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: resposta malformada recusada; nenhuma tentativa depois de soltar.
  *Origem:* cart-2.1 · PR #41 · qa segurança + qa integridade

- [x] **1.7 — Segredo do cartório num arquivo de ambiente** (PR #75, 31/10/2026)
  *O que fazer:* a unidade `sabre-cartorio.service` não tem de onde tirar `SABRE_CARTORIO_SEGREDO_ADMIN` (sem ele o
  cartório recusa a partida): `EnvironmentFile=/etc/sabre/cartorio.env` (0600, root) e o instalador cria o arquivo com
  `openssl rand`, sem nunca imprimir o segredo. **Obrigatório antes do cart-2.2.**
  *Arquivo:* `infra/vps/systemd/sabre-cartorio.service`, `infra/vps/instalar.sh`
  **Tela no app:** não se aplica.
  *Confirmação:* simulação do instalador: arquivo com 0600, unidade sobe com o segredo; rodar de novo não troca o segredo.
  *Origem:* cartmel-1.2 · PR #69 · filha (achado médio)

- [x] **1.8 — Teto do PUT sem enfeite e exemplo de endereço coerente** (PR #135, 31/10/2026; cartório e app só na rede 10.66)
  *O que fazer:* tirar o `bodyLimit` inerte da rota `PUT /versoes/:n/pacote` (o teto real é o do armazém, leitor em
  fluxo) ou trocar por comentário; na mensagem de `conferirEndereco`, trocar o exemplo `10.8.0.1` por `10.66.0.1`.
  *Arquivo:* `services/cartorio/src/servidor.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste do PUT igual; teste do texto do erro.
  *Origem:* cartmel-1.2 · PR #69 · filha (achados baixos)

- [x] **1.9 — Acabamentos do cliente do cartório** (PR #143, 31/10/2026)
  *O que fazer:* cortar em ~200 caracteres o campo `erro` vindo do cartório antes de pôr no `ErroCartorio` e na recusa
  da trava (vai para o log e para a tela); o teste "content-length acima de 64 KB nem é lido" passa a provar que o corpo
  não foi lido (hoje a contagem por fluxo também barra e o teste não distingue); convite antigo sem `ip_prov` (só
  `{token}`) recusado com mensagem clara em vez de "resposta inválida".
  *Arquivo:* `packages/nucleo/src/cartorio/cliente.ts`, `packages/nucleo/src/cartorio/tipos.ts`, testes
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso (falham antes, passam depois).
  *Origem:* cartmel-2.1 · PR #123 · qa segurança + qa integridade + filha


- [x] **2.3 — Listar os PCs do grupo e dizer quem é o dono** (PR #161, 31/10/2026)
  *O que fazer:* `GET /pcs` (só o dono; 403 para os outros) devolve `[{id, nome, dono}]` dos PCs com token ativo; `GET /eu` passa a devolver também `dono: boolean`. Só leitura, sem tabela nova.
  *Arquivo:* `services/cartorio/src/servidor.ts`, `services/cartorio/src/banco.ts`, `packages/nucleo/src/cartorio/cliente.ts` (métodos `eu()` com `dono` e `listarPcs()`)
  **Tela no app:** Configurações › Grupo › "Tirar PC do grupo" (a lista; tela no app-2.2/appmel).
  *Confirmação:* testes: dono lista; não-dono → 403; PC revogado não aparece; `/eu` diz `dono`.
  *Origem:* app-2.2 · triagem da filha · Máxima

- [x] **2.2 — Revogar também o peer e provar a trava do PC revogado** (PR #163, 31/10/2026; remoção do peer virou rede-melhoria 1.3)
  *O que fazer:* hoje `POST /pcs/:id/revogar` só tira o acesso ao cartório; o peer do PC continua na rede privada
  (item de rede à parte, já decidido em DECISOES 31/10) — abrir esse item em `docs/roadmap-rede-melhoria.md` quando
  o ajudante do WireGuard estiver instalado; e documentar que o host revogado perde a trava só no prazo (~20 s).
  *Arquivo:* `services/cartorio/src/`, `docs/`
  **Tela no app:** não se aplica.
  *Confirmação:* teste de limite de falhas contando token revogado (429).
  *Origem:* cartmel-1.1 · PR #154 · qa segurança + qa integridade

- [x] **2.4 — Descoberta de fontes do espalhar no cartório** (PR #187, 31/10/2026; `registrarVersao` ficou como `criarVersao` do PR #189; PC revogado filtrado; faixa 2–199 fechada; `PORTA_ESPALHAR` = 25570 escolhida pela filha, trocar se preciso)
  *O que fazer:* incluir o IP da rede privada de cada PC em `GET /versoes/:n/copias`; um sinalizador de que a nuvem tem a versão M; `maisNova()` e `quemTem()` em `cliente.ts`; e o método do cliente para registrar a versão (`POST /versoes`, hoje só existe `informarCopia`). O espalhar (sync-2.1a) recebe as fontes injetadas dali; só aceita IPs da rede privada.
  *Arquivo:* `services/cartorio/src/servidor.ts`, `versoes.ts`, `packages/nucleo/src/cartorio/cliente.ts`, `tipos.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste do cliente com cartório de teste devolvendo IP e nuvem; teste de que IP fora da rede privada é recusado.
  *Origem:* sync-2.1a · PR #173 · filha

- [x] **2.5 — Versão sem pacote não pode virar a "mais nova"** (PR #194, 31/10/2026; `maisNovaGuardada` + `ultimoRegistrado` p/ o importador numerar após órfã)
  *O que fazer:* hoje `POST /versoes` publica a versão N antes do envio do pacote; se o envio cair, `maisNova` aponta para N, ninguém tem N e a regra 5 (versão manda) trava os hosts até o dono importar de novo. Fazer `maisNova` ignorar versão sem pacote guardado (ou aceitar o pacote antes de publicar). Também: `registrarVersao` marca o PC importador como tendo a cópia N, mas o mundo local dele não mudou, então ele aparece como fonte do espalhar.
  *Arquivo:* `services/cartorio/src/versoes.ts`, `servidor.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: versão criada sem pacote não é devolvida por `/versoes/mais-nova`; importador não aparece em `/copias` até ter a cópia.
  *Origem:* piloto-1.1c · PR #189 · qa integridade

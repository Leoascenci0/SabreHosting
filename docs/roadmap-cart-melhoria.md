# Roadmap de melhoria — Cartório

Melhorias achadas durante os itens do `docs/roadmap-cart.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `cartmel`.** Ramos `roadmap/cartmel-<id>`. Todo item é RISCO alto, como no roadmap irmão.

## Bloco 1 — Núcleo do cartório

- [ ] **1.1 — Revogar token de PC**
  *O que fazer:* rota de administrador `POST /pcs/:id/revogar` que preenche `tokens.revogado_em` (a coluna e o filtro
  já existem).
  *Arquivo:* `services/cartorio/src/`
  **Tela no app:** Configurações › Grupo › "Tirar PC do grupo" (só o dono do grupo; tela no app-2.2).
  *Confirmação:* token revogado → 401 no `/eu`.
  *Origem:* cart-1.1 · PR #15 · filha

- [ ] **1.2 — Endurecer a entrada do cartório**
  *O que fazer:* `bodyLimit` explícito pequeno (ex.: 4 KB); escuta só em 127.0.0.1/::1 e faixas privadas; limite de
  tentativas falhas em `/convites/usar` e de token por IP (dependência nova pede linha em DECISOES).
  *Arquivo:* `services/cartorio/src/servidor.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* corpo de 10 KB → 413; IP público → erro na partida; 20 tentativas erradas → 429.
  *Origem:* cart-1.1 · PR #15 · filha + qa segurança

- [ ] **1.3 — Banco do cartório fora do diretório atual e convites vencidos limpos**
  *O que fazer:* `*.db` no `.gitignore`; caminho padrão do banco numa pasta de dados (ex.: `/var/lib/sabre-cartorio/`);
  apagar convites não usados vencidos há mais de N dias.
  *Arquivo:* `.gitignore`, `services/cartorio/src/iniciar.ts`, `services/cartorio/src/banco.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* `git status` limpo após rodar o cartório na raiz; teste com relógio injetado apaga só os vencidos.
  *Origem:* cart-1.1 · PR #15 · filha

- [ ] **1.4 — Prova de corrida com dois processos**
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

- [ ] **1.6 — Tipo da época garantido no banco e recusa mais clara na passagem**
  *O que fazer:* numa migração nova, `CHECK (typeof(epoca) = 'integer')` na trava (hoje um UPDATE com texto passaria
  pelo gatilho; não se alcança pela API); recusa própria `destino_sem_acesso` quando o destino só tem token revogado.
  *Arquivo:* `services/cartorio/src/banco.ts`, `services/cartorio/src/trava.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* `UPDATE trava SET epoca='abc'` falha; passar para PC revogado devolve `destino_sem_acesso`.
  *Origem:* cartmel-1.5 · PR #27 · qa

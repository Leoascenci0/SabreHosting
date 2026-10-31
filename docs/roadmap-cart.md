# Roadmap — Cartório (a fonte da verdade do grupo)

Objetivo: um serviço pequeno na nuvem que sabe qual é a versão mais nova do mundo, quem hospeda (trava com prazo e
época), quem tem cópia de qual versão, e guarda a última cópia do mundo.

**Sigla `cart`.** Ramos `roadmap/cart-<id>`. Código em `services/cartorio/` (Node + Fastify + SQLite) e o cliente em
`packages/nucleo/src/cartorio/`. Leitura obrigatória: `qualidade-sabre › integridade` §1 e `seguranca` §2; skill
`sysdesign-consistency-coordination`. Todo item é RISCO alto.

## Bloco 1 — Núcleo do cartório

- [x] **1.1 — Serviço, banco e autenticação por token** (PR #15, 30/10/2026)
  *O que fazer:* Fastify escutando só na rede privada; SQLite com migrações; PCs, tokens (hash guardado, nunca o
  token), convites de uso único com validade. Log sem segredos.
  *Arquivo:* `services/cartorio/src/`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: token inválido → 401; convite usado duas vezes → recusado.
  *Depende de:* base-1.1

- [x] **1.2 — Trava de host com prazo e época** (PR #22, 30/10/2026)
  *O que fazer:* pegar, renovar, passar (para migração) e soltar a trava, de forma atômica; época sobe a cada troca
  de dono; prazo e renovação configuráveis.
  *Arquivo:* `services/cartorio/src/trava.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste de corrida: 10 PCs disputando → um só ganha; prazo vencido libera; época velha recusada.
  *Depende de:* cart-1.1

- [x] **1.3 — Versões do mundo e quem tem cópia** (PR #32, 30/10/2026)
  *O que fazer:* registrar versão nova (exige trava + época atual + manifesto); responder "qual a mais nova" e "quem
  tem a versão N"; PCs informam a versão que têm.
  *Arquivo:* `services/cartorio/src/versoes.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: versão só cresce; envio sem trava recusado.
  *Depende de:* cart-1.2

- [x] **1.4 — Guardar a última cópia do mundo** (PR #58, 31/10/2026; servir regiões fica para o sync)
  *O que fazer:* receber delta/pacote da versão aceita, montar a cópia da nuvem (troca atômica), servir regiões para
  quem precisa; guardar alguns backups com rotação.
  *Arquivo:* `services/cartorio/src/armazem.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: queda no meio do envio deixa a cópia anterior intacta.
  *Depende de:* cart-1.3, bkp-1.2

- [x] **1.5 — Convite completo: dono, chave provisória e grupo** (PR #84, 31/10/2026; transporte do ajudante muda no rede-1.5)
  *Desenho aprovado:* `docs/superpowers/specs/2026-10-31-convite-do-grupo-design.md` §5.1, §5.2, §5.5–§5.7.
  *O que fazer:* coluna `dono` no PC; `POST /convites` só para PC dono (403 para os outros; sai o segredo de
  administrador), gera par provisório, reserva IP da sala de entrada pelo ajudante (rede-1.4) e devolve o texto
  `sabre://convite/1.…`; guarda hash do código, IP e chave pública provisória (nunca a privada). `POST /convites/usar
  {convite, chave_publica}` só do IP provisório, em duas fases (repetir com a mesma chave devolve o mesmo IP e token
  novo); `POST /convites/confirmar` do IP definitivo tira o provisório; `GET /grupo` → `{nome, endereco_jogar}`.
  Limpeza remove o peer provisório quando o convite vence. Comandos de root `criar-convite-dono` (recusa se já houver
  dono) e `trocar-dono`. Validade padrão 24 h, máx. 72 h.
  *Arquivo:* `services/cartorio/src/`, `packages/nucleo/src/cartorio/` (cliente)
  **Tela no app:** Configurações › Grupo › "Validade do convite" (a tela é do app-1.3).
  *Confirmação:* testes com ajudante falso: convite vencido remove o provisório; `usar` de outro IP → 401; PC não dono
  → 403; resposta perdida + repetição não encalha o PC; código, token e chave privada fora do banco e do log.
  *Depende de:* cart-1.1, rede-1.4 (contrato do ajudante; dá para começar com o falso)

## Bloco 2 — Cliente no app

- [x] **2.1 — Cliente do cartório no núcleo** (PR #41, 30/10/2026)
  *Nota da revisão do cart-1.2 (PR #22):* o cliente conta o prazo pelo **próprio relógio** a partir do envio do pedido
  (nunca pelo `expiraEm` do servidor); a identidade da trava é o PC, então o cliente guarda a época que **ele** ganhou
  e nunca adota a época devolvida numa recusa (senão um processo zumbi do mesmo PC renovaria).
  *O que fazer:* cliente tipado com novas tentativas e tempo-limite; token no cofre do sistema (`safeStorage`); renovação
  automática da trava com aviso quando falhar.
  *Arquivo:* `packages/nucleo/src/cartorio/`
  **Tela no app:** não se aplica.
  *Confirmação:* testes contra o cartório real em memória: renovação para → trava expira → servidor é parado com save.
  *Depende de:* cart-1.2

- [ ] **2.2 — Instalar o cartório na máquina da nuvem**
  *O que fazer:* serviço systemd, backup diário do SQLite, atualização por script; tutorial.
  *Arquivo:* `infra/vps/cartorio/`, `docs/tutoriais/cart-instalar.md`
  **Tela no app:** não se aplica.
  *Confirmação:* contêiner de teste; depois o Eliel instala. **[P: máquina real]**
  *Depende de:* cart-1.4, rede-1.2

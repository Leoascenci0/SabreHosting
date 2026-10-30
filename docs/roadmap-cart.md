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

- [ ] **1.4 — Guardar a última cópia do mundo**
  *O que fazer:* receber delta/pacote da versão aceita, montar a cópia da nuvem (troca atômica), servir regiões para
  quem precisa; guardar alguns backups com rotação.
  *Arquivo:* `services/cartorio/src/armazem.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: queda no meio do envio deixa a cópia anterior intacta.
  *Depende de:* cart-1.3, bkp-1.2

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

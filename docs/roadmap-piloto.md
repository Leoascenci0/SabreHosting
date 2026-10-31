# Roadmap — Piloto (o grupo do Eliel larga a hospedagem paga)

Objetivo: migrar o mundo atual da hospedagem paga, jogar algumas semanas no SabreHosting e só então cancelar a
hospedagem.

**Sigla `piloto`.** Ramos `roadmap/piloto-<id>`. Quase tudo aqui é **P** (precisa do Eliel e dos amigos).

- [x] **1.1 — Importar o mundo da hospedagem atual** *(código e tutorial prontos: 1.1a PR #177, 1.1b PR #184 (level.dat), 1.1c PR #189 (tela Backups › Importar mundo + `docs/tutoriais/piloto-importar.md`). Falta só a Confirmação com o mundo real, que é **P** do Eliel. O mundo importado ainda não chega sozinho ao host: depende do sync-2.1b)*
  *O que fazer:* ferramenta que importa um zip/pasta de mundo baixado da hospedagem (checa versão do Minecraft,
  plugins, tamanho), gera a versão 1 no cartório; tutorial de como baixar o mundo do painel da hospedagem.
  *Arquivo:* `packages/nucleo/src/importar.ts`, `docs/tutoriais/piloto-importar.md`
  **Tela no app:** Backups › "Importar mundo".
  *Confirmação:* importar um mundo de teste; depois o real. **[P: baixar o mundo real]**
  *Depende de:* cart-1.4, app-2.1

- [ ] **1.2 — Pré-gerar o mapa e afinar o servidor**
  *O que fazer:* rodar Chunky com raio escolhido; ajustar distâncias e RAM pela nota do PC mais forte.
  *Arquivo:* `docs/tutoriais/piloto-afinar.md`
  **Tela no app:** Configurações › Servidor.
  *Confirmação:* TPS 20 estável com o grupo jogando. **[P: sessão com amigos]**
  *Depende de:* piloto-1.1

- [ ] **1.3 — Semanas de piloto e decisão de cancelar a hospedagem**
  *O que fazer:* checklist de 2 semanas (trocas, quedas, backups conferidos); relatório final com números.
  *Arquivo:* `docs/tutoriais/piloto-relatorio.md`
  **Tela no app:** não se aplica.
  *Confirmação:* o Eliel decide cancelar a hospedagem. **[P: decisão do Eliel]**
  *Depende de:* piloto-1.2, migra-3.1

# Roadmap de melhoria — App

Melhorias achadas durante os itens do `docs/roadmap-app.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `appmel`.** Ramos `roadmap/appmel-<id>`. Entram nas próximas ondas, depois das correções e da segurança.

## Bloco 1 — Janela e bandeja

- [ ] **1.1 — Ícone próprio para a bandeja**
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

- [ ] **1.4 — Endereço vindo da configuração do grupo** (absorvido pelo app-1.3, desenho de 31/10/2026: `GET /grupo`)
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


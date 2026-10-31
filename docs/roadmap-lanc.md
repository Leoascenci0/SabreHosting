# Roadmap — Lanc (launcher: Prism agora, próprio depois)

Objetivo: o amigo clica em **Jogar** no SabreHosting e o jogo abre já na versão certa, com os mods do grupo e conectado ao
servidor. Primeiro integrando ao **Prism Launcher** (que faz o login da Microsoft); depois, um launcher próprio do
SabreHosting, que depende da aprovação da Microsoft.

Decisão do Eliel (30/10/2026): "Prism agora, próprio depois".

**Sigla `lanc`.** Ramos `roadmap/lanc-<id>`. Código em `packages/nucleo/src/launcher/` e telas em `apps/desktop/`.

**Regras deste roadmap:**
- **Licença:** o Prism é GPL-3.0 e o SabreHosting é MIT. **Nunca copiar código do Prism** (nem trechos): estudar só o
  comportamento e os formatos documentados (pasta de instância, `.mrpack`, linha de comando).
- **Conta:** login sempre pela Microsoft; nada de conta "offline"/pirata, nem como opção escondida.
- **Token do jogador** nunca sai do PC dele e nunca vai para log, cartório ou git.
- Comandos e formatos do Prism mudam entre versões: cada item confere na documentação oficial da versão atual e fixa
  a versão mínima suportada.

## Bloco 1 — Integração com o Prism (marco M3)

- [x] **1.1 — Achar o Prism no PC** (PR #36, 30/10/2026)
  *O que fazer:* detectar se o Prism está instalado (caminhos padrão no Windows e o escolhido pelo amigo), qual versão
  e onde fica a pasta de instâncias; sem Prism, mostrar o link oficial de download.
  *Arquivo:* `packages/nucleo/src/launcher/prism.ts`
  **Tela no app:** Configurações › Geral › "Pasta do Prism" (automático por padrão).
  *Confirmação:* testes com pastas falsas (instalado, ausente, versão antiga demais).
  *Depende de:* base-1.1

- [x] **1.2 — Instância do grupo no Prism** (PR #57, 30/10/2026; conferência no Prism real pendente [P])
  *O que fazer:* criar e manter atualizada uma instância "SabreHosting — <grupo>" com a versão do Minecraft e o loader do
  servidor (vindos do cartório), pelo formato de instância ou importação `.mrpack` documentados. Nunca mexer nas
  outras instâncias do amigo.
  *Arquivo:* `packages/nucleo/src/launcher/instancia.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste gera a instância numa pasta falsa; conferência manual no Prism real. **[P: teste no PC]**
  *Depende de:* lanc-1.1, cart-1.3 · D1 e D5 decididas (loader NeoForge)

- [x] **1.3 — Botão Jogar abre o jogo já conectado** (PR #206, 31/10/2026; código+teste; **[P: conferir no PC com Prism real]**; ligação em depsReais = lancmel-2.2)
  *O que fazer:* chamar o Prism pela linha de comando para abrir a instância do grupo e entrar direto no endereço do
  proxy; se o Prism estiver aberto, reaproveitar.
  *Arquivo:* `packages/nucleo/src/launcher/abrir.ts`, `apps/desktop/src/telas/inicio.*`
  **Tela no app:** não se aplica.
  *Confirmação:* teste com executável falso confere os argumentos; no PC, o jogo abre no servidor. **[P: teste no PC]**
  *Depende de:* lanc-1.2, app-1.2, rede-2.1

- [x] **1.4 — Mods do grupo iguais para todos** (PR #210, 31/10/2026; cartório + núcleo; a tela "Mods do grupo" e a ligação no app = lancmel-2.1)
  *O que fazer:* lista de mods do grupo (nome, versão, hash) guardada no cartório; o SabreHosting baixa do Modrinth com hash
  conferido e coloca na instância e no servidor (mods Fabric rodam pelo Sinytra Connector, D5).
  *Arquivo:* `packages/nucleo/src/launcher/mods.ts`
  **Tela no app:** Configurações › Grupo › "Mods do grupo" (só o dono do grupo edita).
  *Confirmação:* teste: hash errado recusado; mod removido da lista sai da instância.
  *Depende de:* lanc-1.2 · D5 decidida (o grupo usa mods)

## Bloco 2 — Launcher próprio do SabreHosting (marco M6, depende da Microsoft)

- [ ] **2.1 — Pedir a aprovação da Microsoft**
  *O que fazer:* tutorial para o Eliel cadastrar o app no Azure e preencher o formulário de acesso às APIs do
  Minecraft; política de privacidade do SabreHosting (exigência comum desses cadastros). Começa cedo, em paralelo ao M3,
  porque a resposta pode demorar.
  *Arquivo:* `docs/tutoriais/lanc-aprovacao-microsoft.md`, `docs/privacidade.md`
  **Tela no app:** não se aplica.
  *Confirmação:* pedido enviado; resposta registrada em `DECISOES.md`. **[P: conta e cadastro do Eliel]**
  *Depende de:* —

- [ ] **2.2 — Login da Microsoft no SabreHosting**
  *O que fazer:* login pelo código de dispositivo (MSAL), token guardado no cofre do sistema e renovado sozinho;
  nada de senha digitada no SabreHosting.
  *Arquivo:* `packages/nucleo/src/launcher/conta.ts`
  **Tela no app:** Configurações › Conta › "Entrar com a Microsoft".
  *Confirmação:* login real com a conta do Eliel. **[P: só depois da aprovação]**
  *Depende de:* lanc-2.1 (aprovado), app-2.2

- [x] **2.3 — Baixar e montar a versão do jogo** (✅ parcial PR #240, 31/10/2026: montar.ts com download simulado; versão real no PC e extração do Java ⏸️ P)
  *O que fazer:* a partir do manifesto oficial de versões, baixar cliente, bibliotecas, assets e Java com hash conferido,
  em cache compartilhado; nada distribuído pelo SabreHosting.
  *Arquivo:* `packages/nucleo/src/launcher/montar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste com manifesto falso; versão real montada no PC. **[P: teste no PC]**
  *Depende de:* base-1.1

- [ ] **2.4 — Abrir o jogo pelo SabreHosting e escolher o launcher**
  *O que fazer:* iniciar o jogo com a conta e a versão montadas, já conectado; opção de continuar usando o Prism.
  *Arquivo:* `packages/nucleo/src/launcher/iniciar.ts`
  **Tela no app:** Configurações › Geral › "Abrir o jogo com: Prism | SabreHosting".
  *Confirmação:* o Eliel joga pelo launcher do SabreHosting. **[P: teste no PC]**
  *Depende de:* lanc-2.2, lanc-2.3

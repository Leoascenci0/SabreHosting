# Roadmap — App (o que o amigo vê)

Objetivo: um app simples no Windows: fica na bandeja, um botão grande (Jogar ou Hospedar), status claro, backups e
configurações, instalador e atualização automática.

**Sigla `app`.** Ramos `roadmap/app-<id>`. Código em `apps/desktop/`. Leitura obrigatória: `qualidade-sabre ›
interface`; skill `impeccable` (`audit` e `polish` antes de entregar). Item de tela nunca vai na mesma onda que outro
item da mesma tela.

## Bloco 1 — Casca

- [x] **1.1 — Janela, bandeja e design system** (PR #70, 31/10/2026; confirmação no Windows pendente)
  *O que fazer:* Electron com janela única, ícone na bandeja, iniciar com o Windows (opcional), tokens de cor/espaço
  claro e escuro, `docs/design-system.md` curto. Ponte segura tela ↔ núcleo (`contextIsolation`, sem `nodeIntegration`).
  *Arquivo:* `apps/desktop/src/`, `docs/design-system.md`
  **Tela no app:** Configurações › Geral › "Abrir com o Windows".
  *Confirmação:* teste E2E (Playwright para Electron) abre a janela; `audit` do impeccable sem crítico.
  *Depende de:* base-1.1 · D4 decidida (ícone em apps/desktop/recursos/icone/)

- [ ] **1.2 — Tela inicial: Jogar / Hospedar e status**
  *O que fazer:* estado vindo do núcleo/cartório: "Servidor no PC do X" + Jogar (copia o endereço / abre o launcher);
  "Ninguém hospedando" + Hospedar; progresso em toda ação demorada.
  *Arquivo:* `apps/desktop/src/telas/inicio.*`
  **Tela no app:** não se aplica.
  *Confirmação:* E2E com núcleo falso nos 4 estados.
  *Depende de:* app-1.1, host-2.1

- [ ] **1.3 — Primeira vez: convite, EULA e pasta**
  *O que fazer:* assistente de 3 passos: colar convite do grupo, aceitar o EULA do Minecraft (link oficial), escolher
  a pasta dos mundos.
  *Arquivo:* `apps/desktop/src/telas/boas-vindas.*`
  **Tela no app:** este item é a própria tela.
  *Confirmação:* E2E: sem aceite do EULA não avança.
  *Depende de:* app-1.1, host-1.2, cart-2.1

## Bloco 2 — Backups e configurações

- [ ] **2.1 — Tela de backups e restaurar**
  *O que fazer:* lista (data, tamanho, de quem), restaurar com confirmação que diz nome e data.
  *Arquivo:* `apps/desktop/src/telas/backups.*`
  **Tela no app:** este item é a própria tela.
  *Confirmação:* E2E: cancelar não muda nada; confirmar chama `restaurar` do núcleo.
  *Depende de:* app-1.1, bkp-2.2

- [ ] **2.2 — Tela de configurações**
  *O que fazer:* reunir os campos criados nos outros itens (Geral, Servidor, Backups, Grupo), com valores padrão e
  validação.
  *Arquivo:* `apps/desktop/src/telas/configuracoes.*`
  **Tela no app:** este item é a própria tela.
  *Confirmação:* E2E: valor inválido não salva; valor salvo chega ao núcleo.
  *Depende de:* app-1.1

## Bloco 3 — Distribuição

- [ ] **3.1 — Instalador Windows e versão no GitHub Releases**
  *O que fazer:* electron-builder (NSIS) gerado no GitHub Actions (runner Windows) ao criar tag; checksums publicados.
  *Arquivo:* `.github/workflows/versao.yml`, `apps/desktop/electron-builder.*`
  **Tela no app:** não se aplica.
  *Confirmação:* tag de teste gera o instalador; o Eliel instala num PC. **[P: teste no PC]**
  *Depende de:* app-1.2, base-1.2

- [ ] **3.2 — Atualização automática assinada**
  *O que fazer:* app confere versão nova no GitHub Releases, baixa, confere assinatura/hash e instala ao fechar.
  *Arquivo:* `apps/desktop/src/atualizar.*`
  **Tela no app:** Configurações › Geral › "Atualizar sozinho".
  *Confirmação:* versão de teste 0.0.1 → 0.0.2 no PC. **[P: certificado/assinatura, ESPERA DECISÃO D9]**
  *Depende de:* app-3.1

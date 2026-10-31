# Roadmap — App (o que o amigo vê)

Objetivo: um app simples no Windows: fica na bandeja, um botão grande (Jogar ou Hospedar), status claro, backups e
configurações, instalador e atualização automática.

**Sigla `app`.** Ramos `roadmap/app-<id>`. Código em `apps/desktop/`. Leitura obrigatória: `qualidade-sabre ›
interface`; skill `impeccable` (`audit` e `polish` antes de entregar). Item de tela nunca vai na mesma onda que outro
item da mesma tela.

## Bloco 1 — Casca

- [x] **1.1 — Janela, bandeja e design system** (PR #70, 31/10/2026; confirmado no Windows 11 pelo Eliel em 31/10: janela, tema escuro, ícone na bandeja, fechar esconde; "Abrir com o Windows" ainda sem tela)
  *O que fazer:* Electron com janela única, ícone na bandeja, iniciar com o Windows (opcional), tokens de cor/espaço
  claro e escuro, `docs/design-system.md` curto. Ponte segura tela ↔ núcleo (`contextIsolation`, sem `nodeIntegration`).
  *Arquivo:* `apps/desktop/src/`, `docs/design-system.md`
  **Tela no app:** Configurações › Geral › "Abrir com o Windows".
  *Confirmação:* teste E2E (Playwright para Electron) abre a janela; `audit` do impeccable sem crítico.
  *Depende de:* base-1.1 · D4 decidida (ícone em apps/desktop/recursos/icone/)

- [x] **1.2 — Tela inicial: Jogar / Hospedar e status** (PR #74, 31/10/2026; modo demonstração conferido no Windows pelo Eliel em 31/10: Hospedar e Jogar)
  *O que fazer:* estado vindo do núcleo/cartório: "Servidor no PC do X" + Jogar (copia o endereço / abre o launcher);
  "Ninguém hospedando" + Hospedar; progresso em toda ação demorada.
  *Arquivo:* `apps/desktop/src/telas/inicio.*`
  **Tela no app:** não se aplica.
  *Confirmação:* E2E com núcleo falso nos 4 estados.
  *Depende de:* app-1.1, host-2.1

- [x] **1.3 — Primeira vez: convite, EULA e pasta** (1.3a #207 · 1.3b #211 · 1.3c-i #217 · 1.3c-ii #218, 31/10/2026; **[P: assistente, UAC e túnel no Windows]**) *(corte de 31/10: 1.3a ✅ PR #207 parser+cofre · 1.3b ✅ PR #211 assistente · falta 1.3c: Criar convite/Validade/endereço só leitura e tirar SABRE_ENDERECO/SABRE_CARTORIO_TOKEN de deps-reais, ligando a pasta-base e `abrirJogo` (lancmel-2.2); absorve appmel-1.4)*
  *Desenho aprovado pelo Eliel em 31/10/2026:* `docs/superpowers/specs/2026-10-31-convite-do-grupo-design.md` (§5.2,
  §5.3, §6). Junta o appmel-1.4 (endereço do Jogar vem do cartório, fim do `SABRE_ENDERECO`).
  *O que fazer:* assistente de 3 passos. (1) **Convite:** colar o texto `sabre://convite/1.…` (ou abrir pelo link,
  registrando o `sabre://` no Windows); conferir formato e prazo antes de tudo; gerar a chave própria do PC; **um**
  pedido de administrador que instala o túnel provisório, chama `usar`, regrava o túnel com a chave própria e confirma;
  token no **cofre real** (`safeStorage`, implementando a interface `Cofre`); sem cofre, recusa e explica; depois
  `GET /grupo` dá nome e endereço do Jogar. (2) **EULA** do Minecraft (link oficial; núcleo pronto em `configurar.ts`).
  (3) **Pasta-base** (padrão `%LOCALAPPDATA%\SabreHosting`, com `servidor\` e `mundos\`). No PC do **dono**: botão
  "Criar convite" (nome do PC, validade) que mostra o texto com "Copiar" e o prazo. `deps-reais.ts` deixa de ler
  endereço e token do ambiente.
  *Arquivo:* `apps/desktop/src/ui/boas-vindas.*`, `apps/desktop/src/main/boas-vindas.ts`, `apps/desktop/src/main/cofre.ts`,
  `apps/desktop/src/main/deps-reais.ts`, `packages/nucleo/src/rede/convite.ts` (ler e validar o texto)
  **Tela no app:** este item é a própria tela; Configurações › Grupo › "Criar convite" e "Validade do convite" (só o
  dono); Configurações › Grupo › "Endereço do servidor" (só leitura); Configurações › Geral › "Pasta do SabreHosting".
  *Confirmação:* E2E com cartório falso: convite vencido, torto ou usado → mensagem clara e nada muda; sem aceite do
  EULA não avança; sem cofre não guarda token; texto do convite nunca aparece no log. **[P: prova real no PC Windows —
  pedido de administrador e túnel]**
  *Depende de:* app-1.1, host-1.2, cart-2.1, **cart-1.5**, **rede-1.4**

## Bloco 2 — Backups e configurações

- [x] **2.1 — Tela de backups e restaurar** (PR #157, 31/10/2026; 'De quem' = "Este PC"; Windows real ainda não conferido)
  *O que fazer:* lista (data, tamanho, de quem), restaurar com confirmação que diz nome e data.
  *Arquivo:* `apps/desktop/src/telas/backups.*`
  **Tela no app:** este item é a própria tela.
  *Confirmação:* E2E: cancelar não muda nada; confirmar chama `restaurar` do núcleo.
  *Depende de:* app-1.1, bkp-2.2

- [x] **2.2 — Tela de configurações** (PR #160, 31/10/2026; corte: Geral + Servidor; o resto vira appmel 1.7–1.9)
  *O que fazer:* reunir os campos criados nos outros itens (Geral, Servidor, Backups, Grupo), com valores padrão e
  validação.
  *Arquivo:* `apps/desktop/src/telas/configuracoes.*`
  **Tela no app:** este item é a própria tela.
  *Confirmação:* E2E: valor inválido não salva; valor salvo chega ao núcleo.
  *Depende de:* app-1.1

## Bloco 3 — Distribuição

- [x] **3.1 — Instalador Windows e versão no GitHub Releases** (✅ configuração PR #241, 31/10/2026; primeira tag de teste e instalação no PC Windows ⏸️ P; versão do app está em 0.0.0 e precisa subir antes da 1ª tag)
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

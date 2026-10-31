# Roadmap de melhoria — Launcher (2ª leva)

Melhorias achadas durante os itens do `docs/roadmap-lanc.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `lancmel`.** Ramos `roadmap/lancmel-<id>`. Nunca copiar código do Prism (GPL-3.0). A 1ª leva (1.1) está em `docs/concluidos/roadmap-lanc-melhoria.md`.

## Bloco 2 — Depois do lanc-1.3 e do lanc-1.4

- [x] **2.1 — Tela "Mods do grupo" e ligar `sincronizarMods` no app** (PR #215, 31/10/2026; lado do jogo depende do 2.2)
  *O que fazer:* tela para o dono editar a lista de mods (GET/PUT `/grupo/mods` já existem); ligar `sincronizarMods` (instância do Prism e pasta mods do servidor) no arranque e ao mudar a lista, com estado "Atualizando mods…".
  *Arquivo:* `apps/desktop/src/ui/`, `apps/desktop/src/main/`, `packages/nucleo/src/launcher/mods.ts`
  **Tela no app:** Configurações › Grupo › "Mods do grupo" (só o dono edita).
  *Confirmação:* e2e com cartório falso: dono edita, amigo vê a lista; não-dono não edita.
  *Origem:* lanc-1.4 · PR #210 · filha

- [x] **2.2 — Ligar `abrirJogo` em `depsReais` (com o app-1.3c)** (PR #217, 31/10/2026; **[P: Jogar abre o Prism no PC]**)
  *O que fazer:* o botão Jogar só copia o endereço até `abrirJogo` ser ligado em `deps-reais.ts` com `detectarPrism`, id da instância e endereço do grupo. Derivar `pastaMarcador` e `idInstancia` da MESMA instância (hoje o chamador passa as duas e `abrirJogo` não prova que combinam).
  *Arquivo:* `apps/desktop/src/main/deps-reais.ts`, `packages/nucleo/src/launcher/abrir.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* no PC, Jogar abre o Prism no servidor **[P]**; teste: ids que não combinam são recusados.
  *Origem:* lanc-1.3 · PR #206 · qa

- [x] **2.3 — Download de mod: recusar redirecionamento para outro host e não apagar o mod antes de baixar o novo** (PR #221, 31/10/2026)
  *O que fazer:* `baixarConferido` ganha opção `hostsPermitidos` (usada por `mods.ts`) e recusa redirect para host fora da lista; o arquivo local de mesmo nome só sai depois do novo estar conferido. Teste de redirect.
  *Arquivo:* `packages/nucleo/src/servidor/baixar.ts`, `packages/nucleo/src/launcher/mods.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: redirect para outro host recusado; falha no download mantém o mod antigo.
  *Origem:* lanc-1.4 · PR #210 · qa

- [x] **2.4 — Mods do grupo: limpar avisos antigos na tela** (PR #226, 31/10/2026)
  *O que fazer:* em `carregarMods` (`ui/configuracoes.ts`), `avisoMods` nunca é limpo quando o problema some e o `erroMods` de "Não consegui ler a lista…" fica depois de uma leitura bem-sucedida: limpar nos dois casos (sem apagar o erro de uma ação que acabou de falhar).
  *Arquivo:* `apps/desktop/src/ui/configuracoes.ts`
  **Tela no app:** Configurações › Grupo › "Mods do grupo".
  *Confirmação:* teste/e2e: aviso some quando a lista volta a carregar.
  *Origem:* lancmel-2.1 · PR #215 · qa

- [ ] **2.5 — Mods do grupo: leitura pós-ação não sobrescreve o erro da ação**
  *O que fazer:* no `catch` de `carregarMods`, não trocar a mensagem se `preservarMensagens` for `true` (a leitura que falha logo depois de uma ação com erro apaga o erro da ação).
  *Arquivo:* `apps/desktop/src/ui/configuracoes.ts`
  **Tela no app:** Configurações › Grupo › "Mods do grupo".
  *Confirmação:* E2E: leitura falhando logo após ação com erro mantém o erro da ação.
  *Origem:* lancmel-2.4 · PR #226 · filha

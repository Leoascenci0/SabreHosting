# Roadmap de melhoria — Launcher

Melhorias achadas durante os itens do `docs/roadmap-lanc.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `lancmel`.** Ramos `roadmap/lancmel-<id>`. Nunca copiar código do Prism (GPL-3.0).

## Bloco 1 — Integração com o Prism

- [x] **1.1 — Detecção e instância mais firmes** (PR #200, 31/10/2026; emoji e ENOENT já estavam prontos)
  *O que fazer:* comparar a versão completa do Prism (major.minor.patch) se o mínimo virar 8.x; marcador próprio da
  instância do SabreHosting (arquivo dentro da pasta) além do nome; cortar o nome do grupo sem partir emoji (par
  substituto); `readFile(...).catch` só para "não existe", repassando outros erros.
  *Arquivo:* `packages/nucleo/src/launcher/prism.ts`, `packages/nucleo/src/launcher/instancia.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso.
  *Origem:* lanc-1.1 · PR #36 e lanc-1.2 · PR #57 · qa

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

- [x] **2.5 — Mods do grupo: leitura pós-ação não sobrescreve o erro da ação** (PR #234, 31/10/2026)
  *O que fazer:* no `catch` de `carregarMods`, não trocar a mensagem se `preservarMensagens` for `true` (a leitura que falha logo depois de uma ação com erro apaga o erro da ação).
  *Arquivo:* `apps/desktop/src/ui/configuracoes.ts`
  **Tela no app:** Configurações › Grupo › "Mods do grupo".
  *Confirmação:* E2E: leitura falhando logo após ação com erro mantém o erro da ação.
  *Origem:* lancmel-2.4 · PR #226 · filha

- [x] **2.6 — Extrair o Java baixado e apontar o `javaw`** (✅ PR #246, 01/11/2026)
  *O que fazer:* `montar.ts` já baixa o zip do Java com hash conferido, mas não o extrai. Extrair para a pasta do cache (reusar o `yauzl` que já é dependência do núcleo e a regra de caminho de `importar.ts`; **sem dependência nova**), recusando entrada com `..`, caminho absoluto ou link simbólico (zip slip), extraindo para pasta temporária e renomeando só depois (regra 3), e gravar o caminho do `javaw` no marcador da instância.
  *Arquivo:* `packages/nucleo/src/launcher/montar.ts` (e arquivo novo `zip.ts` ao lado, se passar de ~80 linhas)
  **Tela no app:** não se aplica.
  *Confirmação:* teste com zip falso gerado no teste: extrai, acha o `javaw`, recusa `../fora` e caminho absoluto, e uma falha no meio não deixa pasta pela metade. Versão real do Java no PC **[P: junto do lanc-2.3]**.
  *Origem:* lanc-2.3 · PR #240 · filha

- [x] **2.7 — Montagem já marcada não relê o hash dos ~3 mil assets** (✅ PR #249, 01/11/2026; reaproveitamento do Java confere o `javaw`)
  *O que fazer:* quando `.montada.json` existe e confere com a versão pedida, pular a releitura de hash dos assets e das bibliotecas (só conferir que os arquivos existem e têm o tamanho do manifesto); sem o marcador, ou com tamanho diferente, rebaixa/reconfere como hoje. Depende do 2.6 (mesmo arquivo).
  *Arquivo:* `packages/nucleo/src/launcher/montar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste de cache: segunda montagem não chama o hash nem o download; arquivo com tamanho trocado volta a ser baixado.
  *Origem:* lanc-2.3 · PR #240 · filha (desempenho)

- [x] **2.8 — `javaw` reaproveitado precisa bater com o que foi extraído** (✅ PR #252, 01/11/2026)
  *O que fazer:* hoje, com `.java.json` presente, `extrairJava` (e o `stat` em `montar.ts`) só confere que o `javaw.exe` **existe**: um `javaw` trocado ou truncado seria executado. Gravar no `.java.json` o tamanho e o sha256 do `javaw` na extração; no reaproveitamento, reler esse arquivo (~100 KB, barato) e comparar; se não bater, ou se o marcador for antigo (sem hash), apagar a pasta e extrair de novo do zip (que já tem hash conferido).
  *Arquivo:* `packages/nucleo/src/launcher/zip.ts` (e o `stat` redundante em `montar.ts`)
  **Tela no app:** não se aplica.
  *Confirmação:* teste: `javaw` com 1 byte trocado ou truncado → extrai de novo e o arquivo volta ao original; marcador antigo sem hash → extrai de novo; intacto → não extrai (sem custo). Java real num PC **[P: junto do lanc-2.3]**.
  *Origem:* lancmel-2.6/2.7 · PR #246 (ressalva do qa) · Onda 34

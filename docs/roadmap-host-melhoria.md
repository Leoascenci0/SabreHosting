# Roadmap de melhoria — Host

Melhorias achadas durante os itens do `docs/roadmap-host.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `hostmel`.** Ramos `roadmap/hostmel-<id>`. Entram nas próximas ondas, depois das correções e da segurança.

## Bloco 1 — Baixar e preparar

- [x] **1.1 — Hashes fixados por versão** (PR #102, 31/10/2026; valores reais [P]: versão do Eliel)
  *O que fazer:* tabela de hashes (NeoForge, Java) por versão, conferida pelo grupo, em vez de confiar só no sidecar
  `.sha1` do mesmo servidor do arquivo (protege contra servidor comprometido).
  *Arquivo:* `packages/nucleo/src/servidor/resolvedores.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste com sidecar adulterado recusado pela tabela.
  *Origem:* host-1.1 · PR #12 · filha

- [x] **1.2 — Resolvedores mais rígidos e http local só por opção** (PR #106, 31/10/2026)
  *O que fazer:* resolvedores recusam URL que não seja https; regex da versão do NeoForge exige começar por dígito; a
  exceção http para localhost em `baixarConferido` vira opção injetada `permitirHttpLocal` (padrão falso).
  *Arquivo:* `packages/nucleo/src/servidor/resolvedores.ts`, `packages/nucleo/src/servidor/baixar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: `http://` recusado nos resolvedores e em localhost sem a opção; versão `..`/`-x` recusada.
  *Origem:* host-1.1 · PR #12 · filha + qa segurança

- [x] **1.3 — Testes de redirecionamento com sucesso e dos limites** (PR #109, 31/10/2026)
  *O que fazer:* testes que seguem um redirecionamento https até o fim, que estouram o limite de 5 saltos e que
  estouram o tempo total.
  *Arquivo:* `packages/nucleo/src/servidor/baixar.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* cada teste falha se a regra correspondente for removida.
  *Origem:* host-1.1 · PR #12 · qa

## Bloco 2 — Rodar o servidor

- [ ] **2.1 — Calibrar a nota do PC com PCs reais**
  *O que fazer:* rodar `medirPc` nos PCs dos amigos e ajustar `REFERENCIA`/`PESOS`; registrar a variação de upload e
  RAM livre em 3+ medições seguidas no README da pasta.
  *Arquivo:* `packages/nucleo/src/nota/formula.ts`, `packages/nucleo/src/nota/README.md`
  **Tela no app:** não se aplica.
  *Confirmação:* nota estável (±3 pontos) em 3 medições por PC e ordem coerente com a sensação dos amigos. **[P: PCs reais]**
  *Origem:* host-2.3 · PR #16 · filha

- [x] **2.2 — Workers da medição: corte e falha** (PR #139, 31/10/2026)
  *O que fazer:* teste do corte por tempo na fase de vários núcleos; ao um worker falhar, abortar os demais.
  *Arquivo:* `packages/nucleo/src/nota/medir.ts`, `packages/nucleo/src/nota/medir.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes terminam rápido e nenhum worker fica vivo.
  *Origem:* host-2.3 · PR #16 · filha + qa

- [x] **2.5 — Servidor órfão nunca fica solto** (PR #114, 31/10/2026; prova no Windows [P]) (prioridade alta: regra de ouro 1, antes da v0.1)
  *O que fazer:* se o app morre (fechado à força, queda) com o servidor no ar, o Java fica sem quem renove a trava; ela
  vence em ~60 s e outro PC pode hospedar com o órfão ainda rodando (dois hosts). Garantir que o órfão se encerre com
  `save-all flush` + `stop` quando perde o app (ex.: vigia ligado ao app por pipe/PID que pede o stop), e que o app, ao
  reabrir com órfão vivo nesta pasta, o assuma ou encerre com save antes de oferecer qualquer coisa. Nunca matar sem salvar
  se houver como salvar.
  *Arquivo:* `packages/nucleo/src/servidor/processo.ts`, `apps/desktop/src/main/` (deps-reais, inicio)
  **Tela no app:** não se aplica (aviso "encerrando o servidor anterior…" usa o estado já existente).
  *Confirmação:* testes: app morto → servidor falso recebe save e stop antes da trava vencer; reabrir com órfão vivo →
  encerra antes de oferecer Hospedar. Prova real no PC Windows [P].
  *Origem:* appmel-1.5 · PR #101 · filha + qa (alto)

## Bloco 1 (cont.) — Configuração do servidor

- [x] **1.4 — Testes que faltam na configuração e endurecimento** (PR #122, 31/10/2026; servidor só em 10.66.0.2–199)
  *O que fazer:* teste com `10.999.0.1` (octeto inválido) recusado — hoje apagar `octetosValidos` não derruba teste;
  gravar `enable-query=false` explícito; estreitar o IP aceito para a faixa da rede privada do WireGuard quando o
  rede-* a definir.
  *Arquivo:* `packages/nucleo/src/servidor/configurar.ts`, `packages/nucleo/src/servidor/configurar.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* remover `octetosValidos` faz um teste falhar; `server.properties` tem `enable-query=false`.
  *Origem:* host-1.2 · PR #20 · qa

- [x] **2.3 — Processo do servidor mais robusto** (PR #89, 31/10/2026)
  *O que fazer:* validar `javaPath` e `pasta` como caminhos absolutos; guarda contra duas chamadas de
  `iniciarServidor` na mesma pasta no mesmo PC; estado "pronto" só pela linha `Done (` vinda da thread do servidor (não
  do chat); evitar aviso duplo quando o Java não existe.
  *Arquivo:* `packages/nucleo/src/servidor/processo.ts`, `packages/nucleo/src/servidor/processo.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: caminho relativo recusado; segunda chamada na mesma pasta recusada; "Done (" no chat não muda
  o estado.
  *Origem:* host-2.1 · PR #24 · qa

- [x] **2.4 — Comandos ao servidor mais rígidos** (PR #99, 31/10/2026)
  *O que fazer:* `salvarSeguro` espera "Automatic saving is now disabled" antes do `save-all flush`; prazo também na
  função `copiar` (cópia travada não pode segurar o `save-on` para sempre); teto de tamanho em `enviar`; limite de
  comandos pendentes na fila; `say` recusa `§` (código de cor).
  *Arquivo:* `packages/nucleo/src/servidor/comandos.ts`, `packages/nucleo/src/servidor/processo.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: sem a confirmação do save-off a cópia não começa; cópia que passa do prazo leva ao `save-on`.
  *Origem:* host-2.2 · PR #30 · qa

## Bloco 3 — Versão do jogo escolhida pelo grupo

- [x] **3.1 — Qualquer versão do Minecraft, escolhida pelo dono** *(onda 24: 3.1a PR #180, 3.1b cartório PR #186, 3.1c tela PR #188, 3.1d NeoForge legado + `redirect:"error"` PR #185. **Pendente P:** sha1 do instalador do forge 1.20.1 em `HASHES_NEOFORGE` (Maven da NeoForged bloqueado na nuvem; nenhuma versão com mods hospedável até ser preenchida). Melhorias: backup automático antes de trocar a versão; tela mostrar "mods pendentes" enquanto a tabela estiver vazia)* (decisão do Eliel, 31/10/2026)
  *O que fazer:* lista de versões do Minecraft (da mais nova às antigas) vinda do manifesto oficial da Mojang; para cada
  uma, o que o servidor consegue rodar: NeoForge + Sinytra Connector (Fabric e Forge juntos), um loader só, ou sem mods.
  A versão escolhida vai para a configuração do grupo no cartório (todos os PCs usam a mesma); trocar de versão só com o
  servidor parado e backup feito antes. Hashes por versão (hostmel-1.1) e Java certo para cada versão.
  *Arquivo:* `packages/nucleo/src/servidor/`, `services/cartorio/src/`, `apps/desktop/src/ui/configuracoes.*`
  **Tela no app:** Configurações › Servidor › Versão (só o dono); padrão 1.21.1.
  *Confirmação:* teste: versão sem Connector não oferece Fabric+Forge; trocar versão com servidor rodando é recusado.
  *Depende de:* app-2.2 ✅ · pode virar 2–3 itens na triagem (nucleo, cartório, tela).

# Regras do projeto SabreHosting

App pessoal (sem venda) para o Eliel e os amigos jogarem Minecraft sem pagar hospedagem: o servidor roda no PC
mais forte que estiver online, o mundo fica salvo em todos os PCs e numa máquina na nuvem, e a troca de host
acontece sem derrubar ninguém. O desenho completo está em `docs/arquitetura.md`; leia antes de propor algo de peso.

O trabalho roda **em sessões do Claude Code na nuvem** (claude.ai/code). Regras herdadas do projeto SEURBH (SEGI)
e adaptadas aqui; o detalhe de cada regra mora na skill citada (só carrega quando usada). Este arquivo diz **o
quê** e **quando**. **O repositório SEURBH nunca é tocado por este projeto** (nem leitura para copiar código: ele é
de outro assunto).

## Como responder ao Eliel (dono do projeto)

- Começar com **"Resumo:"** em até 3 linhas: o que foi feito, o que falta, o que ele precisa decidir.
- Depois, no máximo 10 linhas. O detalhe vai num arquivo ou no PR, com o link.
- Uma decisão por vez, **em balão clicável** (`AskUserQuestion`, recomendada primeiro); nunca pergunta solta.
- Sem tabela grande e sem parágrafo de mais de 3 linhas no chat. Número sempre com a comparação
  ("4,1 GB de RAM, era 5,3 GB").
- pt-BR. O Eliel é engenheiro civil e não programa: explicar o porquê de decisão técnica nova como quem
  ensina, abrindo sigla e termo em inglês na primeira vez.

## Visão técnica

- **Peças** (detalhe em `docs/arquitetura.md`):
  - `apps/desktop` — o app que cada amigo instala (Electron + TypeScript): bandeja do Windows, botão Jogar/Hospedar,
    backups, configurações.
  - `packages/nucleo` — a lógica, sem tela (TypeScript puro, testável na nuvem): servidor Minecraft, backup,
    sincronização, trava de host, nota do PC, migração.
  - `services/cartorio` — o serviço pequeno que roda na máquina da nuvem (Node + SQLite): versão mais recente do
    mundo, quem tem cópia, quem hospeda (trava com prazo), última cópia do mundo.
  - `infra/vps` — o que roda na máquina da nuvem além do cartório: proxy Velocity, sala de espera (limbo), rede
    privada (WireGuard), scripts de instalação.
- **Comandos** (valem depois do item `base-1.1`): instalar `npm ci`; testes `npm test`; tipos e estilo
  `npm run lint`; **vistoria local** `npm run vistoria` (lint + testes + verificador); verificador
  `python3 scripts/verificar.py --base origin/main`; estado dos roadmaps `python3 scripts/estado_roadmaps.py`.
- **Vistoria local + CI:** antes de enviar ramo, rodar `npm run vistoria` e colar o resumo no PR. O repositório é
  público, então o GitHub Actions é gratuito: o CI roda a mesma vistoria em todo PR (inclusive de contribuidores).
- **Testar daqui, nunca esperar o CI (regra do Eliel, 31/10/2026):** a decisão de mergear vem da vistoria rodada
  **na própria sessão** (`npm run vistoria` num worktree do ramo com a `main` mesclada). Nunca esperar o check do
  GitHub ficar verde nem agendar aviso para isso; o CI é só uma conferência a mais. CI vermelho depois do merge vira
  correção imediata.
- **Correção de bug = regra + prova:** PR que corrige bug traz teste que **falhava antes e passa depois** e, se o erro
  pode voltar por outro caminho, ficha em `docs/memoria/solucoes.md`. Sem teste, o PR diz por quê e o `qa` reprova
  se faltar a linha `Regressão:`.
- **Regressão também é processo (regra do Eliel, 31/10/2026):** todo erro que eu descobrir e solucionar (no código, no
  teste ou no meu próprio jeito de trabalhar) vira ficha em `docs/memoria/solucoes.md` **e** uma linha em "Soluções
  conhecidas" abaixo, para eu me guiar e não repetir. E todo **roadmap 100% feito vai para `docs/concluidos/`** no PR de
  controle que fecha o último item (o `corr` fica: é a lista permanente de correções).
- **Padrões:** imitar o código vizinho; textos, nomes, commits e mensagens do app em pt-BR.

## Código aberto (decisão do Eliel, 30/10/2026)

- Repositório **público**, licença **MIT** (`LICENSE`). Qualquer pessoa pode usar, mudar e contribuir.
- **Genérico por grupo:** o app serve a qualquer grupo de amigos; nada do grupo do Eliel (nomes, IPs, tokens, endereço
  da máquina da nuvem) vai para o repositório. Tudo isso é configuração local ou do cartório de cada grupo.
- **Nenhum dado pessoal no git:** nem de amigos, nem do Eliel além do autor dos commits. Nada de saúde, endereço,
  telefone.
- **PR de contribuidor externo** (fork ou autor que não é o Eliel): a Máxima revisa e comenta, mas **não mergeia**;
  o merge é do Eliel. CI de PR externo roda sem segredos.
- Minecraft: o projeto **nunca distribui** o jar do servidor nem o Java; o app baixa da fonte oficial no PC do
  usuário, que aceita o EULA da Mojang na tela. Sem afiliação com a Mojang/Microsoft (dito no README).
- **Launcher:** o SabreHosting integra ao Prism Launcher (GPL-3.0) e depois terá launcher próprio. Nunca copiar código
  do Prism nem de outro projeto GPL: estudar só comportamento e formatos documentados. Conta só pela Microsoft,
  nunca "offline"/pirata. Detalhe em `docs/roadmap-lanc.md`.
- Arquivos da comunidade: `README.md`, `CONTRIBUTING.md`, `SECURITY.md` (falha de segurança se reporta em
  privado), `CODE_OF_CONDUCT.md`.

## Regras de ouro do mundo (o "banco de dados" deste projeto)

O mundo dos amigos é o dado mais valioso; estas regras valem acima de qualquer item:

1. **Um host por vez.** Só hospeda quem tem a trava do cartório, renovada a cada ~20 s; sem trava, o app não sobe
   o servidor. Nunca contornar a trava "para testar".
2. **Nunca copiar ou sincronizar a pasta do mundo com o servidor rodando.** Backup só depois de `save-off` +
   `save-all flush` (e `save-on` depois); o que viaja é um pacote fechado com hash.
3. **Troca atômica:** baixar para pasta temporária, conferir o hash, só então renomear. Nunca escrever por cima do
   mundo atual em pedaços.
4. **Nunca apagar o último backup bom.** Rotação apaga só o que está além do mínimo garantido; restaurar faz backup
   do estado atual antes.
5. **Versão manda:** só hospeda quem tem a versão que o cartório diz ser a mais nova. Versão velha atualiza primeiro.
6. **Teste com mundo inventado.** Testes usam mundos gerados para teste (`tests/mundos/`), nunca o mundo real dos
   amigos; nada de mundo real no repositório (`.gitignore` barra `*.mca`, `level.dat` fora de `tests/`).

Detalhe e receitas: skill `qualidade-sabre` › `references/integridade.md`.

## Antes de escrever código: a skill `qualidade-sabre`

Toda tarefa de código e toda revisão invocam **uma** skill, `qualidade-sabre`: ela traz o checklist comum e diz
qual parte detalhada (`references/*.md`) ler para o tipo da mudança.

| Quando | Parte | Os erros que mais se repetem |
|---|---|---|
| Mexe no mundo, backup, sync, trava ou migração de host | `integridade` | copiar com servidor rodando; escrever por cima sem hash; trava sem prazo; apagar o último backup |
| Rede, cartório, proxy, download, segredo | `seguranca` | porta aberta no PC do amigo; token no código; baixar jar sem conferir hash; aceitar comando do cartório sem autenticar |
| Servidor, Java, uso de RAM/CPU, transferência | `desempenho` | ler o mundo inteiro na memória; transferir o mundo inteiro quando só mudou uma região; travar a tela |
| Tela do app | `interface` | ação sem confirmação que apaga algo; termo técnico na tela; botão sem estado de "carregando" |
| Qualquer código ou revisão | `enxugar` | "enxugar" apagando validação, hash ou trava; enxugar e mudar comportamento no mesmo PR |

- **Triagem antes de escrever:** item de código passa pelo agente `triagem`, que escolhe o método mais curto
  (M1 reaproveitar … M7 código novo); escreve-se uma vez só (skill `maxima` › `references/triagem.md`).
- Todo relatório de código fecha com as linhas `Segurança:`, `Integridade:` e `Enxugamento:`.
- **Tudo configurável pelo app:** o que um amigo precisa ajustar (RAM, pasta, intervalo de backup, quem pode
  hospedar) se ajusta numa tela do app, nunca editando arquivo. Item que cria configuração traz a linha
  **Tela no app:** "Configurações › <Área> › <Campo>". Pergunta final: "um amigo consegue fazer isso só clicando?"
- **Trava automática:** `.githooks/pre-commit` roda `scripts/verificar.py --staged` em todo commit (segredo, mundo
  real, arquivo grande, commit na `main`). **Nunca `--no-verify`.**
- **Tetos** (`scripts/limites.json`: tamanho do instalador, RAM do app parado, tempo de troca de host) só descem.
  Subir teto exige linha em `docs/ops/DECISOES.md` e tirar outro peso no mesmo PR.

## Git e entrega

- Nunca commitar nem enviar na `main`; cada sessão trabalha no próprio ramo e envia só ele
  (`git push -u origin <ramo>`). Tudo entra por PR, inclusive BOARD, memória e roadmaps.
- Antes de cada commit: `git branch --show-current` e `git config user.email` = `asc.eliel@gmail.com` (com ponto).
  `git status` sujo, ramo divergente ou `[gone]`: parar e avisar.
- Nunca `--force`, nunca `--no-verify`. Atualizar com `pull --ff-only`.
- **Merge pela Skill Máxima:** ela mergeia depois da própria revisão (vistoria local + verificador + `qa`), um merge
  commit por PR, um por vez. Fora da Máxima, merge só com o "pode mergear" do Eliel.
- **Terminou a mudança: abra o PR sem perguntar** ("quer que eu abra o PR?" é proibido; pergunta só para decisão do
  Eliel).
- Cada tarefa vira issue pequena ligada ao item; o PR cita `Closes #n` ou `Refs #n` (skill `github-issue-pr-delivery`).
  Modelo de PR em `.github/pull_request_template.md`.
- **Versão para os amigos** (o "publicar" deste projeto): instalador novo só sai no fim de um milestone, pela Máxima,
  com o tutorial de teste em `docs/tutoriais/`. "Publicado" só com prova: o arquivo da versão baixa e o hash bate.
- **Sessão concorrente:** ramo `roadmap/*` remoto novo ou `main` divergente no `git fetch` quer dizer outra sessão
  ativa; avisar antes de gravar estado (BOARD, roadmap, memória).

## Orquestração (roadmaps e agentes)

- O Eliel entra pelo `/ceo` (skill `ceo`) ou pela `/maxima` (skill `maxima`): decide, delega e registra; **não
  implementa**. Agentes em `.claude/agents/` (`planejador`, `triagem`, `backend`, `frontend`, `qa`, `documentacao`,
  `implementador-roadmap`) devolvem retorno curto (≤10 linhas) e gravam o detalhe em `docs/ops/relatorios/T-NNN.md`.
  Toda tarefa de código passa pelo `qa`.
- Estado em arquivo, não no chat: `docs/MILESTONE.md` (o plano geral: em curso, fila, pendente do Eliel, backlog,
  feito), `docs/ops/BOARD.md` (fila do CEO), `docs/ops/DECISOES.md` (decisões, todos leem antes).
- **Roadmaps por etapa:** `docs/roadmap-<sigla>.md`, um por etapa; **cada item cabe num chat**. Siglas: `base`,
  `host`, `bkp`, `rede`, `cart`, `app`, `sync`, `migra`, `drive`, `piloto`, `lanc` (launcher), `corr` (correções). Melhoria achada
  durante um item vira item no `docs/roadmap-<sigla>-melhoria.md` (sigla `<sigla>mel`); a filha só descreve no PR.
- **Fila:** um orquestrador por vez; no máximo 1 PR de controle + 3 itens abertos. Item que pede decisão do Eliel
  nunca vai para agente.
- **Três níveis (regra do Eliel, 31/10/2026):** o chat aberto com `/maxima` (ou `/maxima retomar`) só **coordena**:
  abre uma **sessão de onda** por vez, e ela abre as sessões de item, revisa e mergeia. O coordenador lê só o relatório
  de ≤10 linhas de cada onda e passa o bastão a uma nova sessão coordenadora. Teto de contexto: meta **30%**, margem até
  **35%** para concluir a demanda em curso, até **40%** só para um item muito específico. Detalhe em
  `.claude/skills/maxima/references/coordenacao.md`.
- **Ondas visíveis na lista de chats (regra do Eliel, 31/10/2026):** o Eliel abre **só** o chat da Máxima (`/maxima
  retomar` ou continuar); debaixo dele nascem as ondas, e debaixo de cada onda os itens. A sessão de onda se chama `Onda <N>` (pode ter um resumo curto: `Onda 21 — convite no app`; sem lista de itens) e
  cada sessão de item `Item <k> · <sigla-id> — <título>` (k = 1, 2, 3… dentro da onda), criada **dentro** da sessão
  de onda (aparece aninhada debaixo dela) e com a
  etiqueta `maxima-onda-<N>`; o número da onda é único no projeto e cada onda aberta tem uma linha em
  `docs/MILESTONE.md` › Em curso. Bastão do coordenador: `Máxima continuar — <data> (<n>º bastão)`.
  Exemplo certo (aprovado pelo Eliel, 31/10): `Maxima retomar` › `Onda 20` › `Item 1 ·
  cartmel-1.1 — Revogar token de PC`, `Item 2 · app-2.1 — …`. **Errado:** o chat da Máxima virar a própria onda e abrir os
  itens direto debaixo dele (ex.: "Máxima — onda 58" com os itens): ele acumula o contexto de todos os itens.
- **Autonomia da Máxima:** sozinha ela revisa, mergeia e gera a versão de teste; toma decisão **reversível** de
  detalhe (texto de tela, ordem de botão) e relata ("decidi por você", com o PR para desfazer). **Fica com o Eliel:**
  regra do grupo (quem pode hospedar, quem entra), custo ou cadastro em serviço externo (máquina na nuvem, domínio),
  qualquer coisa que apague mundo ou backup, subir teto, mexer na máquina da nuvem de verdade.

### Regras do implementador (um item por sessão)

1. Um item (ou lote de 2–3 itens miúdos da triagem, um commit por item), no ramo `roadmap/<sigla>-<id>`, criado pelo
   commit-base exato do briefing.
2. Fora do alcance: `CLAUDE.md`, `.claude/`, `docs/roadmap-*.md`, `docs/MILESTONE.md`, `docs/agentes/` (exceto o
   próprio plano em `docs/agentes/planos/`).
3. Nunca acessar a máquina da nuvem de verdade, nem o mundo real dos amigos; teste com mundo inventado.
4. **Plano antes do código:** gravar o plano como primeiro commit; numa rodada da Máxima o "pode seguir" vem dado. O
   que o item manda "confirmar com o Eliel" não se decide: pergunta e espera.
5. Ficar nos arquivos que o item lista; nada de "aproveitar para melhorar": a melhoria vai para a seção
   "Melhorias encontradas" do PR.
6. Antes de entregar, `npm run vistoria` dá APROVADA. Relatório diz só o que foi checado; "funciona" só depois da
   *Confirmação* (num PC Windows de verdade, quando o item pede).

## Modelo e custo

Sonnet/medium é o padrão; Haiku para o simples; **Opus só com gatilho dito na resposta**: decisão de arquitetura,
lógica de trava/migração de host, segurança da rede, ou 2 falhas verificadas em Sonnet/high. Volume de leitura vai
para subagente barato. Fechar com `Roteamento: <classe>/<risco> → <modelo>·<esforço> | gatilho Opus: …`
(skill `roteador-modelo-esforco`).

## Memória

- Ler `docs/memoria/INDEX.md` no início da sessão e antes de propor algo de peso; se a proposta divergir, dizer.
- Correção ou abordagem confirmada pelo Eliel entra em `docs/memoria/` no PR aberto (a memória da nuvem some com
  o contêiner). Atualizar em vez de duplicar. Ideia descartada vai para `docs/memoria/visao.md` com o porquê.
- Relatório de fim de item diz o que **não** pôde ser verificado; lacuna achada vira item no BOARD.

## Soluções conhecidas (erro já resolvido; fichas em `docs/memoria/solucoes.md`)

Bateu num erro: `grep -i "<trecho da mensagem>" docs/memoria/solucoes.md` antes de depurar. Erro consertado no teste
de fim de item vira ficha lá (a filha descreve no PR, seção "Soluções"; a Máxima consolida no merge e promove para cá
o que se repete). No máximo 10 linhas:

- **S-02** `git merge` da `main` com CONFLICT (em geral no fim do `docs/ops/DECISOES.md`): resolver ANTES de editar ou
  commitar; o verificador barra marcador de conflito desde o basemel-1.4.
- **S-01** teste passa sozinho e falha com a máquina ocupada (trava, arquivos grandes): é tempo curto demais no teste,
  não no código; folga medida ou prazo explícito só no teste, nunca afrouxar o que ele prova. Não rode 2 vistorias juntas.
- **S-03** vistoria verde na sessão e check vermelho no GitHub: a sessão roda como root e o CI não. Item que mexe em
  `infra/` ou `tests/infra/` roda os testes também como usuário comum (`useradd -m teste`; `su teste -c ...`).
- **S-04** mergear antes da filha terminar o último pedido deixa commit fora da `main` (#128→#138): só mergear depois
  do aviso de "pronto" da filha, e conferir `git log origin/main..origin/<ramo>` vazio depois do merge.
- **S-05** worktree com `node_modules` em atalho da pasta principal dá `Cannot find module '@sabrehosting/...'`: rode
  `npm ci` no próprio worktree.

## Skills sob demanda

O catálogo (`Leoascenci0/skills`) fica fora do repositório. Quando um item pedir, `add_repo` + `git clone --depth 1`
e `bash .claude/ativar-skill.sh <nome ou prefixo>` copia **só a pasta** para `.claude/skills/` no ramo do item,
dizendo na resposta. Já mapeadas para este projeto: `secrets-management` (tokens do cartório), `error-handling-patterns`,
`architecture-decision-records`, `e2e-testing-patterns` (app desktop), `github-actions-templates` (instalador),
`debugging-strategies`, `code-review-excellence`. Já no projeto: `sysdesign-consistency-coordination` (trava e
versão), `sysdesign-resilience-failure` (host que cai), `impeccable` (método de interface).

## Ganchos de início

`.claude/settings.json` roda `configurar-git-nuvem.sh` (autor e trava do pre-commit) e `preparar-nuvem.sh`
(`npm ci` quando já houver `package.json`). Se algum disser FALHA, avisar antes de commitar ou testar.

<!-- BEGIN superpowers (adaptado do SEURBH; fonte de verdade: repo Leoascenci0/skills) -->
## Fluxo de desenvolvimento (Superpowers)

Skills de processo em `.claude/skills/` (origem: obra/superpowers, MIT).

- No texto dessas skills, `superpowers:nome` significa a skill `nome` deste projeto.
- **Tarefa de código** (funcionalidade, correção, refatoração): antes de agir, carregar `using-superpowers` e seguir
  a skill de processo que se aplica. Pergunta de bate-papo ou conceitual não dispara o fluxo.
- Ordem padrão: `brainstorming` (desenho aprovado) → `writing-plans` (plano em `docs/agentes/planos/<sigla>-<id>.md`)
  → `executing-plans` ou `subagent-driven-development` → `verification-before-completion` →
  `finishing-a-development-branch`.
- Bug ou falha de teste: `systematic-debugging` (causa raiz antes de corrigir). Código novo: `test-driven-development`.
- Não declarar "pronto" sem rodar a verificação e mostrar a evidência.
- **Limites:** as regras deste `CLAUDE.md` vencem qualquer skill. Nunca commitar direto na branch principal. Não usar
  bypass de permissões. Mexer na máquina da nuvem de verdade, gerar versão para os amigos e apagar mundo ou backup
  exigem autorização registrada.
<!-- END superpowers -->

<!-- BEGIN orquestrador-ceo (gerado por skills/orquestrador-ceo; editar lá e reaplicar) -->
## Fluxo de trabalho com agentes (orquestração)

- O usuário interage pelo comando `/ceo` (skill em `.claude/skills/ceo/`). O CEO decide, delega e registra; **não implementa**.
- Agentes especialistas em `.claude/agents/`: `planejador`, `backend`, `frontend`, `qa`, `documentacao`. Cada um roda com contexto próprio e recebe só o briefing da sua tarefa.
- Estado do trabalho vive em arquivos versionados, não no chat:
  - `docs/ops/BOARD.md` — fila e status das tarefas (só o CEO edita)
  - `docs/ops/DECISOES.md` — decisões do usuário, uma por linha (todos leem antes de começar)
  - `docs/ops/relatorios/T-NNN.md` — relatório completo de cada tarefa (escrito pelo agente)
- Todo agente devolve ao CEO apenas um **retorno curto** (≤10 linhas) e grava o detalhe no relatório.
- Nenhum agente faz deploy, push, merge na branch principal, alteração destrutiva de banco ou instala dependência nova sem autorização registrada em DECISOES.md.
- Toda tarefa de código passa pelo agente `qa` antes de ser marcada como feita.
- Sessão em nuvem: o board e as decisões só persistem se forem commitados. O CEO commita `docs/ops/` ao fechar o ciclo (`/ceo fechar`), na branch de trabalho, nunca direto na principal.
<!-- END orquestrador-ceo -->

# Coordenação em três níveis (parte da skill `maxima`)

Criada em 31/10/2026 depois da rodada da madrugada: um chat só fez 33 itens (triagem, briefing, vistoria, revisão e
merge de todos) e terminou com **68% de contexto** e custo de **US$ 43**, mais que as 31 filhas juntas (US$ 36). Regra
do Eliel: o chat coordenador abre **sessões de onda**, e cada sessão de onda abre as **sessões de item**. Nenhum chat
acumula o trabalho da noite inteira.

## Os três níveis

| Nível | Quem é | Faz | Nunca faz | Modelo |
|---|---|---|---|---|
| **1. Coordenador** | o chat que o Eliel abre com `/maxima` ou `/maxima retomar` | balões com o Eliel; monta a fila e as ondas no `docs/MILESTONE.md`; despacha **uma sessão de onda por vez**; lê o relatório de ≤10 linhas de cada onda; reescreve `docs/ops/bom-dia.md` e `docs/ops/custos.md`; passa o bastão | triagem, briefing, vistoria, `qa`, ler diff ou log, mergear PR de item | Sonnet·medium (Opus só para decisão de arquitetura com o Eliel) |
| **2. Sessão de onda** | sessão filha criada pelo coordenador (`create_session`) | executa `references/rodada.md` para a sua onda: triagem, briefing, sessão de item, vistoria, `qa`, merge, roadmap `[x]`, fichas em `solucoes.md`; fecha com um PR de controle e o relatório ao coordenador | falar com o Eliel (o que pede decisão volta ao coordenador como P); mexer em `docs/MILESTONE.md`, `bom-dia.md`, `custos.md` | Sonnet·high |
| **3. Sessão de item** | sessão filha criada pela sessão de onda | um item, igual ao Template da filha | — | pela triagem (Haiku / Sonnet / Opus com gatilho) |

Avisos sobem um nível por vez: o item avisa a **onda** (`send_message` para o id da onda) e a onda avisa o
**coordenador**. O coordenador nunca recebe aviso de item.

## Calibragem (números; revisar no fim de cada rodada com o que foi medido)

- **Medida de 31/10:** cerca de **2% de contexto por item** quando um chat faz tudo; relatório de onda lido pelo
  coordenador ≈ 0,3%.
- **Coordenador:** passa o bastão ao chegar em **35% de contexto** ou **8 ondas**, o que vier primeiro. Meta: fechar a
  noite abaixo de 40%.
- **Sessão de onda:** até **3 itens abertos ao mesmo tempo** (regra da fila) e até **6 itens no total**; fecha antes se
  chegar a **40% de contexto**. Itens que sobrarem voltam ao coordenador para a próxima onda.
- **Uma sessão de onda ativa por vez.** Assim só um PR de controle anda de cada vez e o `MILESTONE` não conflita.
- **Saída da onda para o coordenador:** no máximo **10 linhas**, sempre neste formato:
  `ONDA <n> FECHADA · itens ✅ <lista com PR> · ⏸️ <lista com motivo> · P para o Eliel: <lista> · decidi por você:
  <lista> · custo US$ <onda + filhas> · main <hash> vistoria <APROVADA/…> · próximos sugeridos: <lista>`.
- **Custo de referência:** coordenador ≤ 15% do custo total da rodada. Se passar, a próxima rodada delega mais.

## Coordenador: o laço

1. **Preparação** (igual a `rodada.md` §0, passos 1–4): estado, fila, balão com as autorizações. O arquivo de estado
   do coordenador é `docs/ops/rodadas/coordenacao-<AAAA-MM-DD>.md` (ondas, sessão de cada onda, relatório de cada onda,
   bastão).
2. **Monte a onda** (até 6 itens compatíveis pela `SKILL.md` §3, já sem os P) e grave no estado.
3. **Crie a sessão de onda** (`create_session`, base = `HEAD` da `main` com hash completo, ramo de controle
   `roadmap/onda-<data>-<n>`, modelo Sonnet, `permission_mode` igual ou mais restrito, nunca `plan`) com o
   **Template da sessão de onda** abaixo.
4. **Watchdog** (`send_later` 60 min) e **heartbeat** de hora em hora ligado a ESTA sessão. **Termine o turno.**
5. Chegou o relatório: grave-o no estado (as 10 linhas, sem reler PRs), confira só `get_session` → `status_bucket`
   e o hash da `main` com `git fetch`. Leve os **P** ao Eliel em balão se for dia; à noite, só anote em "Esperando você".
6. Próxima onda (volta ao passo 2). Fila vazia: **encerramento** (`rodada.md` §2, só a parte do coordenador:
   `MILESTONE`, `bom-dia`, `custos`, estado ao histórico, apagar heartbeat e watchdogs).

### Passar o bastão (coordenador chegou a 35% ou 8 ondas)

Sem onda aberta (espere a atual fechar): grave o estado, commite e envie; crie a **sessão coordenadora seguinte**
(`create_session`, mesmo modelo, prompt abaixo); apague o seu heartbeat; escreva no estado "bastão → <id novo>";
termine. De dia, avise o Eliel em uma linha com o link da nova sessão.

> Você é a coordenadora da Máxima no SabreHosting (nível 1 de `references/coordenacao.md`). Siga a skill `maxima`,
> modo `retomar`, a partir do estado `docs/ops/rodadas/coordenacao-<data>.md` no ramo `<ramo>` (bastão recebido de
> `<id antigo>`). Autorizações da rodada: <copiar do estado>. Turno: <dia/noite>.

## Template da sessão de onda

```
Você é uma sessão de onda da Máxima no SabreHosting (nível 2 de .claude/skills/maxima/references/coordenacao.md).
Sua coordenadora é {{ID_COORDENADOR}}. Sua onda: {{LISTA_DE_ITENS}} (até 6; no máximo 3 abertos ao mesmo tempo).
Base: {{HASH_MAIN}}. Seu ramo de controle: roadmap/onda-{{DATA}}-{{N}}. Turno: {{dia/noite}}. Autorizações: {{lista}}.

Siga references/rodada.md (§1 Loop por item, Revisão, merge pela SKILL.md §4) para a sua onda, com estas regras:
- Você não fala com o Eliel. Item que pede decisão dele vira ⏸️ P e vai no relatório.
- Você não mexe em docs/MILESTONE.md, docs/ops/bom-dia.md nem docs/ops/custos.md (são da coordenadora).
  Marca [x] nos roadmaps, grava fichas em docs/memoria/solucoes.md e o seu estado em docs/ops/rodadas/onda-{{DATA}}-{{N}}.md.
- Os itens avisam VOCÊ (use o seu próprio id no Template da filha).
- Só mergeie depois do aviso de "pronto" da filha para o último pedido (S-04); item que mexe em infra/ ou tests/infra/:
  testes também como usuário comum (S-03); vistorias uma de cada vez (S-01).
- Feche ao terminar a lista ou ao chegar a 40% de contexto: PR de controle (vistoria APROVADA) mergeado, watchdogs
  apagados, e UMA mensagem para {{ID_COORDENADOR}} no formato "ONDA <n> FECHADA · …" (references/coordenacao.md,
  Calibragem), com no máximo 10 linhas. Depois termine.
```

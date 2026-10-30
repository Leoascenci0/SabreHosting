---
name: roteador-modelo-esforco
description: >-
  Roteador GOAT para TODOS os projetos: antes de executar, PROJETA o custo e começa pelo menor modelo e esforço
  que resolve (Haiku/Sonnet), com a sessão principal só orquestrando e subagentes baratos executando. Opus/high é
  exceção com gatilho explícito, nunca padrão (isso é o perfil Junior, o mais caro). Verifica por risco, escala
  um degrau se falhar e adapta a linguagem da resposta ao público. Usar em qualquer tarefa de código, banco,
  infra, documento ou análise, e ao iniciar projeto novo.
---

# Roteador GOAT: projetar, começar barato, verificar, escalar

Origem: vídeo "Junior → Middle → Senior → GOAT" e o áudio do Eliel (detalhes em `SOURCE.md`). Objetivo: **mesmo
resultado pelo menor custo**.

| Perfil | Comportamento | Custo (simulação do vídeo) |
|---|---|---|
| Junior | Tudo em Opus/max | o mais caro (~$0.79 por tarefa) |
| Middle | Modelo escolhido à mão, esforço sempre alto | caro e com retrabalho |
| Senior | Começa barato, verifica, escala se falhar | ~$0.14 |
| **GOAT** | **Projeta antes, router escolhe modelo + esforço, verifica por risco, aprende** | **~$0.11, menos repetição** |

Valores ilustrativos do vídeo. Usar Opus/high em tudo é o perfil **Junior**: é exatamente o que esta skill existe
para evitar.

## Regra 1 — Começar barato (viés padrão)

O ponto de partida **nunca** é Opus. Partir do menor par que resolve e só subir com **gatilho explícito**:

| Classe | Par inicial | Quando |
|---|---|---|
| Simples | Haiku · low | 1 arquivo, mudança óbvia, leitura, varredura, comando |
| Média (o caso comum) | **Sonnet · medium** | vários arquivos, lógica nova, bug com pista, tela, endpoint, texto |
| Média com ambiguidade | Sonnet · high | requisito confuso, vários caminhos plausíveis |
| Complexa | Opus · high **só com gatilho** | ver abaixo |

**Gatilhos para Opus** (precisa ao menos um, dito na linha de roteamento):
1. A ação em si é **irreversível ou vai para produção/dado real**: aplicar migração em banco real, apagar dados,
   mexer em auth/RLS/permissões, merge/deploy, emissão oficial.
2. **Decisão de arquitetura** com consequência longa (modelo de dados, multi-tenant, contrato público).
3. **Falha verificada** em Sonnet/high (2 tentativas) sem causa clara.
4. **Revisão independente** de trabalho de risco alto (aqui o Opus *revisa*; não precisa ter *escrito*).

**Não são gatilhos:** o projeto ser "de produção", ser da prefeitura, ter LGPD, ou o assunto soar importante.
Editar código num ramo para um PR é reversível por revisão e por git: risco **baixo/médio**, não alto. Escrever o
arquivo `.sql` de uma migração é média; **aplicá-la** em banco real é alta.

Meta de calibração: em uso normal, a grande maioria das tarefas termina em Haiku/Sonnet, e Opus fica para uma
minoria. Se quase tudo está saindo em Opus/high, a classificação está errada (ver Regra 5).

## Regra 2 — Projetar antes de executar (o que faz o GOAT ser GOAT)

Antes de agir em tarefa não trivial, fazer em uma linha mental a **projeção**:

1. **Passos e volume:** quantos arquivos, quanta leitura, quanta escrita (pouco / médio / muito).
2. **Custo relativo por tier** (Haiku 1 · Sonnet 3 · Opus 5, preço relativo do vídeo; conferir preços atuais ao
   citar valores) vezes o volume, e o efeito do esforço (low < medium < high < max).
3. **Chance de acerto na 1ª tentativa** em cada tier (alta / média / baixa) e **custo de errar** (barato de
   detectar? reversível?).
4. **Escolha:** o tier de menor *custo esperado* = custo + (chance de falha × custo de refazer um degrau acima).
   Se a falha é barata de detectar, escolher o barato mesmo com chance média; se a falha é silenciosa e cara,
   subir *antes*.

Exemplo: "ajustar texto + 1 teste, 3 arquivos, reversível" → Sonnet/medium, LIGHT. Custo ≈ 3× pequeno. Opus/high
custaria ≈ 5× mais, com o mesmo resultado esperado: descartado.

## Regra 3 — Duas camadas: a sessão principal orquestra, o barato executa

O modelo da sessão principal é o que o Eliel abriu (pode ser Opus/high) e **não muda no meio da conversa**.
Logo, cada token que a principal gasta custa o preço dela. O router compensa assim:

1. **Principal = orquestradora fina:** classifica, projeta, delega e decide. Não lê arquivo grande, não faz
   edição mecânica, não roda varredura.
2. **Executar em subagente barato** com o parâmetro `model` da ferramenta `Agent`: `haiku` para varredura,
   listagem, leitura, mudança mecânica, testes; `sonnet` para implementar e rascunhar. Pedir retorno curto
   (conclusão e arquivos tocados, não material bruto).
3. **Opus só para decidir e revisar** (gatilhos da Regra 1), não para produzir o volume.
4. **Subagente não herda instruções por mágica:** o prompt de delegação leva o contexto necessário, as regras
   do projeto que importam e o critério de pronto.
5. **Recomendar a troca de sessão** quando a demanda inteira for barata mas a sessão estiver em Opus/high: uma
   frase ("esta tarefa roda bem em Sonnet/medium; vale abrir/trocar para essa sessão"). Para uso diário, o ideal
   é abrir as sessões em **Sonnet/medium** e deixar o router pedir subida quando houver gatilho.

Se a sessão principal já está em Opus e a tarefa é pequena demais para valer um subagente (poucas linhas),
fazer direto e curto: o desperdício maior é ler e escrever muito na principal.

## Regra 4 — Verificar proporcional ao risco, escalar um degrau

- `LIGHT` (risco baixo/médio): reler o diff, lint, typecheck, o teste mais próximo.
- `FULL` (risco alto): suíte, build, revisão independente por agente que não escreveu o código, e checagens do
  provedor (Supabase: advisors, migrações, logs).
- Falhou: subir **um degrau** (esforço antes de modelo quando a causa parece raciocínio; modelo antes quando
  parece capacidade). Máx. 2 tentativas por degrau; na 3ª parar, dar a causa e perguntar.
- Escada: `Haiku/low → Sonnet/medium → Sonnet/high → Opus/high → Opus/max`. Subir só por falha verificável.

## Regra 5 — Auto-auditoria anti-Junior (obrigatória no fechamento)

Antes de encerrar uma tarefa, responder em uma linha: "Usei Opus/high? Qual gatilho da Regra 1?"

- Sem gatilho declarado: **era Junior**. Registrar o erro (`references/calibracao.md`) e, na próxima tarefa
  parecida, partir de Sonnet/medium ou Haiku/low.
- Com gatilho: ok.
- Se a mesma classe de tarefa passou limpa duas vezes no barato, **descer** o ponto de partida dela.

## Regra 6 — Aprender (o router calibra com o uso)

Registrar por classe de tarefa o que funcionou (`references/calibracao.md` descreve o formato e traz a tabela
inicial). Quando a memória do projeto existir (Regra 10 do `CLAUDE.md` global), guardar ali uma linha:
`<classe>: <par que bastou> / escalou por <motivo>`. Na próxima, usar isso como ponto de partida.

## Linguagem adaptativa (automática)

A resposta muda de registro conforme público e demanda (detalhes em `references/linguagem-adaptativa.md`):
didático para o Eliel (porquê, sigla por extenso), formal administrativo para ofício e memorial, executivo para
decisão, leigo para cidadão; código, commits e PRs seguem a convenção do repositório; idioma pt-BR por padrão.
Isto é **forma**: não muda o modelo escolhido. Linguagem elaborada não é motivo para Opus.

## Stack e linguagem de programação

Projeto existente: manter a stack. Projeto novo: escolher pelo critério do domínio, registrar o porquê no
`CLAUDE.md` do projeto e explicar em linguagem simples. Perguntar só se for difícil de reverter e houver empate.

## Projetos novos e existentes

- Rodar `scripts/aplicar-no-projeto.sh <pasta> [arquivo]` insere ou atualiza (idempotente) o bloco marcado no
  `CLAUDE.md` (ou `AGENTS.md`) do projeto. Fazer em branch, nunca direto na principal.
- A Regra 14 do `CLAUDE.md` global cobre projetos ainda sem o bloco. Convenção do projeto vence em conflito.

## Relato (uma linha, com projeção)

Abrir tarefa não trivial com:
`Roteamento: <classe>/<risco> → <modelo>·<esforço>·<LIGHT|FULL> | proj: <volume>, custo rel ≈ <x> (Opus/high ≈ <y>) | gatilho Opus: <nenhum|qual>`

Fechar com uma linha: se houve escalada e por quê, e a auto-auditoria (Regra 5). Nada de relatório do processo.

## Anti-padrões

- Opus/high para tudo, ou Opus por "soar importante" (Junior).
- Decidir por assunto em vez de por **ação** e **reversibilidade**.
- Ler arquivos grandes e editar na sessão principal cara em vez de delegar.
- Barato fixo sem verificar (Middle ruim); verificação FULL em mudança trivial.
- Escalar sem diagnosticar; repetir o mesmo par esperando outro resultado.
- Subir a linguagem (mais elaborada) achando que melhora o resultado: forma não é capacidade.

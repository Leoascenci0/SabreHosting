# Briefing chunk-1.3

BASE: 74cebeefb800cfa0f7760fff78b21776ea7d39ae · RAMO: roadmap/chunk-1.3 · MODELO: sonnet (gatilho Opus permitido SÓ depois de 2 falhas verificadas em Sonnet; dizer na linha Roteamento: do PR)
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre › integridade §1 a §3 (troca atômica, backup, trava) e desempenho (só os .mca tocados vão para a temporária; nunca o mundo inteiro na RAM) e seguranca (entrada não confiável, S-07: marcador lido do disco é entrada não confiável); backup/restaurar.ts inteiro
TRIAGEM: M7 (+M1 backup/guardas, +M5 troca por marcador de restaurar.ts) ~250 linhas (resetar.ts ~180, marcador ~40, testes ~150), risco ALTO (regras 3 e 4). Reaproveitar: exigirPodeTrocar/haMundo/apagar (restaurar.ts:43-80); criarPacote direto com origem (restaurar.ts:99-115; fazerBackup de agendador.ts exige ServidorMinecraft/salvarSeguro e NÃO serve com servidor parado) + abrirPacote para conferir; gravarAtomico/MARCADOR_TROCA (servidor/configurar.ts:95-138); travaConfirmada (servidor/processo.ts:71); renomear/aposPrimeiroRename como injeção de falha (OpcoesRestaurar); listarRegioes e PlanoDeReset; gerarMundo/hashesDoMundo/escreverRegiao nos helpers de teste. NÃO escrever: função de backup nova nem esquema de hash novo (origem já entra no JSON do manifesto; backup antigo mantém o hash); cópia do mundo inteiro; reescrever restaurar.ts; mexer em level.dat/playerdata. Passos: 1 manifesto.ts acrescenta antes-de-resetar a OrigemBackup/ORIGENS (valor desconhecido lido do disco continua automatico). 2 resetar.ts: planejar → criarPacote(origem antes-de-resetar)+abrirPacote de conferência (falha = aborta sem tocar nada); cada .mca tocado em region/entities/poi: copiar em stream para temporária irmã com as entradas escolhidas zeradas (4 bytes de posição + 4 de data), hash do resultado e releitura do cabeçalho. 3 marcador JSON com a lista (original, .antigo, temp) gravado ANTES do primeiro rename; renames em ordem; qualquer erro desfaz pela lista; região que fica vazia só sai. 4 recuperarTroca estendido para a lista (desfaz parcial, nunca apaga .antigo). 5 só depois apaga marcador e .antigo. A guarda 'backup/restauração em andamento' vive no app (apps/desktop/src/main/backups.ts): o núcleo recebe-a como opção (função) e recusa se verdadeira; a ligação real é do 1.5.

## Item (texto literal do roadmap)
> - [ ] **1.3 — Núcleo: executar o reset com troca atômica**
>   *O que fazer:* aplicar o plano: para cada região tocada, copiar o `.mca` para pasta temporária, **zerar no cabeçalho** as
>   entradas dos chunks escolhidos (posição e data) em `region`, `entities` e `poi`, conferir o hash do que sobrou, e só
>   então trocar por rename; região que fica vazia é apagada. Pré-condições recusadas com texto claro: servidor parado
>   exigido, trava deste PC exigida, nenhum backup/restauração em andamento. Faz o backup `antes-de-resetar` pelo mesmo
>   `fazerBackup` **antes** de qualquer escrita; se o backup falhar, não reseta. Falha no meio = mundo como estava.
>   *Arquivo:* `packages/nucleo/src/mundo/resetar.ts`, `backup/manifesto.ts` (valor novo `antes-de-resetar`), testes
>   **Tela no app:** não se aplica.
>   *Confirmação:* testes que falham antes e passam depois: reset de 1 chunk, de uma região inteira, falha injetada no meio
>   (mundo intacto), servidor rodando recusado, sem backup não reseta; `level.dat` e `playerdata` com o mesmo hash depois.
>   *Depende de:* 1.2 e do `appuimel-1.1` (já no ar)
> 

## Decisões que valem para este item
- Só o dono do grupo reseta, no PC que está com a trava (Eliel, 02/11/2026). Interface v2 já feita.
- Regras de ouro 1 a 6 do CLAUDE.md e as "Regras que valem para todos os itens" do topo de docs/roadmap-chunk.md.

- **Origem do backup (decidido pela onda 46):** `antes-de-resetar` é valor novo do campo `origem` do manifesto (appuimel-1.1); valor desconhecido lido do disco continua virando `automatico`; backup antigo mantém o mesmo hash. Teste para os dois.
- **Testes OBRIGATÓRIOS (falham antes, passam depois):** (1) falha injetada no meio do reset deixa o mundo igual BYTE A BYTE (hashesDoMundo antes = depois) e sem sobras (.tmp/.antigo/marcador) ou recuperável pelo recuperarTroca; (2) kill entre renames + recuperação devolve os hashes; (3) servidor rodando recusa; (4) sem trava deste PC recusa; (5) backup que falha (ou conferência do pacote que falha) = nenhum .mca tocado; sem backup não reseta; (6) operação em andamento (opção) recusa; (7) level.dat e playerdata com o mesmo hash depois; (8) region, entities e poi andam juntos (chunk apagado nas três); (9) reset de 1 chunk e de região inteira (arquivo apagado); (10) cabeçalho com entrada inválida/lixo: REVALIDAR ao aplicar (não confiar no plano, qa do 1.2: planejar-reset.ts:189) e recusar ou ignorar de forma segura; (11) marcador adulterado/caminho fora das pastas esperadas não apaga nada (S-07); (12) texto de erro fixo seguro, sem caminho cru.
- **Menores do qa do 1.2 (faça aqui):** normalizar -0 em plano.area (`+ 0`) com teste; não aumentar o teste de tempo <5 s (S-01).
- **Revisão:** este item terá duas lentes (qa integridade + qa segurança) e síntese; uma devolução, na segunda o item sai.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/chunk-1.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois), só com mundo inventado (nunca o mundo real)
- [ ] npm ci no próprio worktree (S-05); `npm run vistoria` APROVADA, uma vistoria por vez (S-01); também `npm run vistoria:comum` se tocar infra/
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, **Regressão:** e **Tela no app:** (S-10)
- [ ] Ao terminar, send_message para session_012qrjnrYFiAJqa6pwfXXKuo: "PR #<n> aberto: <link> — <resumo>" e só então considere pronto (S-04)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo. Não há tela nesta onda.

## O que NÃO decidir (perguntar à sessão de onda)
Nada novo: dúvida de regra do grupo vira pergunta a session_012qrjnrYFiAJqa6pwfXXKuo.

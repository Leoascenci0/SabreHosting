# Soluções conhecidas

Erro consertado e conferido vira ficha (skill `maxima` §5c). Antes de depurar: `grep -i "<trecho>" docs/memoria/solucoes.md`.

Formato:
```
## S-NN — <sintoma curto>
Sintoma: <mensagem exata> · Causa: … · Solução: … · Prova: … · Vezes: 1 · Origem: <item, PR>
```

## S-01 — Teste passa sozinho e falha com a máquina ocupada
Sintoma: `expected Set{ 16, 20 } to deeply equal Set{ 16 }` (corrida da trava) e `Test timed out in 5000ms`/`30000ms`
(testes de 20 MB, memória do manifesto) só em `npm run vistoria` logo após `npm ci` ou com vários vitest juntos ·
Causa: teste dependente de tempo — perdedor atrasado lia a época da rodada seguinte; prazo padrão de 5 s; medida de
memória por `gc()` sensível à carga · Solução: comparar "época ≥ a do vencedor" mantendo "exatamente 1 ganha"; prazo
explícito de 30 s nos testes pesados; medir pedaço lido (≤ 1 MiB) e arquivos abertos (= 1) em vez de memória · Prova:
4 `npx vitest run` em paralelo, 3 vezes, zero falhas · Vezes: 2 · Origem: basemel-1.3, PR #43; basemel-1.5, PR #76
(trava: com renovação de 100 ms a folga do prazo local é 75 ms; teste que exige a trava viva usa 1500/500 ms)

## S-02 — Commit de controle levou marcador de conflito de merge
Sintoma: `<<<<<<< HEAD` dentro de `docs/ops/DECISOES.md` e o verificador APROVADO · Causa: `git merge` da main deu
conflito no fim da tabela (as duas pontas acrescentam linha) e o script seguinte fez `git add -A` sem conferir · Solução:
resolver mantendo as duas linhas; sempre checar a saída do `git merge` antes de `git add` · Prova: `grep -c "<<<<<<<"` = 0 ·
Vezes: 3 (Ondas 3, 6 e 10) · Origem: orquestradora; trava no verificador em basemel-1.4. Regra: depois de `git merge`, se a saída tiver CONFLICT, resolver ANTES de qualquer edição ou commit

## S-03 — Vistoria verde na sessão e check vermelho no GitHub
Sintoma: `ERRO: rode como administrador: sudo bash infra/vps/instalar.sh` e dezenas de falhas em `tests/infra/instalar*.test.ts`
só no CI (usuário comum); na sessão (contêiner como root) tudo verde · Causa: os testes rodavam os scripts em simulação sem
fingir root, e o script confere `id -u` · Solução: os ajudantes de teste passam `SABRE_FALSO_UID=0`; teste que precisa de
root de verdade fica `skipIf` explícito · Prova: `npx vitest run` verde como root e como usuário comum (`useradd -m teste`;
`su teste -c ...` numa cópia do repositório) · Vezes: 1 · Origem: corr-1.1, PR #118. Regra: depois de mergear item que mexe
em `infra/` ou `tests/infra/`, rodar a suíte também como usuário comum, e olhar o check da `main` no fim da onda

## S-04 — Commit da filha ficou fora da main depois do merge
Sintoma: `git log origin/main..origin/roadmap/<item>` não vazio depois do merge; PR já fechado · Causa: a orquestradora
mergeou enquanto a filha ainda atendia um pedido de ajuste (#128) · Solução: PR de complemento do mesmo ramo (#138);
regra: só mergear depois do aviso de "pronto" da filha para o último pedido, e conferir o `git log` vazio depois ·
Prova: #138 mergeado, `git log origin/main..origin/roadmap/basemel-1.6` vazio · Vezes: 1 · Origem: rodada 31/10 (madrugada)

## S-05 — Tipos do workspace somem num worktree
Sintoma: `TS2307: Cannot find module '@sabrehosting/nucleo/...'` no `npm run vistoria` de um worktree · Causa:
`node_modules` em atalho para a pasta principal resolve os pacotes do workspace fora do worktree · Solução: `npm ci` no
próprio worktree (5 s) · Prova: vistoria APROVADA no mesmo worktree depois do `npm ci` · Vezes: 1 · Origem: revisão do #84

## S-06 — Dois agendadores/relógios por corrida em função assíncrona de "ligar/reagendar"
Sintoma: duas chamadas seguidas de `reagendar()` com backup em curso deixam DOIS agendadores ativos (timer vazando, dois relógios
disparando backup do mesmo mundo) · Causa: `const meu = geracao` lido DEPOIS de `await desligar()`; as duas chamadas capturam o mesmo
número e passam pela checagem `meu !== geracao` · Solução: tomar a geração (`++geracao`) e guardar o agendador antigo de forma
SÍNCRONA, antes de qualquer `await` · Prova: teste "backup em curso + dois reagendar seguidos → 1 agendador ativo" (falha no código
antigo) · Vezes: 1 · Origem: appmel-1.8, PR #167 (achado pelo qa integridade). Vale para qualquer "token de geração" contra corrida.

## S-07 — Marcador lido do disco apaga o que não devia
Sintoma: marcador de troca adulterado (`temp == mundo` ou `temp = mods`) faria `apagar(c.temp)` apagar o mundo vivo/os mods · Causa:
o caminho vinha do JSON sem validar nome nem distinção entre as três pastas · Solução: exigir mundo/antigo/temp distintos, filhos
diretos da pasta do servidor (via `path.relative`) e com nome `basename(mundo)+"."…`; apagar o marcador FORA do `try` do 2º rename ·
Prova: testes de marcador forjado e de EPERM ao apagar o marcador · Vezes: 1 · Origem: syncmel-1.4, PR #164. Regra: tudo que um
arquivo de estado manda apagar/renomear é entrada não confiável.

## S-08 — Teste de socket cru: sem `resume()` o `close` nunca chega; prazo de cabeçalho do Node sai em ~30 s
Sintoma: teste de "cabeçalho que nunca termina" estourava 20 s sem o socket fechar · Causa: (1) o cliente de teste não lia os dados, então o FIN do servidor não era processado e o `close` não vinha; (2) o Node confere `headersTimeout` a cada ~30 s, então o corte real não acontece em 10 s · Solução: `s.resume()` no socket de teste; janela do teste de 9 a 45 s com prazo explícito de 60 s (S-01: prazo só no teste) · Prova: medido em 30,0 s; suíte de transferência 33/33 · Vezes: 1 · Origem: syncmel-1.6, PR #172. Vale para qualquer teste de socket cru; melhoria 1.7 do syncmel baixa o custo de 30 s.

## S-09 — Sessão de onda não abre: "branch or commit was not found"
Sintoma: a sessão criada com `create_session` falha em "Repositório clonado" (`ref_not_found`) e não pode continuar ·
Causa: `source_revision` com hash CURTO (`5f440cc`); a nuvem só aceita ramo ou hash completo · Solução: sempre
`git rev-parse origin/main` (40 caracteres) no `source_revision`; arquivar a sessão morta, apagar o vigia dela e recriar ·
Prova: Onda 22 recriada com o hash completo (session_012qrjntw8ggfpCSw7mg4UfD) · Vezes: 1 · Origem: coordenação 31/10.

## S-10 — `qa` reprova PR de correção só por falta das linhas `Regressão:` e `Tela no app:`
Sintoma: PR #181 (drive-1.1b) corrigia dois bugs achados pelo `qa` do #179 e o código estava certo, mas o `qa` reprovou: faltavam `Regressão:` e `Tela no app:` no corpo · Causa: o briefing não repetiu a regra do CLAUDE.md (correção de bug = regra + prova) para o item que "corrige antes de ligar" · Solução: a sessão de onda completou o corpo do PR (sem nova rodada da filha) e mergeou · Prova: PR #181 · Vezes: 1 · Regra: todo briefing de item que corrige bug ou cria tela manda a filha escrever `Regressão: <teste que falhava antes>` e `Tela no app: <caminho>` no PR.

## S-11 — Gancho barra o comando inteiro por causa do TEXTO da flag que pula o pre-commit dentro de um heredoc
Sintoma: `PreToolUse:Bash hook error … é proibido` ao gravar o texto-padrão da filha (ou esta ficha) com `cat <<EOF` · Causa: o gancho `bloquear-git-perigoso.sh` procura a flag no comando inteiro, inclusive em texto que só a cita · Solução: escrever "nem pular a trava do pre-commit" em vez da flag literal em prompts, briefings e fichas · Prova: Onda 24, template regravado e sessões criadas · Vezes: 1 · Origem: onda 24.

## S-12 — Cliente do núcleo diz "resposta inválida" quando o cartório recusa o host a um PC que está atualizando
Sintoma: `pegar` (trava de host) de um PC com trava de atualização valendo lançava `Resposta inválida do cartório: recusa da trava` em vez da mensagem em pt-BR · Causa: o cartório responde 409 com motivo `atualizando` (`trava.ts`), mas a lista `MOTIVOS` do cliente (`tipos.ts`) não o conhecia; nenhum teste juntava cliente e cartório reais em `/atualizacao` · Solução: `atualizando` entrou em `MOTIVOS`; teste de integração `tests/integracao/atualizacao-cartorio.test.ts` · Prova: o teste falha sem a linha e passa com ela · Vezes: 1 · Regra: motivo novo no cartório = motivo novo na lista do cliente no mesmo PR (a vistoria cobre com teste cliente+cartório reais).

## S-13 — Servidor de arquivos servia link simbólico (`stat` segue o link; `lstat` só olha o último componente)
Sintoma: `arquivos(hash)` devolvia 200 para um link simbólico apontando para fora da vitrine · Causa: `stat`/`isFile` seguem o link; depois da troca por `lstat`, uma PASTA intermediária que fosse link ainda era seguida · Solução: `lstat` no arquivo + comparar `realpath(arquivo)` com `realpath(vitrine)` (fora → 404) · Prova: testes de link no arquivo e na pasta intermediária (falham sem a correção) · Vezes: 1 · Origem: syncmel-1.3, PR #203 (o qa de segurança pegou o buraco na 1ª passada). Regra: servir arquivo a partir de nome/hash = validar o caminho REAL, não só o último componente.

## S-14 — Erro bruto na tela (caminho, IP, porta) quando um aviso que ia só ao console passa a aparecer
Sintoma: `qa` de segurança reprovou o PR #214: `erro.message` ia direto para o texto da tela inicial · Causa: mensagens de erro de rede/disco trazem caminho absoluto, endereço e porta de PC do grupo; mostrar o aviso reaproveitou o texto do console · Solução: `textoSeguroParaTela(erro)`: só `ErroLocal`/`ErroCartorio` (texto fixo pt-BR) vão à tela, o resto vira frase genérica; o bruto fica no console · Prova: teste com `Error("ENOENT /home/x/mundo")` e IP/porta esperando o texto genérico · Vezes: 1 · Regra: todo texto que passa a aparecer na tela passa por uma lista de erros com mensagem fixa, nunca `error.message` cru.

## S-15 — Cofre do token devolvia "vazio" tanto para "nunca guardado" quanto para "corrompido"
Sintoma: arquivo do cofre adulterado (ou de outra conta do Windows) fazia o app agir como se fosse a primeira vez, sem pedir convite novo · Causa: `ler()` devolvia `undefined` no `catch` do decrypt e na ausência do arquivo · Solução: `estado()` no cofre do app (`ok`/`ausente`/`corrompido`/`indisponivel`); só `ENOENT` é `ausente`; config do PC e assistente leem o estado (`cofreCorrompido`) · Prova: testes com arquivo adulterado falham sem a correção · Vezes: 1 · Origem: appmel-1.12. Regra: leitura de segredo/arquivo local nunca colapsa "não existe" e "não consegui ler" no mesmo valor vazio.

## S-16 — Filha apagou edições não commitadas com `git checkout --` (e teste de correção que passava antes e depois)
Sintoma: no lote lancmel-2.5 + appmel-1.20 a filha rodou `git checkout --` num arquivo com edições ainda sem commit e perdeu o trabalho (recuperou de uma cópia em /tmp); no mesmo lote, o teste novo do `catch` de `carregarMods` passava também no código antigo · Causa: (1) desfazer uma tentativa com checkout em vez de commitar antes de experimentar; (2) o caminho do `catch` só roda se o IPC falhar e o fake do E2E nunca simula isso, então o teste exercitava outro caminho (`e.erro`) · Solução: commitar (ou guardar com `git stash`) antes de qualquer experimento que vá desfazer; um teste que "falha antes" é obrigatório, e quando um caminho não é alcançável pelo fake o PR diz "verificado só por leitura" em "O que NÃO foi confirmado" · Prova: onda 31, PR #234 (nada se perdeu; ficha de processo) · Vezes: 1 · Regra: desfazer = `git stash` ou commit de rascunho, nunca `checkout --` em arquivo sujo; teste de regressão que passa sem a correção não é prova.


## S-17 — Download em arquivo temporário de nome fixo colide quando duas peças vão para o mesmo destino (lanc-2.3)
Sintoma: peças paralelas (ou duas montagens) escrevendo no mesmo `.parcial` davam falha espúria de hash. Causa: nome temporário derivado só do destino. Regra: temporário único por download (pid/aleatório) e peças deduplicadas por destino; mesmo caminho com hash diferente é erro. Vale também para o marcador `.montada.json` (apagar o antigo no início).

## S-18 — Roadmap 100% feito ficava em `docs/` (regra existia só no texto)
Sintoma: em 01/11/2026 quatro roadmaps completos seguiam fora de `docs/concluidos/` (`cart-melhoria` 15/15, `drive` 2/2, `sync-melhoria` 14/14 e a 2ª leva de `lanc-melhoria` 9/9, que até duplicava o nome do arquivo já arquivado) · Causa: a regra do Eliel (31/10) estava no CLAUDE.md e na Máxima, mas nada barrava o esquecimento no PR de controle · Solução: movidos (a 2ª leva do lancmel foi juntada ao arquivo da 1ª em `docs/concluidos/`) e o `scripts/verificar.py` passou a reprovar commit/ramo com `docs/roadmap-*.md` sem item aberto (exceto `roadmap-corr.md`) · Prova: teste em `tests/infra/verificar.test.ts` falha no verificador antigo · Vezes: 1 · Regra: regra de processo que se esquece vira trava no verificador, não só texto.

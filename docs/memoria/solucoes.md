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

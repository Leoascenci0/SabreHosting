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
4 `npx vitest run` em paralelo, 3 vezes, zero falhas · Vezes: 1 · Origem: basemel-1.3, PR #43

## S-02 — Commit de controle levou marcador de conflito de merge
Sintoma: `<<<<<<< HEAD` dentro de `docs/ops/DECISOES.md` e o verificador APROVADO · Causa: `git merge` da main deu
conflito no fim da tabela (as duas pontas acrescentam linha) e o script seguinte fez `git add -A` sem conferir · Solução:
resolver mantendo as duas linhas; sempre checar a saída do `git merge` antes de `git add` · Prova: `grep -c "<<<<<<<"` = 0 ·
Vezes: 3 (Ondas 3, 6 e 10) · Origem: orquestradora; trava no verificador em basemel-1.4. Regra: depois de `git merge`, se a saída tiver CONFLICT, resolver ANTES de qualquer edição ou commit

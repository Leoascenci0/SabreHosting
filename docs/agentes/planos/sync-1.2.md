# Plano sync-1.2 — Aplicar delta com troca atômica

Método: M1 (reaproveitar) + M7 (aplicar.ts) + M3 (método no cliente do cartório). Risco alto: sync/troca do mundo.

## Peças
1. `cartorio/cliente.ts`: `informarCopia(versao)` → `POST /copias {versao}` (204). A rota já existe no cartório (cart-1.3); o cartório não muda.
2. `backup/restaurar.ts`: só `export` de `desfazer` e `haMundo` (o padrão de troca/queda é um só; nada novo lá dentro).
3. `sync/aplicar.ts` → `aplicarDelta()`:
   - exige servidor parado e trava confirmada (antes de montar e de novo antes da troca);
   - N = manifesto local informado (do pacote fechado) ou `gerarManifesto` da pasta parada; M validado por `validarManifesto`;
   - `compararManifestos(N, M)`; temporária irmã `<mundo>.atualizando-v<M>`;
   - iguais: hard link (`lstat` exige arquivo comum; falha do link → cópia); novos/mudados: `baixar()` injetado (em produção `pedirArquivo`, hash de M) num caminho NOVO da temporária (nunca escreve em arquivo ligado); apagados simplesmente não entram;
   - `gerarManifesto(temporária)` tem de bater com M inteiro (reconfere os iguais);
   - troca: mundo→.antigo, temporária→mundo, `desfazer` copiado de restaurar; depois `avisarCopia(M.versao)`; falha no aviso NÃO desfaz; `.antigo` apagado só no fim.
4. Caminhos sempre do manifesto validado, e confirmados dentro da temporária.

## Testes (mundo inventado)
Só as regiões mudadas são transferidas (bytes e chamadas); resultado = M inteiro; queda em baixar/ligar/conferência/rename 1 e 2 deixa N intacto e sem sobras; sem trava / servidor rodando recusa; fallback de cópia; aviso falho não desfaz; manifesto local ausente; método do cliente.

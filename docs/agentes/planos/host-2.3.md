# Plano host-2.3 — Nota do PC (benchmark)

Método M7 (código novo, só `os` e `worker_threads`), ~130 linhas. Ramo `roadmap/host-2.3`, issue #13.

## Arquivos (todos em `packages/nucleo/src/nota/`)
- `formula.ts` — `calcularNota(medicao)`: pura, inteiro 0–100. Pesos e referências em constantes comentadas.
- `decidir.ts` — `deveMedir(...)`: pura. Mede no 1º uso e a cada 7 dias; nunca com jogo aberto; nunca se
  `permitirHospedar` for falso (padrão desligado; a tela é do app-2.2).
- `medir.ts` — `medirPc({uploadMbps, ...})`: laço cronometrado em 1 núcleo, depois um worker por núcleo com o
  mesmo laço; RAM livre por `os.freemem()`; upload é parâmetro. Teto de 15 s com cancelamento (workers
  terminados) e erro em pt-BR.
- `README.md` — fórmula em linguagem simples.
- `*.test.ts` ao lado de cada arquivo.

## Ordem (TDD)
1. Testes da fórmula e de `deveMedir` (falham) → implementação.
2. Testes da medição (falsa que passa de 15 s é cortada; real termina < 15 s) → implementação.
3. Medir 3 vezes seguidas para registrar a variação no PR; calibrar as referências da fórmula.
4. `npm run vistoria`, PR com `Closes #13`.

## Não fazer
Pacote de benchmark, medição real dentro da fórmula, tela, cliente de upload.

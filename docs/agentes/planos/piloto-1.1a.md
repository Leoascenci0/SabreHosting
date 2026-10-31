# Plano piloto-1.1a — Importar mundo de .zip (núcleo seguro)

Escopo: só o núcleo (`packages/nucleo/src/importar.ts`): zip seguro → pasta temporária → pacote → versão 1.
Fora: ler `level.dat`/versão do Minecraft (1.1b), tela e tutorial (1.1c).

## Desenho
1. **Passo 1, sem gravar nada:** `yauzl` (lazyEntries, lê entrada a entrada, nunca o zip inteiro na RAM) percorre só a
   lista de entradas. Recusa: caminho inválido (reusa `caminhoSeguro` do manifesto: absoluto, `..`, unidade, `\`, NUL,
   nomes do Windows), link simbólico (bits `0o120000` nos atributos externos), entrada repetida (inclusive só na
   maiúscula), nº de entradas > limite, total declarado > teto, zip sem arquivo.
2. **Passo 2:** cria `<trabalho>/importar-XXXX/` (filha direta da pasta de trabalho) e extrai em `mundo/`. Cada destino
   é resolvido e conferido dentro de `mundo/`; grava com `flags: "wx"`; conta os bytes REALMENTE lidos (bomba de zip:
   o declarado não vale) e aborta ao passar do teto.
3. `criarPacote` (reuso) → hash/tamanho; `enviar(pacote)` (injetado: POST /versoes + PUT /versoes/1/pacote com época)
   → devolve `{versao: 1, sha256, tamanho}`.
4. `finally`: apaga a pasta temporária inteira, também em erro (S-07: só apaga a pasta que ela mesma criou).

## Dependência
`yauzl` 3.4.0 (MIT, JS puro, 1 dep `pend`) + `@types/yauzl`, versão exata. Autorizada em DECISOES 31/10 (piloto-1.1).

## Testes (zips gerados no próprio teste, mundo inventado)
Um por caminho hostil: zip-slip (`../x`), absoluto, unidade `C:`, barra invertida, link simbólico, duplicado (e só
maiúscula), bomba (declarado grande; e declarado mentiroso), excesso de entradas. Mais: caminho feliz com hash igual ao
de `criarPacote`; pasta de trabalho sem sobra em erro; nada criado fora da pasta.

# Plano host-2.2 — Comandos ao servidor: salvar com segurança, avisar no chat

Issue #28 · ramo `roadmap/host-2.2` · método M7 + M1 (reaproveita o evento `log` e o stdin de `ServidorMinecraft`).
Risco ALTO: `salvarSeguro` libera a cópia do mundo (regra de ouro 2).

## Desenho
- Comandos pelo **console do processo** (stdin/stdout), não RCON: sem porta de rede, sem senha (decisão da Máxima).
- `processo.ts`: um único método público `enviar(linha)`. Recusa `\r`, `\n` e qualquer caractere de controle
  (`\p{Cc}`, `\p{Zl}`, `\p{Zp}`) e só escreve com o servidor em "pronto".
- `comandos.ts`:
  - fila por servidor (`WeakMap`): um comando por vez, na ordem de chamada; falha de um não trava os seguintes.
  - cada comando registra o ouvinte de `log` ANTES de escrever; casa a resposta com prazo; sai cedo se o servidor
    deixar de estar pronto.
  - `say(texto)`: sem quebra de linha nem controle, não vazio, até 256 caracteres.
  - `list()`: regex ancorada no prefixo do NeoForge (`[hh:mm:ss] [Thread/NÍVEL]: `) → `{online, maximo, nomes}`.
  - `salvarSeguro(servidor, copiar, prazoMs = 120 s)`: `save-off` → `save-all flush` (espera `Saved the game`
    ancorado no prefixo) → `await copiar()` → `save-on` num `finally` (também com prazo estourado e cópia que
    falha). Servidor não pronto: recusa sem mandar nada. A tarefa inteira ocupa a fila (duas cópias nunca se cruzam).
- Âncora no prefixo (e não só `]: `): chat de jogador (`<Nick> Saved the game`, ou `... ]: Saved the game`)
  nunca libera a cópia.

## Testes (primeiro, vermelhos) — servidor falso com modos novos
1. `enviar`: recusa `\n`, `\r`, controle; recusa fora de "pronto"; o falso não recebe linha extra.
2. `salvarSeguro` só chama `copiar` depois do `Saved the game`; ordem save-off, save-all flush, copiar, save-on.
3. `save-on` vai se `copiar` lança e se o prazo estoura; erro original preservado.
4. Chat falso "<Nick> Saved the game" não libera a cópia.
5. `say` com `\n` recusado; texto > 256 recusado; `say` válido chega.
6. Comandos concorrentes saem em ordem (inclusive `salvarSeguro` + `say`).
7. `list` com 0 e 2 jogadores; servidor não pronto recusa sem mandar nada.

## Entrega
`npm run vistoria`, nenhum processo órfão, PR com `Closes #28`.

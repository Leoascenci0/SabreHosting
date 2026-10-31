# Plano appmel-1.10 — acabamentos da tela "Tirar PC do grupo"

Método: M4 (~30 linhas + ~40 de teste). Risco médio. Sem mexer em mundo, trava ou rede.

## Problema
(a) `aria-label` "Tirar Lucas do grupo" não contém o texto visível "Tirar PC do grupo" (acessibilidade: o nome acessível deve conter o texto visível).
(b) Depois de revogar com sucesso a lista é redesenhada, o botão some e o foco se perde.
(c) A mensagem genérica diz "Nada foi alterado", que pode ser falsa se o pedido chegou ao cartório e a resposta se perdeu.

## Desenho
1. `main/grupo.ts`: no `catch` de `tirar`, falha sem status conhecido devolve "Não consegui falar com o cartório agora. Atualize a lista para conferir." 403/404/409 ficam. `GENERICA` (usada na lista, onde nada muda) não muda.
2. `ui/configuracoes.ts`: mesma troca no `.catch` do confirmar ("Não consegui tirar o PC agora. Atualize a lista para conferir.").
3. Remover o `aria-label` do botão: o nome acessível passa a ser o texto visível "Tirar PC do grupo", que está no item da lista junto do nome do PC.
4. Depois do sucesso, `avisoGrupo.tabIndex = -1` e foco no aviso após setar o texto (fallback: título da área, legend). Sem editar `index.html`.

## Testes
- `grupo.test.ts`: falha de rede em `revogarPc` -> mensagem nova, sem "Nada foi alterado" (falha antes).
- E2E (`configuracoes.e2e.ts`): botão achado pelo item da lista; após revogar o foco está em `#grupo-aviso`; botão sem `aria-label`. E2E exige Windows/Electron: se não rodar aqui, dito no PR.

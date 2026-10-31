# Plano cartmel-1.9 — Acabamentos do cliente do cartório

Método M4. Só `packages/nucleo/src/cartorio/` (cliente.ts, tipos.ts, cliente.test.ts).

1. Teste primeiro (falha antes): `erro` do cartório com 500 caracteres vira no máximo ~200 (com reticências)
   na `ErroCartorio` (4xx) e no `erro` da recusa da trava (409).
2. Teste primeiro: `content-length` > 64 KB com corpo-espião; prova que o corpo **não foi lido** (hoje o teste
   passaria também pela contagem em fluxo).
3. Teste primeiro: `{token}` sem `pacote` (convite antigo) → `ErroCartorio` "resposta" com
   "Este convite é de uma versão antiga do cartório; peça um convite novo ao dono do grupo."
4. Implementar: `cortarErro` em tipos.ts (usado em `texto(o,'erro')` da recusa e na mensagem do cliente);
   conferência do convite antigo em `usarConvite`.
5. Mutações: tirar o corte; tirar o teste do content-length → testes caem. `npm run vistoria`, PR (Closes #140).

Não escrever: nada em `services/`. Sem tela no app.

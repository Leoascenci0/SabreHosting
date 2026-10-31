# Plano syncmel-1.13 — fechar o servidor de arquivos sem corrida com o primeiro `tentarLigar`

**Problema:** se o usuário sai durante o primeiro `tentarLigar`, o `ligar()` em voo termina o `await servirArquivos` depois do `fechar()` e deixa o servidor escutando (efeito prático nulo, o app encerra, mas a regra é não escutar depois de fechar).

**Método (triagem M4, ~25 linhas):** reaproveitar `criarServidorDeArquivos` (`apps/desktop/src/main/servir-arquivos.ts`); a flag `fechado` ainda não existe (conferido).

1. Teste primeiro (falha antes): chamar `tentarLigar()` sem esperar, chamar `fechar()` na sequência, esperar os dois; `porta()` fica `undefined`, `tentarLigar` devolve `false`, e nada escuta a porta.
2. `fechado = true` em `fechar()` (antes de qualquer `await`, S-06). `ligar()` recusa se `fechado`; depois do `await servirArquivos`, se `fechado`, fecha o servidor recém-aberto e devolve `false`. `tentarLigar` não publica se `fechado`.
3. `principal.ts` não muda: já chama `fechar()` em `sairDoApp`.

Tela no app: não se aplica. Segurança/Integridade: só reduz superfície (nada escuta depois de fechar); não toca no mundo.

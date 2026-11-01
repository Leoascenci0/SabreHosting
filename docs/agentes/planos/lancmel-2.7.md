# Plano lancmel-2.7 — montagem já marcada não relê o hash

Método M4 (triagem). Arquivo: `packages/nucleo/src/launcher/montar.ts` (+ teste em `montar.test.ts`).

1. Teste primeiro (falha antes): (a) segunda montagem com `.montada.json` válido não baixa nada e **não relê o
   hash** (prova: arquivo de mesmo tamanho adulterado não é rebaixado); (b) arquivo com tamanho trocado volta a
   ser baixado; (c) sem marcador, a conferência por hash continua (mesmo tamanho adulterado é rebaixado);
   (d) `javaw` do `.java.json` apagado: extrai de novo.
2. `montarVersao` lê o marcador ANTES de apagá-lo (continua apagando no início: falha no meio não deixa marcador).
   Marcador só vale se `app`, `versao` e `javaMajor` conferem.
3. `baixarSemColisao` ganha `tamanhoConfiavel`: com marcador válido e tamanho do manifesto conhecido, arquivo
   existente com esse tamanho dispensa o hash; sem tamanho no manifesto ou com tamanho diferente, hash/baixa como hoje.
4. Cliente, bibliotecas e índice passam a carregar `tamanho` do manifesto (assets já carregam).
5. Java: se o `javaw` devolvido por `extrairJava` não existe mais, apaga a pasta extraída e extrai de novo
   (sem mexer em `zip.ts`).
6. O download inicial (sem marcador) não muda: hash sempre conferido.

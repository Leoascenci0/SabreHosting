# Plano appmel-1.16 — esperar a sessão elevada antes de limpar; bloquear Jogar após trocar a pasta

Método: M4 (dois ajustes pequenos). Risco: médio. Tela no app: não se aplica.

1. (a) `entrada-no-grupo.ts`: no `catch` de `esperarPronta`, depois de `sinalizar(cancelar)`, `await sessao.catch(() => undefined)`
   antes de lançar o erro (o `finally` só limpa a pasta depois que o script desinstalou o túnel provisório).
   Teste: executor elevado que só desinstala 80 ms depois de ver `cancelar.flag`; a `entrar` só falha depois disso.
2. (b) `pasta-base.ts`: `trocada()` vira verdadeiro assim que a troca dá certo. `principal.ts`: Jogar e Hospedar recusam
   (mensagem pt-BR) enquanto `trocada()` for verdadeiro (o app reinicia em 1,5 s).
   Teste em `pasta-base.test.ts`: `trocada()` falso antes, verdadeiro após sucesso, falso após falha.
3. Regressão: os testes novos falham sem as duas mudanças. Vistoria completa no fim.

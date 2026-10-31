# Plano appmel-1.6 — endereço continua visível depois de Jogar

1. Teste E2E primeiro (falha: hoje `#detalhe` troca o endereço por "Endereço copiado…"): depois de Jogar, `#detalhe` ainda mostra o endereço e o aviso aparece; passados ~4 s, só o endereço.
2. `index.html`: um `<p id="aviso" role="status">` sempre presente (vazio quando não há aviso), para o leitor de tela anunciar (polite) ao ganhar texto.
3. `tela.ts`: `copiado` deixa de mexer no `#detalhe`; o aviso vai para `#aviso` e um `setTimeout` de 4 s o limpa. Qualquer ação nova (`agir`) limpa o aviso.
4. `npm run vistoria` APROVADA; PR com `Closes #134`.

Fora: processo principal, tela nova, texto novo (o aviso é o que já existe).

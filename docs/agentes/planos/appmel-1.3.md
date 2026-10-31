# Plano appmel-1.3 — Capturas do E2E só quando pedidas (Refs #124)

Triagem: M4 (ajudante pequeno compartilhado pelos dois arquivos do E2E; sem pasta nova, sem mudar tela).

1. **Ajudante:** `apps/desktop/e2e/captura.ts` exporta `capturasLigadas` (`process.env.SABRE_CAPTURAS === "1"`) e
   `registrarCaptura(pagina, arquivo)`, que só cria a pasta e grava o PNG quando a variável está ligada.
2. **janela.e2e.ts:** o teste "grava as capturas" continua trocando o tema claro/escuro e esperando como hoje; só a
   gravação em `docs/imagens/app-1.1-janela-*.png` passa pelo ajudante. Sai o `mkdirSync` que ficaria sem uso.
3. **inicio.e2e.ts:** a função `capturar` mantém a troca de tema e a espera; só o `screenshot` passa pelo ajudante
   (`docs/imagens/app-1.2-*.png`).
4. **Nenhuma asserção muda:** nenhum `expect` lê os PNGs; sem a variável o teste confere a tela do mesmo jeito.
5. **Documentação:** o app não tem README/LEIAME próprio com instrução de E2E (conferido: não há nenhum). A linha
   `SABRE_CAPTURAS=1 npm run test:e2e -w apps/desktop` vai no cabeçalho de `janela.e2e.ts`, que é o lugar onde o
   E2E já é explicado; o achado vai para o PR.
6. **Prova:** `npm run vistoria` APROVADA; `git status --porcelain` vazio depois. Se o xvfb funcionar aqui, rodar
   `SABRE_CAPTURAS=1 npm run test:e2e -w apps/desktop` só para ver que as PNGs são regeradas, e depois restaurar
   `docs/imagens/` (não se commita imagem nesta rodada).

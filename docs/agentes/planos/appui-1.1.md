# Plano appui-1.1 — Estrutura da janela: barra lateral fixa

Base 1a238bb · ramo roadmap/appui-1.1 · Triagem: M5 (+M1), ~180 linhas + ~100 de teste, risco médio.

## Desenho
- `index.html`: as quatro telas (`#cartao`, `#tela-backups`, `#tela-config`, `#tela-boas-vindas`) entram dentro de
  `.janela` > `nav#barra` (Início, Backups, Grupo, Configurações; ícone + nome) + `div.conteudo` (máx. 960 px, centralizado).
  Faixa de demonstração sai do `position: fixed` e fica no fluxo, por cima da janela.
- `navegacao.ts` (novo, ~80 linhas, sem roteador): lê qual tela está visível (MutationObserver em `hidden`), marca o item atual
  (`aria-current="page"`), esconde a barra na Boas-vindas (primeira vez), e navega **reaproveitando os botões que já existem**
  (`voltar-backups`, `config-voltar`, `ver-backups`, `ver-config`). Grupo abre a seção atual de Grupo (1.4 cria a tela própria).
  Teclado: Tab entra na barra; setas cima/baixo/Home/End movem entre itens (roving tabindex).
- Funções puras testáveis (`proximoIndice`, `areaDeTela`) em `navegacao-regras.ts` + teste vitest.
- `tokens.css`: escala de tipografia, espaços extras, sombras suaves, cores de estado (ligado/desligado/atenção) nos dois temas;
  `tokens.test.ts` confere contraste AA dos novos pares. `docs/design-system.md` atualizado.
- `tela.css`: layout da janela; `tela.ts`/outros módulos de tela **não mudam** (nenhuma mudança de conteúdo).
- `principal.ts`: `minWidth`/`minHeight` da janela (720 x 480).
- `copiar-ui.mjs` não muda (só .ts novo, compilado pelo tsc; ficha S-19 conferida).

## Testes
- vitest: regras da navegação + tokens novos (falham antes).
- e2e (estender, não quebrar): `navegacao.e2e.ts` — cada item abre sua tela e marca o atual; setas/Tab; barra some nas Boas-vindas;
  capturas antes/depois (SABRE_CAPTURAS=1).

## Fora
Servidor, mundo, cartório, ponte.ts, boas-vindas.ts, conteúdo das telas.

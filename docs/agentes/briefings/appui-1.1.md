# Briefing appui-1.1 — Estrutura da janela: barra lateral fixa

BASE: 1a238bb0a54d2542e89be0a45e035dec55eb23c0 · RAMO: roadmap/appui-1.1 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface), impeccable (audit antes, polish depois)
LEIA: docs/roadmap-appui.md inteiro ("O que está ruim hoje", "Metas"); docs/design-system.md; qualidade-sabre › references/interface.md
TRIAGEM: M5 (+M1), ~180 linhas + ~100 de teste, risco médio. Reaproveitar a troca de tela por `<main class="cartao" hidden>` (index.html, tela.ts `$(id)`), tokens.css, .principal/.secundario. NÃO ESCREVER: roteador/SPA nem biblioteca de componentes; nada de mudar ponte.ts ou lógica do servidor; não mexer em boas-vindas.ts (primeira vez fica sem barra lateral); token novo só com teste em tokens.test.ts. Grupo ainda sem tela própria (liga ao 1.4; pode abrir a seção atual de grupo). ATENÇÃO: estender (não quebrar) os e2e que buscam #cartao/#tela-backups/#tela-config/#tela-boas-vindas (backups, boas-vindas, configuracoes, demonstracao, importar, inicio, tela-inicial .e2e.ts) e o janela.e2e.ts (appmel-1.27). Captura: apps/desktop/e2e/captura.ts (registrarCaptura), SABRE_CAPTURAS=1; capturas antes (da main) e depois no PR.

## Item (texto literal do roadmap)
- [ ] **1.1 — Estrutura da janela: barra lateral fixa e área de conteúdo**
  *O que fazer:* trocar "cartão que troca de tela" por uma estrutura fixa: barra lateral com **Início, Backups, Grupo, Configurações** (ícone + nome, item atual destacado), faixa de demonstração por cima, conteúdo à direita com largura boa (máx. ~960 px, centralizado), tamanho mínimo da janela. Atualizar `tokens.css` (escala de tipografia, espaços, sombras suaves, cores de estado: ligado/desligado/atenção) e `docs/design-system.md`. As telas atuais entram dentro da estrutura sem mudar de conteúdo ainda.
  *Arquivo:* `apps/desktop/src/ui/index.html`, `tela.css`, `tokens.css`, `tela.ts`, `docs/design-system.md`, testes
  **Tela no app:** barra lateral › Início / Backups / Grupo / Configurações.
  *Confirmação:* e2e: cada item da barra abre a sua tela e marca o atual; teclado (Tab/setas) navega; captura antes/depois.


## Regras desta onda
- Só interface: nada muda em servidor, mundo ou cartório. pt-BR, sem termo técnico, claro e escuro, janela redimensionável.
- Teste do app empacotado: ficha S-19 (arquivos lidos em runtime estão em `files` do electron-builder.json).
- Linhas obrigatórias no PR: `Tela no app:`, `Regressão:` (ou por que não), Triagem/Segurança/Integridade/Enxugamento/Roteamento. Rode também `npm run vistoria:comum`; `npm ci` no próprio worktree.
- Capturas antes/depois dentro do PR (arquivos pequenos em docs/capturas/ ou como o repo já faz).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appui-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` e `vistoria:comum` APROVADAS
- [ ] PR com as seções do modelo

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada.

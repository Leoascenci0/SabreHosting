# Briefing appuimel-2.1 — Direção v2 documentada e tokens novos

BASE: 7fb0ea425f164221e2b93de60cc1e1110a87887e · RAMO: roadmap/appuimel-2.1 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface e enxugar; integridade só onde tocar backup/mundo), impeccable
Tela segue PRODUCT.md (raiz) e docs/design-system.md; direção v2 = bloco 2 de docs/roadmap-appui-melhoria.md (copia a ORGANIZAÇÃO de um painel de referência, nunca o visual: sem fonte monoespaçada em caixa alta, sem paleta marrom/rosa, sem ícones de bloco, sem nome/arquivo do outro produto; mantém tema claro e escuro, azul-petróleo, fonte do sistema, tudo empacotado). A captura de referência NÃO está no repo: a descrição do roadmap basta.
Launcher impeccable (de apps/desktop): /home/user/SabreHosting/.claude/skills/impeccable/scripts/impeccable context ; rode audit e polish antes de entregar e o detector uma vez no fim.
PR deve ter as linhas "Regressão:" e "Tela no app:" (S-10). Teste que falha antes e passa depois; e2e solto precisa de npm run build (S-20); npm ci no próprio worktree (S-05); capturas claro e escuro em docs/imagens/appuimel-<id>/ quando houver tela.
Não pode quebrar: regras de ouro do mundo (ninguém muda comportamento de backup/hospedar, só apresentação), confirmações existentes, teclado, janela mínima 720x480. Tetos de scripts/limites.json só descem.
LEIA: qualidade-sabre §interface; impeccable (modo Operate, passo document); docs/design-system.md inteiro
TRIAGEM: M3 (molde dos tokens e do teste de contraste existentes) + documento, ~70 linhas, risco baixo, MIÚDO. Reaproveitar apps/desktop/src/ui/tokens.css (padrão --cor-*, --espaco-*, tema escuro em @media prefers-color-scheme) e tokens.test.ts (helpers bloco(), luminancia(), contraste(); teste de paridade de --cor-* entre os temas). NÃO escrever helper novo de contraste; NÃO mexer em index.html/tela.css. Passos: (1) seção "Direção v2" em docs/design-system.md; (2) tokens.css só o que falta: superfícies em camadas (claro/escuro), borda por estado, tamanho de número grande, numerais tabulares como regra; (3) tokens.test.ts: contraste AA (>=4,5 texto, >=3 borda/ícone) dos pares novos nos dois temas.

## Item (texto literal do roadmap)
- [ ] **2.1 — Direção v2 documentada e tokens novos**
  *O que fazer:* escrever a seção "Direção v2" em `docs/design-system.md` (abas no topo, chip de estado, cartão principal,
  peças de estado, grade de números, seção recolhível, rodapé; o que é "original" e o que não se faz) e acrescentar em
  `tokens.css` só o que falta (camadas de superfície, borda por estado, numerais tabulares, tamanhos de número grande).
  Nenhuma tela muda neste item. Contraste AA conferido nos dois temas em `tokens.test.ts`.
  *Arquivo:* `docs/design-system.md`, `apps/desktop/src/ui/tokens.css`, `tokens.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste de contraste dos tokens novos nos dois temas; `impeccable` `document` conferido.
  *Origem:* Eliel · 02/11/2026
Direção (bloco 2): original por três escolhas — (1) estado como frase em português, não etiqueta; (2) superfícies em camadas claras com borda de estado em cor + ícone + palavra (nunca só cor); (3) números grandes tabulares, sempre com comparação ("4,1 GB, era 5,3 GB"). Honestidade dos dados: só número que o app sabe; senão "—" com razão em dica; nada de TPS. Sem arrastar/reordenar seções (só recolher/abrir). Sem mapa do mundo. Modo Operate.

## Decisões que valem para este item
2026-11-02 Interface v2 pela estrutura de um painel de referência, original no visual (DECISOES.md).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appuimel-2.1.md como primeiro commit
- [ ] Teste de contraste dos tokens novos nos dois temas (falha antes, passa depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada (direção reversível; documente como tal).

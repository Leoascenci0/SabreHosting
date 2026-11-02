# Briefing appuimel-2.2 — Casca nova: barra superior com abas e chip de estado, rodapé

BASE: f91f97a437d7ddf72a334235b2c002223d721b3a · RAMO: roadmap/appuimel-2.2 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface e enxugar), impeccable
Tela segue PRODUCT.md (raiz) e docs/design-system.md; direção v2 = bloco 2 de docs/roadmap-appui-melhoria.md (copia a ORGANIZAÇÃO de um painel de referência, nunca o visual: sem fonte monoespaçada em caixa alta, sem paleta marrom/rosa, sem ícones de bloco, sem nome/arquivo do outro produto; mantém tema claro e escuro, azul-petróleo, fonte do sistema, tudo empacotado). A captura de referência NÃO está no repo: a descrição do roadmap basta.
Launcher impeccable (de apps/desktop): /home/user/SabreHosting/.claude/skills/impeccable/scripts/impeccable context ; rode audit e polish antes de entregar e o detector uma vez no fim.
PR deve ter as linhas "Regressão:" e "Tela no app:" (S-10). Teste que falha antes e passa depois; e2e solto precisa de npm run build (S-20); npm ci no próprio worktree (S-05); capturas claro e escuro em docs/imagens/appuimel-<id>/ quando houver tela.
Não pode quebrar: regras de ouro do mundo (ninguém muda comportamento de backup/hospedar, só apresentação), confirmações existentes, teclado, janela mínima 720x480. Tetos de scripts/limites.json só descem.
Tokens e "Direção v2" já estão em docs/design-system.md e tokens.css (appuimel-2.1 mergeado); use-os.
LEIA: qualidade-sabre §interface (teclado, aria-current, estados); enxugar (não tirar a navegação por teclado)
TRIAGEM: M5 (+M1 para navegacao.ts/navegacao-regras.ts), ~180 linhas (HTML ~50, CSS ~90, TS ~40), risco médio. Arquivos: ui/index.html (nav#barra L20-47, 4 .item-barra; cartão #cartao), tela.css (.janela grid, .barra, .item-barra, .barra[hidden]+.conteudo), navegacao.ts (já pronto: troca de telas, setas/Home/End, aria-current; só ajustar seletor/âncora), navegacao-regras.ts (AREAS, areaDeTela intactos), tela.ts (desenhar() L86-170 já calcula dataset estado/tom: use como fonte do chip; clique no chip = ir("inicio")), tokens.css --largura-barra (tokens.test.ts L100 exige; ajuste teste junto se remover), docs/design-system.md. Reaproveitar EstadoInicio da ponte, sem chamada nova. NÃO escrever roteador novo, segunda máquina de estado nem sistema de teclado novo. Riscos: e2e dependem da barra lateral — navegacao.e2e.ts (.item-barra, #barra, data-area, aria-current="page", svg=4, tabIndex, Home/End, "Boas-vindas sem barra" via #barra hidden), backups.e2e.ts L80, acabamento.e2e.ts L97-102, importar.e2e.ts L131, mods.e2e.ts L260, grupo.e2e.ts L18: mantenha data-area e #barra (ou atualize os e2e no mesmo PR, sem afrouxar o que provam). Janela mínima 720x480 (confira onde é criada em main/principal.ts). O rodapé usa dados já existentes (versão do app via rotulo-versao.ts, nome do grupo via grupo.ts, estado do cartório); sem chamada nova se já houver.

## Item (texto literal do roadmap)
- [ ] **2.2 — Casca nova: barra superior com abas e chip de estado, rodapé de estado**
  *O que fazer:* trocar a barra lateral por **barra superior**: nome do app, abas **Início, Backups, Grupo, Configurações**
  (a aba atual marcada), e à direita um **chip de estado** sempre visível ("Desligado", "Ligando…", "2 online") que abre
  o Início ao clicar. Rodapé fino: versão do app, nome do grupo e estado do cartório. Janela mínima 720 x 480: abas viram
  só ícone abaixo de 840 px. Navegação por teclado (setas, Home, End, Tab) e `aria-current` mantidas.
  *Arquivo:* `apps/desktop/src/ui/index.html`, `tela.css`, `tela.ts`, `navegacao.ts`, `docs/design-system.md`, testes
  **Tela no app:** barra superior (todas as telas); chip de estado.
  *Confirmação:* e2e: abas levam a cada tela; chip muda com o estado do servidor falso; teclado percorre as abas.
  *Depende de:* 2.1

## Decisões que valem para este item (Máxima, reversíveis; liste em "Decidi por você" no PR)
- "Ligando…" NÃO vira tipo novo em EstadoInicio: o chip mapeia de "ninguem"+trabalho em curso (ligando/preparando). Rótulos do chip: "Desligado", "Ligando…", "N online" (N = jogadores quando eu hospedo; "Online" se não se sabe), "<nome> hospeda" quando outro hospeda, "Sem cartório". Sempre cor + ícone + palavra.
- Se não houver nome do grupo/versão disponíveis sem chamada nova, o rodapé mostra "—".
- Sem tela nova de Mods na barra (continua como hoje).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appuimel-2.2.md como primeiro commit
- [ ] e2e: abas levam a cada tela; chip muda com o estado do servidor falso e clicar nele abre o Início; teclado percorre as abas; abas só ícone abaixo de 840 px; janela 720x480 sem rolagem horizontal
- [ ] Capturas claro e escuro em docs/imagens/appuimel-2.2/ (npm run build antes dos e2e, S-20)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos. Conteúdo do Início (cartão principal, grade) é do 2.4: não refaça.

## O que NÃO decidir
Nada.

# Briefing chunk-1.6 — Tela Mundo: escolher a área, ver a prévia, confirmar, resetar, desfazer

BASE: a2a6f010e2532992dc6d65402003ac6de63f78e9 · RAMO: roadmap/chunk-1.6 · MODELO: sonnet (gatilho Opus: nenhum)
SKILLS: using-superpowers, qualidade-sabre (partes `interface` e `integridade`), impeccable
LEIA: PRODUCT.md; docs/design-system.md (Direção v2, casca nova); docs/ops/rodadas/onda-2026-11-02-46.md; docs/roadmap-chunk.md (item 1.6)
TRIAGEM: M5 (+M1), ~450 linhas, risco alto. Reaproveitar: ponte `ui/ponte.ts:257` (mundo.estado/planejar/resetar/desfazer/descartarPendencia) e `main/preload.cts:71-80`; handlers em `main/principal.ts:798-820` e `main/mundo.ts`; `listarRegioes` em `packages/nucleo/src/mundo/regioes.ts:83` (sem IPC ainda: criar canal `sabre:mundo:regioes`); `main/tamanho-mundo.ts`; `ui/secao.ts` (ligarSecao); `navegacao-regras.ts` (AREAS); moldes de e2e `e2e/backups.e2e.ts` e `e2e/captura.ts`. NÃO escrever: motor de prévia/plano/hash na UI (vem do main), recusas na tela (o main já recusa; a tela só desliga o botão e mostra a mensagem), nova função de desfazer. Passos: (1) navegação + aba "Mundo"; (2) canal de regiões e "servidor ligado" no estado se faltar; (3) `ui/mundo.ts`; (4) index.html/tela.css com tokens; (5) `fake-e2e.ts` com 2–3 `.mca` inventados; (6) `e2e/mundo.e2e.ts` + capturas.

## Item (texto literal do roadmap)
Ver `docs/roadmap-chunk.md` item 1.6 (nova aba Mundo na casca do appuimel bloco 2: dimensão; área por coordenadas e "Raio em blocos ao redor de um ponto" + grade de regiões do que existe no disco para clicar, sem mapa de terreno; prévia "Vai apagar 64 chunks (…). Um backup é feito antes."; confirmação digitando o nome do mundo; progresso e resultado; botão "Desfazer o último reset"; botão desligado com "Pare o servidor para resetar" com servidor ligado).
Arquivo: `apps/desktop/src/ui/mundo.ts`, `index.html`, `tela.css`, `navegacao.ts`, `docs/design-system.md`, e2e (+ canal de regiões em principal.ts/preload.cts/ponte.ts e `fake-e2e.ts`).
Tela no app: Mundo › Dimensão › Área › "Resetar…" › confirmação; "Desfazer o último reset".

## Pontos que a Onda 46 deixou para esta tela (obrigatórios)
1. "Desfazer o último reset" com a confirmação que o núcleo exige: mostrar o aviso `jogadoDepois` (mundo foi jogado depois do reset; desfazer perde esse jogo) e pedir confirmação do dono.
2. Estado `conflito` do mundo só sai por `descartarPendencia` com `confirmado===true`: botão com confirmação do dono (nome do mundo digitado), texto claro em português ("o mundo daqui e o do grupo divergiram…", sem termo técnico).
3. Versão pendente bloqueia Hospedar: a tela explica o que fazer, sem termo técnico.
4. Prévia em "setores reaproveitáveis" (zerar o cabeçalho não encolhe o .mca): em palavras simples com comparação ("libera cerca de 4 MB de 2,2 GB"). Número sempre com a comparação.
5. Teto de 1024 chunks e raio de 1000 blocos sem confirmar: acima disso, confirmação extra mostrando o número.
6. Botão desligado com servidor rodando ("Pare o servidor para resetar") e, para quem não é o dono, a ação nem aparece (o main também recusa).

## Regras de interface
- Ação que apaga: confirmação com nome do mundo e data do backup/estado. Ação demorada: progresso e botão travado (sem duplo clique). Erro em texto fixo seguro, sem caminho cru (S-14).
- Termo técnico fora da tela: "região"/"chunk" explicados em uma frase na primeira vez ("pedaço do mundo de 16 x 16 blocos").
- Siga a casca nova e os componentes da v2 (seção recolhível, peças de estado); não copie o visual de nenhum outro produto. `impeccable` audit e polish (cwd apps/desktop, caminho absoluto do launcher; se o detector estiver negado na nuvem, auditoria por script como na Onda 45).
- Teclado completo (tab, enter, esc, foco visível, rótulos).
- Demonstração: ação recusada (mensagem do main), nunca escreve.

## Decisões que valem para este item
- 2026-11-02: reset só com servidor parado e trava; só o dono do grupo, no PC com a trava; backup `antes-de-resetar`; troca atômica; gera versão nova; Desfazer restaura o backup.
- Onda 46 (reversíveis): Desfazer não recusa por jogo posterior, avisa `jogadoDepois` e pede confirmação; versão pendente bloqueia Hospedar até publicar; `descartarPendencia` só remove marcador (nunca mundo/backup).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/chunk-1.6.md como primeiro commit
- [ ] Testes unitários (navegação, lógica da tela) e e2e com servidor falso e mundo inventado que falham antes e passam depois: botão desligado com servidor ligado; prévia bate com o plano; confirmação errada não reseta; resetar e desfazer; demonstração recusa; teclado
- [ ] Capturas claro e escuro em docs/imagens/chunk-1.6/
- [ ] e2e solto precisa de `npm run build` antes (S-20); `npm ci` no próprio worktree (S-05)
- [ ] `npm run vistoria` APROVADA (e `npm run vistoria:comum` se mexer em infra; aqui provável que não)
- [ ] PR (modelo em .github/pull_request_template.md) com `Refs`, as linhas `Regressão:` e `Tela no app:` (S-10), `Triagem:`, `Segurança:`, `Integridade:`, `Enxugamento:`, `Roteamento:`, "O que NÃO foi confirmado" (teste no Windows com servidor real é ⏸️ P do Eliel), "Achados fora do escopo", "Soluções", "Melhorias encontradas"

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/ops/bom-dia.md, docs/ops/custos.md, máquina da nuvem real, mundo real dos amigos, qualquer segredo. Só mundos inventados (`tests/mundos/` ou gerados no teste).

## O que NÃO decidir (perguntar à orquestradora)
Regra do grupo (quem pode resetar já decidido: só o dono). Nada mais.

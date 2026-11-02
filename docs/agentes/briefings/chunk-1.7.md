# Briefing chunk-1.7 — Acabamento e tutorial de teste

BASE: 1ed10ab111c8cb3660d601a6a5e9f83047a32655 · RAMO: roadmap/chunk-1.7 · MODELO: sonnet (gatilho Opus: nenhum)
SKILLS: using-superpowers, qualidade-sabre (interface), impeccable (audit e polish)
LEIA: PRODUCT.md; docs/design-system.md; docs/roadmap-chunk.md (item 1.7); docs/tutoriais/2026-11-01-ensaio-instalador.md; docs/tutoriais/ (estilo dos outros)
TRIAGEM: M1/M4 (ajustes pequenos na tela já existente + documento), ~150 linhas, risco médio (a tela dispara apagar mundo; não enfraquecer nenhuma trava).

## Item (texto literal do roadmap)
`impeccable` audit/polish na aba Mundo; tutorial passo a passo em `docs/tutoriais/chunk-resetar.md` (como testar com um mundo de teste, nunca o real) e linha no tutorial do ensaio do instalador.
Arquivo: `apps/desktop/src/ui/mundo.ts`, `docs/tutoriais/chunk-resetar.md`, testes. Tela no app: Mundo.
Confirmação: e2e completo verde; no Windows com servidor Minecraft real, em mundo de teste **[P: Eliel]** (registre no PR como não confirmado e siga).

## Ressalvas dos qa do 1.6 (PR #311, mergeado) a corrigir aqui, cada uma com teste que falha antes e passa depois
- MÉDIO (interface): `marcar()` na grade: duas regiões afastadas viram o menor retângulo que as cobre e apaga também regiões não marcadas. Fazer a dica da grade e a prévia dizerem isso em palavras simples (ou impedir seleção não contígua; a opção que mantiver o comportamento do núcleo intacto e for mais segura). A prévia deve mostrar o número real de pedaços e regiões afetadas.
- Foco se perde ao confirmar (`fecharConfirmacao(false)` esconde o bloco): devolver o foco ao botão ou ao título.
- Com o nome do mundo vazio, "confirmar" fica desligado sem explicação: explicar.
- "Descartar este aviso…" desligado com servidor ligado: pôr a dica ao lado.
- `textoDaPublicacao` no caso `pendente` repete `pub.aviso` e `SEM_TERMO.aguardando`: tirar a repetição.
- Alertdialog de área grande não fecha com Esc; grade sem teto de botões (pôr teto razoável e aviso).
- Captura escura: campo do nome parece barra cinza clara; conferir tokens de campo da v2.
- (integridade, menor) a 2ª confirmação do desfazer-forte não mostra a data do backup: mostrar. O teto 1.024 / 1.000 está duplicado em texto fixo na tela: ler do núcleo/ponte se for barato.
- Auditoria `impeccable`: se o detector estiver negado na nuvem, auditoria por script como na Onda 45. Capturas novas claro e escuro em docs/imagens/chunk-1.7/.
Não mexer em: regras do main/núcleo (recusas, teto, troca atômica). A confirmação com nome do mundo ficar só na tela é decisão aceita da Onda 46 (registre uma linha em docs/ops/DECISOES.md? NÃO: só descreva no PR).

## Tutorial `docs/tutoriais/chunk-resetar.md`
Passo a passo para o Eliel, em pt-BR leigo, com mundo de TESTE criado de propósito (nunca o real): criar mundo de teste, abrir Mundo, escolher dimensão e área, ver a prévia, confirmar digitando o nome, resetar, conferir o backup `antes-de-resetar`, desfazer, e o que fazer nos avisos (servidor ligado, conflito, versão pendente). Acrescentar linha no `docs/tutoriais/2026-11-01-ensaio-instalador.md` apontando para ele (sem mexer no link do artefato: a orquestradora atualiza).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/chunk-1.7.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); e2e completo verde (`npm run build` antes, S-20; `npm ci` no worktree, S-05)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com `Regressão:`, `Tela no app:`, Triagem/Segurança/Integridade/Enxugamento/Roteamento, "O que NÃO foi confirmado" (Windows com servidor real: ⏸️ P do Eliel), Achados, Soluções, Melhorias

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/ops/bom-dia.md, docs/ops/custos.md, nuvem real, mundo real, segredo.

## O que NÃO decidir
Nada (decisões já tomadas).

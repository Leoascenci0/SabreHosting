# Briefing appuimel-2.5 — Seção recolhível padrão e Backups v2

BASE: f9893b8906dced7304dc14052f60f77573deda82 · RAMO: roadmap/appuimel-2.5 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface, enxugar; integridade onde tocar backup), impeccable (cwd apps/desktop, caminho absoluto do launcher; audit e polish antes de entregar, detector uma vez no fim)
LEIA: qualidade-sabre §1 e interface; docs/design-system.md (Componentes, Direção v2); PRODUCT.md
TRIAGEM: M5 (+M1), ~170 linhas (+~80 e2e/testes), risco médio. Reaproveitar: tamanhoDe/origemDe/dataDe (ui/backups.ts), dataEmPalavras/haQuanto (ui/ha-quanto.ts), .lista-backups (tela.css), #backups-confirmacao (restaurar fica como está), molde `.painel details` (tela.css) e o padrão de inicio-regras.ts (regra pura testada). NÃO escrever: IPC novo, varredura de disco, nova confirmação, componente genérico além da seção, lógica de rotação/agendador. Passos: (1) função pura resumoDeBackups(itens, agora, intervaloMin) com teste (quantos, último "há quanto", soma de tamanho, "a cada N min"); (2) listar() ganha só o intervalo (preferencias.ts); (3) seção com cabeçalho e botão aria-expanded; lembrança aberta/fechada em localStorage do renderer (confirmar que a CSP deixa; com try/catch, nunca quebra sem ele); (4) resumo no topo; (5) design-system.md; (6) e2e. Estimativa costuma estourar ~4x em tela: confira no fim.

## Item (texto literal do roadmap)
- [ ] **2.5 — Seção recolhível padrão e Backups v2**
  *O que fazer:* criar o componente **seção** (cabeçalho com título, atalho "Ver tudo →" e seta de recolher; lembra
  aberta/fechada por tela, só preferência local) e aplicar em Backups: resumo no topo (quantos, o último há quanto
  tempo, espaço usado, próximo automático) e a lista abaixo; "Fazer backup agora" e "Restaurar" mantidos como estão.
  *Arquivo:* `apps/desktop/src/ui/backups.ts`, `index.html`, `tela.css`, `docs/design-system.md`, e2e
  **Tela no app:** Backups (resumo e seção da lista).
  *Confirmação:* e2e (recolher/abrir, resumo bate com a lista, restaurar continua pedindo confirmação).
  *Depende de:* 2.2

## Decidi por você (Máxima, reversível)
- "Ver tudo →" não tem prévia para expandir hoje: a seção só recolhe e abre; o atalho "Ver tudo →" fica no componente (opcional, escondido) mas **não aparece** em Backups.
- "Próximo automático" = "a cada N min, com servidor pronto" (agendador não expõe a próxima hora; sem número inventado).

## Decisões que valem
Interface v2: original no visual (nada de fonte monoespaçada em caixa alta, paleta marrom/rosa, ícones de bloco, nome do outro produto); honestidade dos dados ("—" com razão); sem arrastar/reordenar; temas claro e escuro; janela mínima 720x480; teclado mantido. Nenhuma regra de backup/restaurar/confirmação muda.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appuimel-2.5.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois): unitário de resumoDeBackups + e2e de Backups (recolher/abrir, resumo bate com a lista, restaurar ainda pede confirmação); e2e solto precisa de `npm run build` (S-20); `npm ci` no próprio worktree (S-05)
- [ ] Capturas claro e escuro em docs/imagens/appuimel-2.5/
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento e as linhas **Regressão:** e **Tela no app:** (S-10)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada.

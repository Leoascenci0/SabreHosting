# Briefing appuimel-2.6 — Grupo, Mods e Configurações na casca nova

BASE: 8eda4aa41b54a87e24c15c5a144caf17e3f0df4d · RAMO: roadmap/appuimel-2.6 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface e enxugar), impeccable (cwd apps/desktop, caminho absoluto do launcher; audit e polish ANTES de entregar, detector uma vez no fim; diga no PR o que achou)
LEIA: qualidade-sabre §1 e interface; docs/design-system.md (Direção v2, Seção recolhível); PRODUCT.md
TRIAGEM: M3 (+M1), ~300 linhas (código ~200 + e2e ~90), risco médio no limite. Reaproveitar: componente seção do 2.5 (index.html `<section class="secao">`, tela.css, JS lembrarSecao/aplicarSecao de backups.ts, chave `sabre:secao:backups`) → extrair para `ui/secao.ts` com `ligarSecao(seta, corpo, chave)` usado por backups, grupo, mods, configuracoes (nada de 2ª/3ª cópia; e2e de backups continua verde); dataEmPalavras (ha-quanto.ts) para "visto há…"; `.barra-salvar` + `#config-pendente` só mudam de lugar para o rodapé; irParaAba e abas Geral/Servidor/Backups já existem. NÃO escrever: CSS de seção novo, aba nova, barra de salvar nova, gate novo de dono (`area.hidden = !g.dono` fica), reescrever e2e (só acrescentar casos, sem afrouxar asserção), mexer em confirmações ("Tirar do grupo", "Tirar da lista").
ENTREGA EM 2 COMMITS para manter o diff revisável: (1) secao.ts + Grupo + Mods; (2) Configurações + barra de salvar no rodapé. Um PR só.

## Item (texto literal do roadmap)

- [ ] **2.6 — Grupo, Mods e Configurações na casca nova**
  *O que fazer:* levar Grupo (PCs, convite), Mods e Configurações (abas Geral/Servidor/Backups) para o mesmo vocabulário:
  seções recolhíveis, peças de estado nos PCs ("online", "visto há…"), barra de salvar no rodapé dentro do novo rodapé.
  Nenhuma regra muda (só o dono vê convite e mods; confirmações iguais).
  *Arquivo:* `apps/desktop/src/ui/grupo.ts`, `mods.ts`, `configuracoes.ts`, `index.html`, `tela.css`, e2e
  **Tela no app:** Grupo, Mods, Configurações.
  *Confirmação:* e2e existentes passam sem afrouxar; capturas dos dois temas.
  *Depende de:* 2.5

## Decisões que valem
Interface v2: original no visual (nada de fonte monoespaçada em caixa alta, paleta marrom/rosa, ícones de bloco, nome do outro produto); honestidade dos dados ("—" com razão; "visto há…" só se o dado existir); sem arrastar/reordenar; claro e escuro; janela mínima 720x480; teclado mantido. Nenhuma regra muda: só o dono vê convite e mods; confirmações iguais.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appuimel-2.6.md como primeiro commit
- [ ] e2e existentes passam sem afrouxar; e2e novos (recolher/abrir e lembrar por tela; dono vê convite e mods; não-dono não) que falham antes e passam depois; `npm run build` antes de e2e solto (S-20); `npm ci` no próprio worktree (S-05)
- [ ] Capturas claro e escuro em docs/imagens/appuimel-2.6/ (sem regravar PNGs de outras pastas: se o e2e regravar, restaure com git checkout dos arquivos alheios)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, **Regressão:** e **Tela no app:** (S-10), e o que o audit/polish achou

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada.

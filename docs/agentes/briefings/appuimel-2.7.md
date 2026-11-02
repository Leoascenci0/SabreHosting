# Briefing appuimel-2.7 — Acabamento da v2: auditoria, polimento e comparação

BASE: 9805556971e0f62c1c19e0208925fd2419bd7761 · RAMO: roadmap/appuimel-2.7 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface e enxugar), impeccable (cwd apps/desktop, caminho absoluto do launcher; audit e polish em TODAS as telas, detector uma vez no fim)
TRIAGEM: M4 (correções pontuais) + M1; pulada pelo agente por ser item de acabamento: estimativa ~150 linhas + testes; risco médio (tela). Não escrever: tela nova, componente novo, mudança de comportamento.

## Item (texto literal do roadmap)

- [ ] **2.7 — Acabamento da v2: auditoria, polimento e comparação**
  *O que fazer:* `impeccable` `audit` e `polish` em todas as telas; conferir contraste, foco, teclado, janela mínima, tema
  claro e escuro; confirmar que nada ficou parecido demais com a referência (fonte, paleta, ícones, nomes); teto de RAM do
  app parado e tamanho do instalador conferidos contra `scripts/limites.json` (só descem). Capturas finais.
  *Arquivo:* `apps/desktop/src/ui/`, `docs/design-system.md`, `docs/imagens/appuimel-2.7/`, testes
  **Tela no app:** todas.
  *Confirmação:* e2e completo verde; auditoria sem item grave; no Windows com o instalador novo **[P: Eliel]**.
  *Depende de:* 2.6

## Backlog das ondas 44/45 que cabe aqui (resolver sem mudar comportamento; o que não couber, listar em "Melhorias encontradas")
1. Coluna lateral do Início cai sob a grade em 720 px e a captura "eu-claro" sai rolada: ajustar o layout em 720x480.
2. Intervalo de 15 s do Início sem e2e: acrescentar e2e (relógio/atualização com a tela aberta; sem afrouxar nada).
3. Borda de estado >=3 sem teste (tokens.test.ts / contraste contra fundo): acrescentar o teste nos dois temas.
4. Tamanho do mundo (apps/desktop/src/main/inicio.ts): sem teto de entradas/tempo no percurso e cache de 30 s sem deduplicar chamadas simultâneas: pôr teto (entradas e tempo; ao estourar, devolve ausente "—") e dedupe da promessa em andamento, com testes; mundo de teste inventado.
5. Rodapé com barra de salvar + mensagem de erro pode ficar alto em 720x480 (nota do qa do 2.6): conferir e ajustar.
6. Backups: "Fazer backup agora" com backup em curso mostra erro genérico; só ajustar o texto se já couber no mesmo arquivo sem mudar comportamento (senão, só relatar).
Conferir também: nada ficou parecido demais com a referência (fonte, paleta, ícones, nomes: grep por termos do outro produto); teto de RAM do app parado e tamanho do instalador contra scripts/limites.json (só descem; hoje o ensaio dá ~122.588.088 B; reporte a medida, não suba teto). Capturas finais claro e escuro de TODAS as telas em docs/imagens/appuimel-2.7/ (sem regravar PNGs de outras pastas).

## Decisões que valem
Interface v2 original no visual; honestidade dos dados; claro e escuro; janela mínima 720x480; teclado mantido; nenhuma regra de backup, hospedar, restaurar ou confirmação muda.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appuimel-2.7.md como primeiro commit
- [ ] Testes novos que falham antes e passam depois (itens 2, 3, 4); `npm run build` antes de e2e solto (S-20); `npm ci` no próprio worktree (S-05)
- [ ] `npm run vistoria` APROVADA (e `npm run vistoria:comum` não é necessário: nada em infra/)
- [ ] PR com as seções do modelo, linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, **Regressão:** e **Tela no app:** (S-10), resultado do audit/polish/detector e a medida de RAM/instalador
- [ ] Linha "⏸️ P (Eliel): conferir no Windows com o instalador novo" no PR (não é para você executar)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada.

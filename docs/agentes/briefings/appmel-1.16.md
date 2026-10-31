# Briefing appmel-1.16

BASE: c1aa2c0b709eb2e02338e609fea6eec2371b51e2 · RAMO: roadmap/appmel-1.16 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › integridade.md e seguranca.md (só o que o item toca); enxugar
TRIAGEM: M4 (a)+(b); (a) entrada-no-grupo.ts catch de esperarPronta ~166-168: falta await sessao.catch(() => undefined) antes de limpar; (b) principal.ts handler sabre:pasta:trocar ~541-547: bloquear Jogar após a troca; ~15 linhas; risco MÉDIO; (a) prova real no Windows é P

## Item (texto literal do roadmap; arquivo docs/roadmap-app-melhoria.md)
- [ ] **1.16 — Entrada no grupo: esperar a sessão elevada antes de limpar; bloquear Jogar após trocar a pasta**
  *O que fazer:* (a) em `entrada-no-grupo.ts` (~172-196) no caminho de falha, `await sessao.catch(() => undefined)` antes de `limpar()`, para o script ver o `cancelar.flag` e desinstalar o túnel provisório na hora (hoje pode ficar até 150 s); (b) em `principal.ts` (~543-547), depois do sucesso da troca de pasta e antes do `app.exit(0)` (1,5 s), bloquear o botão Jogar.
  *Arquivo:* `apps/desktop/src/main/entrada-no-grupo.ts`, `principal.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: falha de `esperarPronta` espera a sessão; Jogar recusado após a troca.
  *Origem:* appmel-1.13 · PR #219 · qa

## Decisões que valem para este item
nenhuma.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.16.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); PR traz `Regressão:` e `Tela no app:`
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada além do descrito; dúvida = avisar a sessão de onda.

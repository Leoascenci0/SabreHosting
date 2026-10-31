# Briefing appmel-1.2 — Teste de chamada de fora recusada pela ponte

BASE: 5816f23c5dfd65bdc8937c59f98485882f595a11 · RAMO: roadmap/appmel-1.2 · MODELO: sonnet (gatilho Opus: nenhum) · ISSUE: #129
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; §seguranca (ponte entre a tela e o processo principal)
TRIAGEM (Máxima): M1 + M4 | ~20 linhas + ~40 de teste | RISCO médio (segurança da ponte; só move e testa) | MIÚDO: não | ONDE: apps/desktop/src/main/principal.ts:137-140 veioDaPagina(evento) = navegacaoPermitida(evento.senderFrame?.url ?? "", PAGINA); usada em :156, :164, :168, :172; navegacaoPermitida já vem de seguranca.ts (confira) | PASSOS: 1. mover veioDaPagina para apps/desktop/src/main/seguranca.ts (exportada, recebendo o evento e a página), principal.ts importa; 2. seguranca.test.ts: remetente da página do app → aceita; senderFrame ausente/null, url de outra origem, file:// de outro arquivo, http(s) qualquer, url com a página como prefixo (ex. ...index.html.evil) → recusa; 3. mutação manual (veioDaPagina sempre true) derruba o teste | NÃO ESCREVER: mudança de comportamento da ponte; nova lista de canais; nada em ui/ | PROVA: testes novos; mutação conferida; vistoria APROVADA.

## Item (texto literal do roadmap)
- [ ] **1.2 — Teste de chamada de fora recusada pela ponte**
  *O que fazer:* teste que prova que `veioDaPagina` (processo principal) recusa chamada cujo remetente não é a página
  do app (hoje o código confere, mas nenhum teste cai se a conferência sumir).
  *Arquivo:* `apps/desktop/src/main/principal.ts` (extrair a conferência para `seguranca.ts`), `seguranca.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* sabotar a conferência derruba o teste.
  *Origem:* app-1.1 · PR #70 · qa

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.2.md como primeiro commit
- [ ] Testes novos em apps/desktop/src/main/seguranca.test.ts (a mutação derruba)
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #129) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/. Só principal.ts, seguranca.ts e o teste.

## O que NÃO decidir (perguntar à orquestradora)
nada

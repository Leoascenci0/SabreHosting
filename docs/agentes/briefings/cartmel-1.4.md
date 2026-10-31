# Briefing cartmel-1.4 — Prova de corrida com dois processos

BASE: 1c7c7dab8b1b31d5bab626e751e566cc4cbd96ce · RAMO: roadmap/cartmel-1.4 · MODELO: sonnet (gatilho Opus: nenhum; só teste) · ISSUE: #130
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; §integridade; docs/memoria/solucoes.md S-01 e S-03
TRIAGEM (Máxima): M1 | ~60 linhas de teste | RISCO médio (só teste; prova a regra "convite de uso único") | MIÚDO: não | ONDE: services/cartorio/src/banco.ts:197 usarConvite; transação com BEGIN IMMEDIATE em banco.ts:138 (confira qual caminho o usar do convite usa hoje — depois do cart-1.5 há o caminho novo em convite.ts com IP provisório e o antigo sem ip_prov) | PASSOS: 1. teste com 2 processos de verdade (child_process.fork de um script de teste, ou worker_threads, cada um com sua conexão SQLite ao MESMO arquivo de banco novo) que usam o mesmo convite ao mesmo tempo (barreira: ambos esperam um sinal para começar); 2. exatamente um vence, o outro recebe recusa (não erro de banco travado — SQLITE_BUSY tratado com busy_timeout?, diga); 3. repetir 20 vezes no teste (ou laço interno) sem falhar; 4. mutação manual: tirar a leitura de dentro da transação (ou trocar IMMEDIATE por DEFERRED) e mostrar que o teste falha (cole no PR) | NÃO ESCREVER: mudança no código de produção (se o teste revelar defeito real, PARE e avise a orquestradora com a prova); sleeps frágeis (use barreira) | PROVA: 20/20 verde; mutação vermelha; vistoria APROVADA; também como usuário comum se usar arquivo temporário (S-03).

## Item (texto literal do roadmap)
- [ ] **1.4 — Prova de corrida com dois processos**
  *O que fazer:* teste com 2 processos (ou worker_threads) abrindo um banco novo e usando o mesmo convite ao mesmo
  tempo; exatamente um vence.
  *Arquivo:* `services/cartorio/src/cartorio.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* o teste roda 20 vezes sem falhar e falha se a leitura da versão sair da transação.
  *Origem:* cart-1.1 · PR #15 · qa integridade

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-1.4.md como primeiro commit
- [ ] Teste novo (pode ser arquivo próprio ao lado, ex. services/cartorio/src/corrida.test.ts, se ficar mais limpo)
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #130) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/. Nenhuma mudança de produção.

## O que NÃO decidir (perguntar à orquestradora)
nada

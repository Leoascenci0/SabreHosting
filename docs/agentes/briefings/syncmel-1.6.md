# Briefing syncmel-1.6

BASE: 5f440cc0ff700894c7442a1c453a7a14543f1fad · RAMO: roadmap/syncmel-1.6 · MODELO: haiku
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; integridade §6 (provas)
TRIAGEM: M4 só em teste (packages/nucleo/src/sync/transferencia.test.ts), MIÚDO. Sem mudança de código de produção.

## Item (texto literal do roadmap)
- [ ] **1.6 — Provas que faltaram no servidor de sync (syncmel-1.2)**
(a) o teste "parcial do tamanho certo mas com conteúdo errado" passaria sem o código novo: contar os corpos servidos e exigir exatamente 1 (prova a conferência do hash antes de renomear); (b) testes próprios de headersTimeout e de maxConnections (17ª conexão não é atendida enquanto as 16 estão abertas).
Arquivo: packages/nucleo/src/sync/transferencia.test.ts. Tela: não se aplica. Confirmação: os testes falham ao remover cada opção do servidor (prove removendo temporariamente e mostre no PR). Ficha S-01: prazos explícitos só no teste, nunca afrouxar o que prova.

## Decisões que valem para este item
Fichas S-06 e S-07 de docs/memoria/solucoes.md (leia): token de geração tomado ANTES de qualquer await; tudo que um arquivo de estado manda apagar/renomear é entrada não confiável.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.6.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento (e Regressão:)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.

# Briefing migra-1.1 — Quem deve hospedar

BASE: 8db6cc10a72e293340342715e24ba884f83a7e10 · RAMO: roadmap/migra-1.1 · MODELO: sonnet · ISSUE: #52
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; references/integridade.md §5 (migração de host); docs/arquitetura.md §3.3 e §3.4
TRIAGEM: M7 (regra pura) · ~80 linhas (+~120 teste de tabela) · risco médio (decide, não executa) · MIÚDO: não.
REAPROVEITAR: `nota/formula.ts` (escala 100 = referência, sem teto), `nota/decidir.ts` (`permitirHospedar`).
NÃO ESCREVER: execução da troca (migra-2.x); chamadas ao cartório; relógio real (injete `agora`).
PASSOS: `packages/nucleo/src/migracao/decidir.ts`: `decidirHost({host, candidatos, versaoMaisNova, agora, folga = 1.3,
calmaMin = 10, ficarAte?})` PURA → `{acao: "manter" | "trocar" | "eleger", para?, motivo}`; candidato válido = online,
`permitirHospedar`, versão = a mais nova (regra de ouro 5), nota medida; sem host (caiu) → "eleger" o de maior nota
válido (empate: menor id, determinístico); com host → "trocar" só se melhor nota ≥ folga × nota do host, fora da
janela de calma (nenhuma troca nos últimos `calmaMin`) e sem `/ficar` vigente (`ficarAte > agora` → manter, motivo
"ficar"); host com versão atrasada ou sem permissão NÃO força troca aqui (só registra motivo) — a troca forçada é do
failover; folga < 1 recusada.
PROVA: testes de tabela: empate exato em 1,3×; 1,29× não troca; `/ficar` vigente e vencido; janela de calma; candidato
com versão atrasada ignorado; nenhum candidato válido → manter/sem eleito; eleição sem host determinística.

## Item (texto literal do roadmap)
- [ ] **1.1 — Quem deve hospedar**
  *O que fazer:* regra pura: candidatos online com versão em dia e permissão de hospedar; troca só se nota ≥ folga ×
  nota do host (padrão 1,3); respeitar `/ficar` (adiar 30 min) e janela de calma.
  *Arquivo:* `packages/nucleo/src/migracao/decidir.ts`
  **Tela no app:** Configurações › Grupo › "Folga para trocar de host". D6 decidida (folga 30%).
  *Confirmação:* testes de tabela cobrindo empate, `/ficar`, versão atrasada.
  *Depende de:* host-2.3, cart-1.3

## Decisões que valem para este item
- D6: folga 30% (1,3×), "Configurações › Grupo › Folga para trocar de host" (tela no app-2.2).
- Nota: 100 = PC de referência, sem teto (DECISOES 30/10).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/migra-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #52` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.

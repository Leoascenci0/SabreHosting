# Briefing cartmel-1.5 — Blindar a época da trava e o destino da passagem

BASE: 3a82250f2279a037be638cf4f62c308a7dc3b3a1 · RAMO: roadmap/cartmel-1.5 · MODELO: sonnet (esforço alto; revisão de integridade em Opus) · ISSUE: #26
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; references/integridade.md §1 e §6
TRIAGEM: M1 (`passar` de trava.ts; `abrirBanco` aceita lista de migrações) + M7 pequeno (gatilhos numa migração nova)
· ~45 linhas (+~110 teste) · risco ALTO (trava) · MIÚDO: não. NÃO ESCREVER: mecanismo novo de época; checagem de token
fora do UPDATE; mexer na migração v2 já publicada. PASSOS: 1) banco.ts: **nova migração v3 no fim de `MIGRACOES`** com
`BEFORE INSERT` e `BEFORE DELETE ON trava` → `RAISE(ABORT, ...)` (o INSERT da linha única já foi feito na v2; o BEFORE
INSERT pega também INSERT OR REPLACE); 2) trava.ts `passar`: no WHERE do mesmo UPDATE, destino ≠ origem e
`EXISTS (SELECT 1 FROM tokens WHERE pc_id = :para AND revogado_em IS NULL)`; recusa com motivo claro (reusar o tipo
existente ou um novo `destino_invalido`); 3) testes: INSERT OR REPLACE e DELETE na trava falham e a época não muda;
passar para si e para PC sem token ativo → recusa sem mudar nada; migração v1→v3 com PCs e tokens cadastrados (montar
v1 com `MIGRACOES.slice(0,1)`, reabrir com a lista completa) preserva tudo; ajustar o teste que espera `versao: 2`.
PROVA: cada gatilho e cada recusa falha antes e passa depois; corrida da trava continua verde.

## Item (texto literal do roadmap de melhoria)
- [ ] **1.5 — Trava: blindar a época e o destino da passagem**
  *O que fazer:* gatilhos `BEFORE DELETE` e `BEFORE INSERT` na tabela `trava` que recusam (hoje só o UPDATE é
  protegido; um `INSERT OR REPLACE` zera a época); `passar` recusa destino = o próprio PC e destino sem token ativo
  (`tokens.revogado_em IS NULL`); teste da migração v1→v2 com PCs já cadastrados.
  *Arquivo:* `services/cartorio/src/banco.ts`, `services/cartorio/src/trava.ts`, `services/cartorio/src/trava.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* `INSERT OR REPLACE` na trava falha; passar para si mesmo ou para PC sem token → recusa; migração v1→v2
  preserva os PCs.
  *Origem:* cart-1.2 · PR #22 · qa integridade + qa segurança

## Decisões que valem para este item
- Regra de ouro 1; época (fencing) nunca desce.
- **Numeração:** este item usa a migração **v3**; o cart-1.3 (próximo) usará a **v4**.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-1.5.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em services/cartorio/
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #26` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.

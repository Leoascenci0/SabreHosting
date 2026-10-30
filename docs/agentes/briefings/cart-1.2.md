# Briefing cart-1.2 — Trava de host com prazo e época

BASE: 88db9287f01a644ac6475348d42b30d8c4835564 · RAMO: roadmap/cart-1.2 · MODELO: opus (gatilho: lógica de trava de host) · ISSUE: #19
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; references/integridade.md §1 (trava) e §6; references/seguranca.md §2
TRIAGEM: M1 (migrações `MIGRACOES` de banco.ts, relógio `agora` injetável de servidor.ts, padrão `usarConvite`) + M7
(trava) · ~130 linhas (+~150 teste) · risco ALTO · MIÚDO: não. NÃO ESCREVER: relógio injetável (já existe); migrador
(já existe); "ler e depois escrever" na trava (proibido: um UPDATE condicional por operação, dentro de BEGIN
IMMEDIATE). PASSOS: 1) migração v2 no fim de `MIGRACOES`: tabela `trava` de uma linha (`dono_pc_id` NULL ou FK de
pcs, `expira_em`, `epoca` inteiro que só sobe); 2) `services/cartorio/src/trava.ts`: `pegar(pc, agora)` (livre ou
vencida → dono = pc, época +1), `renovar(pc, epoca, agora)` (só o dono atual com a época atual e não vencida),
`passar(de, para, epoca, agora)` (migração: só o dono com a época atual; época +1), `soltar(pc, epoca)`; cada uma
devolve {ok, epoca, expiraEm} ou o motivo da recusa; 3) rotas com token do PC: `POST /trava/pegar`, `/renovar`,
`/passar`, `/soltar`, `GET /trava`; 4) prazo e intervalo de renovação configuráveis (padrão: prazo 60 s, renovar a
cada 20 s, como no CLAUDE.md; recusar prazo < 3 × renovação).
PROVA: corrida honesta: 10 `worker_threads` (ou processos) abrindo o MESMO arquivo de banco e chamando `pegar` juntos
→ exatamente 1 ganha (rode o teste várias vezes); prazo vencido libera para outro (relógio injetado); renovar com
época velha → recusa (o "zumbi" que voltou não renova nem passa); passar sobe a época; soltar por quem não é dono →
recusa; época nunca desce (nem após soltar).

## Item (texto literal do roadmap)
- [ ] **1.2 — Trava de host com prazo e época**
  *O que fazer:* pegar, renovar, passar (para migração) e soltar a trava, de forma atômica; época sobe a cada troca
  de dono; prazo e renovação configuráveis.
  *Arquivo:* `services/cartorio/src/trava.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste de corrida: 10 PCs disputando → um só ganha; prazo vencido libera; época velha recusada.
  *Depende de:* cart-1.1

## Decisões que valem para este item
- Regra de ouro 1 do CLAUDE.md: um host por vez; trava renovada a cada ~20 s; sem trava, o app não sobe o servidor.
  Nunca contornar a trava para testar.
- Arquitetura §3.4: host caiu → a trava expira (~60 s) e outro pega.
- Época (fencing token): todo comando do host para o cartório daqui para frente leva a época; esta é a base.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cart-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em services/cartorio/
- [ ] `npm run vistoria` APROVADA; testes de corrida não deixam o `npm test` lento (diga o tempo)
- [ ] PR com as seções do modelo, `Closes #19` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.

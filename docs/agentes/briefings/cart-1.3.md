# Briefing cart-1.3 — Versões do mundo e quem tem cópia

BASE: 972397dfdb493a87e08975858504d5744a9e65ae · RAMO: roadmap/cart-1.3 · MODELO: opus (gatilho: época/fencing da trava) · ISSUE: #31
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; references/integridade.md §1 e §3; references/seguranca.md §2
TRIAGEM: M1 (padrão de `trava.ts`: `renovar`/`recusaDoDono`; `banco.ts`: `emTransacao`, `pcDoToken`, gatilho
`trava_epoca_nunca_desce` como molde, `MIGRACOES`) + M7 (`versoes.ts`) · ~130 linhas (+~180 teste; real provável
~250 + ~280 como o cart-1.2) · risco ALTO · MIÚDO: não. NÃO ESCREVER: checagem de época paralela (use a da trava, no
mesmo SQL); alterar migrações v1–v3 (só acrescentar **v4**); importar `packages/nucleo` no cartório; calcular o
"próximo número" fora da transação. PASSOS: 1) migração **v4** no fim de `MIGRACOES`: `versoes` (numero INTEGER PK,
epoca, pc_id FK, manifesto_sha256 TEXT NOT NULL CHECK hex de 64, arquivos INTEGER, bytes INTEGER, criada_em) com
gatilhos que recusam UPDATE e DELETE; `copias` (pc_id FK, versao FK, informada_em, PK(pc_id) — cada PC informa a
versão que tem AGORA); 2) `versoes.ts`: `registrarVersao(banco, pc, epoca, agora, {manifestoSha256, arquivos, bytes})`
num único `emTransacao` com INSERT ... SELECT condicionado à trava (dono = pc, época = atual, `expira_em > agora`);
número = max+1 dentro da mesma instrução; o PC que registra passa a ter a cópia; `informarCopia(pc, versao)` (só versão
existente); `maisNova()`; `quemTem(versao)` = PCs com exatamente essa versão (decidido); 3) rotas com token de PC:
`POST /versoes`, `GET /versoes/mais-nova`, `POST /copias`, `GET /versoes/:n/copias` em `servidor.ts` (incluído no
alcance deste item), corpo validado por esquema.
PROVA: envio sem trava, com época velha ou com trava vencida → recusado e nada gravado; versão só cresce e não tem
buraco nem repetição (dois envios seguidos do dono → N e N+1); UPDATE/DELETE em `versoes` falham; migração v3→v4
preserva PCs, tokens e trava; `quemTem` e `maisNova` corretos; informar versão inexistente → recusa.

## Item (texto literal do roadmap)
- [ ] **1.3 — Versões do mundo e quem tem cópia**
  *O que fazer:* registrar versão nova (exige trava + época atual + manifesto); responder "qual a mais nova" e "quem
  tem a versão N"; PCs informam a versão que têm.
  *Arquivo:* `services/cartorio/src/versoes.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: versão só cresce; envio sem trava recusado.
  *Depende de:* cart-1.2

## Decisões que valem para este item
- Regra de ouro 5 (versão manda) e 1 (trava/época). O manifesto em si (bkp-1.1) fica no PC; o cartório guarda só o hash
  do manifesto e os totais.
- **Decidido pela Máxima (reversível):** `quemTem(N)` devolve quem tem exatamente a versão N; cada PC tem uma linha em
  `copias` (a versão atual dele). Rotas em `servidor.ts` fazem parte deste item. Migração **v4** (a v3 é do cartmel-1.5).
- Nota do cart-2.1 (cliente) já registrada no roadmap: época guardada pelo cliente, prazo pelo relógio do cliente.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cart-1.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em services/cartorio/
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #31` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.

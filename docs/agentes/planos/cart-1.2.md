# Plano cart-1.2 — Trava de host com prazo e época

Briefing: `docs/agentes/briefings/cart-1.2.md` (ramo da Máxima). Issue #19. Triagem M1 + M7, ~130 linhas (+~150 teste).

## Arquivos
- `services/cartorio/src/banco.ts` — migração v2 no fim de `MIGRACOES`: tabela `trava` de uma linha só
  (`id = 1`, `dono_pc_id` NULL ou FK de `pcs`, `expira_em`, `epoca` ≥ 0) e gatilho que aborta se `epoca` descer;
  exportar `emTransacao` (já existe, só passa a ser exportada).
- `services/cartorio/src/trava.ts` — `conferirTempos({ prazoMs, renovarMs })` (padrão 60 s / 20 s; recusa
  prazo < 3 × renovação); `pegar(banco, pc, agora, prazoMs)`, `renovar(banco, pc, epoca, agora, prazoMs)`,
  `passar(banco, de, para, epoca, agora, prazoMs)`, `soltar(banco, pc, epoca)`, `estadoTrava(banco, agora)`.
  Cada operação é **um** `UPDATE … WHERE <condição> RETURNING` dentro de `BEGIN IMMEDIATE`; nunca "ler e depois
  escrever". Só quando o UPDATE não muda nada a linha é lida (na mesma transação) para dizer o motivo da recusa:
  `ocupada`, `epoca_velha`, `nao_e_dono`, `vencida`, `destino_desconhecido`. Devolve `{ ok, epoca, expiraEm }`.
  - pegar: livre, vencida, ou já do próprio PC (app que reiniciou) → dono = pc, época + 1.
  - renovar: só dono atual, época atual, não vencida → novo prazo; época igual.
  - passar: só dono atual, época atual, não vencida, destino existe → dono = destino, época + 1.
  - soltar: só dono com a época atual → dono NULL; época fica (nunca desce).
- `services/cartorio/src/servidor.ts` — opção `trava?: { prazoMs, renovarMs }` conferida na criação; rotas com token
  do PC: `GET /trava`, `POST /trava/pegar`, `/renovar`, `/passar`, `/soltar` (corpo com `epoca` e `para`, conferido
  por schema). Recusa → 409 com mensagem pt-BR e o motivo.
- `services/cartorio/src/iniciar.ts` + `.env.exemplo` — `SABRE_CARTORIO_TRAVA_PRAZO_S`, `SABRE_CARTORIO_TRAVA_RENOVAR_S`.
- `services/cartorio/src/trava.test.ts` (e `trava-corrida.worker.mjs`) — testes.

## Testes (antes do código)
1. Corrida honesta: 10 `worker_threads`, cada um com a própria conexão ao MESMO arquivo, soltos juntos por uma
   barreira (`Atomics`), chamam `pegar` → exatamente 1 ganha; repetido 20 rodadas (relógio avança para vencer a trava
   anterior), época sobe 1 por rodada.
2. Prazo vencido libera para outro (relógio injetado); 1 ms antes ainda é do dono.
3. Renovar ou passar com época velha → recusa (zumbi); renovar vencida → recusa.
4. Passar sobe a época e o novo dono renova; o antigo não.
5. Soltar por quem não é dono → recusa; época nunca desce (nem após soltar; gatilho barra UPDATE direto).
6. Rotas: sem token → 401; recusa → 409; `GET /trava` mostra dono e época; prazo < 3 × renovação → erro.

## Fora
Envio de versão com época (cart-1.3); o app usar a trava (host-*); tela de configuração (cartório é da máquina da nuvem).

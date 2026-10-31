# Plano appmel-1.7 — Tirar PC do grupo (tela)

Método: M5 (+M3). Risco alto: revoga o acesso de um PC. A rota `POST /pcs/:id/revogar` já existe (cartmel-1.1); o cartório não muda.

## Peças
1. `cartorio/cliente.ts`: `revogarPc(id)` (204, `repetir:false`, sem corpo). 409 passa por `recusaE409` para ler a mensagem do cartório (DONO_NAO_SE_TIRA) como as demais recusas.
2. Mensagens pt-BR por status (403/409/404/401) no lado do app, em `main/grupo.ts`.
3. `main/grupo.ts` (`criarGrupo`): `estado()` → só lista PCs se `eu().dono`; `tirar(id)` revalida `eu().dono` e que o id está na lista e não é o dono, antes de chamar `revogarPc`. IPC `sabre:grupo:estado` / `sabre:grupo:tirar`, preload e ponte.
4. Tela: `fieldset` "Grupo" em Configurações (só aparece para o dono), lista com botão "Tirar PC do grupo" (ausente no PC do dono), confirmação com o NOME do PC e o aviso de novo convite; cancelar não chama; botões "Tirando…" durante a chamada.
5. Fake E2E estendido (`listarPcs`/`revogarPc`/`eu().dono` por cenário) e E2E: cancelar não revoga, confirmar revoga, não-dono não vê a área.

## Por que mais de um arquivo
Regra do app: a janela não fala com o cartório (sandbox) → main (`grupo.ts`) + preload + ponte + tela.

## Testes (cartório e mundo inventados)
cliente.test.ts (204/403/409/404/401, sem repetir), grupo.test.ts (não-dono, dono não se tira, id desconhecido), E2E dos 3 casos.

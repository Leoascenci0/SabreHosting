# Plano cartmel-1.1 — Revogar token de PC

Método: M3 (+M1). Risco ALTO (autenticação). Sem mundo, sem rede real.

1. Teste primeiro (`services/cartorio/src/convite.test.ts`, que já tem `comDono`/`entrar`): dono revoga PC → `/eu` do PC vira 401; sem token → 401; não-dono → 403; alvo = dono → 409; PC inexistente → 404; id inválido → 400; revogar de novo → 204 (idempotente); token do dono continua valendo.
2. `revogarPc(banco, pcId)` em `banco.ts`: transação, `UPDATE tokens SET revogado_em = ? WHERE pc_id = ? AND revogado_em IS NULL`.
3. Rota `POST /pcs/:id/revogar` em `servidor.ts` com `soPc`; 403 `SO_DONO` se o chamador não é o dono; 404 se o PC não existe; 409 se o alvo é o próprio dono (só sai após `trocar-dono`); 204 em sucesso.
4. O 401 do PC revogado sai de graça (`pcDoToken` já filtra `revogado_em`).

Fora: remover o peer da rede privada (item de rede), tela do app (app-2.2), middleware novo, tabela nova.

# Plano cartmel-2.2 — Revogar o peer e provar a trava do PC revogado

Método: M1 (só teste novo + texto). Risco alto por tocar cartório/trava, mas o diff não muda código de produção.

1. Teste em `services/cartorio/src/convite.test.ts` (onde já estão `comAna`/`revogar`; `cartorio.test.ts` não tem dono nem
   convite com sala): dono revoga a Ana; o token revogado usado 20 vezes dá 401 e a 21ª dá 429, mesmo com o token ativo
   do dono vindo do mesmo IP. Prova de que o teste é real: sem a asserção do 429 (ou com `contarFalha` tirado) ele falha.
2. `docs/arquitetura.md` §6: host revogado perde a trava só no prazo. Corrigir o "~20 s": renovação a cada 20 s é
   recusada sem token ativo e o servidor para; a trava vence no `expira_em`, até 60 s após a última renovação
   (`trava.ts:31-34`).
3. Fora: remoção do peer do WireGuard (item de rede à parte, DECISOES 31/10; a Máxima abre em roadmap-rede-melhoria.md).
4. `npm run vistoria`.

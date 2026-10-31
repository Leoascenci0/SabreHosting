# Plano syncmel-1.1 — limite de tentativas erradas e cache curto de token (servidor de sync)

Arquivo: `packages/nucleo/src/sync/transferencia.ts` (+ teste). Método: M3 (+M7), escrito uma vez só.

1. `OpcoesServidor.agora?: () => number` (relógio injetável, para teste).
2. Limitador por IP da conexão (`req.socket.remoteAddress`, sem `X-Forwarded-For`): 5 falhas em 60 s, contadas do
   1º erro; barrado → 429 ANTES de ler o token e de chamar `conferirToken`. Vencidas são limpas a cada falha.
3. Falha = 401 (token ausente ou `null`); 503 (cartório fora) não conta.
4. Cache `Map token → {pc, ate}`, TTL 30 s, só para `pc` não-nulo; purga das vencidas a cada gravação.
   Acerto no cache não chama `conferirToken`. Nada de cache de resposta negativa nem de 503.
5. Testes com relógio falso: 6ª errada → 429 com o contador do cartório falso zerado; token válido 2× → 1 chamada;
   após o TTL → nova chamada; 503 não conta e não entra no cache.

Efeito a registrar no PR: revogar um token leva até 30 s para valer no servidor de sync (cache).
Tela no app: não se aplica. Segredo: nenhum (token só em memória, nunca em log).

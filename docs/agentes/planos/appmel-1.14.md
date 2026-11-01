# Plano appmel-1.14 — Retomar a conexão sem convite novo

Briefing: `origin/roadmap/onda-2026-11-01-35:docs/agentes/briefings/appmel-1.14.md` · Base `a5cb558`.
Triagem M1 (+M4 cartório, +M5 botão). Decisão do Eliel (01/11): reemitir só para a MESMA chave pública e só até
30 min depois do uso; estado só em memória (decisão da onda).

## Passos (TDD: teste falhando primeiro em cada um)

1. **Cartório** (`services/cartorio/src/banco.ts` › `entrarPeloConvite`): no ramo de repetição, recusar também se
   `agora - usado_em > 30 min` (constante `JANELA_REPETICAO_MS`). Recusa = `undefined` → mesma resposta 401 de
   "chave errada" (sem vazar o motivo). Nada de tabela/coluna/endpoint novo.
   Testes em `convite.test.ts`: 29 min mesma chave → 200, token e pacote novos, token antigo 401; 31 min → 401;
   chave diferente → 401 com a MESMA resposta (status + corpo) da janela vencida.
2. **App** (`apps/desktop/src/main/boas-vindas.ts`): as chaves passam a nascer uma vez por convite conferido (a
   repetição precisa da mesma chave) e ficam só em memória. Falha com `conviteGasto` guarda o instante (`gastoEm`);
   `entrar()` de novo reusa convite + chaves enquanto `agora - gastoEm < 30 min`; passou disso, esquece tudo e pede
   convite novo. 401 do cartório numa repetição também esquece. Resposta de erro ganha `tentarDeNovo: true` enquanto
   a retomada vale. Conferir outro convite zera a retomada.
   `entrada-no-grupo.ts`: a mensagem `FALHA_TROCA` deixa de mandar pedir convite novo e aponta "Tentar de novo".
   Testes em `boas-vindas.test.ts`: falha na definitiva → `tentarDeNovo`; 2ª chamada reusa o MESMO convite e as
   MESMAS chaves e entra; depois de 30 min → pede convite novo sem chamar o passo elevado.
3. **Tela** (`ui/boas-vindas.ts`, `ui/ponte.ts`): com `tentarDeNovo`, o botão "Entrar no grupo" vira
   "Tentar de novo" (mesmo canal IPC, mesmo estado de carregando do `rodar`); conferir outro convite volta o texto.

Fora: persistir chave/token em disco, mudar a janela ou a regra "mesmo PC", criarConviteDono/validade.

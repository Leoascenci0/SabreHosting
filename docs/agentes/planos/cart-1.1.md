# Plano cart-1.1 — Serviço, banco e autenticação por token

Briefing: `docs/agentes/briefings/cart-1.1.md` (ramo da Máxima). Issue #11. Triagem M6, ~150–200 linhas.

## Arquivos
- `services/cartorio/package.json` — dependência `fastify`, `engines.node >=22.13`, script `iniciar`.
- `services/cartorio/src/segredo.ts` — `gerarSegredo()` (32 bytes, base64url), `hashSegredo()` (SHA-256 hex),
  `iguais()` (comparação em tempo constante, para o segredo de administrador).
- `services/cartorio/src/banco.ts` — `abrirBanco(caminho)` com `node:sqlite`; migrações versionadas (tabela
  `esquema`); tabelas `pcs`, `tokens` (só `hash`), `convites` (só `hash`, `expira_em`, `usado_em`);
  `criarConvite`, `usarConvite` (UPDATE atômico `WHERE usado_em IS NULL AND expira_em > agora`, `changes === 1`,
  numa transação que cria o PC e o token), `pcDoToken`.
- `services/cartorio/src/servidor.ts` — `criarCartorio({ banco, segredoAdmin, logger, agora })` (Fastify);
  rotas `GET /saude`, `POST /convites` (admin), `POST /convites/usar`, `GET /eu` (token);
  `conferirEndereco()` recusa `0.0.0.0`, `::` e nome que não é IP; log com `redact` do `authorization`.
- `services/cartorio/src/iniciar.ts` — lê as variáveis de ambiente e escuta (padrão `127.0.0.1`).
- `services/cartorio/.env.exemplo` — nomes das variáveis, sem valor.
- `services/cartorio/src/cartorio.test.ts` — testes com `fastify.inject`; apaga `exemplo.ts`/`exemplo.test.ts`.
- `docs/ops/DECISOES.md` — linhas do `fastify` e do `node:sqlite` (ExperimentalWarning aceito).

## Testes (escritos antes do código)
1. sem token / token inválido → 401; token válido → 200 com o PC.
2. token e convite em claro não aparecem no arquivo do banco nem no log capturado.
3. convite usado duas vezes → recusado; duas chamadas simultâneas → só uma passa.
4. convite vencido → recusado (relógio injetado).
5. `POST /convites` sem segredo de administrador → 401.
6. escutar em `0.0.0.0` / `::` → erro.
Banco de teste em pasta temporária apagada no `afterEach`.

## Fora
Trava de host (cart-1.2), versões do mundo (cart-1.3), rota de revogar token, limite de tentativas.

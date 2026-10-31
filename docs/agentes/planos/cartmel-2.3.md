# Plano cartmel-2.3 — Listar os PCs do grupo e dizer quem é o dono

Método M3 (+M1). Só leitura, sem tabela nova.

1. `banco.ts`: `listarPcsAtivos(banco)` → `[{id, nome, dono}]` só de PCs com token ativo (`revogado_em IS NULL`), sem token/hash/IP; `ehDono(banco, id)`.
2. `servidor.ts`: `GET /pcs` com `soPc`; quem não é o dono recebe 403 (mesmo padrão do `/convites`); `GET /eu` devolve `{id, nome, dono}`.
3. Núcleo: tipo `Eu`/`PcDoGrupo`, `validarEu`/`validarListaPcs` em `tipos.ts`; `cliente.eu()` devolve `dono`; `cliente.listarPcs()` novo.
4. Testes (escritos antes, falham antes): dono lista; não-dono 403; sem token 401; revogado não aparece; `/eu` traz `dono`; cliente mapeia e recusa resposta sem `dono`.

Segurança: a lista só ao dono; nada além de id, nome e dono. Integridade: não toca o mundo nem a trava.

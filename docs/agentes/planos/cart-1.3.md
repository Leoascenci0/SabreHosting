# Plano cart-1.3 — Versões do mundo e quem tem cópia

Issue #31 · ramo `roadmap/cart-1.3` · método M1 (molde de `trava.ts`/`banco.ts`) + M7 (`versoes.ts`) · risco alto
(regras de ouro 1 e 5).

## Desenho
- `banco.ts`: **migração v4** no fim de `MIGRACOES` (v1–v3 intactas):
  - `versoes (numero INTEGER PK, epoca, pc_id FK pcs, manifesto_sha256 TEXT NOT NULL CHECK 64 hex minúsculos,
    arquivos ≥ 0, bytes ≥ 0, criada_em)`; gatilhos que recusam UPDATE e DELETE e um `BEFORE INSERT` que só aceita
    `numero = max + 1` (sem buraco, sem repetição, mesmo fora do código do cartório).
  - `copias (pc_id INTEGER PK FK pcs, versao FK versoes, informada_em)`: uma linha por PC, a versão que ele tem agora.
- `versoes.ts` (novo):
  - `registrarVersao(banco, pc, epoca, agora, {manifestoSha256, arquivos, bytes})`: um `emTransacao` com
    `INSERT INTO versoes … SELECT (max + 1), … FROM trava WHERE dono_pc_id = pc AND epoca = ? AND expira_em > agora`
    (a condição da trava e o número no mesmo SQL); aceito → o PC passa a ter a cópia (upsert em `copias`).
    Recusado → o motivo vem do mesmo `recusaDoDono` da trava (exportado por `motivoDaRecusa`), lido na transação.
  - `informarCopia(banco, pc, versao, agora)`: upsert só se a versão existe (`INSERT … SELECT … FROM versoes`).
  - `maisNova(banco)`, `quemTem(banco, n)` (PCs com exatamente a versão N).
- `servidor.ts`: rotas com token de PC — `POST /versoes` (201 / 409 com a mensagem da trava), `GET /versoes/mais-nova`,
  `POST /copias` (204 / 404), `GET /versoes/:n/copias`; corpos e parâmetros por esquema.

## Testes (primeiro, vermelhos) — `services/cartorio/src/versoes.test.ts`
1. Sem trava, época velha, trava vencida, outro dono → recusa com motivo e nada gravado (nem versão nem cópia).
2. Dois envios seguidos do dono → N e N+1; o PC que registrou passa a ter a cópia.
3. UPDATE/DELETE em `versoes` falham; INSERT com número repetido ou com buraco falha.
4. `informarCopia` de versão inexistente → recusa; `quemTem` e `maisNova` corretos (cada PC uma linha).
5. Migração v3 → v4 preserva PCs, tokens e trava (época e dono).
6. Rotas: sem token 401; corpo inválido (hash fora do formato) 400; fluxo completo pega trava → envia → informa → consulta.
7. Ajustar os testes de migração que esperam `versao: 3` e a lista de tabelas.

## Entrega
`npm run vistoria` APROVADA; PR com `Closes #31`.

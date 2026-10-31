# Plano hostmel-3.1b — Cartório: configuração do grupo (versão do Minecraft)

Método: M3 (+M1). Risco ALTO (cartório, migração, gravação dependente de trava). Só banco em memória/pasta temporária.

1. Testes primeiro (`services/cartorio/src/configuracao.test.ts`): padrão 1.21.1 sem sha1; migração 8→9 sobre banco com
   dados (trava, PCs, atualização intactos); gravar como dono; não-dono 403; 409 com trava de host ativa; 409 com
   atualização com `expira_em > agora` (prazo zerado/vencido não conta); sem token 401; entrada inválida 400;
   linha única não se apaga nem se recria; caminhos de tempo (trava vencida libera, borda `expira_em == agora`).
2. Migração 9 em `banco.ts` (`config_grupo`, linha única, gatilhos de não apagar/recriar). Padrão `1.21.1` só aqui.
3. `configuracao.ts`: `lerConfig`, `gravarConfig` numa transação só (`BEGIN IMMEDIATE`): confere dono, trava de host
   (`estadoTrava`) e atualizações ativas antes de gravar, para não passar entre o olhar e o gravar.
4. Rotas `GET /grupo/config` (soPc) e `PUT /grupo/config` (soPc + dono) em `servidor.ts`.
5. Núcleo: `lerConfigGrupo` / `gravarConfigGrupo` no cliente (`criarCliente`) + validador em `tipos.ts`.
6. Atualizar os testes que fixam `versao: 8` do esquema para 9.

Fora: tela (3.1c), NeoForge 1.20.1 (3.1d), buscar o manifesto (já está no núcleo, 3.1a).

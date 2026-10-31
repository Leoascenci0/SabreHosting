# Plano cart-1.5 — Convite completo: dono, chave provisória e grupo

Briefing: `docs/agentes/briefings/cart-1.5.md` (ramo da Máxima). Issue #82. Triagem M7 (+M1, +M3), ~350 + ~250 linhas.
Desenho: `docs/superpowers/specs/2026-10-31-convite-do-grupo-design.md` §5.1, §5.2, §5.5–§5.7.

## Arquivos
- `services/cartorio/src/banco.ts` — migração 6 (nova; as antigas não mudam):
  `pcs.dono` (0/1, índice único parcial: um dono só); em `convites`: `ip_prov`, `chave_pub_prov`, `para_dono`,
  `chave_pub_def`, `ip_def`, `confirmado_em`, `prov_removido_em`. `criarConvite(…, entrada?)` ganha o 5º parâmetro
  opcional (chamadas antigas seguem iguais); `usarConvite` legado segue igual (convite sem `ip_prov`).
  Novas: `lerConvite`, `entrarPeloConvite` (duas fases numa transação: 1º uso marca e cria PC + token; repetição com a
  MESMA chave revoga o token anterior e dá outro; chave diferente → recusa), `nomeOcupado`, `temDono`.
  `apagarConvitesVencidos` não apaga linha cujo peer provisório ainda não saiu.
- `services/cartorio/src/ajudante.ts` — `AjudanteEntrada { adicionar, trocar, remover }`, `criarAjudanteSudo(exec,
  caminho)` (`sudo -n <caminho> entrada-* …`, argumentos em array, sem shell, tempo-limite 10 s; confere o JSON da
  saída), tipo `ExecArquivo` copiado do núcleo, `gerarParProvisorio()` (X25519, clamp igual ao `wg genkey`).
- `services/cartorio/src/convite.ts` — `emitirConvite` (gera par, `adicionar`, grava; se gravar falhar, `remover`),
  texto `sabre://convite/1.<base64url>` (§5.3), `limparProvisorios` (convite vencido ou confirmado → `remover`).
- `services/cartorio/src/servidor.ts` — sai `segredoAdmin`; entram `ajudante?`, `grupo?`, `limpezaMs?`.
  `POST /convites` só PC dono (403 para os outros), `validadeHoras` 1–72 (padrão 24), nome no formato da rede;
  sem ajudante ou grupo → 503 (falha fechada). `POST /convites/usar {convite, chave_publica}`: convite com `ip_prov`
  só vale do IP provisório (outro IP → 401 e conta falha). `POST /convites/confirmar` (token, do IP definitivo) tira o
  provisório. `GET /grupo` → `{nome, endereco_jogar}`. Sala de entrada (10.66.0.200–254) só alcança
  `/convites/usar`. Limpeza periódica (padrão 60 s) com `unref`, parada no `onClose`.
- `services/cartorio/src/comandos.ts` — `criar-convite-dono <nome> [horas]` (recusa se já há dono ou convite de dono
  pendente) e `trocar-dono <id-do-pc>` / `trocar-dono --novo-convite <nome> [horas]`; roda como root na nuvem.
- `services/cartorio/src/iniciar.ts` + `.env.exemplo` — `SABRE_AJUDANTE_ENTRADA`, `SABRE_GRUPO_NOME`,
  `SABRE_GRUPO_ENDERECO_JOGAR`, `SABRE_HUB_ENDPOINT`, `SABRE_HUB_CHAVE_PUB`; sem ajudante (arquivo ausente) ou sem
  grupo → não cria convite (nunca cai num falso). Sai `SABRE_CARTORIO_SEGREDO_ADMIN`.
- `packages/nucleo/src/cartorio/cliente.ts` + `tipos.ts` — `criarConvite`, `usarConvite` (sem token; repete),
  `confirmarEntrada`, `grupo`; 204 sem corpo.
- Testes: `convite.test.ts` (novo), `cartorio.test.ts` (reescreve o teste da linha 82: segredo de admin sai da rota —
  quebra declarada no PR), `cliente.test.ts`; ajustes de montagem em `versoes`/`armazem`/`trava`.test e
  `tests/integracao/hospedar-cartorio.test.ts` (só tirar `segredoAdmin` e criar o PC pelo banco).

## Conta do tempo (L-01)
- Convite: padrão 24 h, máximo 72 h. Repetir `usar` vale até o prazo ou até a confirmação, o que vier antes.
- Peer provisório sai no máximo `limpezaMs` (60 s) + tempo do ajudante (≤ 10 s) depois do vencimento; se o ajudante
  falhar, a linha fica marcada como pendente e a próxima volta tenta de novo (a linha não é apagada antes).
- Chamada ao ajudante: tempo-limite 10 s. O `usar` no cliente usa prazo de 15 s por tentativa (o ajudante pode levar
  até 10 s), 3 tentativas: a repetição é segura (duas fases).
- Ordem no `usar`: banco primeiro (marca e cria token), depois `entrada-trocar` (idempotente). Se o ajudante falhar →
  503 sem token; o PC repete com a mesma chave e recebe token novo (o anterior é revogado). Nada encalha.

## Testes (antes do código)
1. PC não dono → 403; dono → 201 com texto que decodifica (g,h,k,i,p,c,a,e); sem token → 401.
2. `usar` de outro IP → 401; do IP provisório → token + pacote; repetir com a mesma chave → mesmo IP, token novo, o
   antigo para de valer; chave diferente → 401.
3. Ajudante falha no `trocar` (resposta perdida) → 503; repetir → 200; o PC não encalha.
4. `confirmar` do IP definitivo tira o provisório; depois disso repetir `usar` → 401.
5. Convite vencido → `limparProvisorios` chama `remover`; a limpeza de 7 dias não apaga linha com provisório pendente.
6. Código, token e chave privada provisória fora do arquivo do banco e do log.
7. Sala de entrada só alcança `/convites/usar`; `GET /grupo`; validade > 72 h → 400.
8. `criar-convite-dono` recusa com dono; `trocar-dono` passa a marca; convite de dono usado vira dono (e tira o antigo).
9. `criarAjudanteSudo`: argumentos exatos, saída torta recusada; sem shell.
10. Cliente: rotas, corpo, 204, `usarConvite` sem cabeçalho de token.

## Fora
Ajudante real (rede-1.4), tela (app-1.3), ligar os comandos no instalador (cart-2.2).

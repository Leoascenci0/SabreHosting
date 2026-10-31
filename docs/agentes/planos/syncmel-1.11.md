# Plano syncmel-1.11 — Acabamentos do servir/espalhar

Triagem: M1/M2 (acabamento em código existente). Teste primeiro; cada correção com teste que falha sem ela.

| Sub-item | O que faz | Onde | Teste |
|---|---|---|---|
| a | `vitrine.fechar()` espera a publicação em curso e depois apaga; depois de fechada, não publica mais | `packages/nucleo/src/sync/vitrine.ts` | `vitrine.test.ts`: fechar durante publicar não deixa `v-*` |
| b | `before-quit` também fecha o servidor de arquivos quando não há servidor Minecraft ativo (função pura `precisaEncerrarAntesDeSair`) | `apps/desktop/src/main/saida.ts` + `principal.ts` | `saida.test.ts` |
| c | Relê o IP a cada 60 s enquanto o servidor de arquivos não está de pé (túnel que sobe depois); aviso "sem rede privada" só uma vez | `servir-arquivos.ts` (`tentarLigar`) + `principal.ts` | `servir-arquivos.test.ts` |
| d | `ipDaRedePrivada` aceita só a interface do WireGuard (`sabre`, nome do túnel em `rede/wireguard.ts`) | `servir-arquivos.ts`, `wireguard.ts` (exporta o nome) | `servir-arquivos.test.ts` |
| e | Testes: filtro de IP privado (faixa 2–199, IPv6, interface errada), link simbólico na vitrine (já cobertos em `vitrine.test.ts`; conferido), `ligarEspalhar` (já coberto em `ligar-espalhar.test.ts`; acrescenta sem token/pasta e relógio) | testes | — |
| f | `hospedaAgora`/`exigirForaDoHost` ainda vão à rede antes do 1º rename: prioridade baixa, **não feito**; registrado no PR | — | — |
| g | Teste de `ultimoRegistrado` no cliente do cartório | `cliente.test.ts` | novo |
| h | Teste: pré-cópia "ja-tinha" com `hospedaAgora` verdadeiro recusa | `precopia.test.ts` | novo |

Segurança: o servidor continua só no IP da interface WireGuard, nunca 0.0.0.0. Integridade: nada toca o mundo.
Tela no app: não se aplica.

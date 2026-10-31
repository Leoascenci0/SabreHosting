# Plano sync-2.1a — Espalhar a versão nova (núcleo + ligação ao app, sem limite de banda)

Método M7 (+M1, M2). Risco alto (troca atômica, trava). Ramo `roadmap/sync-2.1a`, base 67cbfc3. Decisão da orquestradora:
opção (b): as fontes chegam por injeção; nada de rota nova no cartório nem wrappers novos no `cliente.ts`.

| Peça | O que | Reaproveita |
|---|---|---|
| `packages/nucleo/src/sync/espalhar.ts` | `escolherFontes` (pura: PCs antes do host, sem repetida, vazia = erro); `espalhar`: pede o manifesto de M por hash, confere que `versao` bate com a do cartório, chama `aplicarDelta` com `pastaDoServidor` e `baixar` que tenta cada fonte em ordem | `baixarDoHost`/`pedirArquivo`, `aplicarDelta`, `validarManifesto` |
| `apps/desktop/src/main/espalhar-versao.ts` | `criarEspalhador`: pega a trava (Renovador) como `deps-backups`, passa `pastaDoServidor` (parte 1.5b), avisa o cartório com `informarCopia`, solta a trava | `Renovador`, `criarCliente`, molde `deps-backups.ts` |
| Testes | 3 PCs simulados chegam a M; queda no meio deixa N intacta; fonte ruim cai para a próxima; manifesto de outra versão recusado; mundo fora de `pastaDoServidor` recusado; servidor rodando recusa | `servirArquivos`, `gerarMundo` |

Não fazer: limite de banda e tela (2.1b), rota/wrapper novo no cartório, relógio novo, hash novo, mexer em `podeSubir` ou na ordem dos `rename`.
Regras: S-06 (nenhum relógio novo; o espalhador não tem timer) e S-07 (manifesto e fontes vindos da rede são entrada não confiável: validar antes de usar).
Ponto aberto para a PR: `aplicarDelta` exige a trava; PC que não hospeda só aplica quando consegue a trava (host a segura). Não contorno a trava (regra de ouro 1); vira decisão/melhoria.

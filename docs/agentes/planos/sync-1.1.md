# Plano sync-1.1 — Servir e pedir regiões pela rede privada

Método: M1+M3+M7 (triagem do briefing). Arquivo novo: `packages/nucleo/src/sync/transferencia.ts` (+ teste).

1. `servidor/baixar.ts` (extensão mínima, sem mudar o comportamento atual): opções `cabecalhos` (ex.: Bearer) e
   `permitirHttpPrivado` (http só em 10.66.0.x). O token vai só ao endereço original: em redirecionamento os
   cabeçalhos extras são descartados (e redirecionamento já exige https).
2. `sync/transferencia.ts`:
   - `servirArquivos`: `node:http`, bind SÓ em 10.66.0.x (recusa 0.0.0.0, nome, IPv6, IP público; loopback só com
     `permitirLoopbackParaTeste`). Rota única `GET /arquivos/<sha256>`; o cliente nunca manda caminho: o hash vai
     a um resolvedor injetado (`arquivos(sha256)`), que só conhece pacotes fechados. Bearer obrigatório conferido por
     `conferirToken(token) → pc|null` injetada (servidor sem segredo). ETag = "sha256"; Range 206/416; If-Range;
     streaming com `createReadStream`.
   - `pedirArquivo`: monta a URL e reaproveita `baixarConferido` (retomada, hash, troca atômica).
3. Testes (TDD, primeiro vermelho): sem token/token ruim 401; hash fora do formato/caminho 404; Range 206/416 e
   If-Range; bind recusado em 0.0.0.0/IP público/nome; conexão cortada no meio retoma com 206 e hash final igual;
   parcial pré-existente retoma contra o servidor real; hash errado apaga parcial e não cria destino.
4. Fora: ligar ao app (sync-2.1), mudar formato de pacote/manifesto.

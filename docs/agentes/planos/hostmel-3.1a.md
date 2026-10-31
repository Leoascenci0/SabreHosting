# Plano hostmel-3.1a — Núcleo: versões do Minecraft do manifesto oficial

Ramo `roadmap/hostmel-3.1a`, base `4dd08de`. Só o núcleo (`packages/nucleo/src/servidor/`); cartório (3.1b) e tela (3.1c) ficam fora.

## O que entra
1. `resolvedores.ts`: `resolverMojang(jsonDaVersao)` no molde de `resolverModrinth`, usando `alvo()` (https + hash sha1 válido)
   e uma lista de hosts oficiais (`piston-data.mojang.com`, `launcher.mojang.com`). Devolve também `javaMajor` (inteiro 8–99).
2. `versoes.ts` (novo):
   - `listarVersoes(buscar)`: manifesto oficial, só `release`, da mais nova à mais antiga; id validado (`^1\.\d{1,2}(\.\d{1,2})?$`), URL do JSON da versão só de host oficial (entrada não confiável, S-07).
   - `planoDaVersao(versao, buscar)`: versão tem que estar na lista; baixa o JSON da versão; devolve `{ versao, jar: Alvo (sha1), javaMajor }`.
   - `opcoesDaVersao(versao, buscar)`: "o que dá em cada versão" por consulta (Maven do NeoForge + Modrinth do Connector); falhou a consulta → só "sem mods".
   - `buscar` é injetável (`(url) => Promise<string>`); o padrão usa `fetch` com prazo e teto de tamanho.
3. `processo.ts`: modo `jar` (`-jar server.jar nogui` com `@user_jvm_args.txt`) além do NeoForge (`@args`); `versaoNeoForge` vira opcional (exatamente um dos dois modos).
4. Java: `resolverAdoptium` já existe; a versão maior vem de `javaMajor` (função `urlAdoptium(major)` pequena em `versoes.ts`).

## Não entra
Campo em preferências, tabela fixa de hashes, backup novo, validação de caminho nova, tela, cartório, dependência nova.

## Prova (testes sem rede, manifesto de teste)
- só release, ordem mantida; versão fora da lista recusada; id estranho recusado;
- host/URL não oficial ou http recusado; sha1 ausente/ruim recusado;
- sha1 errado: `baixarConferido` recusa e apaga o arquivo baixado;
- versão sem Connector não oferece Fabric+Forge; NeoForge só quando a consulta o acha; consulta falha → só sem mods;
- modo `jar` sobe com o comando certo (servidor falso, sem Java real); sem `server.jar` recusa.

Segurança: download só de hosts oficiais por https + sha1 do manifesto conferido; Integridade: não toca o mundo; Enxugamento: reuso de `alvo()`, `baixarConferido`, `resolverAdoptium`.

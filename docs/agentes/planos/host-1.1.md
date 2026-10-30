# host-1.1 — Baixar Java e servidor com hash conferido · Plano de implementação

> **Para agentes:** item único, triagem M7 (APIs nativas do Node 22, sem dependência nova), risco ALTO. Issue: #10. Briefing: `docs/agentes/briefings/host-1.1.md`.

**Objetivo:** módulo que baixa arquivo de fonte oficial, confere o hash, guarda em cache e nunca re-baixa à toa; mais resolvedores puros que transformam o JSON/sidecar das fontes (Adoptium, Modrinth, Maven do NeoForge) em `url + hash`.

**Arquitetura:** `baixar.ts` (genérico) + `resolvedores.ts` (puro, sem rede). Versões de Minecraft/NeoForge/Java são parâmetros obrigatórios, sem padrão.

## Restrições globais

- Nenhum teste chama a internet: servidor `node:http` local falso. Formatos das APIs vêm da documentação (dizer no PR).
- Baixa para `<destino>.parcial` na mesma pasta (rename atômico); hash em stream; nunca lê o arquivo na memória.
- Hash divergente: apaga parcial e recusa em pt-BR. Igual: `rename`. Cache: arquivo final com hash certo, zero requisição.
- Retomada: `Range` + `If-Range` (ETag/Last-Modified guardado em `.parcial.meta`); 200 no lugar de 206 ou 416 recomeça do zero.
- Só `https` (exceto `localhost`/`127.0.0.1`, para os testes).
- Não rodar instalador nem EULA (é host-1.2).

## Ponto de revisão

- Arquivo final nunca existe com conteúdo não conferido.
- Hash divergente não deixa `.parcial` nem `.meta`.
- Sidecar `.sha1` do NeoForge vem do mesmo servidor: protege contra corrupção, não contra servidor comprometido (melhoria no PR).

### Tarefa 1: testes (falham antes) → `packages/nucleo/src/servidor/baixar.test.ts`, `resolvedores.test.ts`
### Tarefa 2: `baixar.ts` e `resolvedores.ts`
### Tarefa 3: `npm run vistoria`, commit, PR

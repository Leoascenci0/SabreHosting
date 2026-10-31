# lanc-1.2 — Instância do grupo no Prism · Plano de implementação

> **Para agentes:** item único, triagem M7, risco médio. Issue: #56. Briefing: `docs/agentes/briefings/lanc-1.2.md`.

**Objetivo:** gerar o pacote `.mrpack` (formato público do Modrinth, `modrinth.index.json` formatVersion 1) da instância "SabreHosting — <grupo>", com a versão do Minecraft e do NeoForge vindas do cartório. O Prism importa esse pacote (a importação em si é o lanc-1.3).

**Decisão (a) ou (b) do briefing:** o formato de pasta de instância do Prism (`instance.cfg`, `mmc-pack.json`) não tem especificação pública estável; o `.mrpack` tem. `.mrpack` é zip, e o Node 22 tem `zlib.crc32` e `Buffer`: um zip "sem compressão" (método 0) são ~40 linhas. **Nenhuma dependência nova**, nenhum código GPL.

## Desenho

- `montarInstancia({grupo, versaoMinecraft, versaoNeoForge, mods})` pura → `{ nomeArquivo, indice, bytes }`. `mods` entra vazio (download é o lanc-1.4); `files: []`.
- Nome do grupo higienizado para nome de arquivo com as regras de nome do Windows do manifesto (proibidos, reservados, ponto/espaço no fim, tamanho máximo); grupo vazio recusado.
- `gravarInstancia({pastaDestino, ...})` grava em `<pastaDestino>/SabreHosting/<grupo>.mrpack`: escreve em arquivo temporário na mesma pasta, renomeia (troca atômica). Idempotente: conteúdo igual ao existente não regrava (`alterado: false`). Só toca o arquivo do próprio grupo; qualquer outro arquivo/instância na pasta fica intacto.
- Marcador próprio: pasta `SabreHosting/` + nome `SabreHosting — <grupo>` no índice.
- Versões validadas (só `[0-9A-Za-z.+-]`), pois vão para JSON que o Prism lê.

## Tarefas
1. `instancia.test.ts` (falha antes): JSON conforme formato, zip legível (assinaturas, CRC, nomes), higienização, idempotência, instância alheia intacta, grupo/versão inválidos.
2. `instancia.ts`.
3. `npm run vistoria`, commit, PR.

# Plano bkp-1.2 — Pacote fechado e conferido

Método: M6 (pacote npm `tar` + `node:zlib`). Risco alto: é por aqui que o mundo viaja e é extraído. Formato
`.tar.gz` (zstd ainda não é estável no Node 22). Dependência `tar` (ISC) só em `packages/nucleo`, registrada em DECISOES.md.

Regras de ouro: só **lê** o mundo (2; quem chama faz `salvarSeguro`), escreve só em `<destino>.parcial` e na pasta
temporária, nunca na pasta do mundo (3), só mundos de teste (6).

1. Testes primeiro (falham): `backup/pacote.test.ts` — ida e volta de 20 MB com mesmos hashes; 1 byte trocado recusado
   antes de extrair; entradas `../x`, link simbólico, link físico e arquivo fora do manifesto recusados (pacotes
   maliciosos montados com o próprio `tar`); arquivo do manifesto ausente recusado; falha no meio apaga a temporária;
   laço de eventos responde (maior intervalo entre ticks de `setInterval` de 10 ms).
2. `criarPacote(pasta, destino, {versao, epoca})`: `gerarManifesto`; `manifesto.json` como primeira entrada e os
   arquivos na ordem do manifesto; compactação em `worker_threads` (prioridade baixa via `os.setPriority`, erro
   ignorado); escreve em `<destino>.parcial`, hash em fluxo, `rename`; devolve {caminho, sha256, tamanho}.
3. `abrirPacote(pacote, sha256Esperado, pastaTemporaria)`: hash do pacote ANTES de abrir; lê o manifesto
   (`validarManifesto`); extrai só arquivo comum do manifesto, sem repetição; confere tamanho e SHA-256 de cada
   arquivo; qualquer falha apaga a pasta temporária e lança erro em pt-BR.
4. `npm run vistoria`; PR `Closes #34`.

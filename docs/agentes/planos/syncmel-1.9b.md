# Plano syncmel-1.9b — limite de banda do espalhar

Triagem: M1/M2 (acabamento em código existente).

## O que já existe (grep)
- `baixarConferido` (servidor/baixar.ts) tem um `Transform` `contar` no pipeline; `pedirArquivo` (sync/transferencia.ts) o chama.
- `espalhar` → `pedir` → `pedirArquivo`; `criarEspalhador` (main/espalhar-versao.ts) monta o `espalhar`.
- Preferências: `main/preferencias.ts`, `main/configuracoes.ts`, `ui/configuracoes.ts`, `ui/index.html`, `ui/ponte.ts`.

## Passos (TDD, um commit por passo)
1. Núcleo: `limiteBytesPorSeg` opcional em `baixarConferido` (acelerador no pipeline: atrasa o fluxo, nunca descarta nem altera bytes; o hash continua sendo conferido) e repasse por `pedirArquivo` e `espalhar`. Teste: download de N bytes com limite leva ≥ tempo esperado; sem limite, igual a antes; conteúdo e hash intactos.
2. Preferência `limiteBandaMBs` (padrão 10, inteiro 1–1000), validação, leitura tolerante (arquivo torto volta a 10), campo `banda` na tela. Testes em preferencias/configuracoes.
3. Tela: Configurações › Backups › "Limite de banda para atualizar o mundo (MB/s)". Valor lido a cada rodada (vale na hora, sem reiniciar).
4. Ligação: `criarEspalhador` recebe `limiteBytesPorSeg()`; `ligarEspalhar` lê da preferência.
5. Teste de integração: 3 PCs simulados (host + 2) chegam à versão M com o limite ligado, sem tocar o mundo do host.

## Fora do alcance
Nuvem não é fonte (decidido 31/10). Sem dependência nova.

# Plano app-2.1 — Tela de backups e restaurar

Método: M5 (+M1, +M7 na listagem). Risco ALTO (restaurar troca o mundo). Mundos só de teste. Decisão da Máxima: coluna
"De quem" = "Este PC" (manifesto sem autor; formato do pacote NÃO muda).

1. Núcleo `backup/listar.ts`: `listarBackups(pastaBackups)` lê o `manifesto.json` (1ª entrada) de cada `*.tar.gz`,
   devolve nome, data (`criadoEm`), tamanho (soma de `arquivos[].tamanho`), versão; mais novo primeiro. Pacote ilegível
   é ignorado (nunca apaga nada). Teste primeiro (mundo inventado, pacote quebrado, `.parcial` ignorado).
2. Cola `main/backups.ts` (injeção de dependências, como `inicio.ts`): `estado()` = lista + `bloqueado` (servidor
   rodando); `restaurar(nome)` só aceita nome que está na lista (sem caminho vindo da tela), recusa com servidor no ar,
   e chama o `restaurarBackup` do núcleo. Teste primeiro.
3. `main/deps-backups.ts`: liga o real. Restaurar pega a trava pelo `Renovador` do núcleo (renova durante a cópia),
   chama `restaurarBackup` (sha256 do pacote lido na hora; troca, hash e backup do atual são do núcleo) e solta a trava.
4. IPC `sabre:backups:listar` / `:restaurar` com `veioDaPagina`, nome validado como texto; ponte em `preload.cts` e `ponte.ts`.
5. Tela: seção Backups em `ui/index.html` + `ui/backups.ts` + CSS pelos tokens: lista (data, tamanho, de quem),
   "Restaurar" por linha, confirmação na própria página (igual a "Parar o servidor", clicável no E2E) com nome, data e o
   aviso de que o estado atual vira backup antes; botão desligado com servidor rodando; progresso; erro em pt-BR.
6. E2E (cenário com mundo e backup inventados no fake): cancelar não muda o mundo; confirmar troca o mundo.
7. Prova: `npm run vistoria`; `impeccable` audit/polish.

Fora: formato do manifesto, "de quem" de backup recebido (sync), pasta/mundo configuráveis na tela (app-1.3; por ora
`SABRE_PASTA_BACKUPS` e `SABRE_PASTA_MUNDO`, como as demais), lógica de restauração/hash/trava (já no núcleo).

# Plano hostmel-3.1c — Configurações › Servidor › Versão (só o dono)

Método: M5 (+M1). Risco ALTO (grava a versão que define o que todos os hosts sobem). Mundos só de teste.

1. `main/versao.ts` (cola com dependências injetadas, como `grupo.ts`; sem DOM, testável): `estado()` (dono? lista
   da Mojang + versão atual do cartório), `opcoes(versao)` (só ao selecionar), `gravar(versao)`.
   Reaproveita `listarVersoes`, `opcoesDaVersao`, `planoDaVersao` do núcleo e `lerConfigGrupo`/`gravarConfigGrupo`
   do cliente. A janela só manda o texto da versão; o main revalida: dono, versão está na lista oficial, servidor
   parado neste PC. O sha1 vem do plano oficial, nunca da janela. 409/403 do cartório: mensagem dele (pt-BR).
2. Testes primeiro (`versao.test.ts`, ponte falsa): 1.21.1 = NeoForge + Connector; versão sem Connector não oferece
   Fabric+Forge; não-dono não lista nem grava; servidor rodando recusa antes de ir ao cartório; versão fora da lista e
   texto estranho não chegam ao cartório; 409 mostra a mensagem do cartório; 1.20.1 não é oferecida como pronta com mods.
3. IPC `sabre:versoes:estado|opcoes|gravar` com `veioDaPagina`; ponte em `preload.cts` e `ponte.ts`; fio real em
   `principal.ts` (cliente do ambiente) e falso para o E2E em `fake-e2e.ts`.
4. Tela: fieldset Servidor › Versão em `index.html` (só aparece ao dono), `configuracoes.ts`: lista, opções só ao
   selecionar, confirmação antes de gravar (aviso de backup recente), estado "Gravando…", erro do app.
5. Backup: não existe ação "fazer backup agora" reutilizável; a tela só avisa em uma frase (decisão da Máxima).
6. Prova: `npm run vistoria`; `impeccable` audit/polish.

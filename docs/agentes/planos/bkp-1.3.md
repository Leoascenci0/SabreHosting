# Plano bkp-1.3 — Backup consistente com o servidor rodando

Método: M1 (reaproveita `salvarSeguro` de `servidor/comandos.ts` e `criarPacote` de `backup/pacote.ts`) + M7 pequeno
(agendador). Risco alto: regra de ouro 2 (nunca ler o mundo com o servidor gravando) e regra 4 (nunca sobrescrever backup).
Não escreve: outro fluxo de `save-off`/`save-on`, outro empacotador, rotação (bkp-2.1), envio ao cartório (cart-1.4).

1. Testes primeiro (falham) em `backup/agendador.test.ts`, com servidor falso (emissor de eventos) e mundo de teste de 1 MB:
   - ordem: `save-off` → `save-all flush` → (só depois do "Saved the game") `criarPacote` → `save-on`;
   - `save-on` volta mesmo se o pacote falhar, e o erro sai em pt-BR;
   - servidor que cai durante a cópia: pacote descartado, erro em pt-BR;
   - nome `<data>-v<versao>.tar.gz`; nunca por cima de backup existente;
   - agendador: um backup por vez (2º disparo pula e avisa), só com servidor "pronto", intervalo configurável
     (padrão 10 min, valor inválido recusado), falha de um backup não para os seguintes, `parar()` limpa o timer e espera
     o backup em curso.
2. `fazerBackup({servidor, pastaDoMundo, pastaBackups, versao, epoca})` = `salvarSeguro(servidor, () => criarPacote(...))`;
   devolve `{caminho, sha256, tamanho, duracaoMs}`.
3. `agendarBackups({intervaloMin = 10, ...})` com relógio injetado; devolve `{parar()}`.
4. `npm run vistoria`; PR `Closes #44`.

Tela no app (item app-2.2): Configurações › Backups › Intervalo (padrão 10 min). Aqui só o parâmetro `intervaloMin`.

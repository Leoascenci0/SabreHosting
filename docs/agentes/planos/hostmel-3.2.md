# Plano hostmel-3.2 — Backup antes de trocar a versão do Minecraft

Método: M1 (reaproveitar). `criarPacote` do núcleo já faz o pacote fechado com hash; nada de backup novo.

1. `main/versao.ts`: `DepsVersao.backupAntes()`. `gravar` só chama `deps.gravar` depois dele; se lançar, devolve
   `{ok:false}` com o motivo em pt-BR e a versão não muda. Servidor rodando segue recusado antes de qualquer backup.
2. `main/deps-backups.ts`: `backupParado(o)` — servidor parado (e sem órfão vivo) → `criarPacote` do mundo parado em
   `pastaBackups` (regra 2: nunca com servidor rodando; regra 4: nunca sobrescreve, nunca apaga) e chama a rotação.
3. `main/principal.ts` (mínimo): liga `backupAntes` em `criarVersaoDoApp`. `fake-e2e.ts`: dep falsa.
4. `ui/configuracoes.ts`: botão mostra "Fazendo backup antes…" durante a troca.
5. "Mods pendentes": a tela já mostra o texto para versões sem hash; conferir e cobrir com teste se faltar.

Testes (falham antes): backup falha → versão não muda e mensagem; backup ok → grava depois dele (ordem);
servidor rodando → recusa sem backup nem gravação; backup real em mundo inventado.

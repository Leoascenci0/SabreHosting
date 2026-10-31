# Plano hostmel-3.3 — Acabamentos do backup antes de trocar a versão

Base be029a5. Método M1/M2 (reaproveita o bloqueio "restaurando" do início). Tela no app: Configurações › Servidor › Versão.

1. **Servidor não sobe durante a troca:** `criarVersao` expõe `trocando()` (verdadeiro de antes do backup até depois da
   gravação, inclusive nas falhas). `criarInicio` ganha a dep opcional `trocandoVersao` e `hospedar()` recusa com texto
   próprio. `principal.ts` liga os dois (o `versaoApp` é módulo, como o `backupsApp`).
   Testes: versão (`trocando()` fica verdadeiro durante o backup e volta a falso em sucesso e em falha) e início (recusa
   enquanto troca, volta a valer depois). Provas: sem `trocando()` ou sem a checagem no início, os testes falham.
2. **Colisão de nome do backup:** teste de `backupParado` com o pacote de mesmo nome já existente (relógio fixo): recusa
   e o backup antigo fica intacto (regra 4).
3. **Aviso "mods pendentes" (`SEM_HASH_MODS`):** o teste da 1.20.1 passa a conferir também o texto e que outras versões
   não o mostram.
4. **Texto "Fazendo backup antes…":** extraído para `ui/rotulo-versao.ts` (função pura) e testado; `configuracoes.ts` usa.

Fora: mudar o backup em si, o cartório ou o texto das outras telas.

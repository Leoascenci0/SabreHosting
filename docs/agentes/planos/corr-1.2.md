# Plano corr-1.2 — Vistoria local também como usuário comum

Método: M7 (script novo, ~40 linhas). Risco médio (só roda testes; não toca mundo, rede nem segredo).

1. Teste primeiro (`tests/infra/vistoria-comum.test.ts`): falha enquanto o script não existe.
   - Sem root (`SABRE_FALSO_UID=1000`): roda o comando direto e devolve o código de saída (`exit 7` → 7).
   - Como root de verdade (`skipIf` se não for root): comando que só passa como root (`test "$(id -u)" = 0`) FALHA no script;
     comando que exige usuário comum (`test "$(id -u)" != 0`) PASSA; a cópia fica em pasta temporária do usuário comum e é apagada.
2. `scripts/vistoria-comum.sh`: root → `git archive HEAD` para pasta temporária, `chown` ao usuário `teste` (`useradd -m` se faltar),
   `npm ci` e `npx vitest run` como esse usuário via `su`; devolve o código de saída; apaga a pasta ao sair.
   Variáveis só para teste: `SABRE_FALSO_UID`, `SABRE_COMUM_COMANDO`, `SABRE_COMUM_INSTALAR`.
3. `npm run vistoria:comum` em `package.json`.
4. Prova: script falha num teste que só passa como root e passa na `main` (rodada real como usuário comum); `npm run vistoria`.
5. PR descreve a linha para a Máxima acrescentar à regra do S-03 (a filha não edita `.claude/`).

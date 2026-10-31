# Plano drive-1.1a — Histórico longo numa pasta (copiar, SEM rotação)

Base 3df0f9c. Este item **não apaga nada** (rotação é o drive-1.1b, decisão do Eliel).

1. `packages/nucleo/src/backup/destinos/pasta.ts` — `copiarParaPasta(pacote, sha256, pasta)`: valida a pasta (entrada não
   confiável, S-07: absoluta, existente, diretório, não é a própria pasta de backups), copia para `<nome>.parcial`,
   confere o hash, renomeia. Nunca sobrescreve nome existente, nunca apaga nada além do próprio `.parcial`.
2. Pasta que some no meio: erro em pt-BR, `.parcial` limpo, backup local intacto (a falha só vira aviso).
3. Gancho: `iniciarAgendaReal` ganha `historicoLongo()` (lido a cada backup); após backup bom copia e avisa se falhar.
4. Preferências + tela: Configurações › Backups › "Histórico longo numa pasta" (liga + pasta), validada antes de gravar.
5. Testes (TDD) com mundo/arquivos de teste; `npm run vistoria`.

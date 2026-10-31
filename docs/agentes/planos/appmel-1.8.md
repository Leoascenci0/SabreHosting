# Plano appmel-1.8 — Backups: intervalo (ligar o agendador e expor o campo)

Corte da Máxima: só agendador + campo "Intervalo". Sem rotação, sem "Quantos guardar", sem apagar backup.

1. `preferencias.ts`: campo `intervaloBackupMin` (padrão 10, faixa 1–1440, torto volta ao padrão) + `validarIntervaloBackup`.
2. `configuracoes.ts`: aceita/valida o campo antes de gravar; chama `aplicarIntervaloBackup(min)` após salvar.
3. `agenda-backups.ts` (cola nova, pequena): ouve o estado do servidor; `pronto` liga `agendarBackups` (do núcleo, único
   caminho de backup = `fazerBackup`/`salvarSeguro`), `parando/parado/caiu` para; `reagendar` ao salvar novo intervalo.
4. `inicio.ts`: gancho opcional `aoServidor(servidor)` depois de hospedar; `principal.ts` liga tudo.
5. Tela: `Configurações › Backups › Intervalo` (minutos, dica da faixa, "Salvo.").
6. Testes (vitest) que falham antes + E2E "valor salvo muda o intervalo".
Não toca: `fazerBackup`, `salvarSeguro`, rotação, padrões de retenção.

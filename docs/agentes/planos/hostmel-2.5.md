# Plano hostmel-2.5 — Servidor órfão nunca fica solto

Issue #107 · base c5a6fcc · opção A do briefing (vigia).

## Conta de tempo (L-01)

- Cartório: prazo da trava 60 s, renovação a cada 20 s. Pior caso: o app morre logo antes de uma renovação, então a
  trava vence **~40 s** depois da morte (60 − 20).
- Vigia: percebe a morte pelo fim (EOF) do stdin (o Windows fecha o pipe quando o processo morre, inclusive por
  "Finalizar tarefa") → `save-all flush` (espera "Saved the game", prazo 10 s) → `stop` (espera sair, prazo 10 s) →
  só então mata o Java. Total ≤ ~20 s + o tempo de matar: sobram ≥ 20 s antes de a trava vencer.
- Caminhos de perda: app morre com `stop` já enviado (não repete save/stop, só espera sair e mata no prazo); Java
  que nunca confirma o save (para mesmo assim no prazo); Java que ignora `stop` (morto depois do save); app vivo mas
  travado (fora daqui: o renovador do app já trata); hibernação (PC inteiro pausa junto; ao voltar, o app vivo trata).

## Passos

1. `packages/nucleo/src/servidor/vigia.ts` (script Node, sem dependência): `vigia <prazoSalvarMs> <prazoPararMs>
   <java> <args…>`. Sobe o Java com stdio em pipe, 1ª linha = `[sabre-vigia] pid <n>` (ou `[sabre-vigia] falhou
   <msg>`), repassa saída e comandos, ignora EPIPE. EOF do stdin → passo acima. Sai com o código do Java.
2. `comandos.ts`: só exportar `SALVOU` (sem mudar comportamento).
3. `processo.ts`: o spawn passa a ser `process.execPath vigia.js …` com `ELECTRON_RUN_AS_NODE=1`; lê a 1ª linha
   (PID ou falha), mesma API (`close`, estados, avisos). Matar no prazo mata o Java pelo PID e o vigia.
   Teste: `vigiaArgs` (só testes) roda o `vigia.ts` direto com um gancho que resolve `.js` → `.ts`.
4. `apps/desktop/src/main/inicio.ts`: trava livre ou em nome deste PC com órfão vivo → estado "Parando o servidor…"
   (estado `eu` + `parando`, já existente) e reconfere a cada 1 s até ~30 s; sumiu → avisa a tela (Hospedar). Depois
   dos 30 s com órfão (ex.: órfão de versão antiga, sem vigia): dono = este PC volta ao estado de hoje (Jogar); trava
   livre segue sem oferecer Hospedar.
5. E2E `dono-eu-orfao`: passa a mostrar "Parando o servidor…" sem Hospedar.

## Provas (falham antes, passam depois)

- vigia: (a) fechar o stdin → `save-all flush` e `stop` chegam e o vigia sai em < 20 s; (b) falso que ignora `stop` →
  morto só depois do save; (c) parada normal (`stop` do app e depois EOF) não duplica save/stop; Java inexistente →
  linha de falha.
- processo: matar no prazo não deixa o Java vivo (PID).
- inicio: (d) órfão vivo não mostra Hospedar; órfão some → Hospedar; trava livre + órfão também espera.

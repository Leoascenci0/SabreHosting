# Plano appui-1.5 — Backups: lista legível e ações claras

Método: M5 (molde do 1.4) + M1 (reaproveitar `backups.ts`, `ha-quanto.ts`, `.lista-backups`, `.confirmacao`, e2e existente). Só interface.

## O que a ponte entrega hoje (conferido no código)
- `BackupDaTela` = nome, criadoEm, tamanho, dePc. O manifesto do pacote não guarda a origem, e o backup automático
  e o "antes de restaurar" usam o mesmo `nomeDoBackup` → **não há como saber a origem** sem mudar o núcleo.
- Não existe gatilho manual de backup (só o agendador do núcleo, que roda com o servidor pronto). Um botão novo
  tocaria o mundo (regra de ouro 2).
- "Cópia na pasta extra": só existe o aviso de falha (`avisoHistorico`); não há dado por backup.
→ **⏸️ P (decisão do Eliel)** no PR: "Fazer backup agora" e origem do backup. Não implementados.

## O que entra
1. `ha-quanto.ts`: nova `dataEmPalavras(iso, agora)` → "hoje 14:32", "ontem 09:10", "30/10/2026 18:05" (teste primeiro).
2. `backups.ts`: linha com data em palavras (título), "tamanho · Este PC"; confirmação cita data e diz que o estado
   atual é salvo antes; progresso visível ("Restaurando… não feche o app") com `aria-busy`; estado vazio com
   orientação (o que é backup e quando nasce); remove o "Voltar" visível (a barra lateral é a navegação), mantendo o
   botão escondido porque `navegacao.ts` o aciona por programa; foco inicial vai ao título da tela.
3. `index.html` / `tela.css`: título com `tabindex=-1`, barra de progresso indeterminada (respeita
   `prefers-reduced-motion`), estado vazio, claro/escuro pelos tokens.
4. Testes: unitário de `dataEmPalavras`; e2e: lista com data em palavras, vazio, confirmar mostra progresso;
   `navegacao.e2e` deixa de clicar o "Voltar" escondido e usa "Início" da barra.

## Fora
Servidor, mundo, trava, cartório, núcleo: intocados. Restaurar continua com confirmação e bloqueado com servidor ligado.

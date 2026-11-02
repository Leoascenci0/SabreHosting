# Plano appuimel-2.2 — Casca nova: barra superior, chip de estado, rodapé

Método: M5 (+M1 em navegacao.ts). Só apresentação; nenhum comportamento de backup/hospedar muda.

1. **Teste primeiro (falha antes):** regras puras `rotuloChip(estado)` em `navegacao-regras.ts` (testes unitários) e e2e
   novos em `navegacao.e2e.ts`: abas no alto, chip muda com o servidor falso e abre o Início, setas/Home/End,
   abas só ícone abaixo de 840 px, 720x480 sem rolagem horizontal, rodapé com versão e cartório.
2. **HTML:** `nav#barra` vira `header` superior (mantém `id="barra"`, `.item-barra`, `data-area`); nome do app à esquerda,
   chip `#chip-estado` (botão) à direita; `<footer id="rodape">` com versão, grupo ("—" se sem dado) e cartório.
3. **CSS:** `.janela` vira grade de 3 linhas (barra, conteúdo, rodapé); `.barra` em linha; `@media (max-width: 839px)`
   esconde o texto das abas (só ícone, `aria-label` mantém o nome); chip com cor + ícone + palavra por tom.
   `--largura-barra` sai de tokens.css e do teste de tokens; `docs/design-system.md` descreve a casca.
4. **TS:** `navegacao.ts` troca setas ↓/↑ por ←/→ também (já aceita ambas); chip clica em `ir("inicio")`.
   `tela.ts` preenche chip e rodapé dentro de `desenhar()` a partir do `EstadoInicio` já existente (sem chamada nova).
5. **Verificação:** `npm run build`, e2e, capturas claro/escuro em `docs/imagens/appuimel-2.2/`, `impeccable` audit/polish,
   `npm run vistoria`, PR.

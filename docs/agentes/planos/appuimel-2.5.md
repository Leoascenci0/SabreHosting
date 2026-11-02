# Plano appuimel-2.5 — Seção recolhível padrão e Backups v2

Método: M5 (+M1), sem IPC novo, sem regra de backup/restaurar mexida.

1. `ui/backups-resumo.ts`: função pura `resumoDeBackups(itens, agora, intervaloMin)` (quantos, último "há quanto", soma de
   tamanho, "a cada N min, com servidor pronto"); teste unitário primeiro (falha antes).
2. `EstadoBackups` ganha `intervaloMin?` (main/backups.ts lê `deps.intervaloMin?.()`; principal.ts liga a preferência).
3. `index.html`/`tela.css`: componente seção (`.secao`: cabeçalho com título, atalho "Ver tudo →" opcional e escondido,
   botão `aria-expanded` com seta); Backups usa para a lista. Resumo no topo (4 peças).
4. `backups.ts`: recolher/abrir lembrado em localStorage do renderer (try/catch; CSP não bloqueia localStorage).
5. `docs/design-system.md`: Componentes › Seção.
6. e2e: recolher/abrir, resumo bate com a lista, restaurar ainda pede confirmação; capturas claro/escuro.

Não escrever: IPC novo, varredura de disco, nova confirmação, rotação/agendador.

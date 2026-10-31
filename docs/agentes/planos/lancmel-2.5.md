# Plano — lancmel-2.5 + appmel-1.20 (mesma tela: Configurações)

**Base:** d720a63 · **Ramo:** roadmap/lancmel-2.5 · **Briefing:** docs/agentes/briefings/lancmel-2.5.md (no ramo roadmap/onda-2026-10-31-31)

## lancmel-2.5 — erro da ação preservado ao ler a lista de mods

- **Onde:** `apps/desktop/src/ui/configuracoes.ts`, `carregarMods` (catch, ~linha 371).
- **Mudança:** no `catch`, só mostrar "Não consegui ler a lista de mods agora." quando `preservarMensagens` for `false`. Com `true` (leitura feita logo após uma ação), o erro/aviso da ação fica.
- **Teste (E2E, `apps/desktop/e2e/configuracoes.e2e.ts`, dentro de "mods: aviso e erro antigos…" ou teste novo ao lado):**
  1. `falhaLer = true` **depois** de provocar um erro de ação (adicionar mod com link fora do cdn).
  2. Esperar a ação terminar e a leitura falhar.
  3. Conferir que `#mods-erro` segue com o texto da ação, não com "Não consegui ler…".
- **Regressão:** teste deve falhar antes da mudança (a mensagem de leitura sobrescreve a da ação) e passar depois.
- **Fora:** sem interruptor novo (`falhaLer` já existe em `apps/desktop/src/main/fake-e2e.ts`), sem teste unitário de UI.

## appmel-1.20 — "Convite copiado" anunciado a cada cópia

- **Onde:** `apps/desktop/src/ui/configuracoes.ts`, handler de `conviteCopiar` (~linha 246).
- **Mudança:** ao copiar, limpar `#convite-copiado` e reescrever "Convite copiado." logo depois (~100 ms), para que duas cópias seguidas mudem o conteúdo da região `role="status"` duas vezes.
- **Teste (E2E, padrão de `configuracoes.e2e.ts` ~linha 192):** `MutationObserver` sobre `#convite-copiado`; duas cópias seguidas produzem ≥2 mudanças de texto entre elas.
- **Regressão:** o teste falha antes (só 1 mudança na segunda cópia, texto já igual) e passa depois.
- **Fora:** sem região nova, sem elemento novo.

## Decisão consciente (revisão do QA)

**Primeiro erro visível vence durante a releitura.** Quando a tela relê a lista logo após uma ação (ou na espera de
"atualizando"), o erro de ação que já está na tela não é trocado pela falha de leitura. Só quando não há erro de ação
visível a falha de leitura aparece. Efeito colateral aceito: uma falha de leitura pode não aparecer enquanto um erro de
ação ainda estiver visível; o amigo vê a explicação da ação, que é a que ele acabou de provocar.

## Ordem de commits

1. Este plano (primeiro commit).
2. lancmel-2.5: teste E2E que falha → correção → passa.
3. appmel-1.20: teste E2E que falha → correção → passa.

## Verificação

- `npm run vistoria` → APROVADA (cola o resumo no PR).
- E2E: `npm run test:e2e -w apps/desktop` se o Electron rodar na nuvem; senão diz o que rodou.
- Se o worktree não achar `@sabrehosting/...`: `npm ci` no próprio worktree (S-05).
- Uma vistoria por vez (S-01).

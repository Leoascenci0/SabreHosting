# Briefing lancmel-2.5 + appmel-1.20 (lote de 2 itens miúdos, mesma tela) — Mods: erro da ação preservado · Convite copiado: anunciar a segunda cópia

BASE: d720a63e566ad69d26be580b001d6274db86c8dc · RAMO: roadmap/lancmel-2.5 · MODELO: haiku (MIÚDO: sim)
SKILLS: using-superpowers, qualidade-sabre, impeccable (audit/polish rápido)
LEIA: qualidade-sabre › references/interface.md; enxugar
Um commit por item (plano como primeiro commit, cobrindo os dois). Os dois mexem em `ui/configuracoes.ts` e `e2e/configuracoes.e2e.ts`.

## Item A — lancmel-2.5
TRIAGEM: M4 · ~3 linhas + ~30 E2E · baixo. Em `carregarMods` (apps/desktop/src/ui/configuracoes.ts:352, catch ~:371), envolver `mostrarErroMods("Não consegui ler…")` em `if (!preservarMensagens)`. E2E ("aviso e erro antigos", e2e/configuracoes.e2e.ts:299; interruptor `falhaLer` já existe em main/fake-e2e.ts:264): falhaLer=true, disparar ação com erro (adicionar com link fora do cdn), esperar ação e leitura, conferir que #mods-erro segue com o erro da ação. Sem teste unitário de UI (não existe), sem interruptor novo.
*Item:* no `catch` de `carregarMods`, não trocar a mensagem se `preservarMensagens` for `true`. **Tela no app:** Configurações › Grupo › "Mods do grupo". *Confirmação:* E2E: leitura falhando logo após ação com erro mantém o erro da ação.

## Item B — appmel-1.20
TRIAGEM: M4 · ~8 linhas + ~25 E2E · baixo. Handler de copiar (configuracoes.ts:246): ao copiar, limpar `#convite-copiado` e reescrever "Convite copiado." após ~100 ms (ou contador invisível). E2E (padrão em e2e/configuracoes.e2e.ts:192-196): MutationObserver conta ≥2 mudanças de texto entre duas cópias seguidas. Sem região nova nem elemento novo.
*Item:* copiar duas vezes seguidas repete o mesmo texto em `#convite-copiado` e o leitor de tela pode não anunciar de novo; limpar a região e reescrever a cada cópia. **Tela no app:** Configurações › Grupo › "Criar convite". *Confirmação:* e2e: duas cópias seguidas mudam o conteúdo da região entre as duas.

## Decisões que valem: nenhuma

## Critério de pronto
- [ ] Plano docs/agentes/planos/lancmel-2.5.md primeiro commit
- [ ] E2E novos que falham antes e passam depois (se o Playwright/Electron não rodar na nuvem, diga o que rodou)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo + Triagem/Segurança/Integridade/Enxugamento/Roteamento + **Tela no app:** + **Regressão:** (uma por item). PR diz `Refs lancmel-2.5, appmel-1.20`.

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem, mundo real, segredo.
## O que NÃO decidir: nada

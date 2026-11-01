# Briefing appmel-1.22 — Vigia fora do app.asar

BASE: 94c7c7203f505b4c2d32ea33a7293812c5675665 · RAMO: roadmap/appmel-1.22 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §integridade (vigia, regra de ouro 1) e §seguranca
TRIAGEM: M4 · ~25 linhas + teste · risco alto (vigia protege o mundo; nunca enfraquecer). processo.ts:393 usa new URL('./vigia.js', import.meta.url); criar função pura que troca 'app.asar' por 'app.asar.unpacked' no caminho (só quando o segmento é exatamente app.asar) e usar ali; electron-builder.json ganha asarUnpack só do vigia.js (e do que ele importa, confira). NÃO mudar o comportamento do vigia nem o fluxo de parada; empacotar de verdade fica [P]. Se não der para provar na nuvem só com teste da função + teste do JSON, pare e devolva ⏸️ com o motivo.

## Item (texto literal do roadmap)
- [ ] **1.22 — Vigia fora do `app.asar` (`asarUnpack`)**
  *O que fazer:* `processo.ts` sobe o vigia por `new URL("./vigia.js", import.meta.url)`; empacotado, esse caminho cai dentro do `app.asar`. Resolver o caminho trocando `app.asar` por `app.asar.unpacked` quando existir, e listar o `vigia.js` (e o que ele importa) em `asarUnpack` no `electron-builder.json`. Só entra se der para provar na nuvem (teste da função de caminho + conferência do JSON); empacotar de verdade fica **[P]**.
  *Arquivo:* `packages/nucleo/src/servidor/processo.ts`, `apps/desktop/electron-builder.json`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: caminho dentro de `app.asar` vira `app.asar.unpacked`; fora dele não muda. Instalador com servidor subindo **[P: PC Windows]**.
  *Origem:* app-3.1 · Backlog do milestone · máxima


## Decisões que valem para este item
nenhuma

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.22.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real dos amigos, qualquer segredo.

## O que NÃO decidir
nada

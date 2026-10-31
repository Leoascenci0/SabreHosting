# Briefing appmel-1.15 — Criar convite: anúncio para leitor de tela e nome duplicado

BASE: 46a3dcb0ba6b1c20ed2917a4780c65dd45970996 · RAMO: roadmap/appmel-1.15 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable (audit e polish)
LEIA: qualidade-sabre §1, §interface, §enxugar
TRIAGEM: M1 (reaproveitar `role="status"` de index.html + um só `nomeNaRede`) · ~40 linhas · risco médio. Reaproveitar `main/grupo.ts:60` `nomeNaRede` como único normalizador (exportar de `packages/nucleo`; antes confirmar que o renderer resolve o pacote, senão a UI pede o preview ao main); padrão `aria-live` de `index.html:330` (`grupo-aviso`); `ui/configuracoes.ts:204-214` (`nomeComoFica`) sai. NÃO escrever: segundo normalizador, mudança na regex `^[a-z0-9][a-z0-9-]{0,31}$`, mudança no cartório (já conferido: `services/cartorio/src/convite.test.ts:601` confirma "vale uma vez"), rota IPC nova só para preview. Passos: (1) mover normalizador + teste; (2) `<p role="status" id="convite-copiado">` junto de `#convite-copiar`, escrever "Copiado" em `configuracoes.ts:259`, limpar ao criar outro convite; (3) e2e `configuracoes.e2e.ts:193` confere o texto no status. Prova: teste de `nomeNaRede` (acento, símbolos, 32 caracteres, vazio); e2e do status; `grupo.test.ts` verde.

## Item (texto literal do roadmap)
**1.15 — Criar convite: anúncio para leitor de tela e nome duplicado**
*O que fazer:* o "Copiado" não está numa região `aria-live`; `nomeNaRede` (main) e `nomeComoFica` (UI) são duplicados e podem divergir; conferir que "vale uma vez" bate com o cartório (uso único).
*Arquivo:* `apps/desktop/src/ui/configuracoes.ts`, `index.html`, `main/grupo.ts`
**Tela no app:** Configurações › Grupo › "Criar convite".
*Confirmação:* teste/e2e: região anuncia a cópia; um só normalizador de nome.

## Decisões que valem para este item
nenhuma

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.15.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); PR com as linhas `Regressão:` e `Tela no app:` (S-10)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real dos amigos, qualquer segredo.

## O que NÃO decidir
nada
